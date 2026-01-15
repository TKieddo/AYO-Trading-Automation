"""Calculate backtesting metrics."""

import numpy as np
import pandas as pd
from typing import List, Dict, Any


def calculate_metrics(
    equity_curve: pd.Series,
    trades: List[Dict[str, Any]],
    initial_capital: float
) -> Dict[str, Any]:
    """Calculate comprehensive backtesting metrics.
    
    Args:
        equity_curve: Series of portfolio values over time
        trades: List of trade dictionaries with 'entry_price', 'exit_price', 'pnl', etc.
        initial_capital: Starting capital
        
    Returns:
        Dictionary of calculated metrics
    """
    if len(equity_curve) == 0:
        return {}
    
    final_capital = equity_curve.iloc[-1]
    total_return = ((final_capital - initial_capital) / initial_capital) * 100
    
    # Calculate returns
    returns = equity_curve.pct_change().dropna()
    
    # Sharpe Ratio (annualized, assuming 252 trading days)
    if len(returns) > 1 and returns.std() > 0:
        sharpe_ratio = (returns.mean() / returns.std()) * np.sqrt(252)
    else:
        sharpe_ratio = 0.0
    
    # Sortino Ratio (only downside deviation)
    downside_returns = returns[returns < 0]
    if len(downside_returns) > 0 and downside_returns.std() > 0:
        sortino_ratio = (returns.mean() / downside_returns.std()) * np.sqrt(252)
    else:
        sortino_ratio = 0.0
    
    # Max Drawdown
    cumulative = equity_curve / initial_capital
    running_max = cumulative.expanding().max()
    drawdown = (cumulative - running_max) / running_max * 100
    max_drawdown = drawdown.min()
    
    # Trade statistics
    if trades:
        winning_trades = [t for t in trades if t.get('pnl', 0) > 0]
        losing_trades = [t for t in trades if t.get('pnl', 0) <= 0]
        
        win_rate = (len(winning_trades) / len(trades)) * 100 if trades else 0
        
        total_profit = sum(t.get('pnl', 0) for t in winning_trades)
        total_loss = abs(sum(t.get('pnl', 0) for t in losing_trades))
        profit_factor = total_profit / total_loss if total_loss > 0 else 0
        
        avg_win = np.mean([t.get('pnl', 0) for t in winning_trades]) if winning_trades else 0
        avg_loss = np.mean([t.get('pnl', 0) for t in losing_trades]) if losing_trades else 0
        expectancy = (win_rate / 100 * avg_win) - ((100 - win_rate) / 100 * abs(avg_loss))
        
        # Average hold time
        hold_times = []
        for trade in trades:
            if 'entry_time' in trade and 'exit_time' in trade:
                hold_time = (trade['exit_time'] - trade['entry_time']).total_seconds() / 3600
                hold_times.append(hold_time)
        avg_hold_time = np.mean(hold_times) if hold_times else 0
    else:
        win_rate = 0
        profit_factor = 0
        expectancy = 0
        avg_hold_time = 0
        winning_trades = []
        losing_trades = []
    
    return {
        'initial_capital': initial_capital,
        'final_capital': final_capital,
        'total_return': total_return,
        'sharpe_ratio': sharpe_ratio,
        'sortino_ratio': sortino_ratio,
        'max_drawdown': max_drawdown,
        'win_rate': win_rate,
        'profit_factor': profit_factor,
        'expectancy': expectancy,
        'total_trades': len(trades),
        'winning_trades': len(winning_trades),
        'losing_trades': len(losing_trades),
        'avg_hold_time_hours': avg_hold_time,
    }

