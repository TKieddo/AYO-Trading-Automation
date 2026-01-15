"""Backtesting engine for simulating strategy trades on historical data."""

import pandas as pd
import numpy as np
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
from src.strategies.base_strategy import BaseStrategy
from src.backtesting.metrics import calculate_metrics
from src.indicators.technical_analysis_client import TechnicalAnalysisClient


class BacktestEngine:
    """Simulate strategy trades on historical data."""
    
    def __init__(self, strategy: BaseStrategy, initial_capital: float = 300.0):
        """Initialize backtest engine.
        
        Args:
            strategy: Strategy to backtest
            initial_capital: Starting capital in USD
        """
        self.strategy = strategy
        self.initial_capital = initial_capital
        self.logger = logging.getLogger(__name__)
        self.ta_client = TechnicalAnalysisClient()
    
    def run(self, data: pd.DataFrame, symbol: str = "BTCUSDT", timeframe: str = "5m") -> Dict[str, Any]:
        """Run backtest on historical data.
        
        Args:
            data: DataFrame with OHLCV data (columns: open, high, low, close, volume)
            symbol: Trading symbol
            timeframe: Timeframe string
            
        Returns:
            Dictionary with backtest results and metrics
        """
        if data.empty or len(data) < 50:
            self.logger.warning("Insufficient data for backtest")
            return {}
        
        # Initialize tracking
        capital = self.initial_capital
        position = None  # {size, entry_price, entry_time, direction}
        trades = []
        equity_curve = [capital]
        equity_dates = [data.index[0]]
        
        # Simulate trades
        for i in range(50, len(data)):  # Start after enough data for indicators
            current_price = data.iloc[i]['close']
            current_time = data.index[i]
            
            # Calculate indicators for current data slice (up to current candle)
            data_slice = data.iloc[:i+1]
            indicators = self._calculate_indicators(data_slice)
            
            # Get market data slice
            market_data = {
                'price': current_price,
                'data': data_slice,
                'current_index': i,
            }
            
            # Generate signal
            try:
                signal = self.strategy.generate_signals(
                    market_data,
                    indicators,
                    current_price
                )
            except Exception as e:
                self.logger.error(f"Error generating signal: {e}")
                continue
            
            # Handle position management
            if position is None:
                # No position - check for entry (lowered threshold to 0.4 for more trades)
                signal_strength = signal.get('signal', 0)
                signal_direction = signal.get('direction', 'NEUTRAL')
                
                if signal_direction == 'BUY' and signal_strength > 0.4:
                    # Enter long position
                    position_size = capital * 0.2  # Use 20% of capital per trade
                    position = {
                        'size': position_size / current_price,
                        'entry_price': current_price,
                        'entry_time': current_time,
                        'direction': 'long',
                        'entry_capital': position_size,
                    }
                    capital -= position_size
                    self.logger.info(f"✅ Entry: {current_time}, Price: {current_price:.2f}, Size: {position['size']:.6f}, Signal: {signal_strength:.2f}")
            
            else:
                # Have position - check for exit
                should_exit = False
                exit_reason = ""
                
                # Check signal for exit
                if signal.get('direction') == 'SELL' or signal.get('signal', 0) < -0.5:
                    should_exit = True
                    exit_reason = "Signal"
                
                # Check take profit / stop loss (if strategy defines them)
                if hasattr(self.strategy, 'take_profit') and hasattr(self.strategy, 'stop_loss'):
                    tp_price = position['entry_price'] * (1 + self.strategy.take_profit / 100)
                    sl_price = position['entry_price'] * (1 - self.strategy.stop_loss / 100)
                    
                    if position['direction'] == 'long':
                        if current_price >= tp_price:
                            should_exit = True
                            exit_reason = "Take Profit"
                        elif current_price <= sl_price:
                            should_exit = True
                            exit_reason = "Stop Loss"
                
                if should_exit:
                    # Exit position
                    exit_value = position['size'] * current_price
                    pnl = exit_value - position['entry_capital']
                    pnl_percent = (pnl / position['entry_capital']) * 100
                    
                    capital += exit_value
                    
                    trades.append({
                        'entry_price': position['entry_price'],
                        'exit_price': current_price,
                        'entry_time': position['entry_time'],
                        'exit_time': current_time,
                        'pnl': pnl,
                        'pnl_percent': pnl_percent,
                        'direction': position['direction'],
                        'reason': exit_reason,
                    })
                    
                    self.logger.debug(
                        f"Exit: {current_time}, Price: {current_price:.2f}, "
                        f"PnL: {pnl:.2f} ({pnl_percent:.2f}%)"
                    )
                    
                    position = None
            
            # Update equity curve
            current_equity = capital
            if position:
                # Include unrealized PnL
                position_value = position['size'] * current_price
                current_equity = capital + position_value
            
            equity_curve.append(current_equity)
            equity_dates.append(current_time)
        
        # Close any open position at end
        if position:
            final_price = data.iloc[-1]['close']
            exit_value = position['size'] * final_price
            pnl = exit_value - position['entry_capital']
            capital += exit_value
            
            trades.append({
                'entry_price': position['entry_price'],
                'exit_price': final_price,
                'entry_time': position['entry_time'],
                'exit_time': data.index[-1],
                'pnl': pnl,
                'pnl_percent': (pnl / position['entry_capital']) * 100,
                'direction': position['direction'],
                'reason': "End of Data",
            })
            equity_curve[-1] = capital
        
        # Calculate metrics
        equity_series = pd.Series(equity_curve, index=equity_dates)
        metrics = calculate_metrics(equity_series, trades, self.initial_capital)
        
        # Add buy and hold comparison
        buy_hold_return = ((data.iloc[-1]['close'] - data.iloc[0]['close']) / data.iloc[0]['close']) * 100
        metrics['buy_and_hold_return'] = buy_hold_return
        
        # Add equity curve data
        metrics['equity_curve'] = equity_series.to_dict()
        
        self.logger.info(
            f"Backtest complete: {len(trades)} trades, "
            f"Return: {metrics.get('total_return', 0):.2f}%, "
            f"Sharpe: {metrics.get('sharpe_ratio', 0):.2f}"
        )
        
        return metrics
    
    def _calculate_indicators(self, data: pd.DataFrame) -> Dict[str, Any]:
        """Calculate technical indicators for the data."""
        indicators = {}
        
        try:
            # RSI - need at least 15 candles (14 period + 1)
            if len(data) >= 15:
                rsi = self.ta_client._calculate_rsi(data, period=14)
                if not rsi.empty and not pd.isna(rsi.iloc[-1]):
                    indicators['rsi'] = float(rsi.iloc[-1])
                    indicators['rsi_series'] = rsi
                else:
                    indicators['rsi'] = None
            else:
                indicators['rsi'] = None
            
            # EMA - can calculate with fewer candles
            if len(data) >= 20:
                ema_fast = data['close'].ewm(span=20, adjust=False).mean()
                indicators['ema_fast'] = float(ema_fast.iloc[-1]) if not pd.isna(ema_fast.iloc[-1]) else None
                indicators['ema_fast_series'] = ema_fast
            else:
                indicators['ema_fast'] = None
                
            if len(data) >= 50:
                ema_slow = data['close'].ewm(span=50, adjust=False).mean()
                indicators['ema_slow'] = float(ema_slow.iloc[-1]) if not pd.isna(ema_slow.iloc[-1]) else None
                indicators['ema_slow_series'] = ema_slow
            else:
                indicators['ema_slow'] = None
            
            # MACD
            if len(data) >= 26:
                macd_data = self.ta_client._calculate_macd(data)
                if macd_data:
                    macd_series = macd_data.get('MACD', pd.Series())
                    signal_series = macd_data.get('MACD_signal', pd.Series())
                    hist_series = macd_data.get('MACD_hist', pd.Series())
                    indicators['macd'] = macd_series.iloc[-1] if not macd_series.empty else 0
                    indicators['macd_signal'] = signal_series.iloc[-1] if not signal_series.empty else 0
                    indicators['macd_histogram'] = hist_series.iloc[-1] if not hist_series.empty else 0
            
        except Exception as e:
            self.logger.error(f"Error calculating indicators: {e}")
        
        return indicators

