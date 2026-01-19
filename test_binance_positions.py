"""Test script to retrieve and display Binance position data with all calculated fields."""

import asyncio
import sys
import pathlib
import json
from datetime import datetime
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


def print_position_details(pos, title="Position Details"):
    """Print detailed position information."""
    print_section(title)
    
    # Basic Info
    print("\n📊 BASIC INFORMATION:")
    print(f"  Symbol: {pos.get('symbol', 'N/A')}")
    print(f"  Coin: {pos.get('coin', 'N/A')}")
    print(f"  Position Side: {pos.get('positionSide', 'N/A')}")
    
    # Size Information
    print("\n📏 SIZE INFORMATION:")
    position_amt = pos.get('positionAmt', 0)
    size = pos.get('size', abs(position_amt) if position_amt else 0)
    side = "LONG" if position_amt > 0 else "SHORT" if position_amt < 0 else "NONE"
    print(f"  Position Amount: {position_amt}")
    print(f"  Size (absolute): {size}")
    print(f"  Side: {side}")
    
    # Price Information
    print("\n💰 PRICE INFORMATION:")
    print(f"  Entry Price: ${pos.get('entryPrice', 0):.8f}")
    print(f"  Current Price (Mark): ${pos.get('markPrice', pos.get('currentPrice', 0)):.8f}")
    print(f"  Break Even Price: ${float(pos.get('breakEvenPrice', 0)):.8f}" if pos.get('breakEvenPrice') else "  Break Even Price: N/A")
    liquidation = pos.get('liquidationPrice', pos.get('liquidationPrice'))
    if liquidation and float(liquidation) > 0:
        print(f"  Liquidation Price: ${float(liquidation):.8f}")
    else:
        print(f"  Liquidation Price: N/A")
    
    # PnL Information
    print("\n📈 PNL & ROI INFORMATION:")
    unrealized_pnl = pos.get('unRealizedProfit', pos.get('unrealized_pnl', pos.get('pnl', 0)))
    roi = pos.get('roi', pos.get('roiPercent', 0))
    print(f"  Unrealized PnL: ${float(unrealized_pnl):.4f}")
    print(f"  ROI: {roi:.2f}%")
    
    # Leverage & Margin
    print("\n⚖️  LEVERAGE & MARGIN:")
    leverage = pos.get('leverage', pos.get('calculatedLeverage'))
    position_initial_margin = pos.get('positionInitialMargin', pos.get('initialMargin', 0))
    notional = pos.get('notional', 0)
    print(f"  Leverage: {leverage:.2f}x" if leverage else "  Leverage: N/A")
    print(f"  Notional Value: ${notional:.4f}")
    print(f"  Position Initial Margin: ${position_initial_margin:.4f}")
    
    # Margin Details
    isolated_margin = pos.get('isolatedMargin', 0)
    maint_margin = pos.get('maintMargin', 0)
    open_order_margin = pos.get('openOrderInitialMargin', 0)
    if isolated_margin:
        print(f"  Isolated Margin: ${float(isolated_margin):.4f}")
    print(f"  Maintenance Margin: ${float(maint_margin):.4f}")
    print(f"  Open Order Initial Margin: ${float(open_order_margin):.4f}")
    
    # Time Information
    print("\n🕐 TIME INFORMATION:")
    update_time = pos.get('updateTime', pos.get('update_time'))
    opened_at = pos.get('openedAt', pos.get('openTime'))
    print(f"  Last Update Time: {format_timestamp(update_time)}")
    print(f"  Opened At: {format_timestamp(opened_at)}")
    if update_time and opened_at and update_time != opened_at:
        duration_ms = update_time - opened_at
        duration_hours = duration_ms / (1000 * 60 * 60)
        print(f"  Position Duration: {duration_hours:.2f} hours")
    
    # Additional Info
    print("\n📋 ADDITIONAL INFORMATION:")
    print(f"  Margin Asset: {pos.get('marginAsset', 'N/A')}")
    print(f"  ADL: {pos.get('adl', 'N/A')}")
    print(f"  Bid Notional: ${pos.get('bidNotional', 0)}")
    print(f"  Ask Notional: ${pos.get('askNotional', 0)}")
    
    # Raw JSON (for debugging)
    print("\n🔍 RAW API RESPONSE (JSON):")
    print(json.dumps(pos, indent=2, default=str))


async def test_get_position(symbol=None):
    """Test get_position() method for a specific symbol."""
    print_separator()
    print("  TESTING: get_position() METHOD")
    print_separator()
    
    try:
        binance = BinanceAPI()
        testnet = binance.testnet
        
        print(f"\n📍 Testnet Mode: {testnet}")
        if testnet:
            print(f"🔗 View on Binance Testnet: https://testnet.binancefuture.com/")
        else:
            print(f"🔗 View on Binance: https://www.binance.com/en/futures")
        
        # Test with default or provided symbol
        if not symbol:
            symbol = 'BTCUSDT'
            print(f"\n🔍 Testing with default symbol: {symbol}")
        else:
            print(f"\n🔍 Testing with symbol: {symbol}")
        
        print("\n⏳ Fetching position data...")
        position = await binance.get_position(symbol=symbol)
        
        if position and position.get('positionAmt'):
            position_amt = float(position.get('positionAmt', 0))
            if abs(position_amt) > 0:
                print_position_details(position, f"Position for {symbol}")
            else:
                print(f"\n❌ No open position found for {symbol}")
                print(f"   Position Amount: {position_amt}")
        else:
            print(f"\n❌ No position data found for {symbol}")
            if position:
                print(f"   Response: {json.dumps(position, indent=2, default=str)}")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()


async def test_get_user_state():
    """Test get_user_state() method to see all positions."""
    print_separator()
    print("  TESTING: get_user_state() METHOD")
    print_separator()
    
    try:
        binance = BinanceAPI()
        testnet = binance.testnet
        
        print(f"\n📍 Testnet Mode: {testnet}")
        if testnet:
            print(f"🔗 View on Binance Testnet: https://testnet.binancefuture.com/")
        else:
            print(f"🔗 View on Binance: https://www.binance.com/en/futures")
        
        print("\n⏳ Fetching account state and all positions...")
        state = await binance.get_user_state()
        
        # Account Summary
        print_section("ACCOUNT SUMMARY")
        balance = state.get('balance', 0)
        total_value = state.get('total_value', 0)
        positions = state.get('positions', [])
        asset_balances = state.get('asset_balances', [])
        
        print(f"\n💰 Balance: ${balance:.2f} USDT")
        print(f"💵 Total Value: ${total_value:.2f} USDT")
        print(f"📈 Open Positions: {len(positions)}")
        print(f"💼 Asset Balances: {len(asset_balances)}")
        
        # Asset Balances
        if asset_balances:
            print_section("ASSET BALANCES")
            for asset_bal in asset_balances:
                asset = asset_bal.get('asset', 'N/A')
                wallet = asset_bal.get('walletBalance', 0)
                available = asset_bal.get('availableBalance', 0)
                cross_wallet = asset_bal.get('crossWalletBalance', 0)
                print(f"\n  {asset}:")
                print(f"    Wallet Balance: ${wallet:.4f}")
                print(f"    Available Balance: ${available:.4f}")
                print(f"    Cross Wallet Balance: ${cross_wallet:.4f}")
        
        # Positions Summary
        if positions:
            print_section("POSITIONS SUMMARY")
            print(f"\nFound {len(positions)} open position(s):\n")
            
            for idx, pos in enumerate(positions, 1):
                coin = pos.get('coin', 'N/A')
                size = pos.get('size', abs(float(pos.get('positionAmt', 0))))
                entry = pos.get('entryPrice', 0)
                current = pos.get('currentPrice', pos.get('markPrice', 0))
                pnl = pos.get('unrealizedPnl', pos.get('unrealized_pnl', pos.get('pnl', 0)))
                roi = pos.get('roi', pos.get('roiPercent', 0))
                leverage = pos.get('leverage')
                side = "LONG" if float(pos.get('positionAmt', 0)) > 0 else "SHORT"
                
                print(f"  {idx}. {coin} ({side})")
                print(f"     Size: {size:.6f}")
                print(f"     Entry: ${entry:.2f} | Current: ${current:.2f}")
                print(f"     PnL: ${float(pnl):.4f} | ROI: {roi:.2f}%")
                print(f"     Leverage: {leverage:.2f}x" if leverage else "     Leverage: N/A")
                print()
            
            # Detailed position information
            print_section("DETAILED POSITION INFORMATION")
            for idx, pos in enumerate(positions, 1):
                coin = pos.get('coin', 'N/A')
                print_position_details(pos, f"Position {idx}: {coin}")
        else:
            print("\n✅ No open positions found")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()


async def main():
    """Main test function."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Test Binance position retrieval')
    parser.add_argument('--symbol', '-s', type=str, help='Symbol to test (e.g., BTCUSDT, ETHUSDT)')
    parser.add_argument('--asset', '-a', type=str, help='Asset name to test (e.g., BTC, ETH)')
    parser.add_argument('--all', action='store_true', help='Test get_user_state() to see all positions')
    parser.add_argument('--position', '-p', action='store_true', help='Test get_position() for specific symbol')
    
    args = parser.parse_args()
    
    print_separator()
    print("  BINANCE POSITION RETRIEVAL TEST")
    print_separator()
    
    if args.all:
        # Test all positions
        await test_get_user_state()
    elif args.position or args.symbol or args.asset:
        # Test specific position
        symbol = args.symbol
        if args.asset:
            symbol = f"{args.asset}USDT"
        await test_get_position(symbol)
    else:
        # Default: test both
        print("\n💡 Use --all to see all positions, or --symbol SYMBOL to test specific position")
        print("   Examples:")
        print("     python test_binance_positions.py --all")
        print("     python test_binance_positions.py --symbol BTCUSDT")
        print("     python test_binance_positions.py --asset BTC")
        print("     python test_binance_positions.py --position --symbol ETHUSDT")
        print()
        
        # Run both tests
        await test_get_user_state()
        print("\n\n")
        await test_get_position('BTCUSDT')


if __name__ == "__main__":
    asyncio.run(main())
