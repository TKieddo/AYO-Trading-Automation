# Position Sizing Implementation Summary

## Overview
Position sizing configuration has been fully integrated into the trading agent. All settings are now stored in the database and retrieved dynamically, ensuring the AI agent always uses the latest configuration from the Settings page.

## What Was Added

### 1. Database Schema
- **Migration**: `dashboard/supabase/migrations/20250108_position_sizing.sql`
- **New Fields**:
  - `target_profit_per_1pct_move` (numeric): Target profit in USD per 1% price move (default: 1.00)
  - `allocation_per_position` (numeric, nullable): Fixed allocation per position in USD
  - `max_positions` (integer): Maximum concurrent positions (default: 6)
  - `position_sizing_mode` (text): Mode for calculating positions - "auto", "fixed", or "target_profit"

### 2. Frontend (Settings Page)
- **File**: `dashboard/components/dashboard/TradingSettings.tsx`
- **New UI Elements**:
  - Position Sizing Mode dropdown (auto/target_profit/fixed)
  - Target Profit per 1% Move input (shown when mode is auto or target_profit)
  - Fixed Allocation per Position input (shown when mode is fixed)
  - Maximum Concurrent Positions input

### 3. Backend API
- **File**: `dashboard/app/api/trading/settings/route.ts`
- **Updates**:
  - GET endpoint now returns position sizing fields
  - POST endpoint validates and saves position sizing settings
  - All fields are validated with proper ranges

### 4. Python Trading Agent
- **File**: `src/utils/trading_settings.py`
- **Updates**:
  - `get_trading_settings()` now fetches position sizing settings from database
  - Added `calculate_allocation_usd()` function to calculate position sizes
  - Enhanced logging to show when database settings are fetched
  - **IMPORTANT**: Leverage is now ALWAYS fetched from database, not .env file

- **File**: `src/main.py`
- **Updates**:
  - Position sizing is calculated before placing trades
  - Allocation is calculated based on:
    - Target profit per 1% move
    - Leverage (from database)
    - Available balance
    - Max positions
  - Logging shows position sizing decisions
  - Context payload includes position sizing info for LLM

## How It Works

### Position Sizing Modes

#### 1. Auto Mode (Default)
- Calculates allocation from `target_profit_per_1pct_move`
- Formula: `allocation = target_profit / (0.01 * leverage)`
- Example: With $1 target profit and 10x leverage = $10 allocation
- Capped by available balance and max positions

#### 2. Target Profit Mode
- Same as Auto mode
- Explicitly uses `target_profit_per_1pct_move` for calculation

#### 3. Fixed Mode
- Uses `allocation_per_position` if set
- Otherwise divides available balance by max positions

### Example Calculation

For $300 capital with:
- Leverage: 10x
- Target profit: $1 per 1% move
- Max positions: 5

**Calculation**:
1. Allocation per position = $1 / (0.01 * 10) = $10
2. But with $300 and 5 max positions, max per position = $300 / 5 = $60
3. Final allocation = min($10, $60) = $10

**Result**: Each position will be $10, giving $1 profit on 1% move with 10x leverage.

## Database Persistence

All settings are:
- ✅ Stored in `trading_settings` table
- ✅ Retrieved on every trading loop iteration
- ✅ Never use .env file (except as absolute fallback with warnings)
- ✅ Updated immediately when saved from Settings page

## Leverage Fix

**Before**: Leverage was sometimes read from `.env` file  
**After**: Leverage is ALWAYS fetched from database first

The code now:
1. Always tries to fetch from database API
2. Logs when database settings are successfully fetched
3. Only falls back to .env with explicit warnings
4. Shows warnings if database connection fails

## Usage

### Setting Up Position Sizing

1. Go to Settings page in dashboard
2. Configure:
   - **Leverage**: Your desired leverage (e.g., 10x)
   - **Target Profit per 1% Move**: How much profit you want on 1% move (e.g., $1.00)
   - **Max Positions**: Maximum concurrent positions (e.g., 5-6 for $300 capital)
   - **Position Sizing Mode**: Choose "auto" (recommended) or "fixed"
3. Click "Save Settings"
4. Settings are immediately saved to database

### How Agent Uses Settings

1. Agent fetches settings from database at start of each trading loop
2. When LLM decides to trade, agent calculates allocation using:
   - Position sizing mode
   - Target profit setting
   - Current leverage (from database)
   - Available balance
3. Position size is calculated and trade is placed
4. Logs show the calculated allocation and reasoning

## Testing

To verify everything works:

1. **Check Database**:
   ```sql
   SELECT * FROM trading_settings WHERE id = 'default';
   ```

2. **Check API**:
   ```bash
   curl http://localhost:3001/api/trading/settings
   ```

3. **Check Agent Logs**:
   Look for messages like:
   - `✅ Fetched trading settings from database: leverage=10, target_profit=1.0`
   - `📊 Position sizing: Using calculated allocation $10.00 (target profit: $1.00 per 1% move)`

## Migration

To apply the database migration:

1. Run the migration in Supabase SQL editor:
   ```sql
   -- Copy contents from dashboard/supabase/migrations/20250108_position_sizing.sql
   ```

2. Or if using Supabase CLI:
   ```bash
   supabase db push
   ```

## Notes

- Settings are persistent across agent restarts
- Changes take effect immediately (no restart needed)
- Leverage from database always takes precedence over .env
- Position sizing respects max positions to prevent over-allocation

