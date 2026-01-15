"""Entry-point script that wires together the trading agent, data feeds, and API."""

import sys
import argparse
import pathlib
sys.path.append(str(pathlib.Path(__file__).parent.parent))
from src.strategies.strategy_factory import StrategyFactory
from src.indicators.technical_analysis_client import TechnicalAnalysisClient
from src.config_loader import CONFIG, get_leverage_for_asset
import asyncio
import logging
import time
from collections import deque, OrderedDict
from datetime import datetime, timezone
import math  # For Sharpe
from dotenv import load_dotenv
import os
import json
from aiohttp import web
from src.utils.formatting import format_number as fmt, format_size as fmt_sz
from src.utils.prompt_utils import json_default, round_or_none, round_series
from src.utils.trading_settings import get_trading_settings, get_max_leverage_for_asset, calculate_tp_sl_prices, calculate_allocation_usd

load_dotenv()

# Create a log file handler that captures all output
log_file_path = "trading_agent.log"

# Remove existing handlers to avoid duplicates
logging.getLogger().handlers = []

# Create file handler for comprehensive logging
file_handler = logging.FileHandler(log_file_path, mode='a', encoding='utf-8')
file_handler.setLevel(logging.DEBUG)
file_formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
file_handler.setFormatter(file_formatter)

# Create console handler (terminal output)
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)
console_handler.setFormatter(file_formatter)

# Configure root logger
logger = logging.getLogger()
logger.setLevel(logging.DEBUG)
logger.addHandler(file_handler)
logger.addHandler(console_handler)

# Redirect print statements to logging
class PrintToLog:
    """Redirect print() calls to logging."""
    def write(self, text):
        if text.strip():  # Only log non-empty lines
            logging.info(text.strip())
    
    def flush(self):
        pass

# Replace stdout/stderr to capture print statements
import sys
original_stdout = sys.stdout
original_stderr = sys.stderr
sys.stdout = PrintToLog()
sys.stderr = PrintToLog()

logging.info("=" * 80)
logging.info("Trading Agent Starting")
logging.info("=" * 80)


def clear_terminal():
    """Clear the terminal screen on Windows or POSIX systems."""
    os.system('cls' if os.name == 'nt' else 'clear')


def get_interval_seconds(interval_str):
    """Convert interval strings like '5m' or '1h' to seconds."""
    if interval_str.endswith('m'):
        return int(interval_str[:-1]) * 60
    elif interval_str.endswith('h'):
        return int(interval_str[:-1]) * 3600
    elif interval_str.endswith('d'):
        return int(interval_str[:-1]) * 86400
    else:
        raise ValueError(f"Unsupported interval: {interval_str}")

def main():
    """Parse CLI args, bootstrap dependencies, and launch the trading loop."""
    clear_terminal()
    parser = argparse.ArgumentParser(description="LLM-based Trading Agent on Hyperliquid")
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
            logging.info(f"✅ Using Aster DEX (default)")
        except ValueError as e:
            logging.error(f"❌ Failed to initialize Aster: {e}")
            logging.info("💡 Falling back to Hyperliquid...")
            from src.trading.hyperliquid_api import HyperliquidAPI
            exchange = HyperliquidAPI()
            exchange_name = "hyperliquid"
    elif exchange_name == "hyperliquid":
        from src.trading.hyperliquid_api import HyperliquidAPI
        exchange = HyperliquidAPI()
        network = CONFIG.get("hyperliquid_network", "mainnet")
        logging.info(f"✅ Using Hyperliquid ({network})")
        elif exchange_name == "pepperstone":
            from src.trading.pepperstone_api import PepperstoneAPI
            try:
                exchange = PepperstoneAPI()
                environment = CONFIG.get("pepperstone_environment", "demo")
                logging.info(f"✅ Using Pepperstone cTrader ({environment})")
            except (ValueError, ImportError) as e:
                logging.error(f"❌ Failed to initialize Pepperstone: {e}")
                raise ValueError(f"Pepperstone initialization failed: {e}")
    else:
            raise ValueError(f"Unknown exchange: {exchange_name}. Use 'aster', 'hyperliquid', or 'pepperstone'")
    
    # Use 'exchange' as the variable name throughout (aliased for compatibility)
    # Keep 'hyperliquid' variable name for backward compatibility in code
    hyperliquid = exchange
        exchange_manager = None
    
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
            else:  # hyperliquid
                api_wallet_address = hyperliquid.wallet.address
                main_wallet_address = hyperliquid.main_wallet_address
                network = CONFIG.get("hyperliquid_network", "mainnet")
                
                logging.info(f"📍 API Wallet (for signing): {api_wallet_address}")
                if main_wallet_address:
                    logging.info(f"📍 Main Wallet (for balances): {main_wallet_address}")
                    network_url = "testnet" if network == "testnet" else "app"
                    logging.info(f"🔗 View on Hyperliquid: https://{network_url}.hyperliquid.xyz/portfolio/{main_wallet_address}")
                else:
                    logging.info(f"🔗 View on Hyperliquid: https://{'testnet' if network == 'testnet' else 'app'}.hyperliquid.xyz/portfolio/{api_wallet_address}")
            
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
            else:
                logging.info("💡 Note: Make sure your API wallet is authorized in Hyperliquid dashboard")
                logging.info("   If trades fail, check that the API wallet is approved in your account settings")
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
    initial_account_value = None
    # Perp mid-price history sampled each loop (authoritative, avoids spot/perp basis mismatch)
    price_history = {}

    logging.info(f"Starting trading agent for assets: {args.assets} at interval: {args.interval}")

    def add_event(msg: str):
        """Log an informational event and push it into the recent events deque."""
        logging.info(msg)
        recent_events.append({"timestamp": datetime.now(timezone.utc).isoformat(), "message": msg})

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

    async def run_loop():
        """Main trading loop that gathers data, calls the agent, and executes trades."""
        nonlocal invocation_count, initial_account_value
        while True:
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
            for pos_wrap in state['positions']:
                pos = pos_wrap
                coin = pos.get('coin') or pos.get('symbol')
                asset_exchange = get_exchange_for_asset(coin) if coin else exchange
                current_px = await asset_exchange.get_current_price(coin) if coin else None
                positions.append({
                    "symbol": coin,
                    "quantity": round_or_none(pos.get('szi'), 6),
                    "entry_price": round_or_none(pos.get('entryPx'), 2),
                    "current_price": round_or_none(current_px, 2),
                    "liquidation_price": round_or_none(pos.get('liquidationPx') or pos.get('liqPx'), 2),
                    "unrealized_pnl": round_or_none(pos.get('pnl'), 4),
                    "leverage": pos.get('leverage')
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
                    "assets_without_positions": [a for a in args.assets if a not in (assets_with_positions if 'assets_with_positions' in locals() else set())]
                }
            }

            # Gather data for ALL assets first
            market_sections = []
            asset_prices = {}
            for asset in args.assets:
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
            
            flat_assets = [a for a in args.assets if a not in assets_with_positions_set]

            # Fetch trading settings (leverage, TP%, SL%, position sizing)
            # This will use database settings first, then fall back to .env file if database unavailable
            trading_settings = await get_trading_settings()
            default_leverage = trading_settings["leverage"]
            tp_percent = trading_settings["take_profit_percent"]
            sl_percent = trading_settings["stop_loss_percent"]
            # Position sizing settings (target_profit_per_1pct_move, max_positions, position_sizing_mode) are in trading_settings dict
            # These come from database or .env file (TARGET_PROFIT_PER_1PCT_MOVE, MAX_POSITIONS, POSITION_SIZING_MODE)

            # Build per-asset leverage map for context and enforcement
            per_asset_leverage = {}
            for asset in args.assets:
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
                    "margin_per_position": trading_settings.get("margin_per_position"),  # MANDATORY - always use margin mode
                    "max_positions": trading_settings.get("max_positions", 5),
                    "position_sizing_mode": "margin",  # ALWAYS margin mode - system enforces this
                    "note": _build_position_sizing_note(trading_settings, default_leverage, per_asset_leverage),
                    "⚠️_CRITICAL_RULES": {
                        "margin_per_position": trading_settings.get("margin_per_position"),
                        "default_leverage": default_leverage,
                        "per_asset_leverage": per_asset_leverage,
                        "enforcement": "DUAL: System-level (automatic) + Agent-level (must respect in decisions)",
                        "warning": f"ALLOCATION_USD must NEVER exceed MARGIN_PER_POSITION (${trading_settings.get('margin_per_position', 0):.2f}). System will enforce this, but agent must also respect it."
                    }
                }),
                ("account", dashboard),
                ("market_data", market_sections),
                ("position_status", {
                    "assets_with_positions": list(assets_with_positions_set),
                    "flat_assets": flat_assets,
                    "critical_note": f"Assets {flat_assets} have NO positions - ACTIVELY LOOK FOR ENTRY OPPORTUNITIES using technical analysis. Do not default to 'hold' for flat assets unless you've analyzed and found NO viable setups."
                }),
                ("instructions", {
                    "assets": args.assets,
                    "requirement": "Decide actions for all assets and return a strict JSON array matching the schema.",
                    "priority": f"PRIORITIZE finding entries for flat assets: {flat_assets}. These have no positions - actively scan for trading opportunities.",
                    "tp_sl_guidance": f"Calculate TP/SL prices using configured percentages: TP={tp_percent}%, SL={sl_percent}%. If not provided, system will calculate automatically."
                })
            ])
            context = json.dumps(context_payload, default=json_default)
            add_event(f"Combined prompt length: {len(context)} chars for {len(args.assets)} assets")
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

            # Log which strategy is being used for this cycle (manual mode only)
            if strategy_mode == "MANUAL":
                if not hasattr(run_loop, '_last_strategy_log') or run_loop._last_strategy_log != invocation_count:
                    logging.info(f"📊 Using strategy: {agent.get_name()}")
                    run_loop._last_strategy_log = invocation_count

            try:
                outputs = agent.decide_trade(args.assets, context)
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
                    outputs = agent.decide_trade(args.assets, context_retry)
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
                                if tp_price or sl_price:
                                    is_long = entry.get('action') == 'buy'
                                    break
                        except Exception:
                            continue
                except Exception:
                    pass
                
                # Calculate current PNL percentage
                unrealized_pnl = pos.get('unrealized_pnl') or pos.get('pnl') or 0
                if not entry_price or entry_price <= 0:
                    continue
                
                # Calculate profit percentage (considering leverage)
                notional_value = position_size * entry_price
                pnl_percent = 0.0
                if notional_value > 0:
                    pnl_percent = (unrealized_pnl / notional_value) * 100
                
                # SMART PROFIT-TAKING: Adjust TP dynamically based on current profit
                # Consider fees (~0.04% per entry/exit = ~0.08% round trip)
                # Take profits at reasonable levels, don't be too greedy
                should_take_profit = False
                profit_reason = ""
                
                if pnl_percent >= 15.0:  # Up 15%+ - take profits immediately
                    should_take_profit = True
                    profit_reason = "Strong profit (15%+) - locking in gains"
                elif pnl_percent >= 10.0:  # Up 10-15% - take profits if TP too high
                    # Check if TP is more than 20% away - if so, take profit now
                    if tp_price:
                        tp_percent = 0.0
                        if is_long:
                            tp_percent = ((tp_price - entry_price) / entry_price) * 100
                        else:
                            tp_percent = ((entry_price - tp_price) / entry_price) * 100
                        
                        if tp_percent > 20.0:  # TP is more than 20% away
                            should_take_profit = True
                            profit_reason = f"Profit at {pnl_percent:.1f}% - TP too high ({tp_percent:.1f}%), taking profit"
                # Trailing TP adjustments disabled (reverted to static TP/SL behavior)
                
                # Check TP/SL conditions
                tp_hit = False
                sl_hit = False
                
                if tp_price:
                    tp_price = float(tp_price)
                    if is_long:
                        tp_hit = current_price >= tp_price
                    else:  # short
                        tp_hit = current_price <= tp_price
                
                if sl_price:
                    sl_price = float(sl_price)
                    if is_long:
                        sl_hit = current_price <= sl_price
                    else:  # short
                        sl_hit = current_price >= sl_price
                
                if tp_hit or sl_hit:
                    should_take_profit = True
                    profit_reason = "TP" if tp_hit else "SL"
                elif not tp_price and not sl_price:
                    # No TP/SL found, but if up significantly, take profit
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
                            close_order = await hyperliquid.place_sell_order(asset, position_size)
                        else:
                            close_order = await hyperliquid.place_buy_order(asset, position_size)
                        add_event(f"✅ Closed {asset} position ({reason}) via {close_action} order - Gains Protected!")
                        
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
                    except Exception as e:
                        add_event(f"❌ Failed to close {asset} position: {e}")
                        import traceback
                        logging.error(f"Error closing position for {asset}: {e}\n{traceback.format_exc()}")

            # Execute trades for each asset
            for output in outputs.get("trade_decisions", []) if isinstance(outputs, dict) else []:
                try:
                    asset = output.get("asset")
                    if not asset or asset not in args.assets:
                        continue
                    action = output.get("action")
                    current_price = asset_prices.get(asset, 0)
                    action = output["action"]
                    rationale = output.get("rationale", "")
                    if rationale:
                        add_event(f"Decision rationale for {asset}: {rationale}")
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
                            
                            # If closing/flipping, validate exit conditions before allowing
                            if is_closing and opened_at_str:
                                try:
                                    # Parse ISO format datetime
                                    if 'T' in opened_at_str:
                                        opened_at = datetime.fromisoformat(opened_at_str.replace('Z', '+00:00'))
                                    else:
                                        opened_at = datetime.fromisoformat(opened_at_str)
                                    time_since_entry = (datetime.now(timezone.utc) - opened_at).total_seconds() / 60  # minutes
                                    
                                    # Calculate price movement
                                    price_move_pct = abs((current_price - entry_price) / entry_price * 100) if entry_price and entry_price > 0 else 0
                                    
                                    # MINIMUM HOLD TIME: 15 minutes before allowing invalidation-based exits
                                    MIN_HOLD_TIME_MINUTES = 15
                                    # MINIMUM PRICE MOVEMENT: 2% adverse move before considering invalidation
                                    MIN_ADVERSE_MOVE_PCT = 2.0
                                    
                                    # Check if price moved against position (adverse move)
                                    if existing_is_long:
                                        adverse_move = current_price < entry_price
                                        adverse_move_pct = ((entry_price - current_price) / entry_price * 100) if adverse_move and entry_price > 0 else 0
                                    else:
                                        adverse_move = current_price > entry_price
                                        adverse_move_pct = ((current_price - entry_price) / entry_price * 100) if adverse_move and entry_price > 0 else 0
                                    
                                    # Block premature exits unless:
                                    # 1. Minimum hold time has passed AND
                                    # 2. Either: (a) Adverse move >= 2% OR (b) TP/SL was hit (handled elsewhere) OR (c) Strong invalidation (price moved 5%+ against)
                                    if time_since_entry < MIN_HOLD_TIME_MINUTES:
                                        if adverse_move_pct < MIN_ADVERSE_MOVE_PCT and adverse_move_pct < 5.0:
                                            add_event(f"⏸️  BLOCKED PREMATURE EXIT for {asset}: Position only {time_since_entry:.1f} minutes old (min: {MIN_HOLD_TIME_MINUTES} min). Price move: {price_move_pct:.2f}% (adverse: {adverse_move_pct:.2f}%). Allowing position to mature before considering invalidation.")
                                            continue  # Skip this trade - hold the position
                                    
                                    # Log the exit decision with context
                                    if time_since_entry < MIN_HOLD_TIME_MINUTES:
                                        add_event(f"⚠️  EARLY EXIT for {asset} after {time_since_entry:.1f} minutes (adverse move: {adverse_move_pct:.2f}%) - allowing due to significant adverse movement")
                                    else:
                                        add_event(f"✅ EXIT for {asset} after {time_since_entry:.1f} minutes (price move: {price_move_pct:.2f}%)")
                                except Exception as e:
                                    logging.warning(f"Could not parse opened_at for {asset}: {e}. Allowing trade to proceed.")
                        
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
                                            await hyperliquid.place_sell_order(asset, close_size)
                                        else:
                                            await hyperliquid.place_buy_order(asset, close_size)
                                        add_event(f"✅ Closed {asset} due to LLM 'sell' with zero allocation (reduce-only market close)")
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
                            
                            # Place TP order
                            if tp_price:
                                try:
                                    tp_order = await hyperliquid.place_take_profit(asset, is_buy, actual_position_size, tp_price)
                                    tp_oids = hyperliquid.extract_oids(tp_order)
                                    tp_oid = tp_oids[0] if tp_oids else None
                                    add_event(f"✅ TP placed {asset} at {tp_price:.4f}")
                                except Exception as e:
                                    error_msg = str(e)
                                    if "max stop order limit" in error_msg.lower() or "-4045" in error_msg:
                                        add_event(f"❌ Failed to place TP for {asset}: Max stop orders reached. Please cancel existing TP/SL orders manually.")
                                    else:
                                        add_event(f"❌ Failed to place TP for {asset}: {e}")
                            
                            # Place SL order
                            if sl_price:
                                try:
                                    sl_order = await hyperliquid.place_stop_loss(asset, is_buy, actual_position_size, sl_price)
                                    sl_oids = hyperliquid.extract_oids(sl_order)
                                    sl_oid = sl_oids[0] if sl_oids else None
                                    add_event(f"✅ SL placed {asset} at {sl_price:.4f}")
                                except Exception as e:
                                    error_msg = str(e)
                                    if "max stop order limit" in error_msg.lower() or "-4045" in error_msg:
                                        add_event(f"❌ Failed to place SL for {asset}: Max stop orders reached. Please cancel existing TP/SL orders manually.")
                                    else:
                                        add_event(f"❌ Failed to place SL for {asset}: {e}")
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

    async def handle_positions(request):
        """Return current positions as JSON."""
        try:
            logging.debug("Fetching positions from exchange...")
            state = await hyperliquid.get_user_state()
            positions_list = []
            
            logging.debug(f"Exchange returned {len(state.get('positions', []))} position(s)")
            
            for pos in state.get('positions', []):
                # Extract position data (works for both Binance and Hyperliquid formats)
                coin = pos.get('coin') or pos.get('symbol', '')
                szi = pos.get('szi') or pos.get('positionAmt') or pos.get('quantity', 0)
                entry_px = pos.get('entryPx') or pos.get('entryPrice') or pos.get('entry_price', 0)
                
                # Get current price - try from position data first, then fetch if missing
                current_px = pos.get('current_price') or pos.get('markPrice') or pos.get('currentPrice')
                if not current_px and coin:
                    try:
                        current_px = await hyperliquid.get_current_price(coin)
                    except Exception as e:
                        logging.warning(f"Could not fetch current price for {coin}: {e}")
                        current_px = entry_px  # Fallback to entry price if fetch fails
                
                pnl = pos.get('pnl') or pos.get('unRealizedProfit') or pos.get('unrealized_pnl', 0)
                
                # Determine side (positive = long, negative = short)
                size = float(szi) if szi else 0
                side = "long" if size > 0 else "short" if size < 0 else None
                
                if side and abs(size) > 0:  # Only include non-zero positions
                    # Get leverage from active_trades or trading settings
                    leverage = None
                    opened_at = None
                    for tr in active_trades:
                        if tr.get('asset') == coin:
                            leverage = tr.get('leverage')
                            opened_at = tr.get('opened_at')
                            break
                    
                    # If not found in active_trades, fetch from database settings (ALWAYS use database)
                    if leverage is None:
                        try:
                            settings = await get_trading_settings()
                            leverage = settings["leverage"]
                            logging.debug(f"Fetched leverage {leverage}x from database for position {coin}")
                        except Exception as e:
                            logging.error(f"Failed to fetch leverage from database for {coin}: {e}. This should not happen!")
                            # Only use env as absolute last resort - this should rarely happen
                            leverage = CONFIG.get("default_leverage", 10)
                            logging.warning(f"⚠️  Using .env leverage {leverage}x as fallback. Database settings should be used!")
                    
                    # Get liquidation price if available
                    liquidation_price = pos.get('liquidationPrice') or pos.get('liquidation_price') or pos.get('liqPx') or pos.get('liquidationPx')
                    
                    positions_list.append({
                        'symbol': coin,
                        'side': side,
                        'size': abs(size),  # Always positive, side indicates direction
                        'entry_price': float(entry_px) if entry_px else 0.0,
                        'current_price': float(current_px) if current_px else 0.0,
                        'liquidation_price': float(liquidation_price) if liquidation_price else None,
                        'unrealized_pnl': float(pnl) if pnl else 0.0,
                        'realized_pnl': 0.0,  # Not available from exchange directly
                        'leverage': leverage,
                        'opened_at': opened_at or datetime.now(timezone.utc).isoformat(),
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

    async def handle_status(request):
        """Return API status and basic account info."""
        try:
            state = await hyperliquid.get_user_state()
            
            if exchange_name == "aster":
                network_label = "Aster DEX"
                network = "mainnet"
            else:
                network = CONFIG.get("hyperliquid_network", "mainnet")
                network_label = f"Hyperliquid {network}"
            
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
                    current_price = await hyperliquid.get_current_price(asset)
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
            
            # Round position size (Aster requires async, Hyperliquid is sync - both work with await)
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
                
                # Check if order was successful (Aster and Hyperliquid have different response formats)
                if isinstance(order_result, dict):
                    # Aster format: direct response with orderId
                    if "orderId" in order_result:
                        # Aster - order is successful if orderId exists
                        pass
                    # Hyperliquid format: nested status
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
                        # Hyperliquid format: nested response
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
                    # Place stop loss order
                    sl_result = await hyperliquid.place_stop_loss(asset, is_buy, position_size, sl_price)
                    if isinstance(sl_result, dict):
                        # Aster format: direct orderId
                        if "orderId" in sl_result:
                            sl_oid = sl_result.get("orderId")
                        # Hyperliquid format: nested response
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

    async def start_api(app):
        """Register HTTP endpoints for observing diary entries, logs, positions, and status."""
        app.router.add_get('/diary', handle_diary)
        app.router.add_get('/logs', handle_logs)
        app.router.add_get('/positions', handle_positions)
        app.router.add_get('/status', handle_status)
        app.router.add_get('/api/orders', handle_orders)
        app.router.add_get('/api/pnl', handle_pnl)
        app.router.add_get('/api/performance', handle_performance)
        app.router.add_get('/api/prices', handle_prices)
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
        
        app.middlewares.append(suppress_connection_error_middleware)
        
        await start_api(app)
        from src.config_loader import CONFIG as CFG
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, CFG.get("api_host"), int(CFG.get("api_port")))
        await site.start()
        
        logging.info(f"🌐 HTTP API server started on {CFG.get('api_host')}:{CFG.get('api_port')}")
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

    asyncio.run(main_async())


if __name__ == "__main__":
    main()

