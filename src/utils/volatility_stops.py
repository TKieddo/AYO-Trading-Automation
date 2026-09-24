"""Volatility-adaptive exit distances.

The legacy exits compare against margin ROI, so a "3% stop" at 10x leverage is really a
0.3% price move — well inside normal noise. These helpers express the stop as a multiple of
recent ATR in *price* terms, then convert to ROI only where the existing checks need it.

Take-profit can be decoupled from the stop via ``tp_mode``:
  - ``atr_rr``      — target = TP_RR_RATIO × stop (legacy ATR behaviour)
  - ``roi_percent`` — lock in at TAKE_PROFIT_PERCENT margin ROI (scalping-friendly)
  - ``usd``         — lock in when unrealized PnL reaches TAKE_PROFIT_USD
The stop always follows ``exit_mode`` (atr / fixed) and is not changed by ``tp_mode``.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Sequence

from src.config_loader import CONFIG

logger = logging.getLogger(__name__)


@dataclass
class ExitPlan:
    """Stop and target distances for a single position."""

    stop_price_pct: float       # Stop distance as % of entry price
    target_price_pct: float     # Target distance as % of entry price (0 when usd-only)
    stop_roi_pct: float         # Same stop, expressed as % of margin
    target_roi_pct: float       # Same target, expressed as % of margin (0 when usd-only)
    atr_pct: Optional[float]    # ATR% used to derive it (None = fell back to fixed)
    source: str                 # "atr" or "fixed" — describes the STOP only
    tp_mode: str = "roi_percent"  # atr_rr | roi_percent | usd
    take_profit_usd: Optional[float] = None  # Absolute $ target when tp_mode=usd

    def stop_price(self, entry_price: float, is_long: bool) -> float:
        delta = entry_price * (self.stop_price_pct / 100.0)
        return entry_price - delta if is_long else entry_price + delta

    def target_price(
        self,
        entry_price: float,
        is_long: bool,
        *,
        quantity: Optional[float] = None,
    ) -> Optional[float]:
        """Exchange TP trigger price. For usd mode needs position size."""
        if self.tp_mode == "usd":
            tp_usd = float(self.take_profit_usd or 0)
            qty = abs(float(quantity or 0))
            if tp_usd <= 0 or qty <= 0 or entry_price <= 0:
                return None
            delta = tp_usd / qty
            return entry_price + delta if is_long else entry_price - delta

        if self.target_price_pct <= 0 or entry_price <= 0:
            return None
        delta = entry_price * (self.target_price_pct / 100.0)
        return entry_price + delta if is_long else entry_price - delta


def normalize_tp_mode(raw: Any) -> str:
    """Canonical take-profit mode string."""
    mode = str(raw or "roi_percent").strip().lower()
    aliases = {
        "atr": "atr_rr",
        "rr": "atr_rr",
        "r": "atr_rr",
        "percent": "roi_percent",
        "pct": "roi_percent",
        "roi": "roi_percent",
        "margin": "roi_percent",
        "dollar": "usd",
        "dollars": "usd",
        "$": "usd",
    }
    mode = aliases.get(mode, mode)
    if mode not in ("atr_rr", "roi_percent", "usd"):
        return "roi_percent"
    return mode


def calculate_atr_percent(candles: Sequence[Sequence[Any]], period: int = 14) -> Optional[float]:
    """ATR over `period` candles, expressed as a percentage of the latest close.

    Accepts OHLCV rows in the common exchange layout where index 2/3/4 are high/low/close.
    """
    if not candles or len(candles) < period + 1:
        return None

    true_ranges: List[float] = []
    for i in range(len(candles) - period, len(candles)):
        if i <= 0:
            continue
        try:
            high = float(candles[i][2])
            low = float(candles[i][3])
            prev_close = float(candles[i - 1][4])
        except (IndexError, TypeError, ValueError):
            return None
        true_ranges.append(max(high - low, abs(high - prev_close), abs(low - prev_close)))

    if not true_ranges:
        return None

    atr = sum(true_ranges) / len(true_ranges)
    try:
        last_close = float(candles[-1][4])
    except (IndexError, TypeError, ValueError):
        return None

    if last_close <= 0:
        return None
    return (atr / last_close) * 100.0


def build_exit_plan(
    trading_settings: Dict[str, Any],
    leverage: float,
    atr_pct: Optional[float] = None,
) -> ExitPlan:
    """Resolve stop/target distances for a trade.

    Stop follows ``exit_mode`` (atr / fixed). Take-profit follows ``tp_mode`` independently
    so scalping can lock at a fixed ROI% or $ while the stop stays ATR-wide.
    """
    leverage = max(float(leverage or 1.0), 1.0)
    mode = str(trading_settings.get("exit_mode") or CONFIG.get("exit_mode", "fixed")).lower()
    tp_mode = normalize_tp_mode(
        trading_settings.get("tp_mode") or CONFIG.get("tp_mode") or "roi_percent"
    )

    fixed_sl_roi = float(trading_settings.get("stop_loss_percent") or CONFIG.get("stop_loss_percent", 8) or 8)
    fixed_tp_roi = float(trading_settings.get("take_profit_percent") or CONFIG.get("take_profit_percent", 7) or 7)
    take_profit_usd_raw = trading_settings.get("take_profit_usd", CONFIG.get("take_profit_usd"))
    try:
        take_profit_usd = float(take_profit_usd_raw) if take_profit_usd_raw not in (None, "") else None
    except (TypeError, ValueError):
        take_profit_usd = None
    if take_profit_usd is not None and take_profit_usd <= 0:
        take_profit_usd = None

    # --- Stop (unchanged by tp_mode) ---
    if mode != "atr" or atr_pct is None or atr_pct <= 0:
        if mode == "atr":
            logger.debug("ATR exit mode requested but no usable ATR; falling back to fixed percentages")
        stop_price_pct = fixed_sl_roi / leverage
        stop_roi_pct = fixed_sl_roi
        stop_source = "fixed"
    else:
        sl_mult = float(trading_settings.get("sl_atr_mult") or CONFIG.get("sl_atr_mult", 2.0) or 2.0)
        min_stop = float(trading_settings.get("min_stop_price_pct") or CONFIG.get("min_stop_price_pct", 0.6) or 0.6)
        max_stop = float(trading_settings.get("max_stop_price_pct") or CONFIG.get("max_stop_price_pct", 4.0) or 4.0)
        stop_price_pct = min(max(atr_pct * sl_mult, min_stop), max_stop)
        stop_roi_pct = stop_price_pct * leverage
        stop_source = "atr"

    # --- Take profit (independent) ---
    if tp_mode == "atr_rr":
        rr = float(trading_settings.get("tp_rr_ratio") or CONFIG.get("tp_rr_ratio", 2.5) or 2.5)
        target_price_pct = stop_price_pct * rr
        target_roi_pct = target_price_pct * leverage
        tp_usd = None
    elif tp_mode == "usd":
        # Price % unknown until size is known; mechanical loop uses $ PnL directly.
        target_price_pct = 0.0
        target_roi_pct = 0.0
        tp_usd = take_profit_usd
        if tp_usd is None:
            # Fall back to ROI% if USD not configured so we never leave a trade without a TP.
            logger.warning("tp_mode=usd but take_profit_usd unset; falling back to roi_percent")
            tp_mode = "roi_percent"
            target_price_pct = fixed_tp_roi / leverage
            target_roi_pct = fixed_tp_roi
    else:
        # roi_percent — TAKE_PROFIT_PERCENT is margin ROI (what the dashboard label means for scalping)
        target_price_pct = fixed_tp_roi / leverage
        target_roi_pct = fixed_tp_roi
        tp_usd = None

    return ExitPlan(
        stop_price_pct=stop_price_pct,
        target_price_pct=target_price_pct,
        stop_roi_pct=stop_roi_pct,
        target_roi_pct=target_roi_pct,
        atr_pct=atr_pct,
        source=stop_source,
        tp_mode=tp_mode,
        take_profit_usd=tp_usd,
    )


def max_safe_leverage(stop_price_pct: float, buffer_multiple: float = 3.0) -> float:
    """Largest leverage that keeps liquidation at least `buffer_multiple` stops away.

    Liquidation sits roughly ``100 / leverage`` percent away before maintenance margin, so a
    stop of ``s`` percent needs ``leverage <= 100 / (s * buffer_multiple)``.
    """
    if stop_price_pct <= 0:
        return 1.0
    return max(1.0, 100.0 / (stop_price_pct * max(buffer_multiple, 1.0)))
