"""Factory for creating and managing trading strategies."""

from typing import Optional
import logging
from src.strategies.strategy_interface import StrategyInterface
from src.strategies.llm_trend_strategy import LLMTrendStrategy
from src.strategies.scalping_strategy import ScalpingStrategy
from src.strategies.auto_strategy_selector import AutoStrategySelector


class StrategyFactory:
    """Factory class for creating trading strategies by name."""
    
    # Registry of available strategies
    _strategies = {
        "default": LLMTrendStrategy,
        "llm_trend": LLMTrendStrategy,
        "llm": LLMTrendStrategy,
        "trend": LLMTrendStrategy,
        "scalping": ScalpingStrategy,
        "scalp": ScalpingStrategy,
        "auto": AutoStrategySelector,  # Auto mode: LLM selects best strategy
    }
    
    @classmethod
    def get_strategy(cls, strategy_name: Optional[str] = None) -> StrategyInterface:
        """Get a strategy instance by name.
        
        Args:
            strategy_name: Name of the strategy to use. If None, empty, or "default",
                         returns the default LLM trend strategy.
        
        Returns:
            StrategyInterface instance
        
        Raises:
            ValueError: If strategy_name is not recognized
        """
        logger = logging.getLogger(__name__)
        
        # Normalize strategy name
        if not strategy_name or strategy_name.strip() == "" or strategy_name.lower() == "default":
            strategy_name = "default"
        else:
            strategy_name = strategy_name.lower().strip()
        
        # Get strategy class
        strategy_class = cls._strategies.get(strategy_name)
        
        if strategy_class is None:
            available = ", ".join(cls._strategies.keys())
            raise ValueError(
                f"Unknown strategy: '{strategy_name}'. "
                f"Available strategies: {available}"
            )
        
        logger.info(f"Initializing strategy: {strategy_name} ({strategy_class.__name__})")
        
        # Instantiate and return strategy
        return strategy_class()
    
    @classmethod
    def list_strategies(cls) -> list[str]:
        """List all available strategy names.
        
        Returns:
            List of strategy name strings
        """
        return list(cls._strategies.keys())
    
    @classmethod
    def register_strategy(cls, name: str, strategy_class: type[StrategyInterface]):
        """Register a new strategy class.
        
        Args:
            name: Strategy name (will be normalized to lowercase)
            strategy_class: Strategy class that implements StrategyInterface
        """
        if not issubclass(strategy_class, StrategyInterface):
            raise TypeError(f"Strategy class must implement StrategyInterface")
        
        cls._strategies[name.lower()] = strategy_class
        logging.getLogger(__name__).info(f"Registered strategy: {name} -> {strategy_class.__name__}")

