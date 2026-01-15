# Position Sizing Guide for $300 USDC Trading Capital

## Your Goal
- Make **$1 profit** when price moves **1%** (1:1 leverage scenario)
- OR make **at least $1** when price moves **1-5%**

## Position Sizing Calculations

### Formula
```
Capital Needed Per Position = Target Profit / (Price Move % × Leverage)
```

### Scenarios

#### Scenario 1: 1:1 Leverage (No Leverage)
- **Target**: $1 profit on 1% move
- **Capital per position**: $1 / (0.01 × 1) = **$100**
- **With $300**: You can run **3 positions** of $100 each
- **Risk**: Lower risk, but requires more capital per position

#### Scenario 2: 10x Leverage (Default)
- **Target**: $1 profit on 1% move  
- **Capital per position**: $1 / (0.01 × 10) = **$10**
- **With $300**: You can run **30 positions** (but NOT recommended - too many!)
- **Recommended**: **5-10 positions** for diversification
- **Allocation**: $30-60 per position

#### Scenario 3: 5x Leverage (Moderate)
- **Target**: $1 profit on 1% move
- **Capital per position**: $1 / (0.01 × 5) = **$20**
- **With $300**: You can run **15 positions** (still too many)
- **Recommended**: **6-8 positions** for good diversification
- **Allocation**: $37.50-50 per position

#### Scenario 4: 20x Leverage (High Risk)
- **Target**: $1 profit on 1% move
- **Capital per position**: $1 / (0.01 × 20) = **$5**
- **With $300**: You can run **60 positions** (way too many!)
- **Recommended**: **5-7 positions** for diversification
- **Allocation**: $42-60 per position

## Recommended Strategy for $300 Capital

### Option A: Conservative (Recommended for Beginners)
- **Leverage**: 5x
- **Positions**: 6 pairs
- **Allocation per position**: $50
- **Profit per 1% move**: $50 × 5 × 0.01 = **$2.50 per position**
- **Total profit potential** (if all 6 move 1%): $15
- **Risk level**: Medium

### Option B: Balanced (Recommended)
- **Leverage**: 10x (default)
- **Positions**: 5-6 pairs
- **Allocation per position**: $50-60
- **Profit per 1% move**: $50 × 10 × 0.01 = **$5 per position**
- **Total profit potential** (if all 5 move 1%): $25
- **Risk level**: Medium-High

### Option C: Aggressive (High Risk)
- **Leverage**: 20x
- **Positions**: 5 pairs
- **Allocation per position**: $60
- **Profit per 1% move**: $60 × 20 × 0.01 = **$12 per position**
- **Total profit potential** (if all 5 move 1%): $60
- **Risk level**: Very High (can lose position quickly)

## Number of Trading Pairs Recommendations

### Why Not Too Many Pairs?
- **Diversification**: Too many positions dilute your focus
- **Capital efficiency**: Small positions have higher fees relative to size
- **Risk management**: Harder to monitor and manage many positions
- **Liquidation risk**: More positions = higher chance of hitting liquidation

### Recommended Pair Counts

| Capital | Leverage | Recommended Pairs | Allocation Per Pair |
|---------|----------|-------------------|---------------------|
| $300    | 5x       | 5-6 pairs         | $50-60              |
| $300    | 10x      | 5-6 pairs         | $50-60              |
| $300    | 20x      | 4-5 pairs         | $60-75              |

## How to Configure Your Trading Agent

### Method 1: Via Environment Variables
Add to your `.env` file:
```env
# For 10x leverage with 5-6 pairs
DEFAULT_LEVERAGE=10

# The LLM will allocate based on your available balance
# Make sure you have $300 USDC in your trading account
```

### Method 2: Via Dashboard Settings
1. Go to Settings page in dashboard
2. Set Leverage to your desired value (5x, 10x, or 20x)
3. The agent will automatically size positions based on available balance

### Method 3: Manual Position Sizing
The agent uses `allocation_usd` from LLM decisions. The formula in code:
```python
amount = alloc_usd / current_price
```

So if LLM suggests $50 allocation for BTC at $50,000:
- Position size = $50 / $50,000 = 0.001 BTC
- With 10x leverage, you control $500 worth of BTC
- 1% move = $5 profit ✅ (exceeds your $1 target)

## Example Calculations

### Example 1: BTC Trade
- **BTC Price**: $50,000
- **Allocation**: $50
- **Leverage**: 10x
- **Position Size**: $50 / $50,000 = 0.001 BTC
- **Controlled Value**: $50 × 10 = $500
- **Profit on 1% move**: $500 × 0.01 = **$5** ✅
- **Profit on 5% move**: $500 × 0.05 = **$25** ✅

### Example 2: ETH Trade  
- **ETH Price**: $3,000
- **Allocation**: $50
- **Leverage**: 10x
- **Position Size**: $50 / $3,000 = 0.0167 ETH
- **Controlled Value**: $50 × 10 = $500
- **Profit on 1% move**: $500 × 0.01 = **$5** ✅
- **Profit on 5% move**: $500 × 0.05 = **$25** ✅

## Risk Warnings

⚠️ **Important Considerations**:

1. **Liquidation Risk**: Higher leverage = closer liquidation price
   - At 10x leverage, a 10% move against you = liquidation
   - At 20x leverage, a 5% move against you = liquidation

2. **Fees**: Trading fees reduce profits
   - Typical fees: 0.02-0.05% per trade
   - On $50 position: ~$0.01-0.025 per trade
   - Factor this into profit calculations

3. **Slippage**: Market orders may fill at worse prices
   - Can reduce profit by 0.1-0.5%

4. **Stop Loss**: Always use stop losses!
   - Default: 3% stop loss
   - At 10x leverage, 3% move = 30% of your capital at risk

## Final Recommendation

**For $300 capital with your goals:**

✅ **Best Setup**:
- **Leverage**: 10x (default)
- **Number of Pairs**: 5-6 pairs
- **Allocation per Pair**: $50-60
- **Expected Profit per 1% move**: $5 per position
- **Total Potential** (if all positions move 1%): $25-30

This setup:
- ✅ Exceeds your $1 profit target per position
- ✅ Provides good diversification
- ✅ Manages risk with stop losses
- ✅ Leaves room for fees and slippage
- ✅ Allows you to scale up as you gain experience

## Next Steps

1. **Set your leverage** in `.env` or dashboard settings
2. **Choose 5-6 trading pairs** (BTC, ETH, SOL, etc.)
3. **Start the agent** with: `python src/main.py --assets BTC ETH SOL MATIC AVAX --interval 1h`
4. **Monitor positions** via the dashboard
5. **Adjust allocation** based on performance

The agent will automatically size positions based on available balance and LLM decisions. With $300 and 10x leverage, each position will naturally be around $50-60, giving you the profit targets you want!

