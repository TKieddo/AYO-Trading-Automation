"""Strategy optimization engine using LLM-guided and other methods."""

import logging
import json
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
from src.strategies.base_strategy import BaseStrategy
from src.backtesting.engine import BacktestEngine
from src.backtesting.metrics import calculate_metrics


@dataclass
class OptimizationResult:
    """Result of an optimization iteration."""
    parameters: Dict[str, Any]
    profitability: float
    sharpe_ratio: float
    max_drawdown: float
    win_rate: float
    total_trades: int
    backtest_result: Dict[str, Any]
    llm_reasoning: Optional[str] = None


class StrategyOptimizer:
    """Optimize strategy parameters to reach target profitability."""
    
    def __init__(
        self,
        strategy: BaseStrategy,
        target_profitability: float,
        max_iterations: int = 50,
        method: str = "llm_guided"
    ):
        """Initialize optimizer.
        
        Args:
            strategy: Strategy to optimize
            target_profitability: Target profitability percentage
            max_iterations: Maximum iterations to run
            method: Optimization method ('llm_guided', 'grid_search', 'random_search')
        """
        self.strategy = strategy
        self.target = target_profitability
        self.max_iterations = max_iterations
        self.method = method
        self.logger = logging.getLogger(__name__)
        
        self.best_result: Optional[OptimizationResult] = None
        self.iteration_history: List[OptimizationResult] = []
        self.current_iteration = 0
    
    def optimize(
        self,
        historical_data: Any,
        initial_capital: float = 300.0,
        llm_client=None
    ) -> OptimizationResult:
        """Run optimization loop.
        
        Args:
            historical_data: Historical OHLCV data
            initial_capital: Starting capital
            llm_client: LLM client for guided optimization
            
        Returns:
            Best optimization result found
        """
        self.logger.info(f"Starting optimization: target={self.target}%, method={self.method}")
        
        # Get initial parameters
        base_params = self._extract_parameters(self.strategy)
        self.logger.info(f"Base parameters: {base_params}")
        
        # Run initial backtest
        initial_result = self._backtest_with_params(base_params, historical_data, initial_capital)
        self.best_result = initial_result
        self.iteration_history.append(initial_result)
        
        self.logger.info(f"Iteration 0: Profitability={initial_result.profitability:.2f}%")
        
        # Optimization loop
        for iteration in range(1, self.max_iterations + 1):
            self.current_iteration = iteration
            
            # Check if target met
            if self.best_result.profitability >= self.target:
                self.logger.info(f"Target reached at iteration {iteration-1}!")
                break
            
            # Generate parameter variations
            if self.method == "llm_guided" and llm_client:
                params = self._llm_suggest_parameters(
                    llm_client,
                    self.best_result,
                    self.iteration_history
                )
            elif self.method == "grid_search":
                params = self._grid_search_parameters(base_params, iteration)
            else:
                params = self._random_search_parameters(base_params)
            
            # Test parameters
            result = self._backtest_with_params(params, historical_data, initial_capital)
            self.iteration_history.append(result)
            
            # Update best if better
            if result.profitability > self.best_result.profitability:
                self.best_result = result
                self.logger.info(
                    f"Iteration {iteration}: New best! "
                    f"Profitability={result.profitability:.2f}% "
                    f"(improvement: +{result.profitability - initial_result.profitability:.2f}%)"
                )
            
            # Check if worth continuing (LLM decision for guided method)
            if self.method == "llm_guided" and llm_client:
                if not self._should_continue_optimization(llm_client, result, iteration):
                    self.logger.info(f"LLM determined optimization not worth continuing at iteration {iteration}")
                    break
        
        improvement = self.best_result.profitability - initial_result.profitability
        self.logger.info(
            f"Optimization complete: Best={self.best_result.profitability:.2f}%, "
            f"Improvement=+{improvement:.2f}%, Iterations={self.current_iteration}"
        )
        
        return self.best_result
    
    def _extract_parameters(self, strategy: BaseStrategy) -> Dict[str, Any]:
        """Extract optimizable parameters from strategy."""
        # This would analyze the strategy code/configuration
        # For now, return a placeholder structure
        return {
            "rsi_period": getattr(strategy, "rsi_period", 14),
            "ema_fast": getattr(strategy, "ema_fast", 20),
            "ema_slow": getattr(strategy, "ema_slow", 50),
            "take_profit": getattr(strategy, "take_profit", 5.0),
            "stop_loss": getattr(strategy, "stop_loss", 3.0),
        }
    
    def _backtest_with_params(
        self,
        params: Dict[str, Any],
        historical_data: Any,
        initial_capital: float
    ) -> OptimizationResult:
        """Run backtest with given parameters."""
        # Apply parameters to strategy
        for key, value in params.items():
            if hasattr(self.strategy, key):
                setattr(self.strategy, key, value)
        
        # Run backtest
        engine = BacktestEngine(self.strategy, initial_capital)
        result = engine.run(historical_data)
        
        return OptimizationResult(
            parameters=params.copy(),
            profitability=result.get("total_return", 0),
            sharpe_ratio=result.get("sharpe_ratio", 0),
            max_drawdown=result.get("max_drawdown", 0),
            win_rate=result.get("win_rate", 0),
            total_trades=result.get("total_trades", 0),
            backtest_result=result
        )
    
    def _llm_suggest_parameters(
        self,
        llm_client,
        best_result: OptimizationResult,
        history: List[OptimizationResult]
    ) -> Dict[str, Any]:
        """Use LLM to suggest parameter improvements."""
        prompt = f"""
You are optimizing a trading strategy. Analyze the current performance and suggest parameter changes.

Current Best Performance:
- Profitability: {best_result.profitability:.2f}%
- Sharpe Ratio: {best_result.sharpe_ratio:.2f}
- Max Drawdown: {best_result.max_drawdown:.2f}%
- Win Rate: {best_result.win_rate:.2f}%

Current Parameters:
{json.dumps(best_result.parameters, indent=2)}

Target Profitability: {self.target}%

Recent Optimization History:
{self._format_history(history[-5:])}

Suggest ONE set of parameter changes that could improve profitability toward the target.
Focus on parameters that directly affect entry/exit timing and risk management.

Return ONLY valid JSON in this format:
{{
    "rsi_period": <number between 7-21>,
    "ema_fast": <number between 10-30>,
    "ema_slow": <number between 30-100>,
    "take_profit": <number between 3-10>,
    "stop_loss": <number between 1-5>,
    "reasoning": "<brief explanation of why these changes should help>"
}}
"""
        try:
            response = llm_client.generate(prompt)
            # Parse JSON from response
            suggestions = json.loads(response)
            reasoning = suggestions.pop("reasoning", "")
            
            # Create result with reasoning
            result = OptimizationResult(
                parameters=suggestions,
                profitability=0,  # Will be calculated
                sharpe_ratio=0,
                max_drawdown=0,
                win_rate=0,
                total_trades=0,
                backtest_result={},
                llm_reasoning=reasoning
            )
            
            return suggestions
        except Exception as e:
            self.logger.error(f"LLM suggestion failed: {e}, using random search")
            return self._random_search_parameters(best_result.parameters)
    
    def _grid_search_parameters(self, base_params: Dict[str, Any], iteration: int) -> Dict[str, Any]:
        """Generate parameters using grid search."""
        # Simple grid search - cycle through parameter ranges
        ranges = {
            "rsi_period": list(range(7, 22, 2)),
            "ema_fast": list(range(10, 31, 5)),
            "ema_slow": list(range(30, 101, 10)),
            "take_profit": [3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0],
            "stop_loss": [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 5.0],
        }
        
        # Calculate which combination to test
        total_combinations = 1
        for r in ranges.values():
            total_combinations *= len(r)
        
        # Cycle through combinations
        params = {}
        remaining = iteration % total_combinations
        for key, values in ranges.items():
            idx = remaining % len(values)
            params[key] = values[idx]
            remaining //= len(values)
        
        return params
    
    def _random_search_parameters(self, base_params: Dict[str, Any]) -> Dict[str, Any]:
        """Generate random parameter variations."""
        import random
        
        params = {}
        params["rsi_period"] = random.randint(7, 21)
        params["ema_fast"] = random.randint(10, 30)
        params["ema_slow"] = random.randint(30, 100)
        params["take_profit"] = round(random.uniform(3.0, 10.0), 1)
        params["stop_loss"] = round(random.uniform(1.0, 5.0), 1)
        
        return params
    
    def _should_continue_optimization(
        self,
        llm_client,
        current_result: OptimizationResult,
        iteration: int
    ) -> bool:
        """Ask LLM if optimization should continue."""
        if iteration < 5:  # Always continue for first 5 iterations
            return True
        
        prompt = f"""
Should we continue optimizing this trading strategy?

Current Status:
- Iteration: {iteration} / {self.max_iterations}
- Best Profitability: {self.best_result.profitability:.2f}%
- Target: {self.target}%
- Latest Result: {current_result.profitability:.2f}%

Recent Trend: {self._analyze_trend()}

Respond with ONLY "YES" or "NO" followed by a brief reason.
"""
        try:
            response = llm_client.generate(prompt).strip().upper()
            return response.startswith("YES")
        except:
            # Default: continue if not at target
            return self.best_result.profitability < self.target
    
    def _format_history(self, history: List[OptimizationResult]) -> str:
        """Format optimization history for LLM."""
        lines = []
        for i, result in enumerate(history):
            lines.append(
                f"Iteration {i}: Profitability={result.profitability:.2f}%, "
                f"Params={result.parameters}"
            )
        return "\n".join(lines)
    
    def _analyze_trend(self) -> str:
        """Analyze optimization trend."""
        if len(self.iteration_history) < 3:
            return "Not enough data"
        
        recent = [r.profitability for r in self.iteration_history[-5:]]
        if len(recent) >= 2:
            trend = "improving" if recent[-1] > recent[0] else "declining"
            return f"Profitability trend: {trend} ({recent[0]:.2f}% → {recent[-1]:.2f}%)"
        return "Stable"

