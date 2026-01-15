"""Strategy interface for all trading strategies."""

from abc import ABC, abstractmethod
from typing import Dict, Any, List, Union


class StrategyInterface(ABC):
    """Abstract base class for all trading strategies.
    
    All strategies must implement decide_trade() which returns
    trade decisions in a standardized format.
    """
    
    @abstractmethod
    def decide_trade(self, assets: List[str], context: Union[Dict[str, Any], str]) -> Dict[str, Any]:
        """Generate trading decisions for multiple assets.
        
        Args:
            assets: List of asset tickers to analyze (e.g., ['BTC', 'ETH', 'SOL'])
            context: Structured market/account state containing:
                - invocation: Timing and cycle information
                - trading_settings: Risk management settings
                - account: Account balance, positions, PnL
                - market_data: Per-asset technical indicators and price data
                - position_status: Current positions and active trades
                - recent_trades: Recent trading history
                - recent_diary: Recent diary entries
        
        Returns:
            Dictionary with format:
            {
                'reasoning': str,  # Human-readable explanation of decisions
                'trade_decisions': List[Dict]  # One decision per asset
            }
            
            Each trade decision dict contains:
            {
                'asset': str,  # Asset ticker
                'action': str,  # 'buy', 'sell', or 'hold'
                'allocation_usd': float,  # Position size in USD
                'tp_price': float | None,  # Take profit price
                'sl_price': float | None,  # Stop loss price
                'exit_plan': str,  # Exit conditions description
                'rationale': str  # Reason for this decision
            }
        """
        raise NotImplementedError("Strategy must implement decide_trade()")
    
    def get_name(self) -> str:
        """Get the strategy name.
        
        Returns:
            Strategy name string
        """
        return self.__class__.__name__

