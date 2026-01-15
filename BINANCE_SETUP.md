# Binance Perpetual Futures Setup

## Why Binance Perpetual Futures?

- ✅ **No expiry dates** - Hold positions indefinitely
- ✅ **High leverage** - Up to 125x (configurable, default 10x)
- ✅ **Better liquidity** - Less slippage on major pairs
- ✅ **More assets** - Hundreds of trading pairs
- ✅ **Stable infrastructure** - Proven, reliable exchange

## Setup Steps

### 1. Create Binance Account & API Keys

1. Go to [Binance.com](https://www.binance.com) and create an account
2. Enable **2FA (Two-Factor Authentication)**
3. Navigate to **API Management** → **Create API**
4. Choose **Futures** permissions (you need futures trading enabled)
5. **IMPORTANT**: 
   - ✅ Enable "Futures Trading"
   - ❌ Do NOT enable "Withdrawals" (security best practice)
   - ✅ Enable "Read" permissions
6. Copy your **API Key** and **Secret Key**

### 2. Update .env File

Add these to your `.env` file:

```env
# Binance Futures API (required for Binance trading)
BINANCE_API_KEY=your_api_key_here
BINANCE_API_SECRET=your_secret_key_here

# Optional Binance settings
BINANCE_TESTNET=false          # Set to true for testnet trading
BINANCE_LEVERAGE=10            # Default leverage (1-125x)

# Remove or comment out Hyperliquid keys if switching:
# HYPERLIQUID_PRIVATE_KEY=...
```

### 3. Test Your Setup (Optional)

Use testnet first to verify everything works:

```env
BINANCE_TESTNET=true
```

Then run the test trade script:
```powershell
poetry run python test_trade.py
```

### 4. Start Trading

Once configured, the agent will automatically use Binance if keys are present:

```powershell
poetry run python src/main.py --assets BTC ETH SOL BNB DOGE --interval 5m
```

## Leverage Configuration

Default leverage is **10x** (conservative). You can change it:

- **Per-asset** in code: Edit `binance_api.py` to set different leverage per asset
- **Global** in `.env`: `BINANCE_LEVERAGE=20`
- **Maximum**: 125x (Binance limit, but very risky!)

**Recommended**: Start with 5x-10x leverage for testing.

## Trading Costs

- **Maker fee**: 0.02%
- **Taker fee**: 0.05%
- **Funding rate**: Paid every 8 hours (varies by market)

## Differences from Hyperliquid

| Feature | Hyperliquid | Binance |
|---------|-------------|---------|
| Maker Fee | 0.00% | 0.02% |
| Taker Fee | 0.03% | 0.05% |
| Leverage | High | Up to 125x |
| Assets | ~30 | Hundreds |
| Liquidity | Good | Excellent |
| Testnet | Yes | Yes |

## Important Notes

⚠️ **Always test on testnet first!**

⚠️ **Binance requires accurate timestamps** - Make sure your system clock is synchronized

⚠️ **Fund your Futures account** - You need USDT in your Futures wallet, not Spot wallet

⚠️ **Position limits** - Binance has position size limits per asset

## Troubleshooting

**Error: "Timestamp for this request is outside of the recvWindow"**
- Your system clock is out of sync
- Sync your system time

**Error: "Insufficient balance"**
- Transfer funds to Binance Futures wallet
- Go to Binance → Wallet → Futures → Transfer

**Error: "Position size too large"**
- Reduce leverage or allocation amount
- Check Binance position limits for that asset

## Security

- ✅ Never share your API keys
- ✅ Don't enable withdrawal permissions
- ✅ Use IP whitelist if possible
- ✅ Enable 2FA on your Binance account
- ✅ Start with testnet to verify everything works

