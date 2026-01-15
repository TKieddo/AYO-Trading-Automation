# Aster DEX Integration - Complete Guide

## Overview

Aster DEX has been fully integrated as the **default exchange** for the trading agent. The system now supports seamless switching between Aster (default) and Hyperliquid.

## Configuration

### Environment Variables

Add these to your `.env` file:

```env
# Exchange Selection (default: aster)
EXCHANGE=aster  # Options: "aster" or "hyperliquid"

# Aster DEX Credentials (Required for Aster)
ASTER_API_BASE=https://fapi.asterdex.com
ASTER_USER_ADDRESS=0x...  # Main wallet address
ASTER_SIGNER_ADDRESS=0x...  # API wallet address  
ASTER_PRIVATE_KEY=0x...  # API wallet private key

# Hyperliquid Credentials (Required if using Hyperliquid)
HYPERLIQUID_PRIVATE_KEY=0x...
HYPERLIQUID_WALLET_ADDRESS=0x...
HYPERLIQUID_NETWORK=mainnet  # or "testnet"
```

### Switching Exchanges

To switch between exchanges, simply change the `EXCHANGE` environment variable:

- **Aster (default)**: `EXCHANGE=aster`
- **Hyperliquid**: `EXCHANGE=hyperliquid`

If Aster credentials are missing, the system will automatically fall back to Hyperliquid.

## Architecture

### Python Trading Agent

1. **`src/trading/aster_api.py`**: Complete Aster API client matching the HyperliquidAPI interface
   - Web3-style authentication (ECDSA signatures)
   - All trading operations: buy, sell, TP/SL, cancel orders
   - Account state and position management
   - Market data: prices, funding rates, open interest

2. **`src/config_loader.py`**: Added Aster configuration options

3. **`src/main.py`**: Exchange selection logic with Aster as default

### Dashboard Integration

1. **`dashboard/lib/aster.ts`**: Enhanced with POST and DELETE support
   - `asterSignedGet()`: GET requests
   - `asterSignedPost()`: POST requests  
   - `asterSignedDelete()`: DELETE requests

2. **`dashboard/app/api/aster/balances/route.ts`**: Fetches Aster account balances

## Features

### ✅ Fully Functional

- ✅ Market buy/sell orders
- ✅ Take-profit and stop-loss orders
- ✅ Position management
- ✅ Account balance queries
- ✅ Open orders management
- ✅ Recent fills/trades
- ✅ Current prices
- ✅ Funding rates
- ✅ Open interest

### 🔄 Exchange Switching

The system automatically:
- Detects which exchange to use from `EXCHANGE` env var
- Falls back to Hyperliquid if Aster credentials are missing
- Maintains the same interface for both exchanges

## Usage

### Starting the Trading Agent

```bash
# With Aster (default)
poetry run python src/main.py --assets BTC ETH SOL --interval 5m

# Or explicitly set exchange
EXCHANGE=aster poetry run python src/main.py --assets BTC ETH SOL --interval 5m

# Switch to Hyperliquid
EXCHANGE=hyperliquid poetry run python src/main.py --assets BTC ETH SOL --interval 5m
```

### Dashboard

The dashboard automatically works with whichever exchange is configured. It fetches data from the Python agent's API endpoints, which handle the exchange abstraction.

## API Endpoints

### Python Agent Endpoints (Work with both exchanges)

- `GET /positions` - Current positions
- `GET /status` - Account status
- `GET /diary` - Trading diary
- `GET /logs` - Agent logs
- `GET /api/pnl` - PnL data
- `GET /api/performance` - Performance metrics
- `GET /api/prices` - Current prices

### Dashboard API Routes

- `GET /api/aster/balances` - Aster account balances
- `GET /api/hyperliquid/balances` - Hyperliquid account balances (if using Hyperliquid)

## Authentication

### Aster DEX

Aster uses **Web3-style authentication**:
- Main wallet address (`ASTER_USER_ADDRESS`)
- API wallet address (`ASTER_SIGNER_ADDRESS`)
- API wallet private key (`ASTER_PRIVATE_KEY`)

The signature generation follows Aster's specification:
1. Sort parameters by ASCII order
2. Stringify all values
3. Create JSON string
4. ABI encode: `['string', 'address', 'address', 'uint256']`
5. Keccak hash
6. ECDSA sign with EIP-191

### Hyperliquid

Hyperliquid uses standard Ethereum wallet authentication (unchanged).

## Troubleshooting

### "No agent found" Error

1. Verify `ASTER_USER_ADDRESS` is your main wallet address (0x...)
2. Verify `ASTER_SIGNER_ADDRESS` is your API wallet address (0x...)
3. Verify `ASTER_PRIVATE_KEY` matches the signer address
4. Ensure addresses are in 0x format
5. Check API wallet permissions in Aster dashboard

### Exchange Not Switching

- Check `EXCHANGE` env var is set correctly
- Verify credentials for the selected exchange are present
- Check logs for initialization errors

### Signature Errors

- Ensure private key matches the signer address
- Verify all addresses are valid Ethereum addresses (0x...)
- Check that the API wallet is authorized in Aster dashboard

## Code Structure

```
src/
  trading/
    aster_api.py          # Aster API client (NEW)
    hyperliquid_api.py    # Hyperliquid API client (existing)
    base_exchange.py      # Base interface (empty, for future use)

dashboard/
  lib/
    aster.ts              # Aster TypeScript client (enhanced)
    hyperliquid.ts        # Hyperliquid TypeScript client (existing)
  app/
    api/
      aster/
        balances/         # Aster balances endpoint
      hyperliquid/
        balances/         # Hyperliquid balances endpoint
```

## Testing

To test the integration:

1. Set up Aster credentials in `.env`
2. Start the agent: `poetry run python src/main.py --assets BTC --interval 5m`
3. Check logs for "✅ Using Aster DEX (default)"
4. Verify balance is fetched correctly
5. Test placing a small order (if desired)

## Notes

- Aster is now the **default** exchange
- Hyperliquid remains fully supported as an alternative
- All existing functionality works identically with both exchanges
- The dashboard automatically adapts to the selected exchange
- No code changes needed when switching exchanges (just env var)

