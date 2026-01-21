"""Rule-based scalping strategy - 5m high win rate strategy."""

from src.strategies.strategy_interface import StrategyInterface
from src.indicators.technical_analysis_client import TechnicalAnalysisClient
from src.config_loader import CONFIG
from typing import Dict, Any, List, Optional, Union
import logging
import json


class ScalpingStrategy(StrategyInterface):
    """5-minute scalping strategy with high win rate.
    
    Based on proven Pine Script strategy:
    - 5-minute timeframe execution
    - Entry: EMA5 crossover + RSI filter + volume surge
    - Fixed risk per trade
    - TP: 5.0% (close immediately at 5%), SL: 3%
    - Quick in, quick out - take profits fast
    
    🎯 SCALPING EXIT STRATEGY:
    - Take profit target: 5% (configurable via SCALPING_TP_PERCENT)
    - Close immediately when 5% profit is reached
    - System will auto-close at 5% if not closed manually
    - Don't wait for higher profits - scalping is about quick wins
    
    🚨 AUTOMATIC POSITION MANAGEMENT (System-Enforced):
    The system automatically handles:
    - Auto-close at 5% profit (scalping target)
    - Maximum hold time (auto-closes after 24 hours)
    - Drawdown protection (auto-closes if profit drops 5%+ from peak)
    - Loss protection (auto-closes if down 5%+ for 1+ hours)
    
    This strategy focuses on entry signals only - exits are handled automatically at 5%.
    """
    
    def __init__(self):
        """Initialize scalping strategy parameters."""
        self.ta_client = TechnicalAnalysisClient()
        self.logger = logging.getLogger(f"strategy.{self.__class__.__name__}")
        
        # Strategy parameters from config or defaults
        self.risk_per_trade = CONFIG.get("scalping_risk_per_trade", 10.0)
        self.tp_percent = CONFIG.get("scalping_tp_percent", 1.5) / 100.0
        self.sl_percent = CONFIG.get("scalping_sl_percent", 0.5) / 100.0
        
        # Indicator periods
        self.ema_fast_period = 5
        self.ema_slow_period = 20
        self.rsi_period = 10
        self.volume_sma_period = 20
        self.volume_surge_multiplier = 1.5
        
        # RSI thresholds
        self.rsi_long_threshold = 55
        self.rsi_short_threshold = 45
        
        # Track previous values for crossover detection
        self.prev_ema5 = {}
        self.prev_ema20 = {}
    
    def decide_trade(self, assets: List[str], context: Union[Dict[str, Any], str]) -> Dict[str, Any]:
        """Generate trading decisions using 5m scalping rules.
        
        Args:
            assets: List of asset tickers to analyze
            context: Structured market/account state (dict or JSON string)
            
        Returns:
            Dictionary with 'reasoning' and 'trade_decisions' keys
        """
        # Parse context if it's a string
        if isinstance(context, str):
            try:
                context = json.loads(context)
            except (json.JSONDecodeError, TypeError) as e:
                self.logger.error(f"Error parsing context JSON: {e}")
                return {
                    "reasoning": f"Error parsing context: {str(e)}",
                    "trade_decisions": [self._create_hold_decision(a, "Context parse error") for a in assets]
                }
        
        reasoning_parts = []
        trade_decisions = []
        
        # Get position status
        position_status = context.get("position_status", {})
        assets_with_positions = set(position_status.get("assets_with_positions", []))
        active_trades = position_status.get("active_trades", [])
        
        # Get trading settings
        trading_settings = context.get("trading_settings", {})
        margin_per_position = trading_settings.get("margin_per_position")
        
        # Track current positions by asset
        positions_by_asset = {}
        for trade in active_trades:
            asset = trade.get("asset")
            if asset:
                positions_by_asset[asset] = trade
        
        # Get market data - it's a list of dicts, convert to dict keyed by asset
        market_data_list = context.get("market_data", [])
        market_data = {}
        if isinstance(market_data_list, list):
            for item in market_data_list:
                if isinstance(item, dict) and "asset" in item:
                    market_data[item["asset"]] = item
        elif isinstance(market_data_list, dict):
            market_data = market_data_list
        
        for asset in assets:
            try:
                # If we have a position, check TP/SL and decide whether to close
                if asset in assets_with_positions:
                    # Get position data from context to check PnL
                    positions_data = context.get("positions_data", {}).get("positions", [])
                    position_info = next((p for p in positions_data if p.get("asset") == asset), None)
                    
                    if position_info:
                        pnl_percent = position_info.get("pnl_percent", 0)
                        # Get scalping TP from trading settings
                        scalping_tp = trading_settings.get("scalping_tp_percent", 5.0)
                        
                        # Check if TP is reached - if so, close the position
                        if pnl_percent is not None and pnl_percent >= scalping_tp:
                            # Get position side to determine close action
                            position_side = position_info.get("side")
                            # Fallback: check active_trades if side not in position_info
                            if not position_side:
                                active_trade = positions_by_asset.get(asset)
                                if active_trade:
                                    is_long = active_trade.get("is_long", True)
                                    position_side = "long" if is_long else "short"
                                else:
                                    position_side = "long"  # Default to long if unknown
                            
                            is_long = position_side == "long"
                            # Close action: sell for long positions, buy for short positions
                            close_action = "sell" if is_long else "buy"
                            decision = self._create_close_decision(
                                asset,
                                f"Scalping TP reached: {pnl_percent:.2f}% >= {scalping_tp}% - taking profit",
                                close_action
                            )
                        else:
                            decision = self._create_hold_decision(
                                asset, 
                                f"Position active. PnL: {pnl_percent:.2f}%. Monitor for TP ({scalping_tp}%) or exit conditions."
                            )
                    else:
                        decision = self._create_hold_decision(
                            asset, 
                            "Position active. Monitor for TP/SL or exit conditions."
                        )
                else:
                    decision = self._check_entry_conditions(
                        asset, 
                        market_data.get(asset, {}),
                        margin_per_position
                    )
                
                trade_decisions.append(decision)
                if decision.get("action") != "hold":
                    reasoning_parts.append(f"{asset}: {decision.get('action')} - {decision.get('rationale')}")
            except Exception as e:
                self.logger.error(f"Error analyzing {asset}: {e}")
                trade_decisions.append(self._create_hold_decision(asset, f"Error: {str(e)}"))
        
        reasoning = "5m Scalping Strategy Analysis:\n" + "\n".join(reasoning_parts) if reasoning_parts else "No entry signals detected."
        
        return {
            "reasoning": reasoning,
            "trade_decisions": trade_decisions
        }
    
    def _check_entry_conditions(
        self, 
        asset: str, 
        market_data: Dict[str, Any],
        margin_per_position: Optional[float]
    ) -> Dict[str, Any]:
        """Check if entry conditions are met for an asset."""
        
        try:
            symbol = f"{asset}/USDT"
            timeframe = "5m"
            
            # Get current price
            current_price = market_data.get("current_price")
            if not current_price:
                recent_mids = market_data.get("recent_mids", [])
                if recent_mids:
                    current_price = float(recent_mids[-1]) if isinstance(recent_mids[-1], (int, float)) else float(recent_mids[-1])
                else:
                    return self._create_hold_decision(asset, "Unable to fetch current price")
            
            # Fetch indicators - need series for crossover detection (Pine Script uses current and previous bar)
            # Fetch more data to ensure we have proper EMA values (need at least 20+ candles for EMA20)
            ema5_series = self.ta_client.fetch_series("ema", symbol, timeframe, results=3, params={"period": self.ema_fast_period})
            ema20_series = self.ta_client.fetch_series("ema", symbol, timeframe, results=3, params={"period": self.ema_slow_period})
            rsi_value = self.ta_client.fetch_value("rsi", symbol, timeframe, {"period": self.rsi_period})
            
            # Fetch volume data for surge detection (exactly like Pine Script: volume > 1.5 * volAvg)
            volume_data = self._get_volume_data(symbol, timeframe)
            if not volume_data:
                return self._create_hold_decision(asset, "Unable to fetch volume data")
            
            current_volume = volume_data.get("current")
            volume_sma = volume_data.get("sma")
            # Pine Script: volumeSurge = volume > 1.5 * volAvg
            volume_surge = current_volume > (volume_sma * self.volume_surge_multiplier) if volume_sma and current_volume else False
            
            # Check if we have enough data
            if len(ema5_series) < 2 or len(ema20_series) < 2 or rsi_value is None:
                return self._create_hold_decision(asset, f"Insufficient indicator data (EMA5: {len(ema5_series)}, EMA20: {len(ema20_series)}, RSI: {rsi_value})")
            
            # Get current and previous EMA values (fetch_series returns latest first after reverse)
            # Pine Script: ta.crossover(ema5, ema20) = true when ema5 crosses above ema20
            ema5_current = ema5_series[0]  # Latest (current bar close)
            ema5_previous = ema5_series[1]  # Previous bar close
            ema20_current = ema20_series[0]  # Latest
            ema20_previous = ema20_series[1]  # Previous
            
            # Detect crossovers (exactly like Pine Script ta.crossover/ta.crossunder)
            # Pine Script: ta.crossover(ema5, ema20) = ema5[1] <= ema20[1] and ema5 > ema20
            ema5_cross_above_ema20 = ema5_previous <= ema20_previous and ema5_current > ema20_current
            # Pine Script: ta.crossunder(ema5, ema20) = ema5[1] >= ema20[1] and ema5 < ema20
            ema5_cross_below_ema20 = ema5_previous >= ema20_previous and ema5_current < ema20_current
            
            # Entry conditions (from Pine Script - EXACT MATCH)
            # Pine Script: longCondition = ta.crossover(ema5, ema20) and rsi > 55 and volumeSurge
            long_condition = ema5_cross_above_ema20 and rsi_value > self.rsi_long_threshold and volume_surge
            # Pine Script: shortCondition = ta.crossunder(ema5, ema20) and rsi < 45 and volumeSurge
            short_condition = ema5_cross_below_ema20 and rsi_value < self.rsi_short_threshold and volume_surge
            
            # Detailed logging for debugging (INFO level so we can see what's happening)
            volume_ratio = (current_volume / volume_sma) if volume_sma > 0 else 0
            self.logger.info(
                f"{asset} Scalping Check: "
                f"EMA5={ema5_current:.2f} (prev={ema5_previous:.2f}), "
                f"EMA20={ema20_current:.2f} (prev={ema20_previous:.2f}), "
                f"RSI={rsi_value:.1f}, "
                f"Vol={current_volume:.0f} vs SMA={volume_sma:.0f} (ratio={volume_ratio:.2f}x, surge={volume_surge}), "
                f"CrossAbove={ema5_cross_above_ema20}, CrossBelow={ema5_cross_below_ema20}, "
                f"LongCond={long_condition}, ShortCond={short_condition}"
            )
            
            if long_condition:
                return self._create_long_entry(asset, current_price, margin_per_position)
            elif short_condition:
                return self._create_short_entry(asset, current_price, margin_per_position)
            else:
                # Log why no entry
                reasons = []
                if not ema5_cross_above_ema20 and not ema5_cross_below_ema20:
                    reasons.append("No EMA crossover")
                if rsi_value is not None:
                    if not (rsi_value > self.rsi_long_threshold or rsi_value < self.rsi_short_threshold):
                        reasons.append(f"RSI {rsi_value:.1f} not in range")
                if not volume_surge:
                    reasons.append("No volume surge")
                
                return self._create_hold_decision(asset, "; ".join(reasons) if reasons else "Entry conditions not met")
            
        except Exception as e:
            self.logger.error(f"Error in entry conditions for {asset}: {e}")
            return self._create_hold_decision(asset, f"Error: {str(e)}")
    
    def _get_volume_data(self, symbol: str, timeframe: str) -> Optional[Dict[str, float]]:
        """Get current volume and volume SMA for surge detection.
        
        Pine Script: volAvg = ta.sma(volume, 20)
        Pine Script: volumeSurge = volume > 1.5 * volAvg
        """
        try:
            # Fetch klines to get volume data (need at least 20+ candles for SMA)
            df = self.ta_client._get_klines(symbol, timeframe, limit=self.volume_sma_period + 10)
            if df.empty or len(df) < self.volume_sma_period:
                self.logger.warning(f"Insufficient volume data for {symbol}: {len(df)} candles, need {self.volume_sma_period}")
                return None
            
            # Pine Script uses current bar's volume (latest candle)
            current_volume = float(df["volume"].iloc[-1])
            # Pine Script: volAvg = ta.sma(volume, 20) - uses last 20 periods
            volume_sma = float(df["volume"].tail(self.volume_sma_period).mean())
            
            return {
                "current": current_volume,
                "sma": volume_sma
            }
        except Exception as e:
            self.logger.error(f"Error fetching volume data for {symbol}: {e}")
            return None
    
    def _create_long_entry(
        self, 
        asset: str, 
        entry_price: float,
        margin_per_position: Optional[float]
    ) -> Dict[str, Any]:
        """Create a long entry decision."""
        # Calculate TP/SL
        tp_price = entry_price * (1 + self.tp_percent)
        sl_price = entry_price * (1 - self.sl_percent)
        
        # Calculate position size using Pine Script formula (EXACT MATCH)
        # Pine Script: positionSize = riskPerTrade / (slPercent * close)
        # This gives position size in units. For futures, we need notional value:
        # Notional = positionSize * price = (riskPerTrade / (slPercent * price)) * price = riskPerTrade / slPercent
        # Example: risk=$10, sl=0.5%, then notional = $10 / 0.005 = $2000
        # This ensures we risk exactly $10 if SL hits (0.5% of $2000 = $10)
        position_size_notional_usd = self.risk_per_trade / self.sl_percent
        
        # Use margin_per_position if available (for margin-based sizing), 
        # otherwise use calculated position size from Pine Script formula
        if margin_per_position:
            allocation_usd = margin_per_position
            self.logger.info(f"{asset} Long: Using margin_per_position ${allocation_usd:.2f} (Pine Script notional: ${position_size_notional_usd:.2f})")
        else:
            allocation_usd = position_size_notional_usd
            self.logger.info(f"{asset} Long: Using Pine Script position size ${allocation_usd:.2f} (risk: ${self.risk_per_trade:.2f}, SL: {self.sl_percent*100:.1f}%)")
        
        # Trailing stop: TP/2 (0.75%)
        trail_percent = self.tp_percent / 2
        
        exit_plan = (
            f"SCALPING: TP: {tp_price:.2f} (+{self.tp_percent*100:.1f}%), "
            f"SL: {sl_price:.2f} (-{self.sl_percent*100:.1f}%). "
            f"🎯 Close immediately at 5% profit. "
            f"System will auto-close at 5% if not closed manually."
        )
        
        rationale = (
            f"Long entry: EMA5 crossed above EMA20, RSI > {self.rsi_long_threshold}, volume surge detected. "
            f"Risk: ${self.risk_per_trade:.2f}, Position size: ${allocation_usd:.2f}"
        )
        
        return {
            "asset": asset,
            "action": "buy",
            "allocation_usd": round(allocation_usd, 2),
            "tp_price": round(tp_price, 2),
            "sl_price": round(sl_price, 2),
            "exit_plan": exit_plan,
            "rationale": rationale
        }
    
    def _create_short_entry(
        self, 
        asset: str, 
        entry_price: float,
        margin_per_position: Optional[float]
    ) -> Dict[str, Any]:
        """Create a short entry decision."""
        # Calculate TP/SL
        tp_price = entry_price * (1 - self.tp_percent)
        sl_price = entry_price * (1 + self.sl_percent)
        
        # Calculate position size using Pine Script formula (EXACT MATCH)
        # Pine Script: positionSize = riskPerTrade / (slPercent * close)
        # For futures notional: riskPerTrade / slPercent
        position_size_notional_usd = self.risk_per_trade / self.sl_percent
        
        # Use margin_per_position if available, otherwise use calculated position size
        if margin_per_position:
            allocation_usd = margin_per_position
            self.logger.info(f"{asset} Short: Using margin_per_position ${allocation_usd:.2f} (Pine Script notional: ${position_size_notional_usd:.2f})")
        else:
            allocation_usd = position_size_notional_usd
            self.logger.info(f"{asset} Short: Using Pine Script position size ${allocation_usd:.2f} (risk: ${self.risk_per_trade:.2f}, SL: {self.sl_percent*100:.1f}%)")
        
        exit_plan = (
            f"SCALPING: TP: {tp_price:.2f} (-{self.tp_percent*100:.1f}%), "
            f"SL: {sl_price:.2f} (+{self.sl_percent*100:.1f}%). "
            f"🎯 Close immediately at {self.tp_percent*100:.1f}% profit. "
            f"System will auto-close at {self.tp_percent*100:.1f}% if not closed manually."
        )
        
        rationale = (
            f"Short entry: EMA5 crossed below EMA20, RSI < {self.rsi_short_threshold}, volume surge detected. "
            f"Risk: ${self.risk_per_trade:.2f}, Position size: ${allocation_usd:.2f}"
        )
        
        return {
            "asset": asset,
            "action": "sell",
            "allocation_usd": round(allocation_usd, 2),
            "tp_price": round(tp_price, 2),
            "sl_price": round(sl_price, 2),
            "exit_plan": exit_plan,
            "rationale": rationale
        }
    
    def _create_close_decision(self, asset: str, reason: str, close_action: str) -> Dict[str, Any]:
        """Create a decision to close an existing position.
        
        Args:
            asset: Asset ticker
            reason: Reason for closing (e.g., "TP reached")
            close_action: "sell" for long positions, "buy" for short positions
        """
        return {
            "asset": asset,
            "action": close_action,  # "sell" to close long, "buy" to close short
            "allocation_usd": 0,  # No new allocation needed for closing
            "rationale": reason,
            "tp_price": None,
            "sl_price": None,
            "exit_plan": f"CLOSE: {reason}"
        }
    
    def _create_hold_decision(self, asset: str, reason: str) -> Dict[str, Any]:
        """Create a hold decision for an asset."""
        return {
            "asset": asset,
            "action": "hold",
            "allocation_usd": 0.0,
            "tp_price": None,
            "sl_price": None,
            "exit_plan": "",
            "rationale": reason
        }
