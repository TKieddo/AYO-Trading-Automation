"""Base strategy class for all trading strategies."""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
import logging


class BaseStrategy(ABC):
    """Base class for all trading strategies.
    
    All strategies must inherit from this class and implement generate_signals().
    """
    
    def __init__(self, name: str, description: str = ""):
        """Initialize the strategy.
        
        Args:
            name: Strategy name
            description: Strategy description
        """
        self.name = name
        self.description = description
        self.logger = logging.getLogger(f"strategy.{name}")
    
    @abstractmethod
    def generate_signals(
        self,
        data: Dict[str, Any],
        indicators: Dict[str, Any],
        current_price: float
    ) -> Dict[str, Any]:
        """Generate trading signals based on market data and indicators.
        
        Args:
            data: Market data (OHLCV, etc.)
            indicators: Technical indicators (RSI, EMA, MACD, etc.)
            current_price: Current price of the asset
            
        Returns:
            Dictionary with signal information:
            {
                'signal': float,  # Signal strength (0-1)
                'direction': str,  # 'BUY', 'SELL', or 'NEUTRAL'
                'confidence': float,  # Confidence (0-1)
                'metadata': dict  # Strategy-specific data
            }
        """
        raise NotImplementedError("Strategy must implement generate_signals()")
    
    def validate_signal(self, signal: Dict[str, Any]) -> bool:
        """Validate a signal before returning it.
        
        Args:
            signal: Signal dictionary
            
        Returns:
            True if signal is valid, False otherwise
        """
        required_keys = ['signal', 'direction']
        return all(key in signal for key in required_keys)
    
    def __repr__(self) -> str:
        return f"<{self.__class__.__name__}(name='{self.name}')>"

