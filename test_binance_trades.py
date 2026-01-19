"""Test script to retrieve and display Binance account trade history."""

import asyncio
import sys
import pathlib
import json
from datetime import datetime, timedelta
sys.path.append(str(pathlib.Path(__file__).parent))

from src.trading.binance_api import BinanceAPI
from dotenv import load_dotenv
import logging

load_dotenv()
logging.basicConfig(level=logging.WARNING, format="%(asctime)s - %(levelname)s - %(message)s")


def format_timestamp(ts):
    """Format timestamp in milliseconds to readable date."""
    if not ts:
        return "N/A"
    try:
        dt = datetime.fromtimestamp(ts / 1000)
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    except:
        return str(ts)


def print_separator(char="=", length=80):
    """Print a separator line."""
    print(char * length)


def print_section(title):
    """Print a section header."""
    print()
    print_separator("=")
    print(f"  {title}")
    print_separator("=")


async def get_all_trades(binance, symbol=None, days_back=30, limit=1000):
    """Get all trades for a symbol or all symbols.
    
    Note: Binance API has limitations:
    - Default returns last 7 days if no time range specified
    - startTime + endTime cannot span more than 7 days
    - Cannot retrieve trades older than 6 months
    """
    all_trades = []
    
    try:
        if symbol:
            # Get trades for specific symbol
            print(f"\n📊 Fetching trades for {symbol}...")
            
            # Calculate time range (7-day windows)
            end_time = int(datetime.now().timestamp() * 1000)
            start_time = int((datetime.now() - timedelta(days=days_back)).timestamp() * 1000)
            
            current_start = start_time
            window_days = 7  # Binance limit: max 7 days per request
            
            while current_start < end_time:
                current_end = min(
                    current_start + (window_days * 24 * 60 * 60 * 1000),
                    end_time
                )
                
                try:
                    # Use the python-binance client method
                    # Note: futures_account_trades() accepts symbol, startTime, endTime, fromId, limit
                    raw_trades = await binance._retry(
                        lambda: binance.client.futures_account_trades(
                            symbol=symbol,
                            startTime=current_start,
                            endTime=current_end,
                            limit=limit
                        )
                    )
                    
                    if raw_trades:
                        # Format trades to include all fields (same as get_recent_fills)
                        formatted_window_trades = []
                        for t in raw_trades:
                            asset = binance._from_futures_symbol(t.get('symbol', ''))
                            formatted_window_trades.append({
                                # Original Binance fields
                                'id': t.get('id'),
                                'tradeId': t.get('id'),
                                'symbol': t.get('symbol', ''),
                                'coin': asset,
                                'asset': asset,
                                'side': t.get('side', ''),
                                'isBuy': t.get('side') == 'BUY',
                                'positionSide': t.get('positionSide', ''),
                                'price': float(t.get('price', 0)),
                                'px': float(t.get('price', 0)),
                                'qty': float(t.get('qty', 0)),
                                'sz': float(t.get('qty', 0)),
                                'size': float(t.get('qty', 0)),
                                'quoteQty': float(t.get('quoteQty', 0)),
                                'time': t.get('time', 0),
                                'timestamp': t.get('time', 0),
                                'orderId': t.get('orderId'),
                                'maker': t.get('maker', False),
                                'buyer': t.get('buyer', False),
                                'realizedPnl': float(t.get('realizedPnl', 0)) if t.get('realizedPnl') is not None else None,
                                'realized_pnl': float(t.get('realizedPnl', 0)) if t.get('realizedPnl') is not None else None,
                                'commission': float(t.get('commission', 0)) if t.get('commission') else 0,
                                'fee': float(t.get('commission', 0)) if t.get('commission') else 0,
                                'commissionAsset': t.get('commissionAsset', 'USDT'),
                            })
                        all_trades.extend(formatted_window_trades)
                        print(f"  ✓ Fetched {len(formatted_window_trades)} trades from {format_timestamp(current_start)} to {format_timestamp(current_end)}")
                    
                    # Move to next window
                    current_start = current_end + 1
                    
                    # Small delay to avoid rate limits
                    await asyncio.sleep(0.2)
                    
                except Exception as e:
                    print(f"  ⚠️  Error fetching trades for window {format_timestamp(current_start)}-{format_timestamp(current_end)}: {e}")
                    current_start = current_end + 1
                    continue
        else:
            # Get trades for all symbols (using recent fills method)
            # Note: futures_account_trades() without symbol returns last 7 days by default
            print(f"\n📊 Fetching recent trades for all symbols (last 7 days by default)...")
            print(f"   Note: To get trades for specific symbol, use --symbol SYMBOL")
            trades = await binance.get_recent_fills(limit=limit)
            all_trades = trades
        
        # Sort by time (oldest first)
        if all_trades and isinstance(all_trades[0], dict) and 'time' in all_trades[0]:
            all_trades.sort(key=lambda x: x.get('time', 0))
        
        return all_trades
        
    except Exception as e:
        print(f"\n❌ Error fetching trades: {e}")
        import traceback
        traceback.print_exc()
        return []


def print_trade_details(trade, index=None):
    """Print detailed trade information."""
    trade_id = trade.get('id', trade.get('tradeId', 'N/A'))
    symbol = trade.get('symbol', trade.get('coin', 'N/A'))
    side = trade.get('side', 'N/A')
    price = float(trade.get('price', 0))
    qty = float(trade.get('qty', trade.get('qty', trade.get('sz', trade.get('size', 0)))))
    time_ms = trade.get('time', trade.get('timestamp', 0))
    realized_pnl = trade.get('realizedPnl', trade.get('realized_pnl'))
    commission = trade.get('commission', trade.get('fee', 0))
    commission_asset = trade.get('commissionAsset', 'USDT')
    order_id = trade.get('orderId', 'N/A')
    maker = trade.get('maker', False)
    position_side = trade.get('positionSide', 'N/A')
    
    if index is not None:
        print(f"\n  {index}. Trade ID: {trade_id}")
    else:
        print(f"\n  Trade ID: {trade_id}")
    
    print(f"     Symbol: {symbol}")
    print(f"     Side: {side} ({position_side})")
    print(f"     Price: ${price:.8f}")
    print(f"     Quantity: {qty:.8f}")
    print(f"     Value: ${price * qty:.2f}")
    print(f"     Time: {format_timestamp(time_ms)}")
    print(f"     Order ID: {order_id}")
    print(f"     Maker: {maker}")
    if realized_pnl is not None:
        pnl_val = float(realized_pnl)
        pnl_color = "🟢" if pnl_val >= 0 else "🔴"
        print(f"     Realized PnL: {pnl_color} ${pnl_val:.4f}")
    if commission:
        comm_val = float(commission)
        print(f"     Commission: ${abs(comm_val):.4f} {commission_asset}")


async def test_trades(symbol=None, days_back=30, limit=1000, closed_only=False):
    """Test trade history retrieval."""
    print_separator()
    if closed_only:
        print("  BINANCE CLOSED TRADES TEST (with Realized PnL)")
    else:
        print("  BINANCE ACCOUNT TRADE HISTORY TEST")
    print_separator()
    
    try:
        binance = BinanceAPI()
        testnet = binance.testnet
        
        print(f"\n📍 Testnet Mode: {testnet}")
        if testnet:
            print(f"🔗 View on Binance Testnet: https://testnet.binancefuture.com/")
        else:
            print(f"🔗 View on Binance: https://www.binance.com/en/futures")
        
        if symbol:
            print(f"\n🔍 Fetching trades for symbol: {symbol}")
        else:
            print(f"\n🔍 Fetching recent trades for all symbols (last {limit} trades)")
        
        print(f"📅 Time range: Last {days_back} days")
        print(f"📊 Limit: {limit} trades per request")
        
        # Get trades
        trades = await get_all_trades(binance, symbol=symbol, days_back=days_back, limit=limit)
        
        if not trades:
            print("\n❌ No trades found")
            return
        
        print(f"\n✅ Found {len(trades)} trade(s)")
        
        # Summary
        print_section("TRADE SUMMARY")
        
        # Group by symbol
        by_symbol = {}
        total_pnl = 0.0
        total_commission = 0.0
        
        for trade in trades:
            sym = trade.get('symbol', trade.get('coin', 'UNKNOWN'))
            if sym not in by_symbol:
                by_symbol[sym] = []
            by_symbol[sym].append(trade)
            
            # Calculate totals
            pnl = trade.get('realizedPnl', trade.get('realized_pnl'))
            if pnl is not None:
                total_pnl += float(pnl)
            
            comm = trade.get('commission', trade.get('fee', 0))
            if comm:
                total_commission += abs(float(comm))
        
        print(f"\n📈 Total Trades: {len(trades)}")
        print(f"💰 Total Realized PnL: ${total_pnl:.4f}")
        print(f"💸 Total Commission: ${total_commission:.4f}")
        print(f"📊 Net Profit: ${total_pnl - total_commission:.4f}")
        print(f"\n📋 Trades by Symbol:")
        for sym, sym_trades in sorted(by_symbol.items()):
            sym_pnl = sum(float(t.get('realizedPnl', t.get('realized_pnl', 0))) for t in sym_trades if t.get('realizedPnl') is not None)
            print(f"  {sym}: {len(sym_trades)} trades, PnL: ${sym_pnl:.4f}")
        
        # Detailed trade list
        if closed_only:
            print_section("DETAILED CLOSED TRADES LIST")
            print(f"\nShowing {len(trades)} closed trade(s) with realized PnL (oldest first):\n")
        else:
            print_section("DETAILED TRADE LIST")
            print(f"\nShowing all {len(trades)} trade(s) (oldest first):\n")
            print("   💡 Use --closed-only flag to show only closed trades with realized PnL\n")
        
        if not trades:
            print("  No trades found.")
        else:
            for idx, trade in enumerate(trades, 1):
                print_trade_details(trade, index=idx)
        
        # Show open trades summary if not in closed_only mode
        if not closed_only and open_trades:
            print_section("OPEN TRADES SUMMARY (No Realized PnL)")
            print(f"\n⚠️  Found {len(open_trades)} open trade(s) without realized PnL:")
            print("   These are likely part of open positions that haven't been closed yet.")
            print("   Use --closed-only flag to filter them out.\n")
        
        # Export to JSON option
        print_section("EXPORT OPTIONS")
        print("\n💡 To export trades to JSON, add --export flag")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()


async def main():
    """Main test function."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Test Binance account trade history')
    parser.add_argument('--symbol', '-s', type=str, help='Symbol to test (e.g., BTCUSDT, ETHUSDT). If not provided, fetches recent trades for all symbols.')
    parser.add_argument('--asset', '-a', type=str, help='Asset name to test (e.g., BTC, ETH). Will be converted to symbol format.')
    parser.add_argument('--days', '-d', type=int, default=30, help='Number of days to look back (default: 30, max: 180)')
    parser.add_argument('--limit', '-l', type=int, default=1000, help='Limit per request (default: 1000, max: 1000)')
    parser.add_argument('--closed-only', '-c', action='store_true', help='Show only closed trades with realized PnL')
    parser.add_argument('--export', '-e', action='store_true', help='Export trades to JSON file')
    
    args = parser.parse_args()
    
    symbol = args.symbol
    if args.asset:
        symbol = f"{args.asset}USDT"
    
    days_back = min(args.days, 180)  # Binance max is 6 months (180 days)
    limit = min(args.limit, 1000)  # Binance max is 1000
    
    await test_trades(symbol=symbol, days_back=days_back, limit=limit, closed_only=args.closed_only)
    
    if args.export:
        # Export functionality can be added here
        print("\n💾 Export functionality coming soon...")


if __name__ == "__main__":
    asyncio.run(main())
