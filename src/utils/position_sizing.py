"""Position sizing calculator for trading strategies.

This module provides utilities to calculate optimal position sizes based on:
- Available capital
- Target profit per price move
- Leverage settings
- Number of trading pairs
"""

from typing import Dict, List, Tuple


def calculate_position_size(
    target_profit: float,
    price_move_percent: float,
    leverage: int = 10
) -> float:
    """Calculate capital needed per position to achieve target profit.
    
    Args:
        target_profit: Desired profit in USD (e.g., 1.0 for $1)
        price_move_percent: Expected price move percentage (e.g., 1.0 for 1%)
        leverage: Leverage multiplier (e.g., 10 for 10x)
        
    Returns:
        Capital needed per position in USD
        
    Example:
        >>> calculate_position_size(1.0, 1.0, 10)
        10.0  # Need $10 to make $1 on 1% move with 10x leverage
    """
    if price_move_percent <= 0 or leverage <= 0:
        raise ValueError("Price move and leverage must be positive")
    
    return target_profit / (price_move_percent / 100 * leverage)


def calculate_profit(
    position_size: float,
    price_move_percent: float,
    leverage: int = 10
) -> float:
    """Calculate profit from a position given price movement.
    
    Args:
        position_size: Capital allocated to position in USD
        price_move_percent: Price move percentage (positive for profit, negative for loss)
        leverage: Leverage multiplier
        
    Returns:
        Profit/loss in USD
        
    Example:
        >>> calculate_profit(50.0, 1.0, 10)
        5.0  # $50 position with 10x leverage on 1% move = $5 profit
    """
    controlled_value = position_size * leverage
    return controlled_value * (price_move_percent / 100)


def recommend_allocation(
    total_capital: float,
    target_profit: float,
    price_move_percent: float,
    leverage: int = 10,
    num_pairs: int = 5
) -> Dict[str, any]:
    """Recommend position allocation strategy.
    
    Args:
        total_capital: Total trading capital in USD
        target_profit: Target profit per position in USD
        price_move_percent: Expected price move percentage
        leverage: Leverage multiplier
        num_pairs: Number of trading pairs
        
    Returns:
        Dictionary with recommendations including:
        - allocation_per_position: USD to allocate per position
        - profit_per_1pct_move: Profit if price moves 1%
        - max_positions: Maximum positions possible
        - recommended_positions: Recommended number of positions
        - risk_level: Risk assessment
    """
    # Calculate minimum needed per position
    min_per_position = calculate_position_size(target_profit, price_move_percent, leverage)
    
    # Calculate allocation per position
    allocation_per_position = total_capital / num_pairs
    
    # Calculate actual profit per 1% move
    profit_per_1pct = calculate_profit(allocation_per_position, 1.0, leverage)
    
    # Calculate maximum positions possible
    max_positions = int(total_capital / min_per_position)
    
    # Determine risk level
    if leverage <= 5:
        risk_level = "Low"
    elif leverage <= 10:
        risk_level = "Medium"
    elif leverage <= 20:
        risk_level = "High"
    else:
        risk_level = "Very High"
    
    # Recommended positions (balance diversification with capital efficiency)
    if total_capital < 500:
        recommended_positions = min(5, max(3, int(total_capital / (min_per_position * 1.5))))
    elif total_capital < 1000:
        recommended_positions = min(8, max(5, int(total_capital / (min_per_position * 1.2))))
    else:
        recommended_positions = min(10, max(6, int(total_capital / min_per_position)))
    
    return {
        "allocation_per_position": round(allocation_per_position, 2),
        "profit_per_1pct_move": round(profit_per_1pct, 2),
        "min_per_position": round(min_per_position, 2),
        "max_positions": max_positions,
        "recommended_positions": recommended_positions,
        "risk_level": risk_level,
        "total_profit_potential_1pct": round(profit_per_1pct * num_pairs, 2),
        "leverage": leverage,
        "total_capital": total_capital
    }


def calculate_liquidation_price(
    entry_price: float,
    is_long: bool,
    leverage: int,
    margin_percent: float = 100.0
) -> float:
    """Calculate liquidation price for a leveraged position.
    
    Args:
        entry_price: Entry price of the position
        is_long: True for long position, False for short
        leverage: Leverage multiplier
        margin_percent: Margin percentage before liquidation (default 100% = full margin used)
        
    Returns:
        Liquidation price
        
    Example:
        >>> # Long position at $50,000 with 10x leverage
        >>> calculate_liquidation_price(50000, True, 10)
        45000.0  # Liquidation at 10% drop
    """
    # Liquidation occurs when loss = margin
    # For long: liquidation_price = entry_price * (1 - 1/leverage)
    # For short: liquidation_price = entry_price * (1 + 1/leverage)
    
    liquidation_percent = (1.0 / leverage) * (margin_percent / 100.0)
    
    if is_long:
        return entry_price * (1 - liquidation_percent)
    else:
        return entry_price * (1 + liquidation_percent)


def print_recommendations(total_capital: float = 300.0, target_profit: float = 1.0):
    """Print position sizing recommendations for common scenarios.
    
    Args:
        total_capital: Total trading capital
        target_profit: Target profit per position
    """
    print(f"\n{'='*60}")
    print(f"POSITION SIZING RECOMMENDATIONS")
    print(f"{'='*60}")
    print(f"Total Capital: ${total_capital:,.2f}")
    print(f"Target Profit per Position: ${target_profit:.2f} on 1% move")
    print(f"\n{'Leverage':<10} {'Pairs':<8} {'Alloc/Pos':<12} {'Profit/1%':<12} {'Risk':<12}")
    print(f"{'-'*60}")
    
    for leverage in [1, 5, 10, 20]:
        for num_pairs in [3, 5, 6, 8]:
            if num_pairs > 8:
                continue
            rec = recommend_allocation(total_capital, target_profit, 1.0, leverage, num_pairs)
            if rec["allocation_per_position"] >= rec["min_per_position"]:
                print(f"{leverage}x{'':<6} {num_pairs:<8} ${rec['allocation_per_position']:<11.2f} "
                      f"${rec['profit_per_1pct_move']:<11.2f} {rec['risk_level']:<12}")
    
    print(f"\n{'='*60}")
    print("RECOMMENDED SETUP FOR $300 CAPITAL:")
    print(f"{'='*60}")
    rec = recommend_allocation(300.0, 1.0, 1.0, 10, 5)
    print(f"Leverage: {rec['leverage']}x")
    print(f"Number of Pairs: {rec['recommended_positions']}")
    print(f"Allocation per Position: ${rec['allocation_per_position']}")
    print(f"Profit per 1% Move: ${rec['profit_per_1pct_move']}")
    print(f"Total Profit Potential (all positions move 1%): ${rec['total_profit_potential_1pct']}")
    print(f"Risk Level: {rec['risk_level']}")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    # Print recommendations for $300 capital
    print_recommendations(300.0, 1.0)
    
    # Example calculations
    print("\nExample Calculations:")
    print("-" * 60)
    
    # Example 1: BTC at $50,000
    btc_price = 50000
    allocation = 50
    leverage = 10
    position_size = allocation / btc_price
    profit_1pct = calculate_profit(allocation, 1.0, leverage)
    
    print(f"\nBTC Example:")
    print(f"  Price: ${btc_price:,}")
    print(f"  Allocation: ${allocation}")
    print(f"  Leverage: {leverage}x")
    print(f"  Position Size: {position_size:.6f} BTC")
    print(f"  Controlled Value: ${allocation * leverage:,}")
    print(f"  Profit on 1% move: ${profit_1pct:.2f}")
    print(f"  Profit on 5% move: ${calculate_profit(allocation, 5.0, leverage):.2f}")
    
    # Liquidation example
    liq_price = calculate_liquidation_price(btc_price, True, leverage)
    print(f"  Liquidation Price (Long): ${liq_price:,.2f} ({((btc_price - liq_price) / btc_price * 100):.1f}% drop)")

