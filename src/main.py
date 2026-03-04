"""Entry-point script that wires together the trading agent, data feeds, and API."""

import sys
import argparse
import pathlib
sys.path.append(str(pathlib.Path(__file__).parent.parent))
from src.strategies.strategy_factory import StrategyFactory
from src.indicators.technical_analysis_client import TechnicalAnalysisClient
from src.config_loader import CONFIG, get_leverage_for_asset
from src.pair_hunter import PairHunter, get_best_pairs
from src.webhook_notifier import WebhookNotifier
import asyncio
import logging
import time
from collections import deque, OrderedDict
from datetime import datetime, timezone, timedelta
import math  # For Sharpe
from dotenv import load_dotenv
import os
import json
import fnmatch
from aiohttp import web, ClientSession, ClientTimeout
try:
    import httpx
except ImportError:
    httpx = None  # httpx may not be installed, handle gracefully
from src.utils.formatting import format_number as fmt, format_size as fmt_sz
from src.utils.prompt_utils import json_default, round_or_none, round_series
from src.utils.trading_settings import get_trading_settings, get_max_leverage_for_asset, calculate_tp_sl_prices, calculate_allocation_usd

load_dotenv()

# Store original stdout/stderr BEFORE creating handlers (Railway logging fix)
# This ensures handlers write to the original streams, not redirected ones
original_stdout = sys.stdout
original_stderr = sys.stderr

# Create a log file handler that captures all output
log_file_path = "trading_agent.log"

# Remove existing handlers to avoid duplicates
logging.getLogger().handlers = []

# Create file handler for comprehensive logging
file_handler = logging.FileHandler(log_file_path, mode='a', encoding='utf-8')
file_handler.setLevel(logging.DEBUG)
file_formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
file_handler.setFormatter(file_formatter)

# Railway logging fix: Route INFO/DEBUG/WARNING to stdout, ERROR/CRITICAL to stderr
# This ensures Railway correctly classifies log levels instead of marking everything as error
# Railway treats: stdout -> "info", stderr -> "error"
# WARNING is not an error, so it should go to stdout (shown as "info" in Railway)
class WarningAndBelowFilter(logging.Filter):
    """Filter to allow DEBUG, INFO, and WARNING level logs (but not ERROR/CRITICAL)."""
    def filter(self, record):
        return record.levelno <= logging.WARNING

# Handler for INFO/DEBUG/WARNING logs -> stdout (Railway will classify as "info")
stdout_handler = logging.StreamHandler(original_stdout)
stdout_handler.setLevel(logging.DEBUG)
stdout_handler.addFilter(WarningAndBelowFilter())
stdout_handler.setFormatter(file_formatter)

# Handler for ERROR/CRITICAL logs -> stderr (Railway will classify as "error")
stderr_handler = logging.StreamHandler(original_stderr)
stderr_handler.setLevel(logging.ERROR)
stderr_handler.setFormatter(file_formatter)

# Configure root logger
logger = logging.getLogger()
logger.setLevel(logging.DEBUG)
logger.addHandler(file_handler)
logger.addHandler(stdout_handler)
logger.addHandler(stderr_handler)

# Suppress verbose DEBUG logs from HTTP/2 libraries (httpx, hyper, h2, httpcore)
# These libraries generate very verbose protocol-level logs that aren't useful for normal operation
noisy_libraries = [
    'httpx', 'hyper', 'h2', 'httpcore', 'hpack', 'hstspreload',
    'urllib3.connectionpool', 'urllib3.util.retry', 'requests.packages.urllib3'
]
for lib_name in noisy_libraries:
    lib_logger = logging.getLogger(lib_name)
    lib_logger.setLevel(logging.WARNING)  # Only show WARNING and above from these libraries

# Redirect print statements to logging
# Note: Handlers use original_stdout/stderr, so print() -> logger -> handlers -> original streams (no recursion)
class PrintToLog:
    """Redirect print() calls to logging."""
    def write(self, text):
        if text.strip():  # Only log non-empty lines
            logger.info(text.strip())
    
    def flush(self):
        pass

# Redirect stdout to capture print() statements as INFO logs
# This goes through our logging handlers which write to the original stdout/stderr
sys.stdout = PrintToLog()
# Don't redirect stderr - keep it for actual errors and WARNING/ERROR logs

logging.info("=" * 80)
logging.info("Trading Agent Starting")
logging.info("=" * 80)


def clear_terminal():
    """Clear the terminal screen on Windows or POSIX systems."""
    os.system('cls' if os.name == 'nt' else 'clear')


def get_interval_seconds(interval_str):
    """Convert interval strings like '5m', '1h', '1hr', or '1d' to seconds."""
    interval_str = interval_str.strip().lower()  # Normalize input
    
    if interval_str.endswith('m'):
        return int(interval_str[:-1]) * 60
    elif interval_str.endswith('h') or interval_str.endswith('hr'):
        # Handle both 'h' and 'hr' formats (e.g., '1h' or '1hr')
        if interval_str.endswith('hr'):
            return int(interval_str[:-2]) * 3600
        else:
            return int(interval_str[:-1]) * 3600
    elif interval_str.endswith('d'):
        return int(interval_str[:-1]) * 86400
    else:
        raise ValueError(f"Unsupported interval: {interval_str}. Supported formats: '5m', '1h', '1hr', '1d', etc.")

def main():
    """Parse CLI args, bootstrap dependencies, and launch the trading loop."""
    try:
        clear_terminal()
    except Exception as e:
        print(f"Warning: Could not clear terminal: {e}", file=original_stderr)
    parser = argparse.ArgumentParser(description="LLM-based Trading Agent")
    parser.add_argument("--assets", type=str, nargs="+", required=False, help="Assets to trade, e.g., BTC ETH")
    parser.add_argument("--interval", type=str, required=False, help="Interval period, e.g., 1h")
    args = parser.parse_args()

    # Allow assets/interval via .env (CONFIG) if CLI not provided
    from src.config_loader import CONFIG
    assets_env = CONFIG.get("assets")
    interval_env = CONFIG.get("interval")
    if (not args.assets or len(args.assets) == 0) and assets_env:
        # Support space or comma separated
        if "," in assets_env:
            args.assets = [a.strip() for a in assets_env.split(",") if a.strip()]
        else:
            args.assets = [a.strip() for a in assets_env.split(" ") if a.strip()]
    if not args.interval and interval_env:
        args.interval = interval_env

    if not args.assets or not args.interval:
        parser.error("Please provide --assets and --interval, or set ASSETS and INTERVAL in .env")

    # Initialize multi-exchange manager for simultaneous trading
    taapi = TechnicalAnalysisClient()
    exchange_name = CONFIG.get("exchange", "aster").lower()
    
    # Check if multi-exchange mode is enabled
    use_multi_exchange = CONFIG.get("MULTI_EXCHANGE_MODE", "false").lower() == "true"
    
    if use_multi_exchange:
        # Multi-exchange mode: trade on multiple exchanges simultaneously
        from src.trading.multi_exchange_manager import MultiExchangeManager
        exchange_manager = MultiExchangeManager()
        logging.info("🌐 Multi-exchange mode enabled - trading on multiple exchanges simultaneously")
        
        # For backward compatibility, set a primary exchange
        # Use the first available exchange as primary
        primary_exchange_name = exchange_manager.list_exchanges()[0] if exchange_manager.list_exchanges() else None
        if primary_exchange_name:
            exchange = exchange_manager.exchanges[primary_exchange_name]
            hyperliquid = exchange  # Backward compatibility
            logging.info(f"📌 Primary exchange (for compatibility): {primary_exchange_name}")
        else:
            raise ValueError("No exchanges available in multi-exchange mode")
    else:
        # Single exchange mode (original behavior)
        if exchange_name == "aster":
            from src.trading.aster_api import AsterAPI
            try:
                exchange = AsterAPI()
                hyperliquid = exchange  # Backward compatibility alias
                logging.info(f"✅ Using Aster DEX (default)")
            except ValueError as e:
                logging.error(f"❌ Failed to initialize Aster: {e}")
                logging.info("💡 Falling back to Binance...")
                from src.trading.binance_api import BinanceAPI
                try:
                    exchange = BinanceAPI()
                    exchange_name = "binance"
                    testnet = CONFIG.get("binance_testnet", False)
                    logging.info(f"✅ Using Binance Futures ({'testnet' if testnet else 'mainnet'})")
                except ValueError as e2:
                    logging.error(f"❌ Failed to initialize Binance: {e2}")
                    raise ValueError(f"Failed to initialize any exchange. Aster: {e}, Binance: {e2}")
        elif exchange_name == "binance":
            from src.trading.binance_api import BinanceAPI
            try:
                exchange = BinanceAPI()
                testnet = CONFIG.get("binance_testnet", False)
                logging.info(f"✅ Using Binance Futures ({'testnet' if testnet else 'mainnet'})")
            except ValueError as e:
                logging.error(f"❌ Failed to initialize Binance: {e}")
                raise ValueError(f"Binance initialization failed: {e}")
        else:
            raise ValueError(f"Unknown exchange: {exchange_name}. Use 'aster' or 'binance'")
        
        exchange_manager = None
    
    # Use 'exchange' as the variable name throughout (aliased for backward compatibility)
    hyperliquid = exchange  # Keep for backward compatibility in code
    
    # Initialize trading strategy using factory
    strategy_name = CONFIG.get("strategy")
    strategy_mode = "AUTO" if strategy_name and strategy_name.lower() == "auto" else "MANUAL"
    
    try:
        strategy = StrategyFactory.get_strategy(strategy_name)
        if strategy_mode == "AUTO":
            logging.info(f"🤖 Strategy Mode: AUTO - LLM will select best strategy based on market conditions")
        else:
            selected_name = strategy_name if strategy_name else "default (LLM Trend)"
            logging.info(f"🎯 Strategy Mode: MANUAL - Using strategy: {selected_name}")
            logging.info(f"   Strategy Class: {strategy.get_name()}")
    except ValueError as e:
        logging.error(f"❌ Strategy initialization failed: {e}")
        logging.info("💡 Falling back to default strategy...")
        strategy = StrategyFactory.get_strategy("default")
        strategy_mode = "MANUAL"
        logging.info(f"🎯 Strategy Mode: MANUAL - Using strategy: default (LLM Trend)")
    
    # For backward compatibility, keep 'agent' variable name
    agent = strategy

    # Fetch and display wallet balance on startup
    async def check_wallet_balance():
        try:
            if exchange_name == "aster":
                user_address = exchange.user_address
                signer_address = exchange.signer_address
                logging.info(f"📍 User Address (main): {user_address}")
                logging.info(f"📍 Signer Address (API): {signer_address}")
                logging.info(f"🔗 View on Aster: https://www.asterdex.com/en")
            state = await hyperliquid.get_user_state()
            balance = state.get('balance', 0)
            total_value = state.get('total_value', 0)
            positions_count = len(state.get('positions', []))
            
            logging.info(f"💰 Account Balance: ${balance:.2f}")
            logging.info(f"💵 Total Account Value: ${total_value:.2f}")
            logging.info(f"📈 Open Positions: {positions_count}")
            
            if balance == 0 and total_value == 0:
                logging.warning("⚠️  WARNING: Wallet balance is $0.00 - Make sure you have funds in your wallet!")
            elif balance < 10:
                logging.warning(f"⚠️  WARNING: Low balance (${balance:.2f}) - Consider adding more funds for trading")
            
            # Reminder about API wallet authorization
            if exchange_name == "aster":
                logging.info("💡 Note: Make sure your API wallet is authorized in Aster dashboard")
                logging.info("   If trades fail, check that the API wallet has proper permissions")
            elif exchange_name == "binance":
                logging.info("💡 Note: Make sure your Binance API keys have Futures trading permissions enabled")
                logging.info("   If trades fail, check that your API keys have the correct permissions in Binance settings")
            
            # Show trading status
            trading_enabled = CONFIG.get("trading_enabled", True)
            if trading_enabled:
                logging.info("✅ TRADING ENABLED: Agent will execute new trades and manage positions")
            else:
                logging.info("⏸️  TRADING PAUSED: Agent will monitor positions only (no new entries)")
                logging.info("   Set TRADING_ENABLED=true in Railway/environment to resume trading")
        except Exception as e:
            logging.error(f"❌ Failed to fetch wallet balance on startup: {e}")
            logging.warning("⚠️  Trading agent will continue, but verify your wallet connection")
    
    # Run the balance check synchronously before starting the async server
    asyncio.run(check_wallet_balance())

    start_time = datetime.now(timezone.utc)
    invocation_count = 0
    trade_log = []  # For Sharpe: list of returns
    active_trades = []  # {'asset','is_long','amount','entry_price','tp_oid','sl_oid','exit_plan'}
    recent_events = deque(maxlen=200)
    diary_path = "diary.jsonl"
    pair_hunter_stats_path = "pair_hunter_stats.json"
    initial_account_value = None
    # Perp mid-price history sampled each loop (authoritative, avoids spot/perp basis mismatch)
    price_history = {}
    pair_hunter_stats = {}

    logging.info(f"Starting trading agent for assets: {args.assets} at interval: {args.interval}")

    def add_event(msg: str):
        """Log an informational event and push it into the recent events deque."""
        logging.info(msg)
        recent_events.append({"timestamp": datetime.now(timezone.utc).isoformat(), "message": msg})

    def _load_pair_hunter_stats_local():
        """Load local fallback pair-hunter performance stats."""
        nonlocal pair_hunter_stats
        try:
            if os.path.exists(pair_hunter_stats_path):
                with open(pair_hunter_stats_path, "r", encoding="utf-8") as f:
                    loaded = json.load(f)
                if isinstance(loaded, dict):
                    pair_hunter_stats = loaded
                    add_event(f"📚 Loaded Pair Hunter performance stats for {len(pair_hunter_stats)} assets")
        except Exception as e:
            logging.warning(f"Could not load pair_hunter_stats.json: {e}")
            pair_hunter_stats = {}

    def _save_pair_hunter_stats_local():
        """Persist local fallback pair-hunter performance stats."""
        try:
            with open(pair_hunter_stats_path, "w", encoding="utf-8") as f:
                json.dump(pair_hunter_stats, f, default=json_default)
        except Exception as e:
            logging.warning(f"Could not save pair_hunter_stats.json: {e}")

    def _get_dashboard_api_url() -> str:
        return (
            os.getenv("NEXT_PUBLIC_API_URL")
            or os.getenv("NEXT_PUBLIC_BASE_URL")
            or os.getenv("DASHBOARD_URL")
            or CONFIG.get("NEXT_PUBLIC_API_URL")
            or CONFIG.get("next_public_base_url")
            or "http://localhost:3001"
        )

    async def _load_pair_hunter_stats():
        """Load pair-hunter performance stats from dashboard DB API (fallback to local file)."""
        nonlocal pair_hunter_stats
        api_url = _get_dashboard_api_url()
        try:
            async with ClientSession() as session:
                async with session.get(
                    f"{api_url}/api/pair-hunter/stats",
                    timeout=ClientTimeout(total=8)
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        if isinstance(data, dict) and isinstance(data.get("stats"), dict):
                            pair_hunter_stats = data["stats"]
                            add_event(f"📚 Loaded Pair Hunter stats from DB for {len(pair_hunter_stats)} assets")
                            _save_pair_hunter_stats_local()
                            return
                    logging.warning(f"Pair Hunter DB stats fetch returned status {resp.status}, using local fallback")
        except Exception as e:
            logging.warning(f"Could not load Pair Hunter stats from DB API: {e}")
        _load_pair_hunter_stats_local()

    async def _upsert_pair_hunter_stat_to_db(asset: str, stat_row: dict):
        """Persist a single pair stat to dashboard DB API."""
        api_url = _get_dashboard_api_url()
        payload = {
            "asset": asset,
            "stats": stat_row
        }
        try:
            async with ClientSession() as session:
                async with session.post(
                    f"{api_url}/api/pair-hunter/stats",
                    json=payload,
                    timeout=ClientTimeout(total=8)
                ) as resp:
                    if resp.status not in (200, 201):
                        body = await resp.text()
                        logging.warning(f"Pair Hunter DB upsert failed ({resp.status}): {body[:200]}")
        except Exception as e:
            logging.warning(f"Could not upsert Pair Hunter stat to DB API: {e}")

    async def _record_pair_hunter_outcome(asset: str, pnl_usd: float, pnl_percent: float, close_reason: str):
        """Update win/loss + expectancy metrics for a closed trade asset."""
        key = (asset or "").upper().strip()
        if not key:
            return
        try:
            pnl_usd = float(pnl_usd or 0.0)
        except Exception:
            pnl_usd = 0.0
        try:
            pnl_percent = float(pnl_percent or 0.0)
        except Exception:
            pnl_percent = 0.0

        stats = pair_hunter_stats.get(key, {})
        total_trades = int(stats.get("total_trades", 0) or 0) + 1
        wins = int(stats.get("wins", 0) or 0) + (1 if pnl_usd > 0 else 0)
        losses = int(stats.get("losses", 0) or 0) + (1 if pnl_usd <= 0 else 0)
        total_pnl_usd = float(stats.get("total_pnl_usd", 0.0) or 0.0) + pnl_usd
        total_pnl_percent = float(stats.get("total_pnl_percent", 0.0) or 0.0) + pnl_percent
        win_rate = (wins / total_trades) * 100 if total_trades > 0 else 0.0
        expectancy_usd = total_pnl_usd / total_trades if total_trades > 0 else 0.0
        expectancy_percent = total_pnl_percent / total_trades if total_trades > 0 else 0.0

        pair_hunter_stats[key] = {
            "total_trades": total_trades,
            "wins": wins,
            "losses": losses,
            "win_rate": round(win_rate, 2),
            "total_pnl_usd": round(total_pnl_usd, 4),
            "total_pnl_percent": round(total_pnl_percent, 4),
            "expectancy_usd": round(expectancy_usd, 4),
            "expectancy_percent": round(expectancy_percent, 4),
            "data_fail_count": 0,  # Reset TA data failures after a completed trade cycle
            "excluded_until": None,
            "exclusion_reason": "",
            "last_close_reason": close_reason,
            "last_updated": datetime.now(timezone.utc).isoformat()
        }
        _save_pair_hunter_stats_local()
        await _upsert_pair_hunter_stat_to_db(key, pair_hunter_stats[key])
        add_event(
            f"📊 Pair Hunter stats {key}: trades={total_trades}, win_rate={win_rate:.1f}%, "
            f"expectancy=${expectancy_usd:.2f}/trade"
        )

    def _is_pair_temporarily_excluded(asset: str) -> tuple[bool, str]:
        """Return exclusion status for an asset based on excluded_until timestamp."""
        key = (asset or "").upper().strip()
        if not key:
            return False, ""
        stats = pair_hunter_stats.get(key, {})
        excluded_until_raw = stats.get("excluded_until")
        if not excluded_until_raw:
            return False, ""
        try:
            excluded_until = datetime.fromisoformat(str(excluded_until_raw).replace("Z", "+00:00"))
            if excluded_until.tzinfo is None:
                excluded_until = excluded_until.replace(tzinfo=timezone.utc)
            now_utc = datetime.now(timezone.utc)
            if excluded_until > now_utc:
                remaining_mins = int((excluded_until - now_utc).total_seconds() // 60)
                return True, f"{max(1, remaining_mins)}m remaining"
            # exclusion expired; clear it
            stats["excluded_until"] = None
            stats["exclusion_reason"] = ""
            stats["data_fail_count"] = 0
            pair_hunter_stats[key] = stats
            _save_pair_hunter_stats_local()
            return False, ""
        except Exception:
            return False, ""

    async def _record_pair_hunter_data_failure(asset: str, reason: str):
        """Track TA data failures and temporarily exclude repeated offenders."""
        key = (asset or "").upper().strip()
        if not key:
            return

        fail_threshold = int(CONFIG.get("pair_hunter_data_fail_threshold", 3) or 3)
        cooldown_minutes = int(CONFIG.get("pair_hunter_exclusion_cooldown_minutes", 180) or 180)
        now_utc = datetime.now(timezone.utc)

        stats = pair_hunter_stats.get(key, {})
        fail_count = int(stats.get("data_fail_count", 0) or 0) + 1
        stats["data_fail_count"] = fail_count
        stats["last_data_error"] = reason
        stats["last_updated"] = now_utc.isoformat()

        if fail_count >= fail_threshold:
            excluded_until = now_utc + timedelta(minutes=cooldown_minutes)
            stats["excluded_until"] = excluded_until.isoformat()
            stats["exclusion_reason"] = f"TA data unavailable ({reason})"
            add_event(
                f"🚫 Pair Hunter excluding {key} for {cooldown_minutes}m "
                f"(data failures: {fail_count}/{fail_threshold})"
            )

        pair_hunter_stats[key] = stats
        _save_pair_hunter_stats_local()
        await _upsert_pair_hunter_stat_to_db(key, stats)

    async def _record_pair_hunter_data_success(asset: str):
        """Clear temporary data-failure counters when symbol data is valid again."""
        key = (asset or "").upper().strip()
        if not key:
            return
        stats = pair_hunter_stats.get(key, {})
        if int(stats.get("data_fail_count", 0) or 0) == 0 and not stats.get("excluded_until"):
            return
        stats["data_fail_count"] = 0
        stats["excluded_until"] = None
        stats["exclusion_reason"] = ""
        stats["last_data_error"] = ""
        stats["last_updated"] = datetime.now(timezone.utc).isoformat()
        pair_hunter_stats[key] = stats
        _save_pair_hunter_stats_local()
        await _upsert_pair_hunter_stat_to_db(key, stats)

    def _rank_hunted_assets_by_performance(hunted_assets: list[str]) -> list[str]:
        """Re-rank/filter hunted assets using historical trade outcomes."""
        if not hunted_assets:
            return hunted_assets

        min_trades = int(CONFIG.get("pair_hunter_perf_min_trades", 3) or 3)
        filter_min_trades = int(CONFIG.get("pair_hunter_perf_filter_min_trades", 6) or 6)
        filter_min_win_rate = float(CONFIG.get("pair_hunter_perf_filter_min_win_rate", 25.0) or 25.0)
        filter_min_expectancy_usd = float(CONFIG.get("pair_hunter_perf_filter_min_expectancy_usd", -1.0) or -1.0)

        filtered_assets = []
        for asset in hunted_assets:
            key = (asset or "").upper().strip()
            stats = pair_hunter_stats.get(key, {})
            is_excluded, detail = _is_pair_temporarily_excluded(key)
            if is_excluded:
                add_event(f"🚫 Pair Hunter skipped excluded asset {key} ({detail})")
                continue
            total_trades = int(stats.get("total_trades", 0) or 0)
            win_rate = float(stats.get("win_rate", 0.0) or 0.0)
            expectancy_usd = float(stats.get("expectancy_usd", 0.0) or 0.0)
            should_filter = (
                total_trades >= filter_min_trades
                and win_rate < filter_min_win_rate
                and expectancy_usd < filter_min_expectancy_usd
            )
            if should_filter:
                add_event(
                    f"🚫 Pair Hunter filtered {key} from hunt list "
                    f"(trades={total_trades}, win_rate={win_rate:.1f}%, expectancy=${expectancy_usd:.2f})"
                )
                continue
            filtered_assets.append(key)

        def _rank_tuple(asset: str):
            stats = pair_hunter_stats.get(asset, {})
            total_trades = int(stats.get("total_trades", 0) or 0)
            win_rate = float(stats.get("win_rate", 0.0) or 0.0)
            expectancy_usd = float(stats.get("expectancy_usd", 0.0) or 0.0)
            if total_trades < min_trades:
                return (0, 0.0, 0.0)  # preserve newer/unknown pairs without penalty
            return (1, win_rate, expectancy_usd)

        ranked = sorted(filtered_assets, key=_rank_tuple, reverse=True)
        return ranked

    # Initialize webhook notifier for external alerts (WhatsApp, Discord, etc.)
    webhook_url = CONFIG.get("webhook_url")
    enable_webhook = CONFIG.get("enable_webhook_notifications", False)
    telegram_bot_token = CONFIG.get("telegram_bot_token")
    telegram_chat_id = CONFIG.get("telegram_chat_id")
    webhook_notifier = WebhookNotifier(
        webhook_url if enable_webhook else None,
        telegram_bot_token=telegram_bot_token if enable_webhook else None,
        telegram_chat_id=telegram_chat_id if enable_webhook else None,
    )
    has_native_telegram = bool(telegram_bot_token and telegram_chat_id)
    if enable_webhook and (webhook_url or has_native_telegram):
        channel_desc = []
        if webhook_url:
            channel_desc.append("WEBHOOK_URL")
        if has_native_telegram:
            channel_desc.append("native Telegram")
        add_event(f"🔔 Notifications enabled via {', '.join(channel_desc)}.")
    elif enable_webhook and not webhook_url and not has_native_telegram:
        add_event("⚠️ Notifications enabled but no valid channel configured (set WEBHOOK_URL or TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID).")
    else:
        add_event("🔕 Notifications disabled (ENABLE_WEBHOOK_NOTIFICATIONS=false).")

    def _build_position_sizing_note(trading_settings: dict, default_leverage: int, per_asset_leverage: dict = None) -> str:
        """Build position sizing note for LLM context - ALWAYS uses margin mode."""
        margin_per_position = trading_settings.get("margin_per_position")
        max_positions = trading_settings.get("max_positions", 6)
        
        # Build per-asset leverage note if any assets have custom leverage
        per_asset_note = ""
        if per_asset_leverage:
            custom_leverage_assets = {k: v for k, v in per_asset_leverage.items() if v != default_leverage}
            if custom_leverage_assets:
                per_asset_list = ", ".join([f"{asset}: {lev}x" for asset, lev in custom_leverage_assets.items()])
                per_asset_note = f" PER-ASSET LEVERAGE OVERRIDES: {per_asset_list}. These are MANDATORY and will be strictly enforced."
        
        base_note = f"Use these percentages to calculate TP/SL prices. Default leverage: {default_leverage}x (from DEFAULT_LEVERAGE in settings/.env, will be capped by asset max if lower).{per_asset_note} Maximum {max_positions} concurrent positions allowed."
        
        if margin_per_position is None:
            return f"{base_note} ⚠️ CRITICAL: MARGIN_PER_POSITION is not configured. The system requires MARGIN_PER_POSITION to be set in settings/.env file. Trades will be skipped until this is configured."
        
        # Calculate notional preview using default leverage (per-asset overrides will be applied per asset)
        notional_preview = margin_per_position * default_leverage
        
        # Build explicit instructions for LLM
        margin_instruction = f"""
🚨 MANDATORY POSITION SIZING RULES - STRICTLY ENFORCED 🚨

1. MARGIN_PER_POSITION: ${margin_per_position:.2f} USD
   - This is the EXACT margin amount that MUST be used for every trade
   - You MUST NOT suggest allocation_usd values that exceed ${margin_per_position:.2f}
   - The system will automatically enforce this limit, but you must respect it in your decisions

2. LEVERAGE RULES:
   - Default leverage: {default_leverage}x (from DEFAULT_LEVERAGE in settings/.env)
   - Per-asset leverage overrides: {per_asset_note if per_asset_note else "None - using default"}
   - For each asset, use the leverage specified in per_asset_leverage (if set) or default_leverage
   - These leverage values are MANDATORY and cannot be exceeded

3. CALCULATION:
   - Notional Value = MARGIN_PER_POSITION × Leverage
   - Example: ${margin_per_position:.2f} margin × {default_leverage}x leverage = ${notional_preview:.2f} notional
   - The system handles all calculations automatically - you do NOT need to calculate allocation_usd

4. DUAL ENFORCEMENT:
   - System-level: The system will automatically enforce these limits before trade execution
   - Agent-level: You must respect these limits in your trading decisions
   - If you suggest values exceeding these limits, the system will override them and log a warning

⚠️ CRITICAL: These values are MANDATORY. Do NOT suggest allocation_usd values that exceed MARGIN_PER_POSITION (${margin_per_position:.2f}). Focus on trading decisions (buy/sell/hold) only.
"""
        
        return f"{base_note}{margin_instruction}"

    def _has_required_ta_data(asset: str) -> bool:
        """Validate that key TA inputs exist before adding hunted asset to decision universe."""
        try:
            intraday_probe = taapi.fetch_series(
                "ema",
                f"{asset}/USDT",
                "5m",
                results=1,
                params={"period": 20},
                value_key="value",
            )
            longterm_probe = taapi.fetch_series(
                "ema",
                f"{asset}/USDT",
                "4h",
                results=1,
                params={"period": 20},
                value_key="value",
            )
            return bool(intraday_probe) and bool(longterm_probe)
        except Exception:
            return False

    async def run_loop():
        """Main trading loop that gathers data, calls the agent, and executes trades."""
        nonlocal invocation_count, initial_account_value
        
        # Position cache for PnL tracking (updated every 2-20 seconds)
        position_cache = {}  # asset -> {pnl_usd, pnl_percent, timestamp, entry_price, initial_margin}
        last_cache_update = {}  # asset -> timestamp
        pair_hunter_stats_loaded = False
        
        while True:
            if not pair_hunter_stats_loaded:
                await _load_pair_hunter_stats()
                pair_hunter_stats_loaded = True
            invocation_count += 1
            minutes_since_start = (datetime.now(timezone.utc) - start_time).total_seconds() / 60

            # Global account state
            state = await hyperliquid.get_user_state()
            total_value = state.get('total_value') or state['balance'] + sum(p.get('pnl', 0) for p in state['positions'])
            sharpe = calculate_sharpe(trade_log)

            account_value = total_value
            if initial_account_value is None:
                initial_account_value = account_value
            total_return_pct = ((account_value - initial_account_value) / initial_account_value * 100.0) if initial_account_value else 0.0

            positions = []
            current_time = datetime.now(timezone.utc)
            
            for pos_wrap in state['positions']:
                pos = pos_wrap
                coin = pos.get('coin') or pos.get('symbol')
                # Get the appropriate exchange for this asset
                # In multi-exchange mode, use exchange_manager; otherwise use the single exchange
                if use_multi_exchange and exchange_manager and coin:
                    asset_exchange = exchange_manager.get_exchange_for_asset(coin) or exchange
                else:
                    asset_exchange = exchange
                current_px = await asset_exchange.get_current_price(coin) if coin else None
                
                # Calculate PnL in dollars and percentage (same logic as PositionsTable)
                unrealized_pnl = round_or_none(pos.get('pnl'), 4) or 0
                entry_price = round_or_none(pos.get('entryPx'), 2) or 0
                position_size = abs(float(pos.get('szi', 0)))
                initial_margin = pos.get('initialMargin') or pos.get('positionInitialMargin')
                leverage = pos.get('leverage')
                
                # Calculate ROI percentage (same as PositionsTable)
                roi_percent = None
                if pos.get('roiPercent') is not None:
                    roi_percent = float(pos.get('roiPercent'))
                elif pos.get('roi') is not None:
                    roi_percent = float(pos.get('roi'))
                elif initial_margin and initial_margin > 0:
                    # Fallback: calculate ROI from PnL / initial margin
                    roi_percent = (unrealized_pnl / float(initial_margin)) * 100
                elif entry_price > 0 and position_size > 0:
                    # Fallback: calculate from notional value
                    notional_value = position_size * entry_price
                    if notional_value > 0:
                        roi_percent = (unrealized_pnl / notional_value) * 100
                
                # Update position cache (every 2-20 seconds)
                cache_interval = 10  # Update cache every 10 seconds
                should_update_cache = (
                    coin not in last_cache_update or 
                    (current_time - last_cache_update[coin]).total_seconds() >= cache_interval
                )
                
                if should_update_cache:
                    position_cache[coin] = {
                        "pnl_usd": unrealized_pnl,
                        "pnl_percent": roi_percent,
                        "timestamp": current_time.isoformat(),
                        "entry_price": entry_price,
                        "initial_margin": initial_margin,
                        "leverage": leverage,
                        "position_size": position_size
                    }
                    last_cache_update[coin] = current_time
                    logging.info(f"📊 Position PnL cached for {coin}: ${unrealized_pnl:.2f} ({roi_percent:.2f}% ROI) | Entry: ${entry_price:.2f} | Size: {position_size:.6f}")
                
                positions.append({
                    "symbol": coin,
                    "quantity": round_or_none(pos.get('szi'), 6),
                    "entry_price": entry_price,
                    "current_price": round_or_none(current_px, 2),
                    "liquidation_price": round_or_none(pos.get('liquidationPx') or pos.get('liqPx'), 2),
                    "unrealized_pnl": unrealized_pnl,
                    "unrealized_pnl_usd": unrealized_pnl,  # Explicit USD value
                    "unrealized_pnl_percent": roi_percent,  # Percentage value
                    "pnl_sign": "+" if unrealized_pnl >= 0 else "-",  # Sign indicator
                    "pnl_percent_sign": "+" if (roi_percent or 0) >= 0 else "-",  # Percent sign indicator
                    "leverage": leverage,
                    "initial_margin": initial_margin,
                    "roiPercent": roi_percent
                })

            recent_diary = []
            try:
                with open(diary_path, "r") as f:
                    lines = f.readlines()
                    for line in lines[-10:]:
                        entry = json.loads(line)
                        recent_diary.append(entry)
            except Exception:
                pass

            open_orders_struct = []
            try:
                open_orders = await hyperliquid.get_open_orders()
                for o in open_orders[:50]:
                    open_orders_struct.append({
                        "coin": o.get('coin'),
                        "oid": o.get('oid'),
                        "is_buy": o.get('isBuy'),
                        "size": round_or_none(o.get('sz'), 6),
                        "price": round_or_none(o.get('px'), 2),
                        "trigger_price": round_or_none(o.get('triggerPx'), 2),
                        "order_type": o.get('orderType')
                    })
            except Exception:
                open_orders = []

            # Reconcile active trades
            try:
                assets_with_positions = set()
                for pos in state['positions']:
                    try:
                        if abs(float(pos.get('szi') or 0)) > 0:
                            assets_with_positions.add(pos.get('coin'))
                    except Exception:
                        continue
                assets_with_orders = {o.get('coin') for o in (open_orders or []) if o.get('coin')}
                for tr in active_trades[:]:
                    asset = tr.get('asset')
                    if asset not in assets_with_positions and asset not in assets_with_orders:
                        add_event(f"Reconciling stale active trade for {asset} (no position, no orders)")
                        active_trades.remove(tr)
                        with open(diary_path, "a") as f:
                            f.write(json.dumps({
                                "timestamp": datetime.now(timezone.utc).isoformat(),
                                "asset": asset,
                                "action": "reconcile_close",
                                "reason": "no_position_no_orders",
                                "opened_at": tr.get('opened_at')
                            }) + "\n")
            except Exception:
                pass

            recent_fills_struct = []
            try:
                fills = await hyperliquid.get_recent_fills(limit=50)
                for f_entry in fills[-20:]:
                    try:
                        t_raw = f_entry.get('time') or f_entry.get('timestamp')
                        timestamp = None
                        if t_raw is not None:
                            try:
                                t_int = int(t_raw)
                                if t_int > 1e12:
                                    timestamp = datetime.fromtimestamp(t_int / 1000, tz=timezone.utc).isoformat()
                                else:
                                    timestamp = datetime.fromtimestamp(t_int, tz=timezone.utc).isoformat()
                            except Exception:
                                timestamp = str(t_raw)
                        recent_fills_struct.append({
                            "timestamp": timestamp,
                            "coin": f_entry.get('coin') or f_entry.get('asset'),
                            "is_buy": f_entry.get('isBuy'),
                            "size": round_or_none(f_entry.get('sz') or f_entry.get('size'), 6),
                            "price": round_or_none(f_entry.get('px') or f_entry.get('price'), 2)
                        })
                    except Exception:
                        continue
            except Exception:
                pass

            # Enhance active_trades with position status and exit condition checks
            enhanced_active_trades = []
            for tr in active_trades:
                asset = tr.get('asset')
                exit_plan = tr.get('exit_plan', '')
                
                # Check if position still exists
                has_position = any(p.get('symbol') == asset and abs(float(p.get('quantity', 0))) > 0 for p in positions)
                
                # Create enhanced trade info
                enhanced_tr = {
                    "asset": asset,
                    "is_long": tr.get('is_long'),
                    "amount": round_or_none(tr.get('amount'), 6),
                    "entry_price": round_or_none(tr.get('entry_price'), 2),
                    "tp_oid": tr.get('tp_oid'),
                    "sl_oid": tr.get('sl_oid'),
                    "exit_plan": exit_plan,
                    "opened_at": tr.get('opened_at'),
                    "has_position": has_position,
                    "current_price": round_or_none(asset_prices.get(asset), 2)
                }
                
                # Add current PnL if position exists
                if has_position:
                    for p in positions:
                        if p.get('symbol') == asset:
                            enhanced_tr["unrealized_pnl"] = round_or_none(p.get('unrealized_pnl'), 2)
                            enhanced_tr["current_price"] = round_or_none(p.get('current_price'), 2)
                            break
                
                enhanced_active_trades.append(enhanced_tr)

            # ═════════════════════════════════════════════════════════════════
            # 🔍 PAIR HUNTER: Build decision universe before market-data fetch
            # ═════════════════════════════════════════════════════════════════
            decision_assets = list(args.assets)
            enable_pair_hunter = CONFIG.get("enable_pair_hunter", False)
            pair_hunter_top_n = CONFIG.get("pair_hunter_top_n", 5)
            pair_hunter_refresh_interval = CONFIG.get("pair_hunter_refresh_interval", 5)  # Refresh every N loops
            pair_hunter_min_volatility = CONFIG.get("pair_hunter_min_volatility", 2.0)
            pair_hunter_max_analyze_assets = CONFIG.get("pair_hunter_max_analyze_assets", 8)

            if enable_pair_hunter:
                # Initialize pair hunter tracking
                if not hasattr(run_loop, '_pair_hunter_counter'):
                    run_loop._pair_hunter_counter = 0
                    run_loop._last_hunted_assets = []

                run_loop._pair_hunter_counter += 1

                # Refresh hunted pairs every N iterations (or on first run)
                should_refresh = (
                    run_loop._pair_hunter_counter >= pair_hunter_refresh_interval
                    or len(run_loop._last_hunted_assets) == 0
                )

                # Get current positions (always include these)
                positions_assets = set()
                for pos in positions:
                    asset = pos.get('symbol') or pos.get('coin')
                    if asset:
                        positions_assets.add(asset)

                if should_refresh:
                    try:
                        add_event(f"🔍 PAIR HUNTER: Scanning for top {pair_hunter_top_n} opportunities...")
                        hunted_assets = await get_best_pairs(
                            hyperliquid,
                            top_n=pair_hunter_top_n,
                            min_volatility=pair_hunter_min_volatility
                        )
                        if not hunted_assets or not isinstance(hunted_assets, list):
                            logger.warning(f"Pair Hunter returned invalid result: {hunted_assets}. Using fallback.")
                            hunted_assets = []
                        if hunted_assets:
                            hunted_assets = _rank_hunted_assets_by_performance(hunted_assets)
                            validated_hunts = []
                            for hunted_asset in hunted_assets:
                                if _has_required_ta_data(hunted_asset):
                                    await _record_pair_hunter_data_success(hunted_asset)
                                    validated_hunts.append(hunted_asset)
                                else:
                                    await _record_pair_hunter_data_failure(hunted_asset, "missing 5m/4h TA data")
                                    add_event(f"⚠️ Pair Hunter dropped {hunted_asset}: missing 5m/4h TA data on Binance")
                            hunted_assets = validated_hunts
                        run_loop._last_hunted_assets = hunted_assets
                        run_loop._pair_hunter_counter = 0
                    except Exception as e:
                        add_event(f"⚠️ Pair Hunter error: {e}. Using cached/fallback assets.")
                        hunted_assets = []
                else:
                    hunted_assets = list(run_loop._last_hunted_assets)

                if hunted_assets:
                    merged_assets = list(positions_assets) + [a for a in hunted_assets if a not in positions_assets]
                    decision_assets = merged_assets[:pair_hunter_max_analyze_assets]
                    add_event(f"🏆 PAIR HUNTER: top setups ({len(hunted_assets)}): {', '.join(hunted_assets)}")
                    scoreboard = []
                    for sym in hunted_assets[:5]:
                        s = pair_hunter_stats.get(sym, {})
                        if s:
                            scoreboard.append(
                                f"{sym}(wr={float(s.get('win_rate', 0.0)):.0f}%, exp=${float(s.get('expectancy_usd', 0.0)):.2f}, n={int(s.get('total_trades', 0) or 0)})"
                            )
                    if scoreboard:
                        add_event(f"📈 Pair Hunter scorecard: {', '.join(scoreboard)}")
                    if positions_assets:
                        add_event(f"📊 Monitoring open-position assets: {', '.join(positions_assets)}")
                    try:
                        await webhook_notifier.notify_pair_hunter(
                            top_pairs=hunted_assets,
                            positions=list(positions_assets)
                        )
                    except Exception as e:
                        logging.debug(f"Webhook pair hunter notification failed: {e}")
                else:
                    decision_assets = list(args.assets)
                    add_event("⚠️ Pair Hunter yielded no symbols, using ASSETS fallback.")

            dashboard = {
                "total_return_pct": round(total_return_pct, 2),
                "balance": round_or_none(state['balance'], 2),
                "account_value": round_or_none(account_value, 2),
                "sharpe_ratio": round_or_none(sharpe, 3),
                "positions": positions,
                "active_trades": enhanced_active_trades,
                "open_orders": open_orders_struct,
                "recent_diary": recent_diary,
                "recent_fills": recent_fills_struct,
                "position_summary": {
                    "assets_with_positions": list(assets_with_positions) if 'assets_with_positions' in locals() else [],
                    "assets_without_positions": [a for a in decision_assets if a not in (assets_with_positions if 'assets_with_positions' in locals() else set())]
                }
            }

            # Gather data for ALL assets first
            market_sections = []
            asset_prices = {}
            for asset in decision_assets:
                try:
                    current_price = await hyperliquid.get_current_price(asset)
                    asset_prices[asset] = current_price
                    if asset not in price_history:
                        price_history[asset] = deque(maxlen=60)
                    price_history[asset].append({"t": datetime.now(timezone.utc).isoformat(), "mid": round_or_none(current_price, 2)})
                    oi = await hyperliquid.get_open_interest(asset)
                    funding = await hyperliquid.get_funding_rate(asset)

                    intraday_tf = "5m"
                    ema_series = taapi.fetch_series("ema", f"{asset}/USDT", intraday_tf, results=10, params={"period": 20}, value_key="value")
                    macd_series = taapi.fetch_series("macd", f"{asset}/USDT", intraday_tf, results=10, value_key="valueMACD")
                    rsi7_series = taapi.fetch_series("rsi", f"{asset}/USDT", intraday_tf, results=10, params={"period": 7}, value_key="value")
                    rsi14_series = taapi.fetch_series("rsi", f"{asset}/USDT", intraday_tf, results=10, params={"period": 14}, value_key="value")

                    lt_ema20 = taapi.fetch_value("ema", f"{asset}/USDT", "4h", params={"period": 20}, key="value")
                    lt_ema50 = taapi.fetch_value("ema", f"{asset}/USDT", "4h", params={"period": 50}, key="value")
                    lt_atr3 = taapi.fetch_value("atr", f"{asset}/USDT", "4h", params={"period": 3}, key="value")
                    lt_atr14 = taapi.fetch_value("atr", f"{asset}/USDT", "4h", params={"period": 14}, key="value")
                    lt_macd_series = taapi.fetch_series("macd", f"{asset}/USDT", "4h", results=10, value_key="valueMACD")
                    lt_rsi_series = taapi.fetch_series("rsi", f"{asset}/USDT", "4h", results=10, params={"period": 14}, value_key="value")

                    recent_mids = [entry["mid"] for entry in list(price_history.get(asset, []))[-10:]]
                    funding_annualized = round(funding * 24 * 365 * 100, 2) if funding else None

                    market_sections.append({
                        "asset": asset,
                        "current_price": round_or_none(current_price, 2),
                        "intraday": {
                            "ema20": round_or_none(ema_series[-1], 2) if ema_series else None,
                            "macd": round_or_none(macd_series[-1], 2) if macd_series else None,
                            "rsi7": round_or_none(rsi7_series[-1], 2) if rsi7_series else None,
                            "rsi14": round_or_none(rsi14_series[-1], 2) if rsi14_series else None,
                            "series": {
                                "ema20": round_series(ema_series, 2),
                                "macd": round_series(macd_series, 2),
                                "rsi7": round_series(rsi7_series, 2),
                                "rsi14": round_series(rsi14_series, 2)
                            }
                        },
                        "long_term": {
                            "ema20": round_or_none(lt_ema20, 2),
                            "ema50": round_or_none(lt_ema50, 2),
                            "atr3": round_or_none(lt_atr3, 2),
                            "atr14": round_or_none(lt_atr14, 2),
                            "macd_series": round_series(lt_macd_series, 2),
                            "rsi_series": round_series(lt_rsi_series, 2)
                        },
                        "open_interest": round_or_none(oi, 2),
                        "funding_rate": round_or_none(funding, 8),
                        "funding_annualized_pct": funding_annualized,
                        "recent_mid_prices": recent_mids
                    })
                except Exception as e:
                    add_event(f"Data gather error {asset}: {e}")
                    continue

            # Identify which assets are flat (no positions) - these need active entry hunting
            assets_with_positions_set = set()
            for pos in positions:
                if pos.get('symbol') and abs(float(pos.get('quantity', 0))) > 0:
                    assets_with_positions_set.add(pos.get('symbol'))
            
            flat_assets = [a for a in decision_assets if a not in assets_with_positions_set]

            # Fetch trading settings (leverage, TP%, SL%, position sizing)
            # This will use database settings first, then fall back to .env file if database unavailable
            trading_settings = await get_trading_settings()
            default_leverage = trading_settings["leverage"]
            tp_percent = trading_settings["take_profit_percent"]
            sl_percent = trading_settings["stop_loss_percent"]
            scalping_tp_percent = trading_settings.get("scalping_tp_percent", 5.0)
            scalping_sl_percent = trading_settings.get("scalping_sl_percent", 5.0)
            take_profit_strict_enforcement = trading_settings.get("take_profit_strict_enforcement", False)
            stop_loss_usd = trading_settings.get("stop_loss_usd")  # Optional: stop loss in USD (e.g., -$18)
            enable_stop_loss_orders = trading_settings.get("enable_stop_loss_orders", True)  # Enable automatic SL orders on exchange
            # Position sizing settings (target_profit_per_1pct_move, max_positions, position_sizing_mode) are in trading_settings dict
            # These come from database or .env file (TARGET_PROFIT_PER_1PCT_MOVE, MAX_POSITIONS, POSITION_SIZING_MODE)
            
            # ========================================================================
            # CRITICAL: ENFORCE STOP LOSS BEFORE AI DECISION
            # Stop loss must be respected at all costs, regardless of strategy
            # ========================================================================
            logging.info(f"🛡️  Checking stop loss for {len(positions)} positions before AI decision...")
            positions_to_close = []  # Track positions that hit stop loss
            
            for pos in positions:
                asset = pos.get('symbol')
                if not asset:
                    continue
                
                position_size = abs(float(pos.get('quantity', 0)))
                if position_size <= 0:
                    continue
                
                # Get position data
                raw_size = float(pos.get('quantity', 0) or 0)
                is_long = raw_size > 0
                entry_price = float(pos.get('entry_price') or 0)
                current_price = float(pos.get('current_price') or 0)
                unrealized_pnl = float(pos.get('unrealized_pnl') or 0)
                initial_margin = float(pos.get('initial_margin') or 0)

                raw_pnl_percent = pos.get('unrealized_pnl_percent')
                pnl_candidates = []
                try:
                    if raw_pnl_percent is not None:
                        pnl_candidates.append(float(raw_pnl_percent))
                except Exception:
                    pass

                # Fallback 1: margin-based ROI%
                if initial_margin > 0:
                    pnl_candidates.append((unrealized_pnl / initial_margin) * 100.0)

                # Fallback 2: directional price move%
                if entry_price > 0 and current_price > 0:
                    if is_long:
                        pnl_candidates.append(((current_price - entry_price) / entry_price) * 100.0)
                    else:
                        pnl_candidates.append(((entry_price - current_price) / entry_price) * 100.0)

                # Use the most conservative loss estimate so SL cannot be bypassed by bad data.
                pnl_percent = min(pnl_candidates) if pnl_candidates else 0.0
                
                # Determine which strategy is active for this position
                current_strategy_name = agent.get_name()
                is_scalping = "scalping" in current_strategy_name.lower()
                
                # Get stop loss threshold (scalping or regular)
                effective_sl_percent = scalping_sl_percent if is_scalping else sl_percent
                # Hard safety cap: never allow losses to run past this backstop.
                hard_max_loss_cap_percent = float(trading_settings.get("hard_max_loss_cap_percent", 8.0) or 8.0)
                if hard_max_loss_cap_percent > 0:
                    effective_sl_percent = min(float(effective_sl_percent or hard_max_loss_cap_percent), hard_max_loss_cap_percent)
                
                # Check stop loss in PERCENTAGE
                sl_breached_percent = False
                # For long/short: breach when effective loss % is below threshold.
                logging.info(f"📊 Position {asset} PnL check: ${unrealized_pnl:.2f} ({pnl_percent:.2f}%) | SL threshold: -{effective_sl_percent}%")
                if pnl_percent <= -effective_sl_percent:
                    sl_breached_percent = True
                    add_event(f"🛑 STOP LOSS BREACHED (Percentage) for {asset}: {pnl_percent:.2f}% (threshold: -{effective_sl_percent}%). Closing immediately!")
                    logging.warning(f"🛑 STOP LOSS BREACHED (Percentage) for {asset}: {pnl_percent:.2f}% <= -{effective_sl_percent}%")
                
                # Check stop loss in USD (if configured)
                sl_breached_usd = False
                if stop_loss_usd is not None and stop_loss_usd < 0:
                    # stop_loss_usd is negative (e.g., -18 means close if loss >= $18)
                    logging.info(f"📊 Position {asset} USD SL check: ${unrealized_pnl:.2f} vs threshold: ${stop_loss_usd:.2f}")
                    if unrealized_pnl <= stop_loss_usd:
                        sl_breached_usd = True
                        add_event(f"🛑 STOP LOSS BREACHED (USD) for {asset}: ${unrealized_pnl:.2f} (threshold: ${stop_loss_usd:.2f}). Closing immediately!")
                        logging.warning(f"🛑 STOP LOSS BREACHED (USD) for {asset}: ${unrealized_pnl:.2f} <= ${stop_loss_usd:.2f}")
                
                # If stop loss is breached, mark for immediate closure
                if sl_breached_percent or sl_breached_usd:
                    positions_to_close.append({
                        "asset": asset,
                        "is_long": is_long,
                        "position_size": position_size,
                        "reason": f"Stop Loss: {pnl_percent:.2f}% / ${unrealized_pnl:.2f}",
                        "pnl_percent": pnl_percent,
                        "pnl_usd": unrealized_pnl,
                        "entry_price": entry_price,
                        "current_price": current_price,
                    })
            
            # Close positions that hit stop loss BEFORE AI decision
            for pos_to_close in positions_to_close:
                asset = pos_to_close["asset"]
                is_long = pos_to_close["is_long"]
                position_size = pos_to_close["position_size"]
                reason = pos_to_close["reason"]
                pnl_percent = pos_to_close["pnl_percent"]
                pnl_usd = pos_to_close["pnl_usd"]
                entry_price = pos_to_close.get("entry_price", 0)
                current_price = pos_to_close.get("current_price", 0)
                
                try:
                    add_event(f"🛑 FORCE CLOSING {asset} due to stop loss: {reason}")
                    close_action = "sell" if is_long else "buy"
                    if is_long:
                        close_order = await hyperliquid.place_sell_order(asset, position_size, reduce_only=True)
                    else:
                        close_order = await hyperliquid.place_buy_order(asset, position_size, reduce_only=True)
                    add_event(f"✅ Force closed {asset} position (Stop Loss) via {close_action} order - Loss: {pnl_percent:.2f}% (${pnl_usd:.2f})")
                    await _safe_cancel_all_orders(asset, "post-close stop-loss cleanup")
                    
                    # Remove from active trades
                    for tr in active_trades[:]:
                        if tr.get('asset') == asset:
                            active_trades.remove(tr)
                    
                    # Log to diary
                    with open(diary_path, "a") as f:
                        f.write(json.dumps({
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                            "asset": asset,
                            "action": "close_stop_loss",
                            "entry_price": entry_price,
                            "exit_price": current_price,
                            "amount": position_size,
                            "reason": reason,
                            "pnl": pnl_usd,
                            "pnl_percent": pnl_percent
                        }) + "\n")
                    await _record_pair_hunter_outcome(asset, pnl_usd, pnl_percent, "close_stop_loss")
                    
                    # Remove from positions list so AI doesn't see it
                    positions = [p for p in positions if p.get('symbol') != asset]
                except Exception as e:
                    add_event(f"❌ Failed to force close {asset} position (Stop Loss): {e}")
                    import traceback
                    logging.error(f"Stop loss closure error: {traceback.format_exc()}")

            # Build per-asset leverage map for context and enforcement
            per_asset_leverage = {}
            for asset in decision_assets:
                asset_leverage = get_leverage_for_asset(asset, default_leverage)
                per_asset_leverage[asset] = asset_leverage
                if asset_leverage != default_leverage:
                    add_event(f"📌 Per-asset leverage for {asset}: {asset_leverage}x (default: {default_leverage}x)")

            # Single LLM call with all assets
            context_payload = OrderedDict([
                ("invocation", {
                    "minutes_since_start": round(minutes_since_start, 2),
                    "current_time": datetime.now(timezone.utc).isoformat(),
                    "invocation_count": invocation_count
                }),
                ("trading_settings", {
                    "default_leverage": default_leverage,
                    "per_asset_leverage": per_asset_leverage,  # Per-asset leverage overrides (MANDATORY)
                    "take_profit_percent": tp_percent,
                    "stop_loss_percent": sl_percent,
                    "scalping_tp_percent": scalping_tp_percent,  # Scalping strategy TP%
                    "scalping_sl_percent": scalping_sl_percent,  # Scalping strategy SL%
                    "take_profit_strict_enforcement": take_profit_strict_enforcement,  # If true, TP must be strictly enforced
                    "margin_per_position": trading_settings.get("margin_per_position"),  # MANDATORY - always use margin mode
                    "max_positions": trading_settings.get("max_positions", 5),
                    "position_sizing_mode": "margin",  # ALWAYS margin mode - system enforces this
                    "note": _build_position_sizing_note(trading_settings, default_leverage, per_asset_leverage),
                    "⚠️_CRITICAL_RULES": {
                        "margin_per_position": trading_settings.get("margin_per_position"),
                        "default_leverage": default_leverage,
                        "per_asset_leverage": per_asset_leverage,
                        "enforcement": "DUAL: System-level (automatic) + Agent-level (must respect in decisions)",
                        "warning": f"ALLOCATION_USD must NEVER exceed MARGIN_PER_POSITION (${trading_settings.get('margin_per_position') or 0:.2f}). System will enforce this, but agent must also respect it."
                    }
                }),
                ("account", dashboard),
                ("market_data", market_sections),
                ("position_status", {
                    "assets_with_positions": list(assets_with_positions_set),
                    "flat_assets": flat_assets,
                    "critical_note": f"Assets {flat_assets} have NO positions - ACTIVELY LOOK FOR ENTRY OPPORTUNITIES using technical analysis. Do not default to 'hold' for flat assets unless you've analyzed and found NO viable setups."
                }),
                ("positions_data", {
                    "positions": [
                        {
                            "asset": p.get('symbol'),
                            "side": "long" if float(p.get('quantity', 0)) > 0 else "short",
                            "entry_price": p.get('entry_price'),
                            "current_price": p.get('current_price'),
                            "pnl_usd": p.get('unrealized_pnl_usd'),
                            "pnl_percent": p.get('unrealized_pnl_percent'),
                            "pnl_sign": p.get('pnl_sign'),  # "+" or "-"
                            "pnl_percent_sign": p.get('pnl_percent_sign'),  # "+" or "-"
                            "leverage": p.get('leverage'),
                            "size": abs(float(p.get('quantity', 0))),
                            "initial_margin": p.get('initial_margin'),
                            "cached_pnl": position_cache.get(p.get('symbol'), {})  # Cached data for redundancy
                        }
                        for p in positions if p.get('symbol')
                    ],
                    "note": "Each position includes PnL in USD and percentage with sign indicators. Use cached_pnl if current data is unavailable."
                }),
                ("instructions", {
                    "assets": decision_assets,
                    "requirement": "Decide actions for all assets and return a strict JSON array matching the schema.",
                    "priority": f"PRIORITIZE finding entries for flat assets: {flat_assets}. These have no positions - actively scan for trading opportunities.",
                    "tp_sl_guidance": f"Calculate TP/SL prices using configured percentages: TP={tp_percent}%, SL={sl_percent}%. If not provided, system will calculate automatically."
                })
            ])
            # Log position data being passed to AI
            positions_data = context_payload.get("positions_data", {}).get("positions", [])
            if positions_data:
                logging.info(f"📤 Passing {len(positions_data)} position(s) with PnL data to AI agent:")
                for pos_data in positions_data:
                    asset = pos_data.get("asset", "UNKNOWN")
                    pnl_usd = pos_data.get("pnl_usd", 0)
                    pnl_percent = pos_data.get("pnl_percent", 0)
                    pnl_sign = pos_data.get("pnl_sign", "+")
                    pnl_percent_sign = pos_data.get("pnl_percent_sign", "+")
                    logging.info(f"   • {asset}: {pnl_sign}${abs(pnl_usd):.2f} ({pnl_percent_sign}{abs(pnl_percent):.2f}%) | Side: {pos_data.get('side', 'N/A')} | Entry: ${pos_data.get('entry_price', 0):.2f} | Current: ${pos_data.get('current_price', 0):.2f}")
            else:
                logging.info("📤 No open positions - passing empty positions_data to AI agent")
            
            context = json.dumps(context_payload, default=json_default)
            add_event(f"Combined prompt length: {len(context)} chars for {len(decision_assets)} assets")
            with open("prompts.log", "a") as f:
                f.write(f"\n\n--- {datetime.now()} - ALL ASSETS ---\n{json.dumps(context_payload, indent=2, default=json_default)}\n")

            def _is_failed_outputs(outs):
                """Return True when outputs are missing or clearly invalid."""
                if not isinstance(outs, dict):
                    return True
                decisions = outs.get("trade_decisions")
                if not isinstance(decisions, list) or not decisions:
                    return True
                try:
                    return all(
                        isinstance(o, dict)
                        and (o.get('action') == 'hold')
                        and ('parse error' in (o.get('rationale', '').lower()))
                        for o in decisions
                    )
                except Exception:
                    return True

            # ═════════════════════════════════════════════════════════════════
            # 📊 PERIODIC POSITION UPDATES: Send P&L summary every N iterations
            # ═════════════════════════════════════════════════════════════════
            position_update_interval = CONFIG.get("position_update_interval", 6)  # Every 6 cycles = 30 min at 5m interval
            if not hasattr(run_loop, '_position_update_counter'):
                run_loop._position_update_counter = 0
            
            run_loop._position_update_counter += 1
            
            if run_loop._position_update_counter >= position_update_interval and positions:
                # Build position summary
                position_summary = []
                total_pnl_usd = 0
                total_pnl_pct = 0
                
                for pos in positions:
                    asset = pos.get('symbol') or pos.get('coin')
                    if not asset:
                        continue
                    
                    pnl_usd = float(pos.get('unrealized_pnl', 0) or pos.get('unrealizedPnl', 0) or 0)
                    pnl_pct = float(pos.get('unrealized_pnl_percent', 0) or 0)
                    entry_price = float(pos.get('entry_price') or pos.get('entryPx') or pos.get('entryPrice') or 0)
                    current_price = asset_prices.get(asset, 0)
                    
                    position_summary.append({
                        'asset': asset,
                        'pnl_usd': pnl_usd,
                        'pnl_pct': pnl_pct,
                        'entry': entry_price,
                        'current': current_price
                    })
                    total_pnl_usd += pnl_usd
                    total_pnl_pct += pnl_pct
                
                if position_summary:
                    # Send webhook notification
                    try:
                        await webhook_notifier.send_notification("POSITION_UPDATE", {
                            "positions": position_summary,
                            "total_pnl_usd": round(total_pnl_usd, 2),
                            "total_pnl_pct": round(total_pnl_pct, 2),
                            "count": len(position_summary),
                            "timestamp": str(datetime.now(timezone.utc))
                        })
                    except Exception as e:
                        logging.debug(f"Position update webhook failed: {e}")
                    
                    # Log to console
                    add_event(f"📊 Position Update: {len(position_summary)} positions, Total P&L: ${total_pnl_usd:.2f} ({total_pnl_pct:.1f}%)")
                
                run_loop._position_update_counter = 0  # Reset counter
            
            # Visibility: print the active analysis universe every cycle
            if enable_pair_hunter:
                hunted_snapshot = list(getattr(run_loop, "_last_hunted_assets", []))
                add_event(f"🔎 Pair Hunter cached symbols ({len(hunted_snapshot)}): {', '.join(hunted_snapshot) if hunted_snapshot else 'none'}")
            add_event(f"🧠 LLM analyzing {len(decision_assets)} assets this cycle: {', '.join(decision_assets)}")
            
            # ═════════════════════════════════════════════════════════════════
            # Track current strategy name for change detection (both AUTO and MANUAL)
            # ═════════════════════════════════════════════════════════════════
            current_strategy_name = agent.get_name()
            if not hasattr(run_loop, '_last_strategy_name'):
                run_loop._last_strategy_name = None
            
            # Log which strategy is being used for this cycle
            if strategy_mode == "MANUAL":
                if not hasattr(run_loop, '_last_strategy_log') or run_loop._last_strategy_log != invocation_count:
                    logging.info(f"📊 Using strategy: {current_strategy_name}")
                    run_loop._last_strategy_log = invocation_count
            elif strategy_mode == "AUTO":
                # For auto mode, log when strategy changes
                if run_loop._last_strategy_name and run_loop._last_strategy_name != current_strategy_name:
                    logging.warning(f"🔄 Strategy changed: {run_loop._last_strategy_name} → {current_strategy_name}")
            
            # Update last strategy name
            run_loop._last_strategy_name = current_strategy_name

            try:
                outputs = agent.decide_trade(decision_assets, context)
                if not isinstance(outputs, dict):
                    add_event(f"Invalid output format (expected dict): {outputs}")
                    outputs = {}
            except Exception as e:
                import traceback
                add_event(f"Agent error: {e}")
                add_event(f"Traceback: {traceback.format_exc()}")
                outputs = {}

            # Retry once on failure/parse error with a stricter instruction prefix
            if _is_failed_outputs(outputs):
                add_event("Retrying LLM once due to invalid/parse-error output")
                context_retry_payload = OrderedDict([
                    ("retry_instruction", "Return ONLY the JSON array per schema with no prose."),
                    ("original_context", context_payload)
                ])
                context_retry = json.dumps(context_retry_payload, default=json_default)
                try:
                    outputs = agent.decide_trade(decision_assets, context_retry)
                    if not isinstance(outputs, dict):
                        add_event(f"Retry invalid format: {outputs}")
                        outputs = {}
                except Exception as e:
                    import traceback
                    add_event(f"Retry agent error: {e}")
                    add_event(f"Retry traceback: {traceback.format_exc()}")
                    outputs = {}

            reasoning_text = outputs.get("reasoning", "") if isinstance(outputs, dict) else ""
            if reasoning_text:
                add_event(f"LLM reasoning summary: {reasoning_text}")
            if isinstance(outputs, dict):
                try:
                    decisions = outputs.get("trade_decisions", [])
                    action_counts = {}
                    for d in decisions if isinstance(decisions, list) else []:
                        action = (d.get("action") if isinstance(d, dict) else None) or "unknown"
                        action_counts[action] = action_counts.get(action, 0) + 1
                    add_event(f"🧾 LLM decision summary: {action_counts} across {len(decision_assets)} analyzed assets")
                    await webhook_notifier.send_notification("DECISION_SUMMARY", {
                        "analyzed_assets": decision_assets,
                        "decision_count": len(decisions) if isinstance(decisions, list) else 0,
                        "action_counts": action_counts,
                        "timestamp": str(datetime.now(timezone.utc))
                    })
                except Exception as e:
                    logging.debug(f"Decision summary notification failed: {e}")

            # Check if strategy changed (for auto mode) and adjust existing positions accordingly
            if strategy_mode == "AUTO" and hasattr(run_loop, '_last_strategy_name') and run_loop._last_strategy_name:
                previous_strategy_name = run_loop._last_strategy_name
                if previous_strategy_name != current_strategy_name:
                    add_event(f"🔄 Strategy changed: {previous_strategy_name} → {current_strategy_name}")
                    # Adjust TP/SL for existing positions based on new strategy
                    for pos in positions:
                        asset = pos.get('symbol') or pos.get('coin')
                        if not asset:
                            continue
                        position_size = abs(float(pos.get('quantity', 0) or pos.get('szi', 0)))
                        if position_size <= 0:
                            continue
                        
                        # Find entry price and position info
                        entry_price = pos.get('entry_price') or pos.get('entryPx') or pos.get('entryPrice')
                        if not entry_price:
                            continue
                        
                        current_price = asset_prices.get(asset, 0)
                        if not current_price:
                            try:
                                current_price = await hyperliquid.get_current_price(asset)
                                asset_prices[asset] = current_price
                            except Exception:
                                continue
                        
                        raw_size = float(pos.get('szi', 0) or pos.get('quantity', 0))
                        is_long = raw_size > 0
                        
                        # Determine if switching TO scalping (need 5% TP) or TO trend (indicator-based)
                        is_scalping_now = "scalping" in current_strategy_name.lower()
                        was_scalping_before = "scalping" in previous_strategy_name.lower()
                        
                        # If switching TO scalping: Adjust TP to 5% if position is profitable
                        if is_scalping_now and not was_scalping_before:
                            pnl_pct = ((current_price - entry_price) / entry_price * 100) if is_long else ((entry_price - current_price) / entry_price * 100)
                            if pnl_pct > 0:  # Position is profitable
                                # Calculate new 5% TP
                                if is_long:
                                    new_tp = entry_price * 1.05
                                else:
                                    new_tp = entry_price * 0.95
                                
                                add_event(f"📊 Strategy switch to SCALPING: Adjusting TP for {asset} to 5% (${new_tp:.4f})")
                                try:
                                    await hyperliquid.cancel_all_orders(asset)
                                    await hyperliquid.place_take_profit(asset, is_long, position_size, new_tp)
                                    add_event(f"✅ Updated TP for {asset} to 5% (scalping strategy)")
                                except Exception as e:
                                    add_event(f"⚠️  Could not update TP for {asset}: {e}")
                        
                        # If switching TO trend: Let new strategy manage with indicator-based exits
                        elif not is_scalping_now and was_scalping_before:
                            add_event(f"📊 Strategy switch to TREND: {asset} will be managed with indicator-based exits")
                            # New strategy will handle exits based on indicators
                            # Cancel existing TP orders and let trend strategy set new ones based on indicators
                            try:
                                await hyperliquid.cancel_all_orders(asset)
                                add_event(f"🧹 Cancelled old TP/SL orders for {asset} - trend strategy will set new ones based on indicators")
                            except Exception as e:
                                add_event(f"⚠️  Could not cancel orders for {asset}: {e}")

            # PROTECT GAINS: Check TP/SL for ALL open positions and close immediately if reached
            # This protects against missed TP/SL orders and ensures gains are locked in
            for pos in positions:
                asset = pos.get('symbol') or pos.get('coin')
                if not asset:
                    continue
                    
                position_size = abs(float(pos.get('quantity', 0) or pos.get('szi', 0)))
                if position_size <= 0:
                    continue
                
                # Determine if long or short
                raw_size = float(pos.get('szi', 0) or pos.get('quantity', 0))
                is_long = raw_size > 0
                
                current_price = asset_prices.get(asset, 0)
                if not current_price or current_price <= 0:
                    try:
                        current_price = await hyperliquid.get_current_price(asset)
                        asset_prices[asset] = current_price
                    except Exception:
                        continue
                
                # Get TP/SL from diary entries (most reliable source)
                tp_price = None
                sl_price = None
                entry_price = pos.get('entry_price') or pos.get('entryPx') or pos.get('entryPrice')
                opened_at_str = None
                peak_profit_pct = None  # Track peak profit for drawdown protection
                
                # Find active trade record for additional tracking
                active_trade_record = None
                for tr in active_trades:
                    if tr.get('asset') == asset:
                        active_trade_record = tr
                        opened_at_str = tr.get('opened_at')
                        peak_profit_pct = tr.get('peak_profit_pct')  # Get stored peak profit
                        break
                
                try:
                    with open(diary_path, "r") as f:
                        lines = f.readlines()
                    for line in reversed(lines[-50:]):  # Check recent entries
                        try:
                            entry = json.loads(line)
                            if entry.get('asset') == asset and entry.get('action') in ['buy', 'sell']:
                                if not tp_price:
                                    tp_price = entry.get('tp_price')
                                if not sl_price:
                                    sl_price = entry.get('sl_price')
                                if not entry_price:
                                    entry_price = entry.get('entry_price')
                                if not opened_at_str:
                                    opened_at_str = entry.get('timestamp') or entry.get('opened_at')
                                if tp_price or sl_price:
                                    is_long = entry.get('action') == 'buy'
                                    break
                        except Exception:
                            continue
                except Exception:
                    pass
                
                # Convert to float immediately (values from JSON may be strings)
                try:
                    if entry_price:
                        entry_price = float(entry_price)
                    if tp_price:
                        tp_price = float(tp_price)
                    if sl_price:
                        sl_price = float(sl_price)
                except (ValueError, TypeError) as e:
                    logging.warning(f"Could not convert prices to float for {asset}: entry_price={entry_price}, tp_price={tp_price}, sl_price={sl_price}, error={e}")
                    if not entry_price or entry_price <= 0:
                        continue
                
                # Calculate current PNL percentage
                unrealized_pnl = pos.get('unrealized_pnl') or pos.get('pnl') or 0
                if not entry_price or entry_price <= 0:
                    continue
                
                # Calculate profit percentage (considering leverage)
                notional_value = position_size * entry_price
                pnl_percent = 0.0
                if notional_value > 0:
                    pnl_percent = (unrealized_pnl / notional_value) * 100
                
                # Update peak profit tracking for drawdown protection
                if peak_profit_pct is None or pnl_percent > peak_profit_pct:
                    peak_profit_pct = pnl_percent
                    # Store updated peak in active_trades
                    if active_trade_record:
                        active_trade_record['peak_profit_pct'] = peak_profit_pct
                    else:
                        # Create or update active trade record
                        for tr in active_trades:
                            if tr.get('asset') == asset:
                                tr['peak_profit_pct'] = peak_profit_pct
                                break
                        else:
                            # No record found, create one
                            active_trades.append({
                                'asset': asset,
                                'is_long': is_long,
                                'entry_price': entry_price,
                                'opened_at': opened_at_str or datetime.now(timezone.utc).isoformat(),
                                'peak_profit_pct': peak_profit_pct
                            })
                
                # ========================================================================
                # ADVANCED POSITION MANAGEMENT: Trailing Stop, Max Hold Time, Drawdown Protection
                # ========================================================================
                
                # 1. MAXIMUM HOLD TIME CHECK
                max_hold_hours = CONFIG.get('max_position_hold_hours', 24.0)
                if opened_at_str and max_hold_hours > 0:
                    try:
                        if 'T' in opened_at_str:
                            opened_at = datetime.fromisoformat(opened_at_str.replace('Z', '+00:00'))
                        else:
                            opened_at = datetime.fromisoformat(opened_at_str)
                        # Ensure opened_at is timezone-aware (UTC)
                        if opened_at.tzinfo is None:
                            opened_at = opened_at.replace(tzinfo=timezone.utc)
                        hours_open = (datetime.now(timezone.utc) - opened_at).total_seconds() / 3600
                        
                        if hours_open >= max_hold_hours:
                            add_event(f"⏰ Maximum hold time reached for {asset}: {hours_open:.1f} hours (max: {max_hold_hours}h). Closing position.")
                            should_take_profit = True
                            profit_reason = f"Max hold time ({hours_open:.1f}h)"
                            # Skip other checks and close immediately
                            try:
                                close_action = "sell" if is_long else "buy"
                                if is_long:
                                    close_order = await hyperliquid.place_sell_order(asset, position_size, reduce_only=True)
                                else:
                                    close_order = await hyperliquid.place_buy_order(asset, position_size, reduce_only=True)
                                add_event(f"✅ Closed {asset} position (max hold time) via {close_action} order")
                                await _safe_cancel_all_orders(asset, "post-close max-hold cleanup")
                                
                                # Remove from active trades
                                for tr in active_trades[:]:
                                    if tr.get('asset') == asset:
                                        active_trades.remove(tr)
                                
                                # Log to diary
                                with open(diary_path, "a") as f:
                                    f.write(json.dumps({
                                        "timestamp": datetime.now(timezone.utc).isoformat(),
                                        "asset": asset,
                                        "action": "close_max_hold_time",
                                        "entry_price": entry_price,
                                        "exit_price": current_price,
                                        "amount": position_size,
                                        "reason": f"Maximum hold time reached ({hours_open:.1f}h)",
                                        "pnl": unrealized_pnl
                                    }) + "\n")
                                await _record_pair_hunter_outcome(asset, unrealized_pnl, pnl_percent, "close_max_hold_time")
                            except Exception as e:
                                add_event(f"❌ Failed to close {asset} position (max hold time): {e}")
                            continue  # Skip to next position
                    except Exception as e:
                        logging.warning(f"Could not parse opened_at for {asset} max hold check: {e}")
                
                # 2. DRAWDOWN PROTECTION: Close if profit drops significantly from peak
                enable_drawdown = CONFIG.get('enable_drawdown_protection', True)
                max_drawdown_pct = CONFIG.get('max_drawdown_from_peak_pct', 5.0)
                drawdown_min_peak_profit_pct = CONFIG.get('drawdown_min_peak_profit_pct', 3.0)
                drawdown_confirm_cycles = max(1, int(CONFIG.get('drawdown_confirm_cycles', 2) or 2))
                drawdown_should_close = False
                drawdown_reason = ""
                if enable_drawdown and peak_profit_pct is not None and peak_profit_pct >= drawdown_min_peak_profit_pct:
                    drawdown_from_peak = peak_profit_pct - pnl_percent
                    if drawdown_from_peak >= max_drawdown_pct:
                        drawdown_trigger_count = 1
                        if active_trade_record is not None:
                            drawdown_trigger_count = int(active_trade_record.get("drawdown_trigger_count", 0) or 0) + 1
                            active_trade_record["drawdown_trigger_count"] = drawdown_trigger_count
                        if drawdown_trigger_count >= drawdown_confirm_cycles:
                            add_event(f"📉 Drawdown protection triggered for {asset}: Peak was {peak_profit_pct:.1f}%, now {pnl_percent:.1f}% (drawdown: {drawdown_from_peak:.1f}%). Closing to protect gains.")
                            drawdown_should_close = True
                            drawdown_reason = f"Drawdown protection ({drawdown_from_peak:.1f}% from peak)"
                        else:
                            add_event(f"📉 Drawdown warning for {asset}: {drawdown_from_peak:.1f}% from peak (confirm {drawdown_trigger_count}/{drawdown_confirm_cycles})")
                    elif active_trade_record is not None:
                        active_trade_record["drawdown_trigger_count"] = 0
                elif active_trade_record is not None:
                    active_trade_record["drawdown_trigger_count"] = 0
                
                # 2b. LOSS PROTECTION: Close if position is down significantly (backup if AI doesn't close)
                loss_protection_pct = CONFIG.get('loss_protection_pct', 5.0)  # Close if down 5%+
                loss_protection_min_hours = CONFIG.get('loss_protection_min_hours', 1.0)
                loss_protection_confirm_cycles = max(1, int(CONFIG.get('loss_protection_confirm_cycles', 2) or 2))
                if pnl_percent <= -loss_protection_pct:
                    # Check how long it's been losing
                    if opened_at_str:
                        try:
                            if 'T' in opened_at_str:
                                opened_at = datetime.fromisoformat(opened_at_str.replace('Z', '+00:00'))
                            else:
                                opened_at = datetime.fromisoformat(opened_at_str)
                            # Ensure opened_at is timezone-aware (UTC)
                            if opened_at.tzinfo is None:
                                opened_at = opened_at.replace(tzinfo=timezone.utc)
                            hours_open = (datetime.now(timezone.utc) - opened_at).total_seconds() / 3600
                            
                            # Only auto-close if loss persists for configured time and confirmation cycles
                            if hours_open >= loss_protection_min_hours:
                                loss_trigger_count = 1
                                if active_trade_record is not None:
                                    loss_trigger_count = int(active_trade_record.get("loss_trigger_count", 0) or 0) + 1
                                    active_trade_record["loss_trigger_count"] = loss_trigger_count
                                if loss_trigger_count >= loss_protection_confirm_cycles:
                                    add_event(f"⚠️  Loss protection triggered for {asset}: Down {abs(pnl_percent):.1f}% after {hours_open:.1f} hours. System closing as backup.")
                                    drawdown_should_close = True
                                    drawdown_reason = f"Loss protection (down {abs(pnl_percent):.1f}% after {hours_open:.1f}h)"
                                else:
                                    add_event(f"⚠️  Loss warning for {asset}: Down {abs(pnl_percent):.1f}% (confirm {loss_trigger_count}/{loss_protection_confirm_cycles})")
                        except Exception as e:
                            logging.warning(f"Could not parse opened_at for {asset} loss protection: {e}")
                elif active_trade_record is not None:
                    active_trade_record["loss_trigger_count"] = 0
                
                # 3. TRAILING STOP LOSS: Move SL up as profit increases
                enable_trailing = CONFIG.get('enable_trailing_stop', True)
                trailing_activation_pct = CONFIG.get('trailing_stop_activation_pct', 5.0)
                trailing_distance_pct = CONFIG.get('trailing_stop_distance_pct', 3.0)
                
                if enable_trailing and pnl_percent >= trailing_activation_pct:
                    # Calculate new trailing stop price
                    if is_long:
                        new_sl_price = current_price * (1 - trailing_distance_pct / 100)
                        # Only update if new SL is higher than current SL (or no SL set)
                        if not sl_price or new_sl_price > sl_price:
                            old_sl_price = sl_price
                            sl_price = new_sl_price
                            add_event(f"📈 Trailing stop updated for {asset}: SL moved to ${sl_price:.4f} (profit: {pnl_percent:.1f}%)")
                            
                            # Update SL order on exchange (if enabled)
                            if enable_stop_loss_orders:
                                try:
                                    # Cancel old SL order if exists
                                    if active_trade_record and active_trade_record.get('sl_oid'):
                                        try:
                                            await hyperliquid.cancel_order(asset, active_trade_record.get('sl_oid'))
                                        except Exception:
                                            pass
                                    
                                    # Place new trailing SL order
                                    sl_order = await hyperliquid.place_stop_loss(asset, is_long, position_size, sl_price)
                                    sl_oids = hyperliquid.extract_oids(sl_order) if hasattr(hyperliquid, 'extract_oids') else []
                                    sl_oid = sl_oids[0] if sl_oids else None
                                    
                                    # Update active trade record
                                    if active_trade_record:
                                        active_trade_record['sl_oid'] = sl_oid
                                        active_trade_record['sl_price'] = sl_price
                                    
                                    add_event(f"✅ Trailing SL order placed for {asset} at ${sl_price:.4f}")
                                except Exception as e:
                                    add_event(f"⚠️  Could not update trailing SL for {asset}: {e}")
                            else:
                                add_event(f"📍 Trailing SL updated for {asset} (exchange SL orders disabled)")
                    else:  # short position
                        new_sl_price = current_price * (1 + trailing_distance_pct / 100)
                        # Only update if new SL is lower than current SL (or no SL set)
                        if not sl_price or new_sl_price < sl_price:
                            old_sl_price = sl_price
                            sl_price = new_sl_price
                            add_event(f"📈 Trailing stop updated for {asset}: SL moved to ${sl_price:.4f} (profit: {pnl_percent:.1f}%)")
                            
                            # Update SL order on exchange (if enabled)
                            if enable_stop_loss_orders:
                                try:
                                    # Cancel old SL order if exists
                                    if active_trade_record and active_trade_record.get('sl_oid'):
                                        try:
                                            await hyperliquid.cancel_order(asset, active_trade_record.get('sl_oid'))
                                        except Exception:
                                            pass
                                    
                                    # Place new trailing SL order
                                    sl_order = await hyperliquid.place_stop_loss(asset, is_long, position_size, sl_price)
                                    sl_oids = hyperliquid.extract_oids(sl_order) if hasattr(hyperliquid, 'extract_oids') else []
                                    sl_oid = sl_oids[0] if sl_oids else None
                                    
                                    # Update active trade record
                                    if active_trade_record:
                                        active_trade_record['sl_oid'] = sl_oid
                                        active_trade_record['sl_price'] = sl_price
                                    
                                    add_event(f"✅ Trailing SL order placed for {asset} at ${sl_price:.4f}")
                                except Exception as e:
                                    add_event(f"⚠️  Could not update trailing SL for {asset}: {e}")
                            else:
                                add_event(f"📍 Trailing SL updated for {asset} (exchange SL orders disabled)")
                
                # SMART PROFIT-TAKING: Adjust TP dynamically based on current profit
                # Consider fees (~0.04% per entry/exit = ~0.08% round trip)
                # Take profits at reasonable levels, don't be too greedy
                should_take_profit = drawdown_should_close  # Start with drawdown protection flag
                profit_reason = drawdown_reason if drawdown_should_close else ""
                
                # Check if this is a scalping trade (TP around 5%)
                is_scalping_trade = False
                if tp_price and entry_price:
                    # Ensure tp_price and entry_price are floats (may come from JSON as strings)
                    try:
                        tp_price_float = float(tp_price) if tp_price else None
                        entry_price_float = float(entry_price) if entry_price else None
                        if tp_price_float and entry_price_float:
                            if is_long:
                                tp_percent_from_entry = ((tp_price_float - entry_price_float) / entry_price_float) * 100
                            else:
                                tp_percent_from_entry = ((entry_price_float - tp_price_float) / entry_price_float) * 100
                            # Scalping trades: TP around 7% (6-8% range matches SMART_PROFIT_TIER1_PCT)
                            is_scalping_trade = 6.0 <= tp_percent_from_entry <= 8.0
                    except (ValueError, TypeError) as e:
                        logging.debug(f"Could not calculate TP percent for {asset}: tp_price={tp_price}, entry_price={entry_price}, error={e}")
                        is_scalping_trade = False
                
                # PROFIT MILESTONE ALERTS: Notify as we approach targets
                if is_scalping_trade and pnl_percent >= 5.0 and pnl_percent < tier1_profit_pct:
                    # Check if we already notified for this milestone
                    if active_trade_record and not active_trade_record.get('milestone_5pct_notified'):
                        try:
                            unrealized_pnl = float(pos.get('unrealized_pnl', 0) or pos.get('unrealizedPnl', 0) or 0)
                            await webhook_notifier.notify_profit_milestone(
                                asset=asset,
                                pnl_percent=pnl_percent,
                                pnl_usd=unrealized_pnl,
                                milestone="Approaching 7% target"
                            )
                            active_trade_record['milestone_5pct_notified'] = True
                            add_event(f"📈 {asset} at +{pnl_percent:.1f}% - Approaching 7% profit target!")
                        except Exception as e:
                            logging.debug(f"Milestone notification failed: {e}")
                
                # SCALPING STRATEGY: Close immediately at tier1 profit % (default 7%)
                tier1_profit_pct = CONFIG.get('smart_profit_tier1_pct', 7)
                if is_scalping_trade and pnl_percent >= tier1_profit_pct:
                    should_take_profit = True
                    profit_reason = f"Scalping target reached ({pnl_percent:.1f}%) - closing immediately"
                    add_event(f"🎯 Scalping trade {asset}: Reached {tier1_profit_pct}% target ({pnl_percent:.1f}%), closing immediately")
                
                # TREND STRATEGY: Use higher thresholds, let indicators guide exits
                elif not is_scalping_trade:
                    if pnl_percent >= 15.0:  # Up 15%+ - take profits immediately
                        should_take_profit = True
                        profit_reason = "Strong profit (15%+) - locking in gains"
                    elif pnl_percent >= 10.0:  # Up 10-15% - take profits if TP too high
                        # Check if TP is more than 20% away - if so, take profit now
                        if tp_price:
                            tp_percent = 0.0
                            try:
                                tp_price_float = float(tp_price) if tp_price else None
                                entry_price_float = float(entry_price) if entry_price else None
                                if tp_price_float and entry_price_float:
                                    if is_long:
                                        tp_percent = ((tp_price_float - entry_price_float) / entry_price_float) * 100
                                    else:
                                        tp_percent = ((entry_price_float - tp_price_float) / entry_price_float) * 100
                            except (ValueError, TypeError) as e:
                                logging.debug(f"Could not calculate TP percent for {asset} (trend check): tp_price={tp_price}, entry_price={entry_price}, error={e}")
                                tp_percent = 0.0
                            
                            if tp_percent > 20.0:  # TP is more than 20% away
                                should_take_profit = True
                                profit_reason = f"Profit at {pnl_percent:.1f}% - TP too high ({tp_percent:.1f}%), taking profit"
                
                # Check TP/SL conditions
                tp_hit = False
                sl_hit = False
                
                # Determine which strategy is active for this position
                current_strategy_name = agent.get_name()
                is_scalping = "scalping" in current_strategy_name.lower()
                
                # Get TP/SL thresholds (scalping or regular)
                effective_tp_percent = scalping_tp_percent if is_scalping else tp_percent
                effective_sl_percent = scalping_sl_percent if is_scalping else sl_percent
                
                # Check if strict TP enforcement is enabled
                if take_profit_strict_enforcement and pnl_percent is not None:
                    # Strict TP: Close immediately when TP% is reached
                    if pnl_percent >= effective_tp_percent:
                        tp_hit = True
                        should_take_profit = True
                        profit_reason = f"Take Profit (Strict): {pnl_percent:.2f}% >= {effective_tp_percent}%"
                        add_event(f"🎯 STRICT TAKE PROFIT triggered for {asset}: {pnl_percent:.2f}% >= {effective_tp_percent}%")
                
                # Check TP price hit
                if tp_price:
                    tp_price = float(tp_price)
                    if is_long:
                        tp_hit = current_price >= tp_price
                    else:  # short
                        tp_hit = current_price <= tp_price
                
                # Check SL price hit (already handled above, but check here too for redundancy)
                if sl_price:
                    sl_price = float(sl_price)
                    if is_long:
                        sl_hit = current_price <= sl_price
                    else:  # short
                        sl_hit = current_price >= sl_price
                
                if tp_hit or sl_hit:
                    should_take_profit = True
                    profit_reason = "TP" if tp_hit else "SL"
                elif not tp_price and not sl_price and not take_profit_strict_enforcement:
                    # No TP/SL found, but if up significantly, take profit (only if strict TP is not enabled)
                    if pnl_percent >= 10.0:
                        should_take_profit = True
                        profit_reason = f"Profit at {pnl_percent:.1f}% - no TP set, taking profit"
                
                if should_take_profit:
                    reason = profit_reason if profit_reason else ("TP" if tp_hit else ("SL" if sl_hit else "Smart Profit"))
                    target_price = tp_price if (tp_price and tp_hit) else (sl_price if (sl_price and sl_hit) else current_price)
                    add_event(f"💰 Taking profit for {asset}: {pnl_percent:.1f}% up (${unrealized_pnl:.2f} profit). Reason: {reason}. Locking in gains!")
                    
                    try:
                        # Close position immediately
                        close_action = "sell" if is_long else "buy"
                        if is_long:
                            close_order = await hyperliquid.place_sell_order(asset, position_size, reduce_only=True)
                        else:
                            close_order = await hyperliquid.place_buy_order(asset, position_size, reduce_only=True)
                        add_event(f"✅ Closed {asset} position ({reason}) via {close_action} order - Gains Protected!")
                        await _safe_cancel_all_orders(asset, f"post-close {reason} cleanup")
                        
                        # Send webhook notification for exit
                        try:
                            pnl_usd = (current_price - float(entry_price or current_price)) * position_size if is_long else (float(entry_price or current_price) - current_price) * position_size
                            await webhook_notifier.notify_exit(
                                asset=asset,
                                side="LONG" if is_long else "SHORT",
                                entry_price=float(entry_price or current_price),
                                exit_price=current_price,
                                pnl_percent=pnl_percent,
                                pnl_usd=pnl_usd,
                                reason=reason,
                                size=position_size
                            )
                        except Exception as e:
                            logging.debug(f"Webhook exit notification failed: {e}")
                        
                        # Remove from active trades if present
                        for tr in active_trades[:]:
                            if tr.get('asset') == asset:
                                active_trades.remove(tr)
                        
                        # Log to diary
                        with open(diary_path, "a") as f:
                            f.write(json.dumps({
                                "timestamp": datetime.now(timezone.utc).isoformat(),
                                "asset": asset,
                                "action": "close_" + reason.lower(),
                                "entry_price": entry_price,
                                "exit_price": current_price,
                                "tp_price": tp_price,
                                "sl_price": sl_price,
                                "amount": position_size,
                                "reason": f"{reason} target reached - automatic close",
                                "pnl": (current_price - float(entry_price or current_price)) * position_size if is_long else (float(entry_price or current_price) - current_price) * position_size
                            }) + "\n")
                        realized_pnl = (current_price - float(entry_price or current_price)) * position_size if is_long else (float(entry_price or current_price) - current_price) * position_size
                        await _record_pair_hunter_outcome(asset, realized_pnl, pnl_percent, f"close_{reason.lower()}")
                    except Exception as e:
                        add_event(f"❌ Failed to close {asset} position: {e}")
                        import traceback
                        logging.error(f"Error closing position for {asset}: {e}\n{traceback.format_exc()}")

            # Check if trading is enabled (allows pausing new entries while still monitoring positions)
            trading_enabled = CONFIG.get("trading_enabled", True)
            if not trading_enabled:
                add_event("⏸️  TRADING PAUSED: Skipping new trade entries. Still monitoring existing positions for TP/SL.")
                logging.info("⏸️  Trading is disabled (TRADING_ENABLED=false). Monitoring positions only.")
            
            # Execute trades for each asset
            for output in outputs.get("trade_decisions", []) if isinstance(outputs, dict) else []:
                try:
                    asset = output.get("asset")
                    if not asset or asset not in decision_assets:
                        continue
                    action = output.get("action")
                    current_price = asset_prices.get(asset, 0)
                    action = output["action"]
                    rationale = output.get("rationale", "")
                    if rationale:
                        add_event(f"Decision rationale for {asset}: {rationale}")
                    
                    # If trading is disabled, skip new entries but allow closing existing positions
                    if action in ("buy", "sell") and not trading_enabled:
                        # Check if this is closing an existing position or opening a new one
                        existing_position = None
                        for pos in positions:
                            if pos.get('symbol') == asset and abs(float(pos.get('quantity', 0))) > 0:
                                existing_position = pos
                                break
                        
                        # Allow closing existing positions (safety), but block new entries
                        if not existing_position:
                            add_event(f"⏸️  SKIPPED {asset} {action.upper()}: Trading is paused. Only closing existing positions allowed.")
                            continue
                        else:
                            # This is closing an existing position - allow it for safety
                            add_event(f"✅ ALLOWED {asset} {action.upper()}: Closing existing position (trading paused but position management active)")
                    
                    if action in ("buy", "sell"):
                        is_buy = action == "buy"
                        llm_alloc_usd = float(output.get("allocation_usd", 0.0))
                        
                        # CRITICAL: Check for existing positions and prevent unnecessary trades
                        # Find existing position for this asset
                        existing_position = None
                        existing_trade = None
                        existing_is_long = None
                        entry_price = None
                        opened_at_str = None
                        
                        for tr in active_trades:
                            if tr.get('asset') == asset:
                                existing_trade = tr
                                existing_is_long = tr.get('is_long', True)
                                entry_price = float(tr.get('entry_price', current_price))
                                opened_at_str = tr.get('opened_at')
                                break
                        
                        for pos in positions:
                            if pos.get('symbol') == asset and abs(float(pos.get('quantity', 0))) > 0:
                                existing_position = pos
                                # If we don't have trade record, determine direction from exchange
                                if existing_is_long is None:
                                    pos_quantity = float(pos.get('quantity', 0))
                                    existing_is_long = pos_quantity > 0
                                
                                # Try to get opened_at from position's openTime if not in active_trades
                                if not opened_at_str:
                                    open_time = pos.get('openTime') or pos.get('openedAt')
                                    if open_time:
                                        try:
                                            if isinstance(open_time, (int, float)):
                                                # Timestamp in milliseconds
                                                opened_at_dt = datetime.fromtimestamp(open_time / 1000, tz=timezone.utc)
                                                opened_at_str = opened_at_dt.isoformat()
                                            elif isinstance(open_time, str):
                                                # Try to parse ISO string
                                                opened_at_dt = datetime.fromisoformat(open_time.replace('Z', '+00:00'))
                                                opened_at_str = opened_at_dt.isoformat()
                                        except Exception as e:
                                            logging.debug(f"Could not parse openTime for {asset}: {e}")
                                
                                # Get entry price from position if not in trade record
                                if not entry_price or entry_price == current_price:
                                    entry_price = float(pos.get('entry_price') or pos.get('entryPrice') or current_price)
                                
                                break
                        
                        # If we have an existing position, check what the LLM wants to do
                        if existing_position:
                            # Determine if this is adding to position (same direction) or closing/flipping (opposite direction)
                            is_same_direction = (is_buy and existing_is_long) or (not is_buy and not existing_is_long)
                            is_closing = (is_buy and not existing_is_long) or (not is_buy and existing_is_long)
                            
                            # CRITICAL: BLOCK adding to existing positions in the same direction
                            if is_same_direction:
                                add_event(f"⏸️  BLOCKED ADDING TO POSITION for {asset}: Already have {'long' if existing_is_long else 'short'} position. Only close/flip when exit conditions are met. Holding existing position.")
                                continue  # Skip this trade - hold the existing position
                            
                            # If closing/flipping, execute immediately when AI decides - no premature checks
                            if is_closing:
                                # Calculate price movement for logging
                                price_move_pct = abs((current_price - entry_price) / entry_price * 100) if entry_price and entry_price > 0 else 0
                                
                                # Log the exit decision - AI has decided to close, execute immediately
                                add_event(f"✅ EXIT for {asset}: AI decision to close position (price move: {price_move_pct:.2f}%)")
                        
                        # Get per-asset leverage (from .env override or default)
                        asset_leverage = per_asset_leverage.get(asset, default_leverage)
                        
                        # Get exchange max leverage for this asset
                        available_balance = state.get('balance', 0.0)
                        max_leverage = await get_max_leverage_for_asset(hyperliquid, asset)
                        
                        # ALWAYS USE MARGIN MODE - Strict enforcement of MARGIN_PER_POSITION and per-asset leverage
                        margin_per_position = trading_settings.get("margin_per_position")
                        
                        # CRITICAL: If margin_per_position is not set, skip trade (strict enforcement)
                        if margin_per_position is None:
                            add_event(f"❌ ERROR: MARGIN_PER_POSITION is not set in settings/.env. Cannot place trade for {asset}. Please configure MARGIN_PER_POSITION.")
                            continue
                        
                        # Set leverage BEFORE calculating notional (for margin mode, this determines actual leverage)
                        # CRITICAL: Always use user's leverage setting (per-asset or default) for calculations
                        # Only use exchange max if user's setting exceeds it AND exchange rejects it
                        leverage_to_use = asset_leverage  # Always start with user's setting (per-asset or default)
                        
                        if hasattr(hyperliquid, 'set_leverage'):
                            try:
                                # Try to set user's requested leverage (per-asset or default)
                                await hyperliquid.set_leverage(asset, asset_leverage)
                                # Successfully set - use user's leverage
                                leverage_to_use = asset_leverage
                                if asset_leverage != default_leverage:
                                    add_event(f"✅ Set per-asset leverage for {asset} to {asset_leverage}x (from .env setting)")
                                else:
                                    add_event(f"✅ Set leverage for {asset} to {asset_leverage}x (default from settings)")
                            except Exception as e:
                                error_msg = str(e)
                                # Check if leverage was rejected (not valid)
                                if "-4028" in error_msg or "not valid" in error_msg.lower():
                                    # Exchange rejected user's setting - must use exchange max for actual trade
                                    # But warn user that their setting couldn't be applied
                                    if asset_leverage != default_leverage:
                                        add_event(f"⚠️  Per-asset leverage {asset_leverage}x not supported for {asset} (exchange max: {max_leverage}x). Exchange will use {max_leverage}x, but calculations use your setting {asset_leverage}x")
                                    else:
                                        add_event(f"⚠️  Default leverage {asset_leverage}x not supported for {asset} (exchange max: {max_leverage}x). Exchange will use {max_leverage}x, but calculations use your setting {asset_leverage}x")
                                    # Use exchange max for actual trade execution
                                    leverage_to_use = max_leverage
                                else:
                                    add_event(f"⚠️  Could not set leverage {asset_leverage}x for {asset}: {e}. Using exchange max {max_leverage}x.")
                                    leverage_to_use = max_leverage
                        else:
                            # No set_leverage method - use user's setting if within exchange limits, otherwise exchange max
                            if asset_leverage <= max_leverage:
                                leverage_to_use = asset_leverage
                            else:
                                leverage_to_use = max_leverage
                                add_event(f"⚠️  Per-asset leverage {asset_leverage}x exceeds exchange max {max_leverage}x for {asset}, using {max_leverage}x")
                        
                        # ALWAYS USE MARGIN MODE: STRICTLY enforce MARGIN_PER_POSITION (never exceed user's setting)
                        # Dual enforcement: System-level (here) and Agent-level (in LLM context)
                        alloc_usd = min(margin_per_position, available_balance)
                        
                        # STRICT VALIDATION: Margin must never exceed MARGIN_PER_POSITION
                        if alloc_usd > margin_per_position:
                            add_event(f"❌ CRITICAL ERROR: Calculated margin ${alloc_usd:.2f} exceeds MARGIN_PER_POSITION ${margin_per_position:.2f}. Skipping trade for {asset}.")
                            continue
                        
                        # Validate LLM didn't suggest exceeding margin (agent-level enforcement check)
                        if llm_alloc_usd > 0 and llm_alloc_usd > margin_per_position:
                            add_event(f"⚠️  WARNING: LLM suggested allocation ${llm_alloc_usd:.2f} exceeds MARGIN_PER_POSITION ${margin_per_position:.2f}. System enforcing ${alloc_usd:.2f} instead.")
                        
                        notional_preview = alloc_usd * leverage_to_use
                        
                        # Calculate expected profit for informational purposes only
                        from src.utils.position_sizing import calculate_profit
                        expected_profit_1_5pct = calculate_profit(alloc_usd, 1, leverage_to_use)
                        expected_profit_2pct = calculate_profit(alloc_usd, 2.0, leverage_to_use)
                        
                        add_event(f"💰 MARGIN MODE (ALWAYS): Using ${alloc_usd:.2f} margin (MARGIN_PER_POSITION: ${margin_per_position:.2f}) with {leverage_to_use}x leverage = ${notional_preview:.2f} notional")
                        add_event(f"   📊 Expected profit: ${expected_profit_1_5pct:.2f} on 1% move, ${expected_profit_2pct:.2f} on 2% move")
                        add_event(f"   ✅ System-level enforcement: Margin strictly capped at ${margin_per_position:.2f}, Leverage: {leverage_to_use}x (per-asset: {asset_leverage}x, default: {default_leverage}x)")
                        
                        if alloc_usd <= 0:
                            # If LLM signals 'sell' with zero allocation but we have a position, close it reduce-only
                            if not is_buy:
                                # Check if position exists
                                state_check = await hyperliquid.get_user_state()
                                close_size = 0.0
                                is_long_pos = True
                                for p in state_check.get('positions', []):
                                    sym = p.get('coin') or p.get('symbol')
                                    if sym == asset:
                                        raw = float(p.get('szi') or p.get('quantity') or 0)
                                        if abs(raw) > 0:
                                            close_size = abs(raw)
                                            is_long_pos = raw > 0
                                            break
                                if close_size > 0:
                                    try:
                                        # Reduce-only market close regardless of TP/SL
                                        if is_long_pos:
                                            await hyperliquid.place_sell_order(asset, close_size, reduce_only=True)
                                        else:
                                            await hyperliquid.place_buy_order(asset, close_size, reduce_only=True)
                                        add_event(f"✅ Closed {asset} due to LLM 'sell' with zero allocation (reduce-only market close)")
                                        await _safe_cancel_all_orders(asset, "post-close llm-signal cleanup")
                                        # Log closure intent (price captured above in asset_prices)
                                        with open(diary_path, "a") as f:
                                            f.write(json.dumps({
                                                "timestamp": datetime.now(timezone.utc).isoformat(),
                                                "asset": asset,
                                                "action": "close_llm_signal",
                                                "amount": close_size,
                                                "reason": "LLM sell with zero allocation - executing reduce-only market close"
                                            }) + "\n")
                                    except Exception as e:
                                        add_event(f"❌ Failed to close {asset} on LLM signal: {e}")
                                    continue
                            add_event(f"Holding {asset}: zero/negative allocation")
                            continue
                        
                        # CRITICAL FIX: Apply leverage to convert margin to notional value before calculating contract quantity
                        # alloc_usd is the margin/capital allocated, but we need notional = margin × leverage
                        # Example: $10 margin with 10x leverage = $100 notional, then contracts = $100 / price
                        # Use leverage_to_use (the leverage that was actually set or max allowed)
                        notional_value = alloc_usd * leverage_to_use
                        amount = notional_value / current_price
                        
                        # Log position sizing details
                        if leverage_to_use != default_leverage:
                            add_event(f"📊 Position sizing: ${alloc_usd:.2f} margin × {leverage_to_use}x leverage (capped from {default_leverage}x) = ${notional_value:.2f} notional → {amount:.6f} contracts @ ${current_price:.2f}")
                        else:
                            add_event(f"📊 Position sizing: ${alloc_usd:.2f} margin × {leverage_to_use}x leverage = ${notional_value:.2f} notional → {amount:.6f} contracts @ ${current_price:.2f}")

                        order = await hyperliquid.place_buy_order(asset, amount) if is_buy else await hyperliquid.place_sell_order(asset, amount)
                        
                        # Wait for order to fill and position to be established
                        await asyncio.sleep(2)  # Give exchange time to process
                        
                        # Verify position exists before placing TP/SL
                        state_check = await hyperliquid.get_user_state()
                        position_exists = False
                        actual_position_size = amount
                        
                        for pos in state_check.get('positions', []):
                            if pos.get('coin') == asset or pos.get('symbol') == asset:
                                pos_size = abs(float(pos.get('szi') or pos.get('quantity', 0)))
                                if pos_size > 0:
                                    position_exists = True
                                    actual_position_size = pos_size
                                    add_event(f"Position confirmed: {asset} size {actual_position_size}")
                                    break
                        
                        if not position_exists:
                            add_event(f"WARNING: Position for {asset} not found after order. Skipping TP/SL placement.")
                        
                        fills_check = await hyperliquid.get_recent_fills(limit=10)
                        filled = False
                        for fc in reversed(fills_check):
                            try:
                                if (fc.get('coin') == asset or fc.get('asset') == asset):
                                    filled = True
                                    break
                            except Exception:
                                continue
                        trade_log.append({"type": action, "price": current_price, "amount": amount, "exit_plan": output["exit_plan"], "filled": filled})
                        
                        # Send webhook notification for entry
                        if position_exists and filled:
                            try:
                                await webhook_notifier.notify_entry(
                                    asset=asset,
                                    side="LONG" if is_buy else "SHORT",
                                    price=current_price,
                                    size=actual_position_size,
                                    leverage=leverage_to_use,
                                    reason=output.get("rationale", "")
                                )
                            except Exception as e:
                                logging.debug(f"Webhook entry notification failed: {e}")
                        
                        tp_oid = None
                        sl_oid = None
                        
                        # Calculate TP/SL prices if not provided by agent, or use agent's values
                        tp_price = output.get("tp_price")
                        sl_price = output.get("sl_price")
                        
                        if position_exists:
                            # If agent didn't provide TP/SL, calculate from configured percentages
                            if not tp_price or not sl_price:
                                calculated_tp, calculated_sl = calculate_tp_sl_prices(
                                    current_price, is_buy, tp_percent, sl_percent
                                )
                                if not tp_price:
                                    tp_price = calculated_tp
                                    add_event(f"📊 Calculated TP for {asset}: {tp_price:.4f} ({tp_percent}% from entry)")
                                if not sl_price:
                                    sl_price = calculated_sl
                                    add_event(f"🛡️  Calculated SL for {asset}: {sl_price:.4f} ({sl_percent}% from entry)")
                            
                            # Cancel existing TP/SL orders first to avoid "max stop order limit" error
                            try:
                                await hyperliquid.cancel_all_orders(asset)
                                add_event(f"🧹 Cancelled existing orders for {asset} before placing TP/SL")
                            except Exception as e:
                                add_event(f"⚠️  Could not cancel existing orders for {asset}: {e}")
                            
                            protection = await _ensure_protective_orders(
                                asset=asset,
                                is_long=is_buy,
                                position_size=actual_position_size,
                                tp_price=tp_price,
                                sl_price=sl_price,
                                trading_settings=trading_settings,
                            )
                            tp_price = protection.get("tp_price")
                            sl_price = protection.get("sl_price")
                            tp_oid = protection.get("tp_oid")
                            sl_oid = protection.get("sl_oid")

                            if tp_price and not tp_oid:
                                add_event(f"⚠️  TP for {asset} price is set but order ID is missing. Verify exchange open orders.")
                            if sl_price and trading_settings.get('enable_stop_loss_orders', True) and not sl_oid:
                                add_event(f"⚠️  SL for {asset} price is set but order ID is missing. Verify exchange open orders.")
                        # Reconcile: if opposite-side position exists or TP/SL just filled, clear stale active_trades for this asset
                        for existing in active_trades[:]:
                            if existing.get('asset') == asset:
                                try:
                                    active_trades.remove(existing)
                                except ValueError:
                                    pass
                        active_trades.append({
                            "asset": asset,
                            "is_long": is_buy,
                            "amount": amount,
                            "entry_price": current_price,
                            "tp_oid": tp_oid,
                            "sl_oid": sl_oid,
                            "leverage": leverage_to_use,
                            "exit_plan": output["exit_plan"],
                            "opened_at": datetime.now().isoformat()
                        })
                        add_event(f"{action.upper()} {asset} amount {amount:.4f} at ~{current_price}")
                        if rationale:
                            add_event(f"Post-trade rationale for {asset}: {rationale}")
                        # Write to diary after confirming fills status
                        with open(diary_path, "a") as f:
                            diary_entry = {
                                "timestamp": datetime.now(timezone.utc).isoformat(),
                                "asset": asset,
                                "action": action,
                                "allocation_usd": alloc_usd,
                                "amount": amount,
                                "entry_price": current_price,
                                "tp_price": tp_price,
                                "tp_oid": tp_oid,
                                "sl_price": sl_price,
                                "sl_oid": sl_oid,
                                "exit_plan": output.get("exit_plan", ""),
                                "rationale": output.get("rationale", ""),
                                "reasoning": reasoning_text,  # Include full LLM reasoning from this cycle
                                "order_result": str(order),
                                "opened_at": datetime.now(timezone.utc).isoformat(),
                                "filled": filled
                            }
                            f.write(json.dumps(diary_entry) + "\n")
                    else:
                        # Hold decision - log with all fields for consistency
                        add_event(f"Hold {asset}: {output.get('rationale', '')}")
                        # Write hold to diary with complete fields
                        with open(diary_path, "a") as f:
                            diary_entry = {
                                "timestamp": datetime.now(timezone.utc).isoformat(),
                                "asset": asset,
                                "action": "hold",
                                "allocation_usd": output.get("allocation_usd", 0.0),  # May be 0 for holds
                                "amount": 0.0,  # No position size for holds
                                "entry_price": None,
                                "tp_price": output.get("tp_price"),  # May have TP/SL even on hold
                                "tp_oid": None,
                                "sl_price": output.get("sl_price"),
                                "sl_oid": None,
                                "exit_plan": output.get("exit_plan", ""),
                                "rationale": output.get("rationale", ""),
                                "reasoning": reasoning_text,  # Include full LLM reasoning from this cycle
                                "order_result": None,
                                "filled": False
                            }
                            f.write(json.dumps(diary_entry) + "\n")
                except Exception as e:
                    import traceback
                    add_event(f"Execution error {asset}: {e}")

            await asyncio.sleep(get_interval_seconds(args.interval))

    async def handle_diary(request):
        """Return diary entries as JSON or newline-delimited text."""
        try:
            raw = request.query.get('raw')
            download = request.query.get('download')
            if raw or download:
                if not os.path.exists(diary_path):
                    return web.Response(text="", content_type="text/plain")
                with open(diary_path, "r") as f:
                    data = f.read()
                headers = {}
                if download:
                    headers["Content-Disposition"] = f"attachment; filename=diary.jsonl"
                return web.Response(text=data, content_type="text/plain", headers=headers)
            limit = int(request.query.get('limit', '200'))
            with open(diary_path, "r") as f:
                lines = f.readlines()
            start = max(0, len(lines) - limit)
            entries = [json.loads(l) for l in lines[start:]]
            return web.json_response({"entries": entries})
        except FileNotFoundError:
            return web.json_response({"entries": []})
        except Exception as e:
            return web.json_response({"error": str(e)}, status=500)

    async def handle_logs(request):
        """Return recent log entries as JSON (structured) or plain text."""
        try:
            path = request.query.get('path', 'trading_agent.log')  # Default to main log file
            download = request.query.get('download')
            limit_param = request.query.get('limit')
            format_type = request.query.get('format', 'json')  # 'json' or 'text'
            
            if not os.path.exists(path):
                # Return empty result if log file doesn't exist yet
                if format_type == 'json':
                    return web.json_response([])
                return web.Response(text="", content_type="text/plain")
            
            with open(path, "r", encoding='utf-8') as f:
                lines = f.readlines()
            
            # Apply limit
            if limit_param:
                if limit_param.lower() == 'all' or limit_param == '-1':
                    filtered_lines = lines
                else:
                    limit = int(limit_param)
                    filtered_lines = lines[-limit:]
            else:
                filtered_lines = lines[-2000:]  # Default 2000 lines
            
            # If download requested, return as plain text file
            if download:
                headers = {"Content-Disposition": f"attachment; filename={os.path.basename(path)}"}
                return web.Response(text=''.join(filtered_lines), content_type="text/plain", headers=headers)
            
            # Return as JSON (structured) for dashboard
            if format_type == 'json':
                import re
                log_entries = []
                for line in filtered_lines:
                    line = line.strip()
                    if not line:
                        continue
                    
                    # Try to parse structured log format: "timestamp - LEVEL - message"
                    # Example: "2025-11-03 10:00:00,123 - INFO - Starting agent"
                    match = re.match(r'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:,\d+)?)\s*-\s*(\w+)\s*-\s*(.+)', line)
                    if match:
                        timestamp_str, level_str, message = match.groups()
                        # Convert level string to our level enum
                        level_map = {
                            'DEBUG': 'info',
                            'INFO': 'info',
                            'WARNING': 'warning',
                            'ERROR': 'error',
                            'CRITICAL': 'error'
                        }
                        level = level_map.get(level_str.upper(), 'info')
                        
                        # Parse timestamp
                        try:
                            if ',' in timestamp_str:
                                ts_parts = timestamp_str.split(',')
                                dt = datetime.strptime(ts_parts[0], '%Y-%m-%d %H:%M:%S')
                                timestamp = dt.replace(tzinfo=timezone.utc).isoformat()
                            else:
                                dt = datetime.strptime(timestamp_str, '%Y-%m-%d %H:%M:%S')
                                timestamp = dt.replace(tzinfo=timezone.utc).isoformat()
                        except:
                            timestamp = datetime.now(timezone.utc).isoformat()
                        
                        log_entries.append({
                            'id': f"log-{len(log_entries)}",
                            'level': level,
                            'message': message,
                            'timestamp': timestamp
                        })
                    else:
                        # Plain text line without structured format
                        log_entries.append({
                            'id': f"log-{len(log_entries)}",
                            'level': 'info',
                            'message': line,
                            'timestamp': datetime.now(timezone.utc).isoformat()
                        })
                
                return web.json_response(log_entries)
            else:
                # Return as plain text
                limit = int(limit_param) if limit_param else 2000
                return web.Response(text=''.join(filtered_lines[-limit:]), content_type="text/plain")
        except Exception as e:
            logger.error(f"Error reading logs: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return web.json_response({"error": str(e)}, status=500)

    def _normalize_order_type(order: dict) -> str:
        """Normalize exchange order type across Binance/Aster payload shapes."""
        if not isinstance(order, dict):
            return ""
        raw = (
            order.get("orderType")
            or order.get("type")
            or order.get("origType")
            or order.get("order_type")
            or ""
        )
        return str(raw).upper().replace("-", "_")

    def _extract_tp_sl_from_orders(open_orders, asset: str):
        """Extract best-effort TP/SL trigger prices for an asset from open reduce-only orders."""
        tp_price = None
        sl_price = None
        tp_oid = None
        sl_oid = None
        target_asset = str(asset or "").upper().replace("/USDT", "").replace("USDT", "")

        for order in open_orders or []:
            order_asset = str(order.get("coin") or order.get("asset") or order.get("symbol") or "").upper()
            order_asset = order_asset.replace("/USDT", "").replace("USDT", "")
            if order_asset != target_asset:
                continue

            order_type = _normalize_order_type(order)
            trigger = order.get("triggerPx")
            if trigger is None:
                trigger = order.get("stopPrice")
            if trigger is None:
                trigger = order.get("price")
            try:
                trigger = float(trigger) if trigger is not None else None
            except (ValueError, TypeError):
                trigger = None

            oid = order.get("oid") or order.get("orderId") or order.get("id")
            if oid is not None:
                oid = str(oid)

            if order_type.startswith("TAKE_PROFIT"):
                if trigger is not None:
                    tp_price = trigger
                if oid:
                    tp_oid = oid
            elif order_type.startswith("STOP"):
                if trigger is not None:
                    sl_price = trigger
                if oid:
                    sl_oid = oid

        return {
            "tp_price": tp_price,
            "sl_price": sl_price,
            "tp_oid": tp_oid,
            "sl_oid": sl_oid,
        }

    async def _safe_cancel_all_orders(asset: str, reason: str = ""):
        """Best-effort cancel of all open orders for an asset."""
        try:
            await hyperliquid.cancel_all_orders(asset)
            suffix = f" ({reason})" if reason else ""
            add_event(f"🧹 Cancelled all open orders for {asset}{suffix}")
        except Exception as e:
            suffix = f" ({reason})" if reason else ""
            add_event(f"⚠️  Could not cancel open orders for {asset}{suffix}: {e}")

    async def _ensure_protective_orders(asset: str, is_long: bool, position_size: float, tp_price, sl_price, trading_settings: dict):
        """Place and verify TP/SL orders with retries, returning confirmed values from open orders."""
        confirmed_tp = None
        confirmed_sl = None
        confirmed_tp_oid = None
        confirmed_sl_oid = None

        # Attempt placement first (best effort)
        if tp_price:
            try:
                tp_order = await hyperliquid.place_take_profit(asset, is_long, position_size, tp_price)
                tp_oids = hyperliquid.extract_oids(tp_order) if hasattr(hyperliquid, "extract_oids") else []
                if tp_oids:
                    confirmed_tp_oid = tp_oids[0]
                add_event(f"✅ TP placed {asset} at {float(tp_price):.4f}")
            except Exception as e:
                add_event(f"❌ Failed to place TP for {asset}: {e}")

        enable_sl_orders = bool(trading_settings.get("enable_stop_loss_orders", True))
        if sl_price and enable_sl_orders:
            try:
                sl_order = await hyperliquid.place_stop_loss(asset, is_long, position_size, sl_price)
                sl_oids = hyperliquid.extract_oids(sl_order) if hasattr(hyperliquid, "extract_oids") else []
                if sl_oids:
                    confirmed_sl_oid = sl_oids[0]
                add_event(f"✅ SL placed {asset} at {float(sl_price):.4f}")
            except Exception as e:
                add_event(f"❌ Failed to place SL for {asset}: {e}")

        # Verify via open orders and retry missing side once per cycle.
        for attempt in range(1, 4):
            try:
                open_orders = await hyperliquid.get_open_orders()
                extracted = _extract_tp_sl_from_orders(open_orders, asset)
                confirmed_tp = extracted.get("tp_price")
                confirmed_sl = extracted.get("sl_price")
                confirmed_tp_oid = extracted.get("tp_oid") or confirmed_tp_oid
                confirmed_sl_oid = extracted.get("sl_oid") or confirmed_sl_oid
            except Exception as e:
                add_event(f"⚠️  Could not verify TP/SL orders for {asset} (attempt {attempt}/3): {e}")
                await asyncio.sleep(1)
                continue

            missing_tp = bool(tp_price) and not bool(confirmed_tp)
            missing_sl = bool(sl_price) and enable_sl_orders and not bool(confirmed_sl)
            if not missing_tp and not missing_sl:
                break

            add_event(
                f"⚠️  Protective order check {asset} (attempt {attempt}/3): "
                f"TP {'missing' if missing_tp else 'ok'}, SL {'missing' if missing_sl else 'ok'}"
            )

            if missing_tp:
                try:
                    await hyperliquid.place_take_profit(asset, is_long, position_size, tp_price)
                except Exception:
                    pass
            if missing_sl:
                try:
                    await hyperliquid.place_stop_loss(asset, is_long, position_size, sl_price)
                except Exception:
                    pass
            await asyncio.sleep(1)

        return {
            "tp_price": confirmed_tp if confirmed_tp is not None else (float(tp_price) if tp_price else None),
            "sl_price": confirmed_sl if confirmed_sl is not None else (float(sl_price) if sl_price else None),
            "tp_oid": confirmed_tp_oid,
            "sl_oid": confirmed_sl_oid,
        }

    async def handle_positions(request):
        """Return current positions as JSON."""
        try:
            logging.debug("Fetching positions from exchange...")
            state = await hyperliquid.get_user_state()
            try:
                open_orders_for_positions = await hyperliquid.get_open_orders()
            except Exception as e:
                logging.warning(f"Could not fetch open orders for TP/SL enrichment: {e}")
                open_orders_for_positions = []
            positions_list = []
            
            logging.debug(f"Exchange returned {len(state.get('positions', []))} position(s)")
            
            for pos in state.get('positions', []):
                # Extract position data (works for both Aster and Binance formats)
                coin = pos.get('coin') or pos.get('symbol', '')
                szi = pos.get('szi') or pos.get('positionAmt') or pos.get('quantity', 0)
                entry_px = pos.get('entryPx') or pos.get('entryPrice') or pos.get('entry_price', 0)
                
                # Always fetch fresh current price for real-time updates
                current_px = None
                if coin:
                    try:
                        current_px = await hyperliquid.get_current_price(coin)
                    except Exception as e:
                        logging.warning(f"Could not fetch current price for {coin}: {e}")
                        # Fallback to markPrice from position data if fetch fails
                        current_px = pos.get('current_price') or pos.get('markPrice') or pos.get('markPrice') or pos.get('currentPrice')
                        if not current_px:
                            current_px = entry_px  # Last resort: use entry price
                
                pnl = pos.get('pnl') or pos.get('unRealizedProfit') or pos.get('unrealized_pnl', 0)
                
                # Determine side (positive = long, negative = short)
                size = float(szi) if szi else 0
                side = "long" if size > 0 else "short" if size < 0 else None
                
                if side and abs(size) > 0:  # Only include non-zero positions
                    protective_orders = _extract_tp_sl_from_orders(open_orders_for_positions, coin)
                    # ONLY use actual leverage from Binance position data (no fallback to settings/config)
                    leverage = pos.get('leverage')
                    if leverage:
                        try:
                            leverage = float(leverage)
                            logging.debug(f"Using actual leverage {leverage}x from Binance for position {coin}")
                        except (ValueError, TypeError):
                            leverage = None
                            logging.warning(f"⚠️  Could not parse leverage from Binance for {coin}, setting to None")
                    else:
                        leverage = None
                        logging.warning(f"⚠️  No leverage found in Binance position data for {coin}, setting to None")
                    
                    # Get liquidation price if available
                    liquidation_price = pos.get('liquidationPrice') or pos.get('liquidation_price') or pos.get('liqPx') or pos.get('liquidationPx')
                    
                    # Get actual initial margin from position data (more accurate than calculating)
                    # Binance API returns this as 'positionInitialMargin' or 'initialMargin'
                    initial_margin = pos.get('positionInitialMargin') or pos.get('initialMargin') or pos.get('position_initial_margin') or pos.get('initial_margin')
                    if initial_margin is None or initial_margin == 0:
                        # Fallback: calculate from notional and leverage
                        if entry_px and size and leverage:
                            notional = abs(size) * float(entry_px)
                            initial_margin = notional / leverage if leverage > 0 else None
                        else:
                            initial_margin = None
                    else:
                        initial_margin = float(initial_margin)
                    
                    # Get ROI percentage directly from Binance API
                    roi_percent = pos.get('roiPercent') or pos.get('roi')
                    if roi_percent is not None:
                        try:
                            roi_percent = float(roi_percent)
                        except (ValueError, TypeError):
                            roi_percent = None
                    
                    # Get notional value directly from Binance API
                    notional = pos.get('notional')
                    if notional is not None:
                        try:
                            notional = float(notional)
                        except (ValueError, TypeError):
                            notional = None
                    
                    # Get openTime from Binance API (timestamp in ms) - prioritize this over active_trades
                    open_time = pos.get('openTime') or pos.get('openedAt')
                    if open_time:
                        if isinstance(open_time, (int, float)):
                            # Already a timestamp in ms
                            open_time = int(open_time)
                        elif isinstance(open_time, str):
                            # Try to parse ISO string to timestamp
                            try:
                                dt = datetime.fromisoformat(open_time.replace('Z', '+00:00'))
                                open_time = int(dt.timestamp() * 1000)
                            except:
                                open_time = None
                        else:
                            open_time = None
                    else:
                        open_time = None
                    
                    # Get opened_at from active_trades as fallback (for ISO string format)
                    opened_at = None
                    if not open_time:
                        for tr in active_trades:
                            if tr.get('asset') == coin:
                                opened_at = tr.get('opened_at')
                                break
                    
                    # Use openTime to create ISO string for opened_at, or fallback to active_trades
                    if open_time:
                        opened_at = datetime.fromtimestamp(open_time / 1000, tz=timezone.utc).isoformat()
                    elif not opened_at:
                        opened_at = datetime.now(timezone.utc).isoformat()
                    
                    positions_list.append({
                        'symbol': coin,
                        'side': side,
                        'size': abs(size),  # Always positive, side indicates direction
                        'entry_price': float(entry_px) if entry_px else 0.0,
                        'current_price': float(current_px) if current_px else 0.0,
                        'liquidation_price': float(liquidation_price) if liquidation_price else None,
                        'tp_price': protective_orders.get('tp_price'),
                        'sl_price': protective_orders.get('sl_price'),
                        'tp_oid': protective_orders.get('tp_oid'),
                        'sl_oid': protective_orders.get('sl_oid'),
                        'unrealized_pnl': float(pnl) if pnl else 0.0,
                        'realized_pnl': 0.0,  # Not available from exchange directly
                        'leverage': leverage,  # ONLY from Binance exchange, never from settings
                        'initial_margin': float(initial_margin) if initial_margin else None,  # Actual margin used
                        'roiPercent': roi_percent,  # ROI percentage from Binance API
                        'notional': notional,  # Notional value from Binance API
                        'opened_at': opened_at,  # ISO string format
                        'openTime': open_time,  # Timestamp in ms from Binance API
                        'updated_at': datetime.now(timezone.utc).isoformat()
                    })
                    logging.debug(f"Added position: {coin} {side} {abs(size)}")
            
            logging.info(f"Returning {len(positions_list)} position(s) to client")
            return web.json_response(positions_list)
        except Exception as e:
            logging.error(f"Error getting positions: {e}")
            import traceback
            logging.error(traceback.format_exc())
            return web.json_response({"error": str(e)}, status=500)

    async def handle_balances(request):
        """Return all asset balances (USDT, USDC, BTC, etc.) from the exchange."""
        try:
            logging.info("Fetching balances from exchange...")
            state = await hyperliquid.get_user_state()
            
            # Get asset balances if available (Binance returns this, Aster might not)
            asset_balances = state.get('asset_balances', [])
            
            logging.info(f"Retrieved {len(asset_balances)} asset balances from get_user_state")
            if asset_balances:
                logging.info(f"Asset balance keys: {[b.get('asset', 'N/A') for b in asset_balances[:5]]}")
            
            # If no asset_balances in state, try to construct from positions and account info
            if not asset_balances and exchange_name == "binance":
                # For Binance, we should have asset_balances from get_user_state
                # But if not, we can still return what we have
                logging.warning("No asset_balances found in state for Binance exchange")
                asset_balances = []
            
            # Format balances for frontend compatibility
            formatted_balances = []
            for balance in asset_balances:
                asset = balance.get('asset', '')
                if not asset:
                    continue
                    
                formatted_balance = {
                    'asset': asset,
                    'walletBalance': float(balance.get('walletBalance', 0) or 0),
                    'availableBalance': float(balance.get('availableBalance', 0) or 0),
                    'crossWalletBalance': float(balance.get('crossWalletBalance', 0) or 0),
                    'crossUnPnl': float(balance.get('crossUnPnl', 0) or 0),
                    'positionValue': float(balance.get('positionValue', balance.get('crossWalletBalance', 0)) or 0),
                }
                formatted_balances.append(formatted_balance)
                logging.debug(f"Formatted balance for {asset}: wallet={formatted_balance['walletBalance']}, cross={formatted_balance['crossWalletBalance']}")
            
            logging.info(f"Returning {len(formatted_balances)} formatted balances: {[b['asset'] for b in formatted_balances]}")
            
            # Calculate account value
            account_value = state.get('total_value', state.get('balance', 0))
            
            response_data = {
                "balances": formatted_balances,
                "accountValue": account_value,
                "balance": state.get('balance', 0),
                "exchange": exchange_name,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            
            logging.info(f"Balances response: {len(formatted_balances)} assets, accountValue={account_value}")
            return web.json_response(response_data)
        except Exception as e:
            logging.error(f"Error getting balances: {e}")
            import traceback
            logging.error(traceback.format_exc())
            return web.json_response({
                "error": str(e),
                "balances": [],
                "timestamp": datetime.now(timezone.utc).isoformat()
            }, status=500)

    async def handle_status(request):
        """Return API status and basic account info."""
        try:
            # Add timeout to prevent blocking
            try:
                state = await asyncio.wait_for(hyperliquid.get_user_state(), timeout=3.0)
            except asyncio.TimeoutError:
                # Return cached/fallback status if API is slow
                if exchange_name == "aster":
                    network_label = "Aster DEX"
                    network = "mainnet"
                elif exchange_name == "binance":
                    testnet = CONFIG.get("binance_testnet", False)
                    network_label = f"Binance Futures ({'testnet' if testnet else 'mainnet'})"
                    network = "testnet" if testnet else "mainnet"
                else:
                    network_label = exchange_name
                    network = "mainnet"
                
                return web.json_response({
                    "connected": True,
                    "status": "online",
                    "network": network,
                    "network_label": network_label,
                    "exchange": exchange_name,
                    "balance": 0,
                    "account_value": 0,
                    "positions_count": 0,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "warning": "Status check timed out, using cached data"
                })
            
            if exchange_name == "aster":
                network_label = "Aster DEX"
                network = "mainnet"
            elif exchange_name == "binance":
                testnet = CONFIG.get("binance_testnet", False)
                network_label = f"Binance Futures ({'testnet' if testnet else 'mainnet'})"
                network = "testnet" if testnet else "mainnet"
            else:
                network_label = exchange_name
                network = "mainnet"
            
            return web.json_response({
                "connected": True,
                "status": "online",
                "network": network,
                "network_label": network_label,
                "exchange": exchange_name,
                "balance": round(state.get('balance', 0), 2),
                "account_value": round(state.get('total_value', 0), 2),
                "positions_count": len(state.get('positions', [])),
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
        except Exception as e:
            logging.error(f"Error getting status: {e}")
            return web.json_response({
                "connected": False,
                "status": "error",
                "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }, status=500)

    async def handle_pnl(request):
        """Return daily PNL data calculated from account value changes."""
        try:
            # Get current account state
            state = await hyperliquid.get_user_state()
            current_value = state.get('total_value') or state['balance'] + sum(p.get('pnl', 0) for p in state.get('positions', []))
            base_value = initial_account_value or current_value
            
            # Read diary entries to build timeline
            if not os.path.exists(diary_path):
                # Return current state only
                current_pnl = current_value - base_value
                return web.json_response([{
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "daily_pnl": current_pnl,
                    "cumulative_pnl": current_pnl
                }])
            
            with open(diary_path, "r") as f:
                lines = f.readlines()
            
            # Group entries by day
            entries_by_day = {}
            for line in lines:
                try:
                    entry = json.loads(line)
                    ts = entry.get('timestamp')
                    if ts:
                        dt = datetime.fromisoformat(ts.replace('Z', '+00:00'))
                        day_key = dt.date().isoformat()
                        if day_key not in entries_by_day:
                            entries_by_day[day_key] = []
                        entries_by_day[day_key].append(entry)
                except Exception:
                    continue
            
            # Calculate cumulative PNL from account value progression
            # Use positions' unrealized PNL as proxy for daily changes
            result = []
            sorted_days = sorted(entries_by_day.keys())
            prev_cumulative = 0.0
            
            for day in sorted_days:
                # Get positions at that day (estimate from diary entries)
                # For simplicity, calculate from current positions and extrapolate
                day_entries = entries_by_day[day]
                
                # Calculate daily PNL estimate from entries
                daily_pnl = 0.0
                for entry in day_entries:
                    # If position was opened, estimate contribution
                    if entry.get('action') in ['buy', 'sell']:
                        # Use a simple estimate: if we have current positions, use their PNL
                        pass
                
                # Use current positions' PNL divided by number of days for rough estimate
                if not result and state.get('positions'):
                    # Estimate initial daily PNL from current positions
                    total_unrealized = sum(p.get('pnl', 0) for p in state.get('positions', []))
                    if len(sorted_days) > 0:
                        daily_pnl = total_unrealized / max(len(sorted_days), 1)
                
                cumulative = prev_cumulative + daily_pnl
                result.append({
                    "timestamp": f"{day}T00:00:00Z",
                    "daily_pnl": daily_pnl,
                    "cumulative_pnl": cumulative
                })
                prev_cumulative = cumulative
            
            # Add current state as latest entry
            current_total_pnl = current_value - base_value
            if result:
                latest = result[-1]
                # Update latest entry with actual current PNL
                result[-1] = {
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "daily_pnl": current_total_pnl - latest.get('cumulative_pnl', 0),
                    "cumulative_pnl": current_total_pnl
                }
            else:
                # If no history, return current state
                result.append({
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "daily_pnl": current_total_pnl,
                    "cumulative_pnl": current_total_pnl
                })
            
            return web.json_response(result)
        except Exception as e:
            logging.error(f"Error getting PNL: {e}")
            import traceback
            logging.error(traceback.format_exc())
            return web.json_response({"error": str(e)}, status=500)

    async def handle_performance(request):
        """Return performance data with closed trade statistics."""
        try:
            # Read diary entries to extract closed trades
            if not os.path.exists(diary_path):
                return web.json_response([])
            
            with open(diary_path, "r") as f:
                lines = f.readlines()
            
            # Extract closed trades from diary entries
            # Track position lifecycle: open -> close
            closed_trades = []
            position_stack = []  # Stack of opened positions (FIFO)
            
            for line_idx, line in enumerate(lines):
                try:
                    entry = json.loads(line)
                    action = entry.get('action', '').lower()
                    asset = entry.get('asset')
                    timestamp = entry.get('timestamp')
                    
                    if not asset or not timestamp:
                        continue
                    
                    # Track opened positions (entries with buy/sell action and filled=True)
                    if action in ['buy', 'sell']:
                        filled = entry.get('filled', False)
                        if filled or entry.get('entry_price'):  # Position was opened
                            position_stack.append({
                                'asset': asset,
                                'entry_price': entry.get('entry_price'),
                                'amount': entry.get('amount', 0),
                                'opened_at': timestamp,
                                'is_long': action == 'buy',
                                'entry_action': action
                            })
                    
                    # Identify closed trades
                    if (action.startswith('close_') or 
                        (entry.get('exit_price') is not None) or
                        (entry.get('reason') and 'close' in entry.get('reason', '').lower())):
                        # Find matching open position for this asset
                        matching_pos = None
                        for i, pos in enumerate(position_stack):
                            if pos['asset'] == asset:
                                matching_pos = position_stack.pop(i)
                                break
                        
                        # If no matching position found, try to use entry data
                        if not matching_pos:
                            # Look for recent entry for this asset (search backwards from current line)
                            for recent_line in reversed(lines[max(0, line_idx - 50):line_idx]):
                                try:
                                    recent_entry = json.loads(recent_line)
                                    if recent_entry.get('asset') == asset and recent_entry.get('action') in ['buy', 'sell']:
                                        matching_pos = {
                                            'entry_price': recent_entry.get('entry_price'),
                                            'amount': recent_entry.get('amount', 0),
                                            'is_long': recent_entry.get('action') == 'buy',
                                            'opened_at': recent_entry.get('timestamp')
                                        }
                                        break
                                except Exception:
                                    continue
                        
                        if matching_pos:
                            entry_price = matching_pos.get('entry_price')
                            exit_price = entry.get('exit_price') or entry.get('price', 0)
                            amount = matching_pos.get('amount', 0) or entry.get('amount', 0)
                            pnl = entry.get('pnl')
                            
                            # Calculate PNL if not provided
                            if pnl is None and entry_price and exit_price and amount:
                                is_long = matching_pos.get('is_long', True)
                                if is_long:
                                    pnl = (exit_price - entry_price) * amount
                                else:
                                    pnl = (entry_price - exit_price) * amount
                            
                            if pnl is not None:
                                closed_trades.append({
                                    "date": timestamp,
                                    "value": exit_price * amount if amount else 0,
                                    "pnl": float(pnl),
                                    "won": float(pnl) > 0,
                                    "asset": asset,
                                    "entry_price": entry_price,
                                    "exit_price": exit_price,
                                    "amount": amount
                                })
                                
                except Exception:
                    continue
            
            # Sort trades by date
            closed_trades.sort(key=lambda x: x.get('date', ''))
            
            # Calculate cumulative value over time for chart
            base_value = initial_account_value or 10000.0
            cumulative_pnl = 0.0
            result = []
            
            for trade in closed_trades:
                cumulative_pnl += trade['pnl']
                current_value = base_value + cumulative_pnl
                result.append({
                    "date": trade['date'],
                    "value": current_value,
                    "pnl": trade['pnl'],
                    "won": trade['won'],
                    "asset": trade['asset']
                })
            
            # If no closed trades, return empty array
            if not result:
                return web.json_response([])
            
            return web.json_response(result)
        except Exception as e:
            logging.error(f"Error getting performance: {e}")
            import traceback
            logging.error(traceback.format_exc())
            return web.json_response({"error": str(e)}, status=500)

    async def handle_prices(request):
        """Return current prices for all trading assets."""
        try:
            prices_list = []
            
            # Get prices for all trading assets
            for asset in args.assets:
                try:
                    # Add timeout to prevent blocking
                    current_price = await asyncio.wait_for(hyperliquid.get_current_price(asset), timeout=2.0)
                    if current_price and current_price > 0:
                        # Calculate 24h change from price history if available
                        change_24h = 0.0
                        change_24h_percent = 0.0
                        
                        # Try to get 24h ago price from price_history if available
                        if asset in price_history and len(price_history[asset]) > 0:
                            # Get price from 24h ago (approximate)
                            now = datetime.now(timezone.utc)
                            prices_24h_ago = [
                                p for p in list(price_history[asset])
                                if (now - datetime.fromisoformat(p['t'].replace('Z', '+00:00'))).total_seconds() >= 86400 - 3600
                            ]
                            if prices_24h_ago:
                                price_24h_ago = prices_24h_ago[0].get('mid', current_price)
                                change_24h = current_price - price_24h_ago
                                if price_24h_ago > 0:
                                    change_24h_percent = (change_24h / price_24h_ago) * 100
                        
                        prices_list.append({
                            "symbol": asset,
                            "price": round(current_price, 2),
                            "change24h": round(change_24h, 2),
                            "change24hPercent": round(change_24h_percent, 2),
                            "timestamp": datetime.now(timezone.utc).isoformat()
                        })
                except Exception as e:
                    logging.warning(f"Failed to get price for {asset}: {e}")
                    continue
            
            return web.json_response(prices_list)
        except Exception as e:
            logging.error(f"Error getting prices: {e}")
            import traceback
            logging.error(traceback.format_exc())
            return web.json_response({"error": str(e)}, status=500)

    async def sync_trades_to_supabase():
        """Background task that continuously syncs trades to Supabase database."""
        if not os.getenv('SUPABASE_URL') or not os.getenv('SUPABASE_KEY'):
            logging.info("Supabase not configured - skipping trade sync")
            return
        
        # Get binance_api from exchange (if it's BinanceAPI)
        from src.trading.binance_api import BinanceAPI
        binance_api = exchange if isinstance(exchange, BinanceAPI) else None
        
        if not binance_api:
            logging.warning("Binance API not initialized - cannot sync trades")
            return
        
        try:
            from supabase import create_client, Client
            supabase_url = os.getenv('SUPABASE_URL')
            supabase_key = os.getenv('SUPABASE_KEY')
            
            # Prefer service_role key for server-side operations (bypasses RLS)
            # If SUPABASE_SERVICE_KEY is set, use it; otherwise use SUPABASE_KEY
            service_key = os.getenv('SUPABASE_SERVICE_KEY') or supabase_key
            
            if not service_key:
                logging.error("❌ SUPABASE_KEY or SUPABASE_SERVICE_KEY must be set")
                return
            
            supabase: Client = create_client(supabase_url, service_key)
            
            # Log which key type is being used
            if os.getenv('SUPABASE_SERVICE_KEY'):
                logging.info("🔑 Using SUPABASE_SERVICE_KEY (bypasses RLS)")
            else:
                logging.warning("⚠️ Using SUPABASE_KEY (anon key) - may fail if RLS is enabled")
                logging.warning("   Consider using SUPABASE_SERVICE_KEY for server-side operations")
        except Exception as e:
            logging.error(f"❌ Failed to initialize Supabase client: {e}")
            import traceback
            logging.error(traceback.format_exc())
            return
        
        logging.info("🔄 Starting initial trade sync to Supabase...")
        
        while True:
            try:
                # Fetch recent trades from Binance
                logging.info("📥 Fetching trades from Binance...")
                trades = await binance_api.get_recent_fills(limit=1000)
                logging.info(f"📊 Fetched {len(trades)} trades from Binance")
                
                if not trades:
                    logging.info("No trades found, waiting 1 minute before next check...")
                    await asyncio.sleep(60)  # Wait 1 minute if no trades
                    continue
                
                # Get existing trades from Supabase to avoid duplicates
                existing_trades_set = set()
                try:
                    logging.info("🔍 Checking existing trades in Supabase...")
                    # Add retry logic for connection issues
                    for retry in range(3):
                        try:
                            result = supabase.table('trades').select('symbol, executed_at, price, size').limit(10000).execute()
                            if result.data:
                                logging.info(f"📋 Found {len(result.data)} existing trades in database")
                                for t in result.data:
                                    # Normalize timestamp for comparison
                                    exec_at = t.get('executed_at', '')
                                    if exec_at:
                                        # Remove timezone info for comparison
                                        exec_at_normalized = exec_at.split('+')[0].split('.')[0] if '+' in exec_at or '.' in exec_at else exec_at
                                        key = f"{t['symbol']}_{exec_at_normalized}_{t['price']}_{t['size']}"
                                        existing_trades_set.add(key)
                            else:
                                logging.info("📋 No existing trades in database (first sync)")
                            break  # Success, exit retry loop
                        except Exception as conn_err:
                            # Check if it's a connection error (httpx may not be available)
                            is_conn_error = (
                                isinstance(conn_err, (ConnectionError, OSError)) or
                                (httpx and isinstance(conn_err, httpx.ConnectError)) or
                                '10054' in str(conn_err) or  # Windows connection reset
                                'connection' in str(conn_err).lower() or
                                'forcibly closed' in str(conn_err).lower()
                            )
                            if is_conn_error:
                                if retry < 2:  # Retry up to 3 times
                                    wait_time = (retry + 1) * 2  # 2s, 4s, 6s
                                    logging.warning(f"Supabase connection error (attempt {retry + 1}/3): {conn_err}. Retrying in {wait_time}s...")
                                    await asyncio.sleep(wait_time)
                                else:
                                    logging.warning(f"Could not fetch existing trades after 3 attempts: {conn_err}. Continuing without duplicate check.")
                                    break
                            else:
                                # Not a connection error, re-raise
                                raise
                except Exception as e:
                    logging.warning(f"Could not fetch existing trades: {e}. Continuing without duplicate check.")
                    logging.warning(f"Could not fetch existing trades: {e}. Continuing without duplicate check.")
                
                # Format and filter new trades
                new_trades = []
                for trade in trades:
                    symbol = trade.get('symbol', '').replace('USDT', '')
                    side = trade.get('side', '').lower()
                    if side not in ['buy', 'sell']:
                        side = 'buy' if side == 'buy' else 'sell'
                    
                    price = float(trade.get('price', 0))
                    size = float(trade.get('size', trade.get('qty', 0)))
                    fee = float(trade.get('fee', trade.get('commission', 0)))
                    realized_pnl = trade.get('realizedPnl') or trade.get('realized_pnl')
                    pnl = float(realized_pnl) if realized_pnl is not None else None
                    
                    # Convert timestamp to ISO string
                    timestamp_ms = trade.get('time') or trade.get('timestamp', 0)
                    if timestamp_ms:
                        if timestamp_ms > 1e12:  # Already in milliseconds
                            timestamp_iso = datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc).isoformat()
                        else:  # In seconds
                            timestamp_iso = datetime.fromtimestamp(timestamp_ms, tz=timezone.utc).isoformat()
                    else:
                        timestamp_iso = datetime.now(timezone.utc).isoformat()
                    
                    # Create composite key for duplicate check
                    exec_at_normalized = timestamp_iso.split('+')[0].split('.')[0] if '+' in timestamp_iso or '.' in timestamp_iso else timestamp_iso
                    key = f"{symbol}_{exec_at_normalized}_{price}_{abs(size)}"
                    
                    # Only add if not already in database
                    if key not in existing_trades_set:
                        new_trades.append({
                            'symbol': symbol,
                            'side': side,
                            'size': abs(size),
                            'price': price,
                            'fee': abs(fee),
                            'pnl': pnl,
                            'executed_at': timestamp_iso,
                            'order_id': None,
                        })
                        existing_trades_set.add(key)  # Add to set to avoid duplicates in this batch
                
                # Insert new trades in batches
                if new_trades:
                    try:
                        logging.info(f"💾 Saving {len(new_trades)} new trades to Supabase...")
                        # Insert in batches of 100 to avoid overwhelming the database
                        batch_size = 100
                        for i in range(0, len(new_trades), batch_size):
                            batch = new_trades[i:i + batch_size]
                            result = supabase.table('trades').insert(batch).execute()
                            logging.info(f"✅ Synced {len(batch)} trades to Supabase (batch {i//batch_size + 1})")
                        logging.info(f"✅ Total: Synced {len(new_trades)} new trades to Supabase")
                    except Exception as e:
                        error_msg = str(e)
                        logging.error(f"❌ Error inserting trades to Supabase: {error_msg}")
                        
                        # Provide helpful error message for RLS issues
                        if 'row-level security' in error_msg.lower() or '42501' in error_msg:
                            logging.error("")
                            logging.error("🔒 ROW LEVEL SECURITY (RLS) ERROR:")
                            logging.error("   Your Supabase table has RLS enabled, but you're using the anon key.")
                            logging.error("   Solution: Use SUPABASE_SERVICE_KEY instead of SUPABASE_KEY")
                            logging.error("")
                            logging.error("   Steps to fix:")
                            logging.error("   1. Go to Supabase Dashboard > Settings > API")
                            logging.error("   2. Copy the 'service_role' key (NOT the 'anon' key)")
                            logging.error("   3. Add to your .env file: SUPABASE_SERVICE_KEY=your_service_role_key")
                            logging.error("   4. Restart the agent")
                            logging.error("")
                        
                        import traceback
                        logging.error(traceback.format_exc())
                else:
                    logging.info("ℹ️ No new trades to sync (all trades already in database)")
                
                # Wait 5 minutes before next sync
                logging.info("⏳ Waiting 5 minutes before next sync...")
                await asyncio.sleep(300)
                
            except Exception as e:
                logging.error(f"Error in trade sync loop: {e}")
                import traceback
                logging.error(traceback.format_exc())
                await asyncio.sleep(60)  # Wait 1 minute on error before retrying

    async def sync_portfolio_assets():
        """Background task that syncs portfolio assets to database every hour."""
        # Get dashboard URL from environment
        dashboard_url = os.getenv('DASHBOARD_URL') or os.getenv('NEXT_PUBLIC_BASE_URL') or 'http://localhost:3001'
        dashboard_url = dashboard_url.rstrip('/')
        
        logging.info("🔄 Starting portfolio assets sync to database...")
        logging.info(f"   Dashboard URL: {dashboard_url}")
        
        # Perform initial sync immediately
        first_sync = True
        
        while True:
            try:
                # Call the portfolio assets sync endpoint
                sync_url = f"{dashboard_url}/api/portfolio/assets/sync"
                if first_sync:
                    logging.info(f"📥 Performing initial portfolio assets sync from {sync_url}...")
                    first_sync = False
                else:
                    logging.info(f"📥 Syncing portfolio assets from {sync_url}...")
                
                async with ClientSession() as session:
                    try:
                        async with session.post(sync_url, timeout=ClientTimeout(total=30)) as response:
                            if response.status == 200:
                                data = await response.json()
                                synced_count = data.get('synced', 0)
                                logging.info(f"✅ Successfully synced {synced_count} portfolio assets to database")
                            else:
                                error_text = await response.text()
                                logging.warning(f"⚠️ Portfolio assets sync returned status {response.status}: {error_text}")
                    except asyncio.TimeoutError:
                        logging.warning("⚠️ Portfolio assets sync timed out")
                    except Exception as e:
                        logging.warning(f"⚠️ Failed to sync portfolio assets: {e}")
                
                # Wait 1 hour (3600 seconds) before next sync
                logging.info("⏳ Waiting 1 hour before next portfolio assets sync...")
                await asyncio.sleep(3600)
                
            except Exception as e:
                logging.error(f"❌ Error in portfolio assets sync loop: {e}")
                import traceback
                logging.error(traceback.format_exc())
                # Wait 10 minutes on error before retrying
                await asyncio.sleep(600)

    async def handle_trades(request):
        """Return trade history from Binance API."""
        try:
            limit = int(request.query.get('limit', 1000))
            
            # Check if exchange is BinanceAPI instance
            from src.trading.binance_api import BinanceAPI
            binance_api = exchange if isinstance(exchange, BinanceAPI) else None
            
            if not binance_api:
                return web.json_response({
                    'error': 'Binance API not initialized',
                    'trades': []
                }, status=503)
            
            # Get all trades using get_recent_fills with timeout
            try:
                trades = await asyncio.wait_for(binance_api.get_recent_fills(limit=limit), timeout=12.0)
            except asyncio.TimeoutError:
                logger.warning("get_recent_fills timed out after 12s, returning empty trades")
                return web.json_response({
                    'trades': [],
                    'count': 0,
                    'source': 'binance',
                    'warning': 'Request timed out'
                })
            except Exception as e:
                logger.warning(f"get_recent_fills error: {e}, returning empty trades")
                return web.json_response({
                    'trades': [],
                    'count': 0,
                    'source': 'binance',
                    'warning': f'Error: {str(e)[:100]}'
                })
            
            # Format trades for frontend
            formatted_trades = []
            for trade in trades:
                symbol = trade.get('symbol', '').replace('USDT', '')
                side = trade.get('side', '').lower()
                if side not in ['buy', 'sell']:
                    side = 'buy' if side == 'buy' else 'sell'
                
                price = float(trade.get('price', 0))
                size = float(trade.get('size', trade.get('qty', 0)))
                fee = float(trade.get('fee', trade.get('commission', 0)))
                realized_pnl = trade.get('realizedPnl') or trade.get('realized_pnl')
                pnl = float(realized_pnl) if realized_pnl is not None else None
                
                # Convert timestamp to ISO string
                timestamp_ms = trade.get('time') or trade.get('timestamp', 0)
                if timestamp_ms:
                    if timestamp_ms > 1e12:  # Already in milliseconds
                        timestamp_iso = datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc).isoformat()
                    else:  # In seconds
                        timestamp_iso = datetime.fromtimestamp(timestamp_ms, tz=timezone.utc).isoformat()
                else:
                    timestamp_iso = datetime.now(timezone.utc).isoformat()
                
                # Create unique ID
                trade_id = trade.get('id') or trade.get('tradeId')
                if not trade_id:
                    # Create hash from trade data
                    import hashlib
                    trade_str = f"{symbol}_{side}_{price}_{size}_{timestamp_ms}"
                    trade_id = hashlib.sha256(trade_str.encode()).hexdigest()[:16]
                
                formatted_trades.append({
                    'id': str(trade_id),
                    'symbol': symbol,
                    'side': side,
                    'size': abs(size),
                    'price': price,
                    'fee': abs(fee),
                    'pnl': pnl,
                    'timestamp': timestamp_iso,
                })
            
            # Sort by timestamp descending (newest first)
            formatted_trades.sort(key=lambda t: t['timestamp'], reverse=True)
            
            return web.json_response({
                'trades': formatted_trades,
                'count': len(formatted_trades),
                'source': 'binance'
            })
        except Exception as e:
            logger.error(f"Error in handle_trades: {e}")
            import traceback
            traceback.print_exc()
            return web.json_response({
                'error': str(e),
                'trades': []
            }, status=500)

    async def handle_orders(request):
        """Return all orders (open + recent fills) from Aster."""
        try:
            # Get open orders
            open_orders = await hyperliquid.get_open_orders()
            
            # Get recent fills
            recent_fills = await hyperliquid.get_recent_fills(limit=100)
            
            # Combine and normalize orders
            all_orders = []
            
            # Process open orders
            for o in open_orders:
                try:
                    symbol = o.get('symbol', '').replace('USDT', '') or o.get('coin', '')
                    order_id = o.get('orderId') or o.get('oid') or o.get('id')
                    side_raw = o.get('side', '').upper()
                    is_buy = side_raw == 'BUY' or o.get('isBuy', False)
                    
                    all_orders.append({
                        'oid': str(order_id),
                        'order_id': str(order_id),
                        'coin': symbol,
                        'symbol': symbol,
                        'isBuy': is_buy,
                        'side': 'buy' if is_buy else 'sell',
                        'sz': float(o.get('origQty') or o.get('quantity') or o.get('size', 0)),
                        'size': float(o.get('origQty') or o.get('quantity') or o.get('size', 0)),
                        'px': float(o.get('price', 0)) if o.get('price') else None,
                        'price': float(o.get('price', 0)) if o.get('price') else None,
                        'orderType': o.get('type', 'MARKET').lower(),
                        'type': o.get('type', 'MARKET').lower(),
                        'status': o.get('status', 'NEW').lower(),
                        'time': int(o.get('time', 0)) if o.get('time') else int(time.time() * 1000),
                        'timestamp': int(o.get('time', 0)) if o.get('time') else int(time.time() * 1000),
                        'created_at': datetime.fromtimestamp(int(o.get('time', time.time() * 1000)) / 1000, tz=timezone.utc).isoformat() if o.get('time') else datetime.now(timezone.utc).isoformat(),
                        'filled_size': float(o.get('executedQty') or o.get('filled_size', 0)),
                    })
                except Exception as e:
                    logging.warning(f"Error processing open order: {e}")
                    continue
            
            # Process recent fills
            for f in recent_fills:
                try:
                    symbol = f.get('symbol', '').replace('USDT', '') or f.get('coin', '')
                    order_id = f.get('orderId') or f.get('id')
                    side_raw = f.get('side', '').upper()
                    is_buy = side_raw == 'BUY' or f.get('isBuy', False)
                    
                    # Check if this order is already in all_orders (as open order)
                    existing = next((o for o in all_orders if str(o.get('oid')) == str(order_id)), None)
                    if existing:
                        # Update existing order with fill info
                        existing['filled_size'] = float(f.get('qty') or f.get('quantity') or f.get('size', 0))
                        existing['status'] = 'filled' if existing['filled_size'] >= existing.get('sz', 0) else 'partially_filled'
                    else:
                        # Add as filled order
                        all_orders.append({
                            'oid': str(order_id),
                            'order_id': str(order_id),
                            'coin': symbol,
                            'symbol': symbol,
                            'isBuy': is_buy,
                            'side': 'buy' if is_buy else 'sell',
                            'sz': float(f.get('qty') or f.get('quantity') or f.get('size', 0)),
                            'size': float(f.get('qty') or f.get('quantity') or f.get('size', 0)),
                            'px': float(f.get('price', 0)) if f.get('price') else None,
                            'price': float(f.get('price', 0)) if f.get('price') else None,
                            'orderType': 'market',
                            'type': 'market',
                            'status': 'filled',
                            'time': int(f.get('time', 0)) if f.get('time') else int(time.time() * 1000),
                            'timestamp': int(f.get('time', 0)) if f.get('time') else int(time.time() * 1000),
                            'created_at': datetime.fromtimestamp(int(f.get('time', time.time() * 1000)) / 1000, tz=timezone.utc).isoformat() if f.get('time') else datetime.now(timezone.utc).isoformat(),
                            'filled_size': float(f.get('qty') or f.get('quantity') or f.get('size', 0)),
                        })
                except Exception as e:
                    logging.warning(f"Error processing fill: {e}")
                    continue
            
            # Sort by timestamp (newest first)
            all_orders.sort(key=lambda x: x.get('timestamp', 0), reverse=True)
            
            return web.json_response(all_orders[:200])  # Limit to 200 most recent
        except Exception as e:
            logging.error(f"Error getting orders: {e}")
            import traceback
            logging.error(traceback.format_exc())
            return web.json_response({"error": str(e)}, status=500)

    async def handle_alert_signal(request):
        """Receive trading signal from alert service and execute immediately."""
        try:
            signal = await request.json()
            
            # Validate signal format
            required_fields = ["asset", "action", "price", "tp_price", "sl_price", "allocation_usd"]
            for field in required_fields:
                if field not in signal:
                    return web.json_response({"error": f"Missing required field: {field}"}, status=400)
            
            asset = signal["asset"]
            action = signal["action"]
            entry_price = float(signal["price"])
            tp_price = float(signal["tp_price"])
            sl_price = float(signal["sl_price"])
            allocation_usd = float(signal["allocation_usd"])
            
            if action not in ("buy", "sell"):
                return web.json_response({"error": f"Invalid action: {action}"}, status=400)
            
            is_buy = action == "buy"
            
            # Get current price to calculate position size
            current_price = await hyperliquid.get_current_price(asset)
            if not current_price or current_price <= 0:
                return web.json_response({"error": f"Could not get current price for {asset}"}, status=500)
            
            # Calculate position size from allocation
            # For futures: size = allocation_usd / price
            position_size = allocation_usd / current_price
            
            # Round position size (Aster requires async, Binance is sync - both work with await)
            if hasattr(hyperliquid, 'round_size') and asyncio.iscoroutinefunction(hyperliquid.round_size):
                position_size = await hyperliquid.round_size(asset, position_size)
            else:
                position_size = hyperliquid.round_size(asset, position_size)
            
            logging.info(
                f"🚨 ALERT SIGNAL: {asset} {action.upper()} @ ${current_price:.2f} "
                f"(TP: ${tp_price:.2f}, SL: ${sl_price:.2f}, Size: {position_size}, Allocation: ${allocation_usd:.2f})"
            )
            
            # Execute trade immediately
            try:
                if is_buy:
                    order_result = await hyperliquid.place_buy_order(asset, position_size)
                else:
                    order_result = await hyperliquid.place_sell_order(asset, position_size)
                
                # Check if order was successful (Aster and Binance have different response formats)
                if isinstance(order_result, dict):
                    # Aster format: direct response with orderId
                    if "orderId" in order_result:
                        # Aster - order is successful if orderId exists
                        pass
                    # Binance format: nested status
                    elif order_result.get("status") != "ok":
                        error_msg = order_result.get("response", {}).get("error", "Unknown error")
                        logging.error(f"❌ Alert trade failed for {asset}: {error_msg}")
                        return web.json_response({"error": f"Trade execution failed: {error_msg}"}, status=500)
                
                # Place TP/SL orders
                tp_oid = None
                sl_oid = None
                
                try:
                    # Place take profit order
                    tp_result = await hyperliquid.place_take_profit(asset, is_buy, position_size, tp_price)
                    if isinstance(tp_result, dict):
                        # Aster format: direct orderId
                        if "orderId" in tp_result:
                            tp_oid = tp_result.get("orderId")
                        # Binance format: nested response
                        elif tp_result.get("status") == "ok":
                            response_data = tp_result.get("response", {}).get("data", {})
                            statuses = response_data.get("statuses", [])
                            if statuses and isinstance(statuses[0], dict):
                                tp_resting = statuses[0].get("resting", {})
                                if tp_resting:
                                    tp_oid = tp_resting.get("oid")
                        else:
                            logging.warning(f"⚠️  Could not place TP order for {asset}: {tp_result}")
                    else:
                        logging.warning(f"⚠️  Could not place TP order for {asset}: {tp_result}")
                except Exception as e:
                    logging.warning(f"⚠️  Error placing TP order for {asset}: {e}")
                
                try:
                    # Place stop loss order (if enabled)
                    if CONFIG.get('enable_stop_loss_orders', True):
                        sl_result = await hyperliquid.place_stop_loss(asset, is_buy, position_size, sl_price)
                    else:
                        sl_result = {"disabled": True}
                    if isinstance(sl_result, dict):
                        # Aster format: direct orderId
                        if "orderId" in sl_result:
                            sl_oid = sl_result.get("orderId")
                        # Binance format: nested response
                        elif sl_result.get("status") == "ok":
                            response_data = sl_result.get("response", {}).get("data", {})
                            statuses = response_data.get("statuses", [])
                            if statuses and isinstance(statuses[0], dict):
                                sl_resting = statuses[0].get("resting", {})
                                if sl_resting:
                                    sl_oid = sl_resting.get("oid")
                        else:
                            logging.warning(f"⚠️  Could not place SL order for {asset}: {sl_result}")
                    else:
                        logging.warning(f"⚠️  Could not place SL order for {asset}: {sl_result}")
                except Exception as e:
                    logging.warning(f"⚠️  Error placing SL order for {asset}: {e}")
                
                # Log to diary
                diary_path = "diary.jsonl"
                exit_plan = f"TP: ${tp_price:.2f}, SL: ${sl_price:.2f}"
                with open(diary_path, "a") as f:
                    f.write(json.dumps({
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "asset": asset,
                        "action": f"alert_{action}",
                        "entry_price": current_price,
                        "tp_price": tp_price,
                        "sl_price": sl_price,
                        "amount": position_size,
                        "allocation_usd": allocation_usd,
                        "tp_oid": tp_oid,
                        "sl_oid": sl_oid,
                        "reason": f"Alert service signal: {signal.get('signal_type', 'unknown')}",
                        "source": "alert_service"
                    }) + "\n")
                
                logging.info(
                    f"✅ Alert trade executed: {asset} {action.upper()} @ ${current_price:.2f} "
                    f"(TP: ${tp_price:.2f}, SL: ${sl_price:.2f}, TP_OID: {tp_oid}, SL_OID: {sl_oid})"
                )
                
                return web.json_response({
                    "success": True,
                    "asset": asset,
                    "action": action,
                    "entry_price": current_price,
                    "position_size": position_size,
                    "tp_price": tp_price,
                    "sl_price": sl_price,
                    "tp_oid": tp_oid,
                    "sl_oid": sl_oid
                })
                
            except Exception as e:
                logging.error(f"❌ Error executing alert trade for {asset}: {e}")
                import traceback
                logging.error(traceback.format_exc())
                return web.json_response({"error": f"Trade execution error: {str(e)}"}, status=500)
                
        except Exception as e:
            logging.error(f"Error handling alert signal: {e}")
            import traceback
            logging.error(traceback.format_exc())
            return web.json_response({"error": str(e)}, status=500)

    async def handle_trading_info(request):
        """Return trading information for a given asset and amount (allocation)."""
        try:
            asset = request.query.get('asset', '').upper()
            amount_str = request.query.get('amount', '0')
            
            if not asset:
                return web.json_response({"error": "asset parameter is required"}, status=400)
            
            try:
                amount = float(amount_str)
            except (ValueError, TypeError):
                return web.json_response({"error": "amount must be a valid number"}, status=400)
            
            if amount <= 0:
                return web.json_response({"error": "amount must be greater than 0"}, status=400)
            
            # Get current price
            try:
                current_price = await hyperliquid.get_current_price(asset)
                if not current_price or current_price <= 0:
                    return web.json_response({"error": f"Could not get price for {asset}"}, status=404)
            except Exception as e:
                logging.error(f"Error getting price for {asset}: {e}")
                return web.json_response({"error": f"Error getting price: {str(e)}"}, status=500)
            
            # Get trading settings
            from src.utils.trading_settings import get_trading_settings, get_max_leverage_for_asset, calculate_tp_sl_prices
            trading_settings = await get_trading_settings()
            leverage = get_leverage_for_asset(asset, trading_settings.get('leverage', 10))
            
            # Get max leverage for asset from exchange
            max_leverage = await get_max_leverage_for_asset(hyperliquid, asset)
            leverage = min(leverage, max_leverage)
            
            # Calculate position size
            from src.utils.position_sizing import calculate_profit, calculate_liquidation_price
            position_size_units = amount / current_price  # Units of asset
            controlled_value = amount * leverage  # Total notional value
            
            # Calculate profit/loss scenarios
            profit_1pct = calculate_profit(amount, 1.0, leverage)
            profit_5pct = calculate_profit(amount, 5.0, leverage)
            loss_1pct = calculate_profit(amount, -1.0, leverage)
            loss_3pct = calculate_profit(amount, -3.0, leverage)
            
            # Calculate TP/SL prices
            take_profit_percent = trading_settings.get('take_profit_percent', 5.0)
            stop_loss_percent = trading_settings.get('stop_loss_percent', 3.0)
            
            tp_price_long, sl_price_long = calculate_tp_sl_prices(
                current_price, True, take_profit_percent, stop_loss_percent
            )
            tp_price_short, sl_price_short = calculate_tp_sl_prices(
                current_price, False, take_profit_percent, stop_loss_percent
            )
            
            # Calculate liquidation prices
            liquidation_long = calculate_liquidation_price(current_price, True, leverage)
            liquidation_short = calculate_liquidation_price(current_price, False, leverage)
            
            return web.json_response({
                "asset": asset,
                "current_price": round(current_price, 2),
                "allocation_usd": round(amount, 2),
                "leverage": leverage,
                "max_leverage": max_leverage,
                "position_size_units": round(position_size_units, 8),
                "controlled_value_usd": round(controlled_value, 2),
                "profit_scenarios": {
                    "profit_1pct": round(profit_1pct, 2),
                    "profit_5pct": round(profit_5pct, 2),
                    "loss_1pct": round(loss_1pct, 2),
                    "loss_3pct": round(loss_3pct, 2),
                },
                "long_position": {
                    "entry_price": round(current_price, 2),
                    "tp_price": round(tp_price_long, 2),
                    "sl_price": round(sl_price_long, 2),
                    "liquidation_price": round(liquidation_long, 2),
                    "tp_profit": round(profit_5pct, 2),
                    "sl_loss": round(loss_3pct, 2),
                },
                "short_position": {
                    "entry_price": round(current_price, 2),
                    "tp_price": round(tp_price_short, 2),
                    "sl_price": round(sl_price_short, 2),
                    "liquidation_price": round(liquidation_short, 2),
                    "tp_profit": round(profit_5pct, 2),
                    "sl_loss": round(loss_3pct, 2),
                },
                "trading_settings": {
                    "take_profit_percent": take_profit_percent,
                    "stop_loss_percent": stop_loss_percent,
                }
            })
        except Exception as e:
            logging.error(f"Error in handle_trading_info: {e}")
            import traceback
            logging.error(traceback.format_exc())
            return web.json_response({"error": str(e)}, status=500)

    async def start_api(app):
        """Register HTTP endpoints for observing diary entries, logs, positions, and status."""
        app.router.add_get('/diary', handle_diary)
        app.router.add_get('/logs', handle_logs)
        app.router.add_get('/positions', handle_positions)
        app.router.add_get('/status', handle_status)
        app.router.add_get('/balances', handle_balances)  # Add balances endpoint
        app.router.add_get('/api/orders', handle_orders)
        app.router.add_get('/api/pnl', handle_pnl)
        app.router.add_get('/api/performance', handle_performance)
        app.router.add_get('/api/prices', handle_prices)
        app.router.add_get('/api/trading-info', handle_trading_info)  # Add trading info endpoint
        app.router.add_get('/api/trades', handle_trades)  # Add trades endpoint
        app.router.add_post('/api/test', handle_status)  # Alias for compatibility
        app.router.add_post('/api/alert/signal', handle_alert_signal)

    def suppress_connection_errors():
        """Suppress harmless Windows socket connection errors that occur during rapid connection closures."""
        def handle_exception(loop, context):
            """Handle asyncio exceptions, suppressing harmless Windows socket errors."""
            exception = context.get('exception')
            message = context.get('message', '')
            
            # Suppress known harmless Windows socket errors
            if isinstance(exception, (OSError, ConnectionResetError)):
                error_code = getattr(exception, 'winerror', None) or getattr(exception, 'errno', None)
                # Windows error codes: 64 = network name no longer available, 10054 = connection reset
                if error_code in (64, 10054) or 'network name' in str(exception).lower() or 'connection reset' in str(exception).lower():
                    # Suppress these harmless errors - they occur when connections close rapidly
                    return
            
            # Log other exceptions normally
            loop.default_exception_handler(context)
        
        # Set custom exception handler for the event loop
        loop = asyncio.get_event_loop()
        loop.set_exception_handler(handle_exception)

    async def main_async():
        """Start the aiohttp server and kick off the trading loop."""
        # Suppress harmless Windows socket errors
        suppress_connection_errors()
        
        # Configure aiohttp to handle connection errors gracefully
        app = web.Application()
        
        # Add CORS middleware to allow requests from Vercel and other origins
        @web.middleware
        async def cors_middleware(request, handler):
            """Handle CORS headers for cross-origin requests."""
            # Handle preflight OPTIONS requests
            if request.method == 'OPTIONS':
                response = web.Response()
            else:
                response = await handler(request)
            
            # Get allowed origins from environment or use defaults
            allowed_origins = os.getenv('CORS_ALLOWED_ORIGINS', '').split(',')
            # Add common localhost origins for development
            if not allowed_origins or allowed_origins == ['']:
                allowed_origins = [
                    'http://localhost:3000',
                    'http://localhost:3001',
                    'https://*.vercel.app',  # Vercel preview deployments
                ]
            else:
                # Clean up the list
                allowed_origins = [origin.strip() for origin in allowed_origins if origin.strip()]
            
            # Get the origin from the request
            origin = request.headers.get('Origin', '')
            
            # Check if origin is allowed (supports wildcard for Vercel)
            origin_allowed = False
            if origin:
                for allowed in allowed_origins:
                    if allowed == '*' or origin == allowed:
                        origin_allowed = True
                        break
                    # Support wildcard matching for Vercel (*.vercel.app)
                    if '*' in allowed:
                        if fnmatch.fnmatch(origin, allowed):
                            origin_allowed = True
                            break
            
            # Set CORS headers
            if origin_allowed or not origin:
                response.headers['Access-Control-Allow-Origin'] = origin if origin_allowed else '*'
                response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
                response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
                response.headers['Access-Control-Allow-Credentials'] = 'true'
            
            return response
        
        # Add middleware to catch and suppress connection errors
        @web.middleware
        async def suppress_connection_error_middleware(request, handler):
            try:
                return await handler(request)
            except (OSError, ConnectionResetError) as e:
                error_code = getattr(e, 'winerror', None) or getattr(e, 'errno', None)
                # Suppress harmless Windows socket errors (64, 10054)
                if error_code in (64, 10054):
                    # Return empty response instead of crashing
                    return web.Response(status=200, text='')
                raise
        
        app.middlewares.append(cors_middleware)
        app.middlewares.append(suppress_connection_error_middleware)
        
        await start_api(app)
        from src.config_loader import CONFIG as CFG
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, CFG.get("api_host"), int(CFG.get("api_port")))
        await site.start()
        
        logging.info(f"🌐 HTTP API server started on {CFG.get('api_host')}:{CFG.get('api_port')}")
        
        # Start background task to continuously sync trades to Supabase
        # Check if exchange is BinanceAPI instance
        from src.trading.binance_api import BinanceAPI
        is_binance = isinstance(exchange, BinanceAPI)
        
        supabase_url = os.getenv('SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_KEY')
        
        if is_binance and supabase_url and supabase_key:
            # Pass exchange as binance_api to the sync function
            asyncio.create_task(sync_trades_to_supabase())
            logging.info("🔄 Background trade sync to Supabase started")
            logging.info(f"   Supabase URL: {supabase_url[:30]}...")
        elif is_binance:
            logging.info("ℹ️ Supabase not configured - trade sync disabled")
            if not supabase_url:
                logging.info("   Missing: SUPABASE_URL environment variable")
            if not supabase_key:
                logging.info("   Missing: SUPABASE_KEY environment variable")
            logging.info("   Add SUPABASE_URL and SUPABASE_KEY to your .env file to enable trade sync")
        
        # Start background task to sync portfolio assets every hour
        # This works for both Binance and Aster exchanges
        dashboard_url = os.getenv('DASHBOARD_URL') or os.getenv('NEXT_PUBLIC_BASE_URL')
        if dashboard_url:
            asyncio.create_task(sync_portfolio_assets())
            logging.info("🔄 Background portfolio assets sync started (every hour)")
        else:
            logging.info("ℹ️ Dashboard URL not configured - portfolio assets sync disabled")
            logging.info("   Add DASHBOARD_URL or NEXT_PUBLIC_BASE_URL to your .env file to enable portfolio sync")
        
        await run_loop()

    def calculate_total_return(state, trade_log):
        """Compute percent return relative to an assumed initial balance."""
        initial = 10000
        current = state['balance'] + sum(p.get('pnl', 0) for p in state.get('positions', []))
        return ((current - initial) / initial) * 100 if initial else 0

    def calculate_sharpe(returns):
        """Compute a naive Sharpe-like ratio from the trade log."""
        if not returns:
            return 0
        vals = [r.get('pnl', 0) if 'pnl' in r else 0 for r in returns]
        if not vals:
            return 0
        mean = sum(vals) / len(vals)
        var = sum((v - mean) ** 2 for v in vals) / len(vals)
        std = math.sqrt(var) if var > 0 else 0
        return mean / std if std > 0 else 0

    async def check_exit_condition(trade, taapi, hyperliquid):
        """Evaluate whether a given trade's exit plan triggers a close."""
        plan = (trade.get("exit_plan") or "").lower()
        if not plan:
            return False
        try:
            if "macd" in plan and "below" in plan:
                indicators = taapi.get_indicators(trade["asset"], "4h")
                macd = indicators.get("macd", {}).get("valueMACD")
                if macd is None:
                    return False
                threshold = float(plan.split("below")[-1].strip())
                return macd < threshold
            if "close above ema50" in plan:
                historical = taapi.get_historical_indicator("ema", f"{trade['asset']}/USDT", "4h", results=1, params={"period": 50})
                if not historical or len(historical) == 0:
                    return False
                ema50 = historical[0].get("value")
                if ema50 is None:
                    return False
                current = await hyperliquid.get_current_price(trade["asset"])
                return current > ema50
        except Exception:
            return False
        return False

    try:
        asyncio.run(main_async())
    except KeyboardInterrupt:
        logging.info("Trading agent stopped by user")
    except Exception as e:
        logging.error(f"Fatal error in main_async: {e}", exc_info=True)
        print(f"Fatal error: {e}", file=original_stderr)
        import traceback
        traceback.print_exc(file=original_stderr)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"Fatal error in main: {e}", file=original_stderr)
        import traceback
        traceback.print_exc(file=original_stderr)
        raise

