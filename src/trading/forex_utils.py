"""Forex trading utilities for position sizing, pip calculations, and leverage."""

import logging
from typing import Optional


def calculate_lot_size_from_capital(
    capital: float,
    leverage: float,
    entry_price: float = 1.0
) -> float:
    """Calculate lot size from capital and leverage.
    
    Args:
        capital: Capital/margin in base currency (e.g., USD)
        leverage: Leverage ratio (e.g., 50, 100, 200, 500)
        entry_price: Entry price of the pair (default 1.0 for most pairs)
        
    Returns:
        Lot size (e.g., 0.1 = mini lot, 1.0 = standard lot)
    
    Example:
        $30 capital × 500 leverage = $15,000 position
        At EUR/USD 1.1000 = 13,636 EUR = 0.136 lot
    """
    position_size = capital * leverage
    units = position_size / entry_price
    lot_size = units / 100000.0  # 1 lot = 100,000 units
    return round(lot_size, 2)


def calculate_profit_per_pip(
    lot_size: float,
    pair_type: str = "standard"
) -> float:
    """Calculate profit per pip for a given lot size.
    
    Args:
        lot_size: Lot size (e.g., 0.1, 0.5, 1.0)
        pair_type: "standard" (EUR/USD, GBP/USD) or "jpy" (USD/JPY, EUR/JPY)
        
    Returns:
        Profit per pip in quote currency (usually USD)
    
    Example:
        0.1 lot on EUR/USD = $1 per pip
        1.0 lot on EUR/USD = $10 per pip
    """
    if pair_type == "jpy":
        # JPY pairs: 1 lot = 100,000 units, 1 pip = 0.01
        # Profit per pip = lot_size × 100,000 × 0.01 = lot_size × 1,000
        return lot_size * 1000.0
    else:
        # Standard pairs: 1 lot = 100,000 units, 1 pip = 0.0001
        # Profit per pip = lot_size × 100,000 × 0.0001 = lot_size × 10
        return lot_size * 10.0


def calculate_lot_size_for_profit_per_pip(
    target_profit_per_pip: float,
    pair_type: str = "standard"
) -> float:
    """Calculate lot size needed to achieve target profit per pip.
    
    Args:
        target_profit_per_pip: Desired profit per pip (e.g., $1, $5, $10)
        pair_type: "standard" or "jpy"
        
    Returns:
        Required lot size
    
    Example:
        To make $1 per pip on EUR/USD: 0.1 lot
        To make $5 per pip on EUR/USD: 0.5 lot
        To make $10 per pip on EUR/USD: 1.0 lot
    """
    if pair_type == "jpy":
        return round(target_profit_per_pip / 1000.0, 2)
    else:
        return round(target_profit_per_pip / 10.0, 2)


def calculate_margin_required(
    lot_size: float,
    leverage: float,
    entry_price: float = 1.0
) -> float:
    """Calculate margin required for a position.
    
    Args:
        lot_size: Lot size
        leverage: Leverage ratio
        entry_price: Entry price
        
    Returns:
        Margin required in base currency
    
    Example:
        0.1 lot at 50:1 leverage = $220 margin
    """
    position_size = lot_size * 100000 * entry_price
    margin = position_size / leverage
    return round(margin, 2)


def calculate_pip_value(
    lot_size: float,
    pip_move: float,
    pair_type: str = "standard"
) -> float:
    """Calculate profit/loss for a pip move.
    
    Args:
        lot_size: Lot size
        pip_move: Number of pips moved (can be negative)
        pair_type: "standard" or "jpy"
        
    Returns:
        Profit/loss in quote currency
    
    Example:
        0.1 lot, +10 pips on EUR/USD = $10 profit
        0.1 lot, -5 pips on EUR/USD = -$5 loss
    """
    profit_per_pip = calculate_profit_per_pip(lot_size, pair_type)
    return profit_per_pip * pip_move


def get_pair_type(symbol: str) -> str:
    """Determine if a forex pair is JPY-based or standard.
    
    Args:
        symbol: Symbol (e.g., 'EURUSD', 'USDJPY', 'EURJPY')
        
    Returns:
        "jpy" or "standard"
    """
    symbol_upper = symbol.upper()
    jpy_pairs = ["JPY", "JPYUSD", "USDJPY", "EURJPY", "GBPJPY", "AUDJPY", "CADJPY", "CHFJPY", "NZDJPY"]
    
    for jpy_pair in jpy_pairs:
        if jpy_pair in symbol_upper:
            return "jpy"
    
    return "standard"


def calculate_position_from_capital_and_target_pip_profit(
    capital: float,
    leverage: float,
    target_profit_per_pip: float,
    entry_price: float = 1.0,
    pair_type: str = "standard"
) -> dict:
    """Calculate complete position details from capital and target profit per pip.
    
    Args:
        capital: Capital/margin available
        leverage: Leverage ratio
        target_profit_per_pip: Desired profit per pip
        entry_price: Entry price
        pair_type: "standard" or "jpy"
        
    Returns:
        Dictionary with lot_size, position_size, margin, profit_per_pip, etc.
    
    Example:
        $30 capital, 500 leverage, $1 profit per pip:
        {
            "lot_size": 0.1,
            "position_size": 15000,
            "margin": 30,
            "profit_per_pip": 1.0,
            "units": 13636
        }
    """
    # Calculate lot size from capital
    lot_from_capital = calculate_lot_size_from_capital(capital, leverage, entry_price)
    
    # Calculate lot size from target profit
    lot_from_profit = calculate_lot_size_for_profit_per_pip(target_profit_per_pip, pair_type)
    
    # Use the smaller of the two (to not exceed capital)
    lot_size = min(lot_from_capital, lot_from_profit)
    
    # Calculate other metrics
    position_size = lot_size * 100000 * entry_price
    margin = position_size / leverage
    profit_per_pip = calculate_profit_per_pip(lot_size, pair_type)
    units = lot_size * 100000
    
    return {
        "lot_size": round(lot_size, 2),
        "position_size": round(position_size, 2),
        "margin": round(margin, 2),
        "profit_per_pip": round(profit_per_pip, 2),
        "units": round(units, 0),
        "leverage": leverage,
        "capital": capital
    }


# Quick reference examples
if __name__ == "__main__":
    print("=== Forex Position Sizing Examples ===\n")
    
    # Example 1: $30 capital, 500 leverage
    print("Example 1: $30 capital, 500:1 leverage")
    result = calculate_position_from_capital_and_target_pip_profit(
        capital=30,
        leverage=500,
        target_profit_per_pip=1.0,
        entry_price=1.1000
    )
    print(f"Lot Size: {result['lot_size']}")
    print(f"Position Size: ${result['position_size']:,.2f}")
    print(f"Margin: ${result['margin']:.2f}")
    print(f"Profit Per Pip: ${result['profit_per_pip']:.2f}")
    print(f"Units: {result['units']:,.0f}")
    print()
    
    # Example 2: $50 capital, 200 leverage
    print("Example 2: $50 capital, 200:1 leverage")
    result = calculate_position_from_capital_and_target_pip_profit(
        capital=50,
        leverage=200,
        target_profit_per_pip=1.0,
        entry_price=1.1000
    )
    print(f"Lot Size: {result['lot_size']}")
    print(f"Position Size: ${result['position_size']:,.2f}")
    print(f"Margin: ${result['margin']:.2f}")
    print(f"Profit Per Pip: ${result['profit_per_pip']:.2f}")
    print()
