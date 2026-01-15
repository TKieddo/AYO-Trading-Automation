# Hyperliquid Database Migration & Setup

## Overview
This migration sets up Hyperliquid data persistence, replacing the old Binance data structure. All Hyperliquid balances, positions, and trades will now be saved to Supabase for historical tracking and percentage calculations.

## Migrations to Run

### 1. Clear Old Binance Data
**File**: `dashboard/supabase/migrations/20250106_clear_binance_data.sql`

This migration clears all Binance-related data:
- Trades
- Orders  
- Positions
- Account Metrics
- Decisions

**Note**: Prices and trading logs are preserved (exchange-agnostic).

### 2. Create Wallet Balance History Table
**File**: `dashboard/supabase/migrations/20250106_wallet_balance_history.sql`

This migration creates:
- `wallet_balance_history` table to track account value over time
- Indexes for efficient queries
- Function to calculate percentage changes
- Unique constraint to prevent duplicates

## How It Works

### Automatic Balance Syncing
The `/api/hyperliquid/balances` endpoint now automatically saves balance snapshots to the database every time it's called. Snapshots are rounded to the nearest minute to prevent duplicate entries.

### Balance History API
- **GET** `/api/hyperliquid/sync-balance?network=mainnet&hours=720` - Get balance history for the last N hours
- **POST** `/api/hyperliquid/sync-balance` - Manually sync current balance (can be called periodically via cron)

### Real Percentage Calculations
The portfolio page now calculates real percentage changes:
- **Day**: Compares current balance to 24 hours ago
- **Week**: Compares current balance to 7 days ago  
- **Month**: Compares current balance to 30 days ago

Uses the closest available balance snapshot within a reasonable time window.

## Next Steps

1. **Run Migrations in Supabase**:
   - Open Supabase Dashboard → SQL Editor
   - Run `20250106_clear_binance_data.sql` first
   - Then run `20250106_wallet_balance_history.sql`

2. **Test the Setup**:
   - Visit `/wallet` page - should save balance snapshot automatically
   - Visit `/portfolio` page - should show real percentage changes (will be 0% initially until history accumulates)

3. **Optional: Set up Periodic Sync** (recommended):
   - Add a cron job or scheduled task to call `POST /api/hyperliquid/sync-balance` every 5-10 minutes
   - This ensures balance history is always up-to-date even if pages aren't visited

4. **Update Other Pages** (future work):
   - Update positions page to use Hyperliquid data from database
   - Update trades/orders pages to sync Hyperliquid trades
   - Update dashboard metrics to use Hyperliquid data

## Data Flow

```
Hyperliquid API → /api/hyperliquid/balances → Supabase (wallet_balance_history)
                                                      ↓
Portfolio Page → /api/hyperliquid/sync-balance (GET) → Calculate % changes
```

## Duplicate Prevention

- **Timestamp rounding**: Balances are rounded to nearest minute before saving
- **Unique constraint**: Database enforces uniqueness on (timestamp, network)
- **Upsert logic**: Uses Supabase upsert with conflict resolution

## Notes

- Balance history accumulates over time (one entry per minute max)
- Old data can be cleaned up periodically (e.g., keep last 90 days)
- Network separation: testnet and mainnet data are stored separately
- All calculations use `accountValue` from Hyperliquid (same as wallet page)





