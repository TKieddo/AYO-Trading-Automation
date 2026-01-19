# ✅ Dynamic Strategy Switching - Re-evaluate Every Cycle

## What Was Implemented

The auto strategy selector now **re-evaluates the strategy on every cycle** and automatically adjusts positions when the strategy changes.

---

## How It Works

### Before (OLD):
- ❌ Strategy selected once at startup
- ❌ Cached for 20 minutes
- ❌ No re-evaluation when market conditions change
- ❌ Positions stuck with old strategy's TP/SL

### After (NEW):
- ✅ Strategy re-evaluated **every cycle** (every INTERVAL)
- ✅ Detects when market regime changes
- ✅ Automatically switches strategies when conditions warrant
- ✅ Adjusts existing positions' TP/SL when strategy changes

---

## Strategy Selection Logic

### Every Cycle:
1. **Analyze Market Conditions**
   - Volatility (ATR on 5m and 4h)
   - Trend strength (EMA alignment)
   - RSI levels
   - Market regime (trending vs ranging)

2. **LLM Recommends Strategy**
   - **Scalping**: For ranging/choppy markets, high volatility
   - **Trend (LLM)**: For trending markets, clear direction

3. **Check if Strategy Changed**
   - Compare current strategy with previous
   - If changed → Adjust existing positions

---

## Position Adjustment on Strategy Switch

### Switching TO Scalping:
**When**: Market was trending but now ranging/choppy

**Action**:
- ✅ If position is profitable → Adjust TP to 5% (scalping target)
- ✅ Cancel old TP/SL orders
- ✅ Place new 5% TP order
- ✅ System will auto-close at 5% profit

**Example**:
```
Position: BTC Long, Entry $100, Current $102 (+2%)
Strategy switches: Trend → Scalping
Action: Update TP to $105 (5%), close at 5% profit
```

### Switching TO Trend:
**When**: Market was ranging but now trending

**Action**:
- ✅ Cancel old fixed TP orders
- ✅ Let trend strategy manage with indicator-based exits
- ✅ New strategy will set TP based on technical levels (8-15%)
- ✅ Exits based on RSI/MACD/EMA signals

**Example**:
```
Position: BTC Long, Entry $100, TP was $105 (5% fixed)
Strategy switches: Scalping → Trend
Action: Cancel old TP, trend strategy will set new TP based on resistance levels
```

---

## Configuration

### Default Behavior:
- **Re-evaluates every cycle** (cache_duration = 0)
- Automatically switches when market conditions change

### Optional Caching:
If you want to cache strategy selection (less frequent switching):
```bash
AUTO_STRATEGY_CACHE_MINUTES=10  # Cache for 10 minutes (default: 0 = every cycle)
```

---

## Example Scenarios

### Scenario 1: Market Changes from Trending to Ranging
```
Cycle 1: Market trending → Strategy: Trend (LLM)
Cycle 2: Market still trending → Strategy: Trend (LLM) [unchanged]
Cycle 3: Market becomes choppy/ranging → Strategy: Scalping [SWITCHED]
  → Existing positions: TP adjusted to 5% if profitable
  → New positions: Use 5% TP (scalping)
```

### Scenario 2: Market Changes from Ranging to Trending
```
Cycle 1: Market ranging → Strategy: Scalping
Cycle 2: Market still ranging → Strategy: Scalping [unchanged]
Cycle 3: Market starts trending → Strategy: Trend (LLM) [SWITCHED]
  → Existing positions: Old TP cancelled, new strategy manages with indicators
  → New positions: Use indicator-based exits (8-15% TP)
```

---

## Files Updated

1. ✅ `src/strategies/auto_strategy_selector.py`
   - Changed cache duration to 0 (re-evaluate every cycle)
   - Added strategy change detection
   - Improved LLM prompts for strategy selection

2. ✅ `src/main.py`
   - Added strategy change detection
   - Added position adjustment logic when strategy switches
   - Tracks strategy name across cycles

3. ✅ `src/config_loader.py`
   - Added `AUTO_STRATEGY_CACHE_MINUTES` config option

---

## Key Features

### 1. Dynamic Re-evaluation
- ✅ Checks market conditions every cycle
- ✅ No caching by default (re-evaluates every INTERVAL)
- ✅ Adapts to changing market conditions

### 2. Automatic Position Adjustment
- ✅ Detects when strategy changes
- ✅ Adjusts TP/SL for existing positions
- ✅ Scalping → Trend: Cancel fixed TP, use indicators
- ✅ Trend → Scalping: Set TP to 5% if profitable

### 3. Smart Strategy Selection
- ✅ LLM analyzes: Volatility, Trend, RSI, Market Regime
- ✅ Recommends best strategy for current conditions
- ✅ Considers existing positions in recommendations

---

## How to Use

### Enable Auto Mode:
```bash
STRATEGY=auto  # In .env or command line
```

### Optional: Cache Strategy Selection:
```bash
AUTO_STRATEGY_CACHE_MINUTES=10  # Cache for 10 minutes (optional)
```

### Default (Recommended):
```bash
STRATEGY=auto
# No AUTO_STRATEGY_CACHE_MINUTES = re-evaluates every cycle
```

---

## Result

✅ **Adaptive**: Strategy changes with market conditions  
✅ **Automatic**: No manual intervention needed  
✅ **Position-Aware**: Adjusts existing positions when strategy changes  
✅ **Efficient**: Re-evaluates every cycle to catch regime changes  

🎯 **Your agent now adapts to market conditions in real-time!**
