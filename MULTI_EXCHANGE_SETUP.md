# Multi-Exchange Trading Setup Guide

## Overview

Your trading system now supports **simultaneous trading on multiple exchanges**! You can trade crypto on Aster and Binance at the same time.

## How It Works

### Single Exchange Mode (Default)
- Trade on ONE exchange at a time
- Set `EXCHANGE=aster` or `EXCHANGE=binance` in `.env`
- All assets trade on that single exchange

### Multi-Exchange Mode (NEW!)
- Trade on MULTIPLE exchanges simultaneously
- Crypto assets (BTC, ETH, SOL) → Aster or Binance
- System automatically routes each asset to the correct exchange

## Setup Instructions

### 1. Enable Multi-Exchange Mode

Add to your `.env` file:

```env
# Enable multi-exchange mode
MULTI_EXCHANGE_MODE=true

# Configure ALL exchanges you want to use
# Aster (crypto)
ASTER_USER_ADDRESS=0x...
ASTER_SIGNER_ADDRESS=0x...
ASTER_PRIVATE_KEY=0x...

# Binance (crypto)
BINANCE_API_KEY=your_api_key
BINANCE_API_SECRET=your_api_secret
BINANCE_TESTNET=false  # Set to true for testnet

# Trading assets
ASSETS=BTC ETH SOL BNB AVAX
INTERVAL=5m
```

### 2. Asset Mapping

The system automatically maps assets to exchanges:

**Crypto Assets** → Aster/Hyperliquid:
- BTC, ETH, SOL, BNB, DOGE, XRP, ADA, etc.
- Any asset that looks like crypto

**Forex Pairs** → Pepperstone:
- EURUSD, GBPUSD, USDJPY, AUDUSD, etc.
- Any pair containing USD, EUR, GBP, JPY, etc.

### 3. Run the Agent

```bash
poetry run python src/main.py --assets BTC ETH EURUSD GBPUSD --interval 5m
```

The system will:
- Trade BTC, ETH on Aster (crypto)
- Trade EURUSD, GBPUSD on Pepperstone (forex)
- All simultaneously!

## Features

### ✅ Simultaneous Trading
- Trade crypto and forex at the same time
- No need to switch between exchanges
- All positions tracked in one dashboard

### ✅ Automatic Routing
- System automatically routes each asset to correct exchange
- Crypto → Aster/Hyperliquid
- Forex → Pepperstone

### ✅ Aggregated View
- See all positions from all exchanges
- Combined balance and PnL
- Unified trading dashboard

### ✅ Independent Risk Management
- Each exchange has its own balance
- Positions tracked separately
- Risk managed per exchange

## Example Configuration

### Trading Both Crypto and Forex

```env
MULTI_EXCHANGE_MODE=true

# Crypto exchange (Aster)
ASTER_USER_ADDRESS=0x...
ASTER_SIGNER_ADDRESS=0x...
ASTER_PRIVATE_KEY=0x...

# Forex exchange (Pepperstone)
PEPPERSTONE_CLIENT_ID=your_id
PEPPERSTONE_CLIENT_SECRET=your_secret
PEPPERSTONE_ACCOUNT_ID=your_account
PEPPERSTONE_ENVIRONMENT=demo

# Mixed assets
ASSETS=BTC ETH SOL EURUSD GBPUSD USDJPY AUDUSD
INTERVAL=5m
```

### Trading Only Crypto (Multiple Exchanges)

```env
MULTI_EXCHANGE_MODE=true

# Both Aster and Hyperliquid
ASTER_USER_ADDRESS=0x...
ASTER_SIGNER_ADDRESS=0x...
ASTER_PRIVATE_KEY=0x...

HYPERLIQUID_PRIVATE_KEY=0x...

ASSETS=BTC ETH SOL
```

## How Assets Are Mapped

### Crypto Detection
- Assets like: BTC, ETH, SOL, BNB, DOGE, XRP
- Any asset containing: BTC, ETH, SOL
- Defaults to crypto exchange if unclear

### Forex Detection
- Pairs like: EURUSD, GBPUSD, USDJPY
- Contains currency codes: USD, EUR, GBP, JPY, AUD, CAD, CHF, NZD
- Must be 6+ characters (typical forex pair format)

## Troubleshooting

### "No exchange available for [asset]"
- Make sure you have the correct exchange configured
- Check that credentials are correct
- Verify asset format (EURUSD not EUR/USD)

### "Exchange initialization failed"
- Check API credentials
- Verify network connectivity
- Check exchange-specific requirements

### Positions Not Showing
- Wait a few seconds for positions to sync
- Check exchange-specific position formats
- Verify you have open positions on that exchange

## Benefits

1. **Diversification**: Trade multiple asset classes simultaneously
2. **Efficiency**: No need to switch between systems
3. **Unified View**: See all trades in one place
4. **Flexibility**: Mix and match exchanges as needed

## Next Steps

1. Set `MULTI_EXCHANGE_MODE=true` in `.env`
2. Configure all exchanges you want to use
3. Add mixed assets to `ASSETS` (crypto + forex)
4. Run the agent and watch it trade on multiple exchanges!
