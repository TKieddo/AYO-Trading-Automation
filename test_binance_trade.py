"""Test script to execute a small trade on Binance and verify it appears."""

import asyncio
import sys
import pathlib
sys.path.append(str(pathlib.Path(__file__).parent))

from src.trading.binance_api import BinanceAPI
from dotenv import load_dotenv
import logging

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

async def test_trade():
    """Execute a small test trade and verify position."""
    
    print("=" * 60)
    print("BINANCE FUTURES TRADE TEST")
    print("=" * 60)
    print()
    
    try:
        # Initialize Binance client
        binance = BinanceAPI()
        testnet = binance.testnet
        
        print(f"📍 Testnet Mode: {testnet}")
        if testnet:
            print(f"🔗 View on Binance Testnet: https://testnet.binancefuture.com/")
        else:
            print(f"🔗 View on Binance: https://www.binance.com/en/futures")
        print()
        
        # Get initial account state
        print("📊 Fetching account state...")
        state = await binance.get_user_state()
        balance = state.get('balance', 0)
        total_value = state.get('total_value', 0)
        positions = state.get('positions', [])
        
        print(f"💰 Balance: ${balance:.2f} USDT")
        print(f"💵 Total Value: ${total_value:.2f} USDT")
        print(f"📈 Current Positions: {len(positions)}")
        
        if positions:
            print("\nCurrent Positions:")
            for pos in positions:
                coin = pos.get('coin', 'N/A')
                size = pos.get('quantity', 0)
                entry = pos.get('entryPrice', 0)
                pnl = pos.get('unrealized_pnl', 0)
                current_price = pos.get('current_price', 0)
                print(f"  • {coin}: Size={size:.6f}, Entry=${entry:.2f}, Current=${current_price:.2f}, PnL=${pnl:.4f}")
        print()
        
        # Check if we have enough balance
        if balance < 10:
            print("⚠️  WARNING: Balance is very low. You need at least $10-20 for a test trade.")
            print("   Make sure you have funds in your Binance Futures wallet.")
            if not testnet:
                print("   Go to Binance → Wallet → Futures → Transfer")
            return
        
        # Test parameters
        TEST_ASSET = "BTC"  # You can change this to ETH, SOL, etc.
        TEST_SIZE_USD = 10.0  # $10 test trade - adjust as needed
        
        print(f"🎯 Test Trade Parameters:")
        print(f"   Asset: {TEST_ASSET}")
        print(f"   Size: ${TEST_SIZE_USD:.2f} USD")
        print(f"   Leverage: {binance.default_leverage}x")
        print()
        
        # Get current price
        print(f"📈 Fetching current price for {TEST_ASSET}...")
        current_price = await binance.get_current_price(TEST_ASSET)
        if current_price <= 0:
            print(f"❌ Failed to get price for {TEST_ASSET}")
            return
        
        print(f"   Current {TEST_ASSET} Price: ${current_price:,.2f}")
        
        # Calculate contract size (quantity)
        # For Binance Futures, quantity is in contracts
        # Contract size = USD value / (price * contract multiplier)
        # For BTCUSDT, 1 contract = 0.001 BTC
        contract_size = TEST_SIZE_USD / current_price
        print(f"   Contract Size: {contract_size:.8f} {TEST_ASSET}")
        print()
        
        # Confirm
        print("⚠️  READY TO EXECUTE TEST TRADE")
        print(f"   This will place a BUY order for ~${TEST_SIZE_USD:.2f} worth of {TEST_ASSET}")
        print(f"   Using {binance.default_leverage}x leverage")
        if not testnet:
            print("   ⚠️  This is LIVE trading - real money!")
        print()
        response = input("   Continue? (yes/no): ").strip().lower()
        
        if response != 'yes':
            print("❌ Trade cancelled.")
            return
        
        print()
        print("🚀 Executing BUY order...")
        
        # Place buy order
        try:
            order_result = await binance.place_buy_order(TEST_ASSET, contract_size, leverage=binance.default_leverage)
            print("✅ Order placed successfully!")
            print()
            print("Order Result:")
            print(f"   {order_result}")
            print()
            
            # Extract order IDs if available
            oids = binance.extract_oids(order_result)
            if oids:
                print(f"📝 Order IDs: {oids}")
            
            # Wait a moment for order to fill
            print()
            print("⏳ Waiting 3 seconds for order to fill...")
            await asyncio.sleep(3)
            
            # Check for new position
            print()
            print("🔍 Checking for new position...")
            new_state = await binance.get_user_state()
            new_positions = new_state.get('positions', [])
            
            test_asset_position = None
            for pos in new_positions:
                if pos.get('coin') == TEST_ASSET or pos.get('symbol') == TEST_ASSET:
                    test_asset_position = pos
                    break
            
            if test_asset_position:
                print("✅ POSITION FOUND!")
                print()
                print(f"📊 {TEST_ASSET} Position Details:")
                print(f"   Coin: {test_asset_position.get('coin')}")
                print(f"   Size: {test_asset_position.get('quantity', 0):.8f}")
                print(f"   Entry Price: ${test_asset_position.get('entryPrice', 0):.2f}")
                print(f"   Current Price: ${test_asset_position.get('current_price', 0):.2f}")
                print(f"   Unrealized PnL: ${test_asset_position.get('unrealized_pnl', 0):.4f}")
                if test_asset_position.get('liquidation_price'):
                    print(f"   Liquidation Price: ${test_asset_position.get('liquidation_price'):.2f}")
                print()
                print("=" * 60)
                print("✅ SUCCESS! Position is open and visible.")
                print()
                if testnet:
                    print(f"🌐 View on Binance Testnet:")
                    print(f"   https://testnet.binancefuture.com/")
                else:
                    print(f"🌐 View on Binance:")
                    print(f"   https://www.binance.com/en/futures")
                print()
                print("💡 Tips:")
                print("   • The position should appear in your portfolio immediately")
                print("   • You can manually close it via the Binance UI")
                print("   • Or let the agent manage it with TP/SL orders")
                print("=" * 60)
            else:
                print("⚠️  Position not found yet. It may still be processing.")
                print("   Check recent fills:")
                fills = await binance.get_recent_fills(limit=5)
                if fills:
                    print("   Recent fills:")
                    for fill in fills[-3:]:
                        coin = fill.get('coin') or fill.get('asset', 'N/A')
                        side = "BUY" if fill.get('isBuy') else "SELL"
                        print(f"     • {side} {coin}: {fill.get('sz', 0)} @ ${fill.get('px', 0)}")
                
        except Exception as e:
            print(f"❌ Error executing trade: {e}")
            import traceback
            traceback.print_exc()
            return
        
    except ValueError as e:
        print(f"❌ Configuration Error: {e}")
        print()
        print("💡 Make sure you have set BINANCE_API_KEY and BINANCE_API_SECRET in your .env file")
        print("   Optional: Set BINANCE_TESTNET=true for testnet trading")
        return
    except Exception as e:
        print(f"❌ Unexpected Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    print()
    asyncio.run(test_trade())
