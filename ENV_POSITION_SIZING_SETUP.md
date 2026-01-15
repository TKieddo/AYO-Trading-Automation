# Position Sizing Configuration in .env File

## Overview

Position sizing can now be configured in your `.env` file as a fallback when the database is unavailable. The AI agent will always use database settings first, but will fall back to `.env` values if needed.

---

## Environment Variables

Add these to your `.env` file:

```env
# Position sizing mode: "auto", "fixed", "target_profit", or "margin"
# - "auto": Calculate from target_profit_per_1pct_move (recommended)
# - "target_profit": Same as auto, explicitly uses target profit
# - "fixed": Use ALLOCATION_PER_POSITION if set
# - "margin": Use MARGIN_PER_POSITION × Leverage to calculate notional size
#   ⚠️  When "margin" mode is selected, TARGET_PROFIT_PER_1PCT_MOVE is IGNORED
POSITION_SIZING_MODE=auto

# Target profit per 1% price move (ONLY used when POSITION_SIZING_MODE=auto or target_profit)
# ⚠️  IGNORED when POSITION_SIZING_MODE=margin - use MARGIN_PER_POSITION instead
# Example: 1.0 = $1 per 1%, 3.0 = $3 per 1%
TARGET_PROFIT_PER_1PCT_MOVE=1.0

# Margin per position (ONLY used when POSITION_SIZING_MODE=margin)
# ⚠️  When this is set and mode is "margin", TARGET_PROFIT_PER_1PCT_MOVE is completely ignored
# Amount you want to risk per trade. System calculates: Notional = Margin × Leverage
# Example: MARGIN_PER_POSITION=100 with 25x leverage = $2,500 notional position
# MARGIN_PER_POSITION=

# Fixed allocation per position (ONLY used when POSITION_SIZING_MODE=fixed)
# If set, this will be used instead of target_profit calculation
# ALLOCATION_PER_POSITION=

# Maximum concurrent positions
MAX_POSITIONS=6

# Per-Asset Leverage Overrides (optional)
# Set leverage for specific assets that have different max leverage limits
# Format: {ASSET}_LEVERAGE={value}
# Example: ZEC_LEVERAGE=5 (ZEC max is 5x, so set this to avoid errors)
# Example: BTC_LEVERAGE=25, ETH_LEVERAGE=20
# These will override DEFAULT_LEVERAGE for the specified assets only
# ZEC_LEVERAGE=5
# BTC_LEVERAGE=25
```

---

## How It Works

### 1. Priority Order:

1. **Database Settings** (from dashboard) - Always used first
2. **.env File** - Used as fallback if database unavailable
3. **Hardcoded Defaults** - Only if both above fail

### 2. Mode-Specific Behavior:

**IMPORTANT:** Each mode uses DIFFERENT settings. Settings for other modes are IGNORED.

#### When `POSITION_SIZING_MODE=auto` or `target_profit`:
- ✅ Uses: `TARGET_PROFIT_PER_1PCT_MOVE`
- ❌ Ignores: `MARGIN_PER_POSITION`, `ALLOCATION_PER_POSITION`

#### When `POSITION_SIZING_MODE=margin`:
- ✅ Uses: `MARGIN_PER_POSITION` + Leverage
- ❌ Ignores: `TARGET_PROFIT_PER_1PCT_MOVE`, `ALLOCATION_PER_POSITION`

#### When `POSITION_SIZING_MODE=fixed`:
- ✅ Uses: `ALLOCATION_PER_POSITION`
- ❌ Ignores: `TARGET_PROFIT_PER_1PCT_MOVE`, `MARGIN_PER_POSITION`

### 3. Calculation Formula:

When `POSITION_SIZING_MODE=auto` or `target_profit`:

```
Allocation (USD) = TARGET_PROFIT_PER_1PCT_MOVE / (0.01 * Leverage)
```

**Example:**
- `TARGET_PROFIT_PER_1PCT_MOVE=1.0` (want $1 per 1% move)
- Leverage = 10x
- Allocation = $1 / (0.01 * 10) = $1 / 0.1 = **$10**

**Example 2:**
- `TARGET_PROFIT_PER_1PCT_MOVE=3.0` (want $3 per 1% move)
- Leverage = 10x
- Allocation = $3 / (0.01 * 10) = $3 / 0.1 = **$30**

When `POSITION_SIZING_MODE=margin`:

```
Notional Value = MARGIN_PER_POSITION × Leverage
Contract Quantity = Notional Value / Current Price
```

**Example:**
- `MARGIN_PER_POSITION=50` (you risk $50 per trade)
- Leverage = 25x
- Notional = $50 × 25 = **$1,250**
- If BTC price = $50,000: Contract quantity = $1,250 / $50,000 = **0.025 BTC**
- ⚠️  **TARGET_PROFIT_PER_1PCT_MOVE is completely IGNORED in margin mode**

### 4. Position Sizing Modes Summary:

#### Mode: "auto" or "target_profit"
- ✅ Uses: `TARGET_PROFIT_PER_1PCT_MOVE`
- ❌ Ignores: `MARGIN_PER_POSITION`, `ALLOCATION_PER_POSITION`
- Calculates allocation based on target profit per 1% move
- Automatically adjusts for leverage
- Caps allocation by available balance and max positions

#### Mode: "fixed"
- ✅ Uses: `ALLOCATION_PER_POSITION` if set
- ❌ Ignores: `TARGET_PROFIT_PER_1PCT_MOVE`, `MARGIN_PER_POSITION`
- If not set, falls back to dividing balance by `MAX_POSITIONS`

#### Mode: "margin"
- ✅ Uses: `MARGIN_PER_POSITION` + Leverage
- ❌ Ignores: `TARGET_PROFIT_PER_1PCT_MOVE`, `ALLOCATION_PER_POSITION`
- Uses `MARGIN_PER_POSITION` as the amount you risk per trade
- System calculates: **Notional = Margin × Leverage**
- Example: $100 margin with 25x leverage = $2,500 notional position
- Contract quantity = Notional / Current Price
- This matches how you trade manually on exchanges (you specify margin, exchange calculates notional)
- ⚠️  **CRITICAL: TARGET_PROFIT_PER_1PCT_MOVE is completely ignored when using margin mode**

---

## Per-Asset Leverage Overrides

Some assets have different maximum leverage limits on exchanges. For example, ZEC might only support 5x leverage while BTC supports 25x. You can set per-asset leverage in your `.env` file to enforce specific leverage for each asset.

### How It Works

1. **Set per-asset leverage** in `.env`:
   ```env
   DEFAULT_LEVERAGE=25
   ZEC_LEVERAGE=5
   BTC_LEVERAGE=25
   ETH_LEVERAGE=20
   ```

2. **System behavior**:
   - For ZEC: Uses 5x leverage (from `ZEC_LEVERAGE=5`)
   - For BTC: Uses 25x leverage (from `BTC_LEVERAGE=25`)
   - For ETH: Uses 20x leverage (from `ETH_LEVERAGE=20`)
   - For other assets: Uses `DEFAULT_LEVERAGE` (25x)

3. **Enforcement**:
   - Per-asset leverage is **enforced** and cannot be exceeded
   - The system will use the minimum of: per-asset leverage, default leverage, and exchange max
   - Example: If ZEC max is 5x and you set `ZEC_LEVERAGE=10`, it will use 5x (exchange max)

4. **Margin mode with per-asset leverage**:
   - If `MARGIN_PER_POSITION=50` and `ZEC_LEVERAGE=5`:
     - Notional = $50 × 5x = $250
     - Margin used = $50 (always respected)
   - If `MARGIN_PER_POSITION=50` and `BTC_LEVERAGE=25`:
     - Notional = $50 × 25x = $1,250
     - Margin used = $50 (always respected)

5. **LLM awareness**:
   - The decision maker receives per-asset leverage information in the context
   - The LLM knows which assets have custom leverage and will respect those limits

---

## Examples

### Example 1: Conservative ($1 per 1% move)

```env
TARGET_PROFIT_PER_1PCT_MOVE=1.0
MAX_POSITIONS=6
POSITION_SIZING_MODE=auto
```

**Result:**
- With 10x leverage: $10 allocation per trade
- With $300 account: Can open 6 positions of $10 each = $60 total exposure
- Target: Make $1 when price moves 1%

### Example 2: Aggressive ($3 per 1% move)

```env
TARGET_PROFIT_PER_1PCT_MOVE=3.0
MAX_POSITIONS=4
POSITION_SIZING_MODE=auto
```

**Result:**
- With 10x leverage: $30 allocation per trade
- With $300 account: Can open 4 positions of $30 each = $120 total exposure
- Target: Make $3 when price moves 1%

### Example 3: Fixed Allocation

```env
ALLOCATION_PER_POSITION=25.0
MAX_POSITIONS=6
POSITION_SIZING_MODE=fixed
```

**Result:**
- Always uses $25 per position
- With $300 account: Can open 6 positions = $150 total exposure
- Ignores target_profit_per_1pct_move

### Example 4: Margin Mode (Recommended for Manual Trading Style)

```env
MARGIN_PER_POSITION=100.0
DEFAULT_LEVERAGE=25
MAX_POSITIONS=6
POSITION_SIZING_MODE=margin
# TARGET_PROFIT_PER_1PCT_MOVE is IGNORED when using margin mode
# TARGET_PROFIT_PER_1PCT_MOVE=1.0  ← This setting has NO EFFECT in margin mode
```

**Result:**
- ✅ Uses $100 margin per trade (from `MARGIN_PER_POSITION`)
- ✅ With 25x leverage: $100 × 25 = $2,500 notional position per trade
- ✅ With $300 account: Can open 6 positions (each using $100 margin) = $600 total margin used
- ✅ Matches how you trade manually: specify margin, system calculates notional
- ✅ Example: BTC at $50,000 → Contract quantity = $2,500 / $50,000 = 0.05 BTC
- ❌ **TARGET_PROFIT_PER_1PCT_MOVE is completely ignored** - even if set, it has no effect

---

## Integration with AI Agent

The AI agent receives these settings in the trading context. The settings vary based on `position_sizing_mode`:

### When `POSITION_SIZING_MODE=auto` or `target_profit`:

```json
{
  "trading_settings": {
    "default_leverage": 25,
    "target_profit_per_1pct_move": 1.0,
    "max_positions": 6,
    "position_sizing_mode": "auto",
    "margin_per_position": null,
    "note": "Position sizing is calculated automatically based on target_profit_per_1pct_move (1.0) and max_positions (6)."
  }
}
```

### When `POSITION_SIZING_MODE=margin`:

```json
{
  "trading_settings": {
    "default_leverage": 25,
    "target_profit_per_1pct_move": 1.0,  // ⚠️ IGNORED - not used in margin mode
    "max_positions": 6,
    "position_sizing_mode": "margin",
    "margin_per_position": 50.0,  // ✅ This is what's actually used
    "note": "POSITION SIZING MODE: MARGIN. The system will automatically use $50.00 margin per position. With 25x leverage, this creates a $1,250.00 notional position per trade. You do NOT need to calculate allocation_usd - the system handles this automatically."
  }
}
```

**Key Points:**
- When `position_sizing_mode=margin`, the `target_profit_per_1pct_move` value is still present in the context but **completely ignored** by the system
- The `margin_per_position` value is what actually controls position sizing
- The `note` field clearly indicates which mode is active and what settings are used

The agent understands:
- **Higher `target_profit_per_1pct_move`** = Larger positions needed
- **Lower `target_profit_per_1pct_move`** = Smaller positions
- **Must respect `max_positions`** limit
- **System calculates allocation automatically** based on these rules

---

## Verification

To verify your settings are being used:

1. Check logs when agent starts:
   ```
   ✅ Fetched trading settings from database: leverage=10, target_profit=1.0
   ```
   OR
   ```
   ⚠️  Using .env defaults as fallback. Database settings should be used instead!
   ```

2. Check position sizing logs during trades:
   ```
   📊 Position sizing: Using calculated allocation $10.00 (target profit: $1.00 per 1% move)
   ```

---

## Best Practices

1. **Start Conservative:**
   - `TARGET_PROFIT_PER_1PCT_MOVE=1.0` for small accounts
   - Scale up only after consistent profitability

2. **Match Your Account Size:**
   - $100-200 account: `TARGET_PROFIT_PER_1PCT_MOVE=1.0` to `2.0`
   - $300-500 account: `TARGET_PROFIT_PER_1PCT_MOVE=2.0` to `3.0`
   - $1000+ account: `TARGET_PROFIT_PER_1PCT_MOVE=3.0` to `5.0`

3. **Consider Leverage:**
   - Higher leverage = Smaller allocation needed for same target profit
   - Lower leverage = Larger allocation needed

4. **Risk Management:**
   - Never set `TARGET_PROFIT_PER_1PCT_MOVE` so high that it exceeds your account balance
   - Always keep `MAX_POSITIONS` reasonable (4-6 for small accounts)

---

## Troubleshooting

### Issue: Positions too small
**Solution:** Increase `TARGET_PROFIT_PER_1PCT_MOVE` (e.g., from 1.0 to 2.0)

### Issue: Positions too large
**Solution:** Decrease `TARGET_PROFIT_PER_1PCT_MOVE` (e.g., from 3.0 to 1.5)

### Issue: Not enough positions
**Solution:** Increase `MAX_POSITIONS` (but keep total exposure < 50% of account)

### Issue: Settings not being used
**Solution:** 
1. Check if database is available (preferred source)
2. Verify `.env` file is in project root
3. Restart the trading agent after changing `.env`

---

## Summary

- ✅ Position sizing configurable in `.env` as fallback
- ✅ Database settings always take priority
- ✅ AI agent understands and obeys position sizing rules
- ✅ Automatic calculation based on target profit per 1% move
- ✅ Flexible modes: auto, fixed, target_profit, or margin
- ✅ Margin mode matches manual trading style (specify margin, system calculates notional)

**The agent will always follow these rules, just like it follows your trading strategy and prompts!**

## Complete .env Example

Here's a complete example with all position sizing options:

```env
# Leverage
DEFAULT_LEVERAGE=25

# Position Sizing Mode: "auto", "fixed", "target_profit", or "margin"
POSITION_SIZING_MODE=margin

# For margin mode (when POSITION_SIZING_MODE=margin)
MARGIN_PER_POSITION=100.0

# For auto/target_profit mode (when POSITION_SIZING_MODE=auto or target_profit)
TARGET_PROFIT_PER_1PCT_MOVE=1.0

# For fixed mode (when POSITION_SIZING_MODE=fixed)
# ALLOCATION_PER_POSITION=25.0

# Maximum concurrent positions
MAX_POSITIONS=6
```

**Note:** Only set the variables relevant to your chosen `POSITION_SIZING_MODE`. The system will ignore irrelevant variables.


