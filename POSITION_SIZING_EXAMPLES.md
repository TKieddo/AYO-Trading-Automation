# Position Sizing Calculation Examples

## Formula

**Profit = Allocation × (PriceMove% / 100) × Leverage**

**Therefore:**
**Allocation = TargetProfit / ((PriceMove% / 100) × Leverage)**

---

## Examples: Making $1 with 20x Leverage

### For 1% Price Move:
- Allocation = $1 / (0.01 × 20) = $1 / 0.2 = **$5.00**
- Profit on 1% move: $5 × 0.01 × 20 = **$1.00** ✅

### For 1.5% Price Move:
- Allocation = $1 / (0.015 × 20) = $1 / 0.3 = **$3.33**
- Profit on 1.5% move: $3.33 × 0.015 × 20 = **$1.00** ✅

### For 2% Price Move:
- Allocation = $1 / (0.02 × 20) = $1 / 0.4 = **$2.50**
- Profit on 2% move: $2.50 × 0.02 × 20 = **$1.00** ✅

---

## Current System Behavior

The system uses `target_profit_per_1pct_move` setting, which means:
- **It calculates allocation to make $X per 1% move**
- **If price moves MORE than 1%, you make MORE than $X**
- **If price moves LESS than 1%, you make LESS than $X**

### Example with target_profit_per_1pct_move = $1.00 and 20x leverage:

**Allocation calculated:** $1 / (0.01 × 20) = **$5.00**

**Profits at different moves:**
- 0.5% move: $5 × 0.005 × 20 = **$0.50**
- 1.0% move: $5 × 0.01 × 20 = **$1.00** ✅ (target)
- 1.5% move: $5 × 0.015 × 20 = **$1.50** (50% more!)
- 2.0% move: $5 × 0.02 × 20 = **$2.00** (100% more!)

---

## Quick Reference Table

### Making $1 with Different Leverage and Move Percentages:

| Leverage | 1% Move | 1.5% Move | 2% Move | 2.5% Move | 5% Move |
|----------|---------|-----------|---------|-----------|---------|
| 10x      | $10.00  | $6.67     | $5.00   | $4.00     | $2.00   |
| 20x      | $5.00   | $3.33     | $2.50   | $2.00     | $1.00   |
| 30x      | $3.33   | $2.22     | $1.67   | $1.33     | $0.67   |
| 40x      | $2.50   | $1.67     | $1.25   | $1.00     | $0.50   |

### Making $2 with 20x Leverage:

| Move % | Allocation Needed |
|--------|-------------------|
| 1%     | $10.00           |
| 1.5%   | $6.67            |
| 2%     | $5.00            |
| 2.5%   | $4.00            |
| 5%     | $2.00            |

---

## Understanding the Current System

**Current Setting:** `target_profit_per_1pct_move = $1.00`

This means the system calculates allocation to guarantee **at least $1 per 1% move**.

**If you want to make $1 on a 1.5% or 2% move instead**, you would need to:
1. Adjust the calculation to use the expected move percentage, OR
2. Understand that with the current setting, you'll make MORE than $1 if price moves more than 1%

**Example:**
- System allocates $5 (for $1 per 1% with 20x leverage)
- Price moves 1.5% → You make $1.50 (not $1.00)
- Price moves 2% → You make $2.00 (not $1.00)

---

## Recommendation

The current system is designed for **scalping** where you expect 1-2% moves. If you set `target_profit_per_1pct_move = $1.00`:
- You're guaranteed at least $1 on a 1% move
- You'll make $1.50 on a 1.5% move
- You'll make $2.00 on a 2% move

This is actually **better** than targeting a specific move percentage, because you profit more when price moves more!

