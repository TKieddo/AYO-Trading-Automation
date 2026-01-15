"""PineScript strategy converter - converts 5-minute scalping strategy to Python."""

from src.indicators.technical_analysis_client import TechnicalAnalysisClient
from src.config_loader import CONFIG
from typing import Dict, Any, Optional
import logging


class PineScriptStrategy:
    """Converts and executes 5-minute scalping strategy from PineScript.
    
    Exact conversion of:
    - EMA5/EMA20 crossovers
    - RSI(10) filter
    - Volume surge detection
    - Position sizing: riskPerTrade / (slPercent * close)
    - TP: 1.5%, SL: 0.5%
    - Trailing stop: TP/2
    """
    
    def __init__(self, risk_per_trade: Optional[float] = None, timeframe: Optional[str] = None):
        """Initialize PineScript strategy with configurable risk per trade and timeframe.
        
        Args:
            risk_per_trade: Risk per trade in USD (default from CONFIG or 20.0)
            timeframe: Timeframe to use (e.g., "5m", "15m") - default from CONFIG or "5m"
        """
        self.ta_client = TechnicalAnalysisClient()
        self.logger = logging.getLogger(f"alert.{self.__class__.__name__}")
        
        # Strategy parameters (exactly as PineScript)
        self.risk_per_trade = risk_per_trade or CONFIG.get("ALERT_RISK_PER_TRADE", 20.0)
        self.timeframe = timeframe or CONFIG.get("ALERT_TIMEFRAME", "5m")
        self.tp_percent = 0.015  # 1.5% (PineScript: tpPercent = 1.5 / 100)
        self.sl_percent = 0.005  # 0.5% (PineScript: slPercent = 0.5 / 100)
        
        # Indicator periods (exactly as PineScript)
        self.ema_fast_period = 5
        self.ema_slow_period = 20
        self.rsi_period = 10
        self.volume_sma_period = 20
        self.volume_surge_multiplier = 1.5
        
        # RSI thresholds (exactly as PineScript)
        self.rsi_long_threshold = 55
        self.rsi_short_threshold = 45
        
        # Track previous values for crossover detection
        self.prev_ema5 = {}
        self.prev_ema20 = {}
        self.prev_close = {}
    
    def check_signal(self, asset: str, current_price: float) -> Optional[Dict[str, Any]]:
        """Check for trading signals based on PineScript logic.
        
        Args:
            asset: Asset ticker (e.g., 'BTC')
            current_price: Current market price
            
        Returns:
            Signal dict with action, price, tp, sl, position_size, etc. or None if no signal
        """
        try:
            symbol = f"{asset}/USDT"
            
            # Fetch indicators - need series for crossover detection
            ema5_series = self.ta_client.fetch_series("ema", symbol, self.timeframe, results=3, params={"period": self.ema_fast_period})
            ema20_series = self.ta_client.fetch_series("ema", symbol, self.timeframe, results=3, params={"period": self.ema_slow_period})
            rsi_value = self.ta_client.fetch_value("rsi", symbol, self.timeframe, {"period": self.rsi_period})
            
            # Fetch volume data for surge detection
            volume_data = self._get_volume_data(symbol, self.timeframe)
            if not volume_data:
                return None
            
            current_volume = volume_data.get("current")
            volume_sma = volume_data.get("sma")
            # PineScript: volumeSurge = volume > 1.5 * volAvg
            volume_surge = current_volume > (volume_sma * self.volume_surge_multiplier) if volume_sma and current_volume else False
            
            # Check if we have enough data
            if len(ema5_series) < 2 or len(ema20_series) < 2 or rsi_value is None:
                return None
            
            # Get current and previous EMA values
            # PineScript: ta.crossover(ema5, ema20) = ema5[1] <= ema20[1] and ema5 > ema20
            ema5_current = ema5_series[0]  # Latest (current bar close)
            ema5_previous = ema5_series[1]  # Previous bar close
            ema20_current = ema20_series[0]  # Latest
            ema20_previous = ema20_series[1]  # Previous
            
            # Detect crossovers (exactly like PineScript ta.crossover/ta.crossunder)
            ema5_cross_above_ema20 = ema5_previous <= ema20_previous and ema5_current > ema20_current
            ema5_cross_below_ema20 = ema5_previous >= ema20_previous and ema5_current < ema20_current
            
            # Entry conditions (exactly as PineScript)
            # PineScript: longCondition = ta.crossover(ema5, ema20) and rsi > 55 and volumeSurge
            long_condition = ema5_cross_above_ema20 and rsi_value > self.rsi_long_threshold and volume_surge
            # PineScript: shortCondition = ta.crossunder(ema5, ema20) and rsi < 45 and volumeSurge
            short_condition = ema5_cross_below_ema20 and rsi_value < self.rsi_short_threshold and volume_surge
            
            if long_condition:
                return self._create_long_signal(asset, current_price)
            elif short_condition:
                return self._create_short_signal(asset, current_price)
            
            return None
            
        except Exception as e:
            self.logger.error(f"Error checking signal for {asset}: {e}")
            return None
    
    def _get_volume_data(self, symbol: str, timeframe: str) -> Optional[Dict[str, float]]:
        """Get current volume and volume SMA for surge detection.
        
        PineScript: volAvg = ta.sma(volume, 20)
        PineScript: volumeSurge = volume > 1.5 * volAvg
        """
        try:
            # Fetch klines to get volume data
            df = self.ta_client._get_klines(symbol, timeframe, limit=self.volume_sma_period + 10)
            if df.empty or len(df) < self.volume_sma_period:
                return None
            
            # PineScript uses current bar's volume (latest candle)
            current_volume = float(df["volume"].iloc[-1])
            # PineScript: volAvg = ta.sma(volume, 20)
            volume_sma = float(df["volume"].tail(self.volume_sma_period).mean())
            
            return {
                "current": current_volume,
                "sma": volume_sma
            }
        except Exception as e:
            self.logger.error(f"Error fetching volume data for {symbol}: {e}")
            return None
    
    def _create_long_signal(self, asset: str, entry_price: float) -> Dict[str, Any]:
        """Create a long signal with exact PineScript TP/SL calculation.
        
        PineScript:
        - limit = close * (1 + tpPercent)
        - stop = close * (1 - slPercent)
        - trail_points = close * tpPercent / 2
        - trail_offset = close * tpPercent / 2
        - positionSize = riskPerTrade / (slPercent * close)
        """
        # Calculate TP/SL exactly as PineScript
        tp_price = entry_price * (1 + self.tp_percent)  # close * (1 + tpPercent)
        sl_price = entry_price * (1 - self.sl_percent)  # close * (1 - slPercent)
        
        # Trailing stop: TP/2
        trail_points = entry_price * self.tp_percent / 2  # close * tpPercent / 2
        trail_offset = entry_price * self.tp_percent / 2  # close * tpPercent / 2
        
        # Position sizing exactly as PineScript
        # PineScript: positionSize = riskPerTrade / (slPercent * close)
        # For futures, this gives us the notional value
        position_size_notional = self.risk_per_trade / (self.sl_percent * entry_price)
        # Convert to USD allocation (positionSize * price = riskPerTrade / slPercent)
        allocation_usd = self.risk_per_trade / self.sl_percent
        
        return {
            "asset": asset,
            "action": "buy",
            "price": entry_price,
            "tp_price": round(tp_price, 2),
            "sl_price": round(sl_price, 2),
            "trail_points": round(trail_points, 2),
            "trail_offset": round(trail_offset, 2),
            "allocation_usd": round(allocation_usd, 2),
            "position_size": round(position_size_notional, 8),
            "risk_per_trade": self.risk_per_trade,
            "tp_percent": self.tp_percent * 100,
            "sl_percent": self.sl_percent * 100,
            "signal_type": "ema_cross",
            "timestamp": None  # Will be set by alert monitor
        }
    
    def _create_short_signal(self, asset: str, entry_price: float) -> Dict[str, Any]:
        """Create a short signal with exact PineScript TP/SL calculation.
        
        PineScript:
        - limit = close * (1 - tpPercent)
        - stop = close * (1 + slPercent)
        - trail_points = close * tpPercent / 2
        - trail_offset = close * tpPercent / 2
        - positionSize = riskPerTrade / (slPercent * close)
        """
        # Calculate TP/SL exactly as PineScript
        tp_price = entry_price * (1 - self.tp_percent)  # close * (1 - tpPercent)
        sl_price = entry_price * (1 + self.sl_percent)  # close * (1 + slPercent)
        
        # Trailing stop: TP/2
        trail_points = entry_price * self.tp_percent / 2
        trail_offset = entry_price * self.tp_percent / 2
        
        # Position sizing exactly as PineScript
        position_size_notional = self.risk_per_trade / (self.sl_percent * entry_price)
        allocation_usd = self.risk_per_trade / self.sl_percent
        
        return {
            "asset": asset,
            "action": "sell",
            "price": entry_price,
            "tp_price": round(tp_price, 2),
            "sl_price": round(sl_price, 2),
            "trail_points": round(trail_points, 2),
            "trail_offset": round(trail_offset, 2),
            "allocation_usd": round(allocation_usd, 2),
            "position_size": round(position_size_notional, 8),
            "risk_per_trade": self.risk_per_trade,
            "tp_percent": self.tp_percent * 100,
            "sl_percent": self.sl_percent * 100,
            "signal_type": "ema_cross",
            "timestamp": None  # Will be set by alert monitor
        }


