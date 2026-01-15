"""FastAPI endpoint for backtesting execution.
This bridges Next.js API calls to Python backtesting engine."""

import asyncio
import json
import logging
import sys
from pathlib import Path
from typing import Dict, Any, Optional
from datetime import datetime
import pandas as pd

# Add project root to Python path
project_root = Path(__file__).parent.parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from src.backtesting.engine import BacktestEngine
from src.backtesting.data_loader import DataLoader
from src.strategies.base_strategy import BaseStrategy

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class MockStrategy(BaseStrategy):
    """Mock strategy for testing - will be replaced with actual strategy code."""
    
    def __init__(self, strategy_json: Dict[str, Any]):
        super().__init__(
            name=strategy_json.get("name", "Mock Strategy"),
            description=strategy_json.get("description", "")
        )
        self.strategy_json = strategy_json
        # Extract parameters from strategy_json
        self.rsi_period = strategy_json.get("rsi_period", 14)
        self.ema_fast = strategy_json.get("ema_fast", 20)
        self.ema_slow = strategy_json.get("ema_slow", 50)
        self.take_profit = strategy_json.get("take_profit", 5.0)
        self.stop_loss = strategy_json.get("stop_loss", 3.0)
    
    def generate_signals(
        self,
        data: Dict[str, Any],
        indicators: Dict[str, Any],
        current_price: float
    ) -> Dict[str, Any]:
        """Generate signals based on strategy rules."""
        signal_strength = 0.0
        direction = "NEUTRAL"
        
        # Simple RSI + EMA strategy
        rsi = indicators.get("rsi")
        ema_fast = indicators.get("ema_fast")
        ema_slow = indicators.get("ema_slow")
        
        # Debug: Log first few calls to see what we're getting
        if not hasattr(self, '_debug_count'):
            self._debug_count = 0
        if self._debug_count < 5:
            logger.info(f"Signal call {self._debug_count}: rsi={rsi}, ema_fast={ema_fast}, ema_slow={ema_slow}, price={current_price}")
            self._debug_count += 1
        
        # More aggressive: Try to generate signals even with partial data
        if rsi is not None and ema_fast is not None and ema_slow is not None:
            # Buy signal: RSI oversold + price above EMA fast
            if rsi < 30 and current_price > ema_fast:
                signal_strength = 0.8
                direction = "BUY"
            # Sell signal: RSI overbought + price below EMA fast
            elif rsi > 70 and current_price < ema_fast:
                signal_strength = 0.8
                direction = "SELL"
            # EMA crossover (more aggressive)
            elif ema_fast > ema_slow and current_price > ema_fast:
                signal_strength = 0.6
                direction = "BUY"
            elif ema_fast < ema_slow and current_price < ema_fast:
                signal_strength = 0.6
                direction = "SELL"
            # Additional signals: RSI in neutral zone with EMA trend
            elif 40 < rsi < 60:  # Neutral RSI
                if ema_fast > ema_slow and current_price > ema_fast * 0.99:  # Price near or above fast EMA
                    signal_strength = 0.5
                    direction = "BUY"
                elif ema_fast < ema_slow and current_price < ema_fast * 1.01:  # Price near or below fast EMA
                    signal_strength = 0.5
                    direction = "SELL"
        # Even more aggressive: Generate signals with just EMA if RSI is missing
        elif ema_fast is not None and ema_slow is not None:
            # EMA crossover signals (more lenient)
            if ema_fast > ema_slow * 1.001:  # Fast EMA above slow EMA (0.1% threshold)
                signal_strength = 0.4
                direction = "BUY"
            elif ema_fast < ema_slow * 0.999:  # Fast EMA below slow EMA
                signal_strength = 0.4
                direction = "SELL"
        # Fallback: Generate signals based on price momentum
        elif len(indicators) == 0:
            # If no indicators, use simple price-based signals (very aggressive for testing)
            # This should rarely happen, but helps debug
            logger.warning("No indicators available, using fallback price-based signals")
        
        return {
            "signal": signal_strength,
            "direction": direction,
            "confidence": signal_strength,
            "metadata": {
                "rsi": rsi,
                "ema_fast": ema_fast,
                "ema_slow": ema_slow,
            }
        }


async def run_backtest(
    strategy_id: str,
    strategy_json: Dict[str, Any],
    symbol: str,
    timeframe: str,
    start_date: str,
    end_date: str,
    initial_capital: float = 300.0
) -> Dict[str, Any]:
    """Run a backtest and return results.
    
    Args:
        strategy_id: Strategy ID
        strategy_json: Strategy configuration JSON
        symbol: Trading pair (e.g., BTCUSDT)
        timeframe: Timeframe (e.g., 5m)
        start_date: Start date (YYYY-MM-DD)
        end_date: End date (YYYY-MM-DD)
        initial_capital: Starting capital
        
    Returns:
        Dictionary with backtest results
    """
    try:
        logger.info(f"Starting backtest: {strategy_id}, {symbol}, {timeframe}, {start_date} to {end_date}")
        
        # Load historical data
        loader = DataLoader()
        start_dt = datetime.fromisoformat(start_date)
        end_dt = datetime.fromisoformat(end_date)
        
        logger.info(f"Loading historical data from Binance...")
        data = loader.load_from_binance(symbol, timeframe, start_dt, end_dt)
        
        if data is None or data.empty:
            raise ValueError(f"No data available for {symbol} from {start_date} to {end_date}")
        
        logger.info(f"Loaded {len(data)} candles")
        
        # Create strategy instance
        strategy = MockStrategy(strategy_json)
        
        # Run backtest
        engine = BacktestEngine(strategy, initial_capital)
        logger.info("Running backtest simulation...")
        results = engine.run(data, symbol, timeframe)
        
        logger.info(f"Backtest complete: Return={results.get('total_return', 0):.2f}%")
        
        return {
            "success": True,
            "result": results,
        }
        
    except Exception as e:
        logger.error(f"Backtest error: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e),
        }


if __name__ == "__main__":
    # Test backtest
    import asyncio
    
    test_strategy = {
        "name": "Test Strategy",
        "description": "Test",
        "rsi_period": 14,
        "ema_fast": 20,
        "ema_slow": 50,
        "take_profit": 5.0,
        "stop_loss": 3.0,
    }
    
    result = asyncio.run(run_backtest(
        strategy_id="test",
        strategy_json=test_strategy,
        symbol="BTCUSDT",
        timeframe="5m",
        start_date="2024-01-01",
        end_date="2024-01-31",
        initial_capital=300.0
    ))
    
    print(json.dumps(result, indent=2))

