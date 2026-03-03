"""Centralized environment variable loading for the trading agent configuration."""

import json
import os
from dotenv import load_dotenv

load_dotenv()


def _get_env(name: str, default: str | None = None, required: bool = False) -> str | None:
    """Fetch an environment variable with optional default and required validation."""
    value = os.getenv(name, default)
    if required and (value is None or value == ""):
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def _get_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _get_float(name: str, default: float | None = None) -> float | None:
    """Get float environment variable."""
    val = os.getenv(name)
    if val is None:
        return default
    try:
        return float(val)
    except ValueError:
        return default


def _get_int(name: str, default: int | None = None) -> int | None:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        # Strip whitespace and remove comments (everything after # or parentheses)
        cleaned = raw.strip()
        # Remove comments after # or in parentheses
        if '#' in cleaned:
            cleaned = cleaned.split('#')[0].strip()
        if '(' in cleaned:
            cleaned = cleaned.split('(')[0].strip()
        return int(cleaned)
    except ValueError as exc:
        raise RuntimeError(f"Invalid integer for {name}: {raw}") from exc


def _get_json(name: str, default: dict | None = None) -> dict | None:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        parsed = json.loads(raw)
        if not isinstance(parsed, dict):
            raise RuntimeError(f"Environment variable {name} must be a JSON object")
        return parsed
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Invalid JSON for {name}: {raw}") from exc


def _get_list(name: str, default: list[str] | None = None) -> list[str] | None:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    raw = raw.strip()
    # Support JSON-style lists
    if raw.startswith("[") and raw.endswith("]"):
        try:
            parsed = json.loads(raw)
            if not isinstance(parsed, list):
                raise RuntimeError(f"Environment variable {name} must be a list if using JSON syntax")
            return [str(item).strip().strip('"\'') for item in parsed if str(item).strip()]
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"Invalid JSON list for {name}: {raw}") from exc
    # Fallback: comma separated string
    values = []
    for item in raw.split(","):
        cleaned = item.strip().strip('"\'')
        if cleaned:
            values.append(cleaned)
    return values or default


CONFIG = {
    # TAAPI is optional now (replaced with TA-Lib + Binance)
    "taapi_api_key": _get_env("TAAPI_API_KEY"),  # Optional, kept for backwards compatibility
    # Exchange selection (default: aster)
    "exchange": _get_env("EXCHANGE", "aster").lower(),  # Options: "aster", "binance"
    # Aster DEX API (default exchange)
    "aster_api_base": _get_env("ASTER_API_BASE", "https://fapi.asterdex.com"),
    "aster_user_address": _get_env("ASTER_USER_ADDRESS"),  # Main wallet address
    "aster_signer_address": _get_env("ASTER_SIGNER_ADDRESS"),  # API wallet address
    "aster_private_key": _get_env("ASTER_PRIVATE_KEY"),  # API wallet private key
    # Binance Futures API
    "binance_api_key": _get_env("BINANCE_API_KEY"),
    "binance_api_secret": _get_env("BINANCE_API_SECRET"),
    "binance_testnet": _get_bool("BINANCE_TESTNET", False),
    "binance_leverage": _get_int("BINANCE_LEVERAGE", 10),
    # Trading settings (can be overridden via database/frontend)
    "default_leverage": _get_int("DEFAULT_LEVERAGE", 10),  # Default leverage (will be capped by asset max)
    "take_profit_percent": _get_int("TAKE_PROFIT_PERCENT", 5),  # Take profit percentage (e.g., 5 = 5%)
    "stop_loss_percent": _get_int("STOP_LOSS_PERCENT", 3),  # Stop loss percentage (e.g., 3 = 3%)
    "enable_stop_loss_orders": _get_bool("ENABLE_STOP_LOSS_ORDERS", True),  # Enable automatic stop-loss orders on exchange (disable if exchange API rejects SL orders)
    # Position sizing (fallback when database unavailable)
    "target_profit_per_1pct_move": _get_float("TARGET_PROFIT_PER_1PCT_MOVE", 1.0),  # Target profit per 1% price move (e.g., 1.0 = $1 per 1%, 3.0 = $3 per 1%)
    "allocation_per_position": _get_float("ALLOCATION_PER_POSITION"),  # Fixed allocation per position (None = auto)
    "margin_per_position": _get_float("MARGIN_PER_POSITION"),  # Margin per position when position_sizing_mode is "margin" (None = not set)
    "max_positions": _get_int("MAX_POSITIONS", 6),  # Maximum concurrent positions
    "position_sizing_mode": _get_env("POSITION_SIZING_MODE", "auto"),  # "auto", "fixed", "target_profit", or "margin"
    # LLM via DeepSeek API (replaces OpenRouter)
    "deepseek_api_key": _get_env("DEEPSEEK_API_KEY", required=True),
    "deepseek_base_url": _get_env("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
    "llm_model": _get_env("LLM_MODEL", "deepseek-chat"),  # Options: deepseek-chat, deepseek-reasoner
    # DeepSeek-specific settings
    "deepseek_max_tokens": _get_int("DEEPSEEK_MAX_TOKENS", 64000),  # Max for reasoner
    # Runtime controls via env
    # Asset configuration: support separate CRYPTO_ASSETS and FOREX_ASSETS, or legacy ASSETS
    "crypto_assets": _get_env("CRYPTO_ASSETS"),  # e.g., "BTC ETH SOL BNB ZEC DOGE AVAX XLM XMR"
    "forex_assets": _get_env("FOREX_ASSETS"),  # e.g., "EURUSD GBPUSD USDJPY AUDUSD"
    "assets": _get_env("ASSETS"),  # Legacy: e.g., "BTC ETH SOL" or "BTC,ETH,SOL" (fallback if CRYPTO_ASSETS/FOREX_ASSETS not set)
    "interval": _get_env("INTERVAL"),  # e.g., "5m", "1h"
    # Strategy selection (default: None/empty uses LLM trend strategy)
    "strategy": _get_env("STRATEGY"),  # Options: "default", "llm_trend", "scalping", "auto", etc.
    # Scalping strategy settings
    "scalping_risk_per_trade": _get_float("SCALPING_RISK_PER_TRADE", 10.0),  # Risk per trade in USD
    "scalping_tp_percent": _get_float("SCALPING_TP_PERCENT", 5.0),  # Take profit percentage for scalping (e.g., 5.0 = 5%) - close immediately at 5%
    "scalping_sl_percent": _get_float("SCALPING_SL_PERCENT", 3.0),  # Stop loss percentage (e.g., 3.0 = 3%) - updated from 0.5%
    "auto_strategy_cache_minutes": _get_int("AUTO_STRATEGY_CACHE_MINUTES", 0),  # 0 = re-evaluate every cycle, >0 = cache for X minutes
    # Advanced position management
    "enable_trailing_stop": _get_bool("ENABLE_TRAILING_STOP", True),  # Enable trailing stop loss
    "trailing_stop_activation_pct": _get_float("TRAILING_STOP_ACTIVATION_PCT", 5.0),  # Start trailing after X% profit
    "trailing_stop_distance_pct": _get_float("TRAILING_STOP_DISTANCE_PCT", 3.0),  # Keep SL X% below peak profit
    "trading_enabled": _get_bool("TRADING_ENABLED", True),  # Enable/disable trading (when False, skips new entries but still monitors/closes positions)
    "max_position_hold_hours": _get_float("MAX_POSITION_HOLD_HOURS", 24.0),  # Maximum hours to hold a position
    "enable_drawdown_protection": _get_bool("ENABLE_DRAWDOWN_PROTECTION", True),  # Enable drawdown protection
    "max_drawdown_from_peak_pct": _get_float("MAX_DRAWDOWN_FROM_PEAK_PCT", 5.0),  # Close if profit drops X% from peak
    "loss_protection_pct": _get_float("LOSS_PROTECTION_PCT", 5.0),  # Close if position is down X% (backup protection)
    # API server (DigitalOcean App Platform uses PORT, fallback to APP_PORT/API_PORT/3000)
    "api_host": _get_env("API_HOST", "0.0.0.0"),
    "api_port": _get_env("PORT") or _get_env("APP_PORT") or _get_env("API_PORT") or "3000",
    # Alert service configuration
    "ALERT_SERVICE_ENABLED": _get_bool("ALERT_SERVICE_ENABLED", False),
    "ALERT_SERVICE_PORT": _get_int("ALERT_SERVICE_PORT", 8080),
    "ALERT_CHECK_INTERVAL": _get_int("ALERT_CHECK_INTERVAL", 5),
    "ALERT_AGENT_ENDPOINT": _get_env("ALERT_AGENT_ENDPOINT", "http://localhost:5000/api/alert/signal"),
    "ALERT_ASSETS": _get_env("ALERT_ASSETS", "BTC,ETH,SOL"),
    "ALERT_RISK_PER_TRADE": _get_float("ALERT_RISK_PER_TRADE", 20.0),
    "ALERT_TIMEFRAME": _get_env("ALERT_TIMEFRAME", "5m"),  # Default timeframe (5m, 15m, 1h, etc.)
    # Multi-exchange mode (trade on multiple exchanges simultaneously)
    "MULTI_EXCHANGE_MODE": _get_env("MULTI_EXCHANGE_MODE", "false"),  # Set to "true" to enable
}

def _parse_assets(assets_str: str | None) -> list[str]:
    """Parse assets from environment variable (supports space or comma separated).
    
    Args:
        assets_str: Asset string like "BTC ETH SOL" or "BTC,ETH,SOL"
        
    Returns:
        List of asset symbols (uppercase, stripped)
    """
    if not assets_str:
        return []
    # Support both space and comma separated
    if "," in assets_str:
        return [a.strip().upper() for a in assets_str.split(",") if a.strip()]
    else:
        return [a.strip().upper() for a in assets_str.split(" ") if a.strip()]

# Parse assets list
_assets_list = _parse_assets(CONFIG.get("assets"))
if _assets_list:
    CONFIG["assets"] = " ".join(_assets_list)
    CONFIG["assets_list"] = _assets_list
else:
    CONFIG["assets"] = None
    CONFIG["assets_list"] = []

# Load per-asset leverage settings (e.g., ZEC_LEVERAGE=5, BTC_LEVERAGE=10)
# This scans all environment variables matching {ASSET}_LEVERAGE pattern
_per_asset_leverage = {}
for key, value in os.environ.items():
    if key.endswith("_LEVERAGE") and key != "BINANCE_LEVERAGE":
        asset = key[:-9].upper()  # Remove "_LEVERAGE" suffix
        try:
            leverage = int(value)
            if leverage > 0:
                _per_asset_leverage[asset] = leverage
        except (ValueError, TypeError):
            pass  # Skip invalid values

# Load per-asset timeframe settings (e.g., BTC_TIMEFRAME=15m, ETH_TIMEFRAME=5m)
# This scans all environment variables matching {ASSET}_TIMEFRAME pattern
_per_asset_timeframe = {}
for key, value in os.environ.items():
    if key.endswith("_TIMEFRAME") and key != "ALERT_TIMEFRAME":
        asset = key[:-10].upper()  # Remove "_TIMEFRAME" suffix
        if asset and value:
            _per_asset_timeframe[asset] = value.strip()


def get_leverage_for_asset(asset: str, default_leverage: int) -> int:
    """Get leverage for a specific asset.
    
    Args:
        asset: Asset symbol (e.g., 'ZEC', 'BTC')
        default_leverage: Default leverage to use if no per-asset setting exists
        
    Returns:
        Leverage for the asset (per-asset setting if exists, otherwise default)
    """
    asset_upper = asset.upper()
    # Check exact match first
    if asset_upper in _per_asset_leverage:
        return _per_asset_leverage[asset_upper]
    # Check without USDT suffix if asset has it
    if asset_upper.endswith("USDT"):
        base_asset = asset_upper[:-4]
        if base_asset in _per_asset_leverage:
            return _per_asset_leverage[base_asset]
    return default_leverage


def get_timeframe_for_asset(asset: str, default_timeframe: str) -> str:
    """Get timeframe for a specific asset.
    
    Args:
        asset: Asset symbol (e.g., 'BTC', 'ETH')
        default_timeframe: Default timeframe to use if no per-asset setting exists (e.g., '5m', '15m')
        
    Returns:
        Timeframe for the asset (per-asset setting if exists, otherwise default)
    """
    asset_upper = asset.upper()
    # Check exact match first
    if asset_upper in _per_asset_timeframe:
        return _per_asset_timeframe[asset_upper]
    # Check without USDT suffix if asset has it
    if asset_upper.endswith("USDT"):
        base_asset = asset_upper[:-4]
        if base_asset in _per_asset_timeframe:
            return _per_asset_timeframe[base_asset]
    return default_timeframe
