# Interval Recommendations: Balancing Speed vs Cost

## 🔍 Understanding Exit Monitoring

### Two Types of Exits:

#### 1. **TP/SL Orders (Hard Stops) - ALWAYS MONITORED** ✅
- **TP/SL orders are placed on Binance/Hyperliquid as trigger orders**
- **They monitor continuously 24/7** - even when agent is sleeping
- **Interval DOES NOT affect these** - they trigger automatically when price hits
- Example: TP @ $105, SL @ $97 → Binance watches 24/7, triggers instantly

#### 2. **Indicator-Based Exits (Soft Conditions) - AGENT DEPENDENT** ⚠️
- **Only checked during agent cycles** (when interval wakes agent)
- Examples:
  - "Exit if MACD crosses below signal line"
  - "Exit if price closes above EMA50"
  - "Exit if RSI rises above 70"
- **Longer interval = slower detection of these conditions**
- Example: With 1h interval, if MACD crosses at 10:05 but agent checks at 10:00 and 11:00, you miss it until 11:00

## 📊 Interval Comparison

### **1 Minute Interval**
**Pros:**
- ✅ Fast entry detection (catch opportunities quickly)
- ✅ Fast indicator-based exit detection
- ✅ Responsive to market changes
- ✅ Good for scalping/day trading

**Cons:**
- ❌ **60 API calls/hour** = High costs
- ❌ **High OpenRouter costs** (~60 LLM calls/hour)
- ❌ **Binance rate limits** (might hit limits)
- ❌ **More noise** (might overtrade on small fluctuations)
- ❌ **Higher compute costs**

**Cost Estimate:**
- OpenRouter: ~60 calls/hour × $0.01/call = $0.60/hour = $14.40/day = $432/month
- Binance API: Usually free but watch rate limits

### **5 Minute Interval** ⭐ RECOMMENDED
**Pros:**
- ✅ **Good balance** - catches most opportunities
- ✅ **12 checks/hour** = Reasonable API usage
- ✅ **Fast enough** for most indicator-based exits
- ✅ **Lower costs** (~$86/month OpenRouter)
- ✅ **Avoids overtrading** (less noise)

**Cons:**
- ⚠️ Might miss very quick moves (<5 min)
- ⚠️ Slightly slower entry detection than 1m

**Best For:**
- Most trading strategies
- Swing trading / position trading
- Cost-conscious operations

### **15 Minute Interval**
**Pros:**
- ✅ **4 checks/hour** = Low costs (~$29/month)
- ✅ **Minimal API usage**
- ✅ **Good for swing trading**

**Cons:**
- ❌ Might miss quick opportunities
- ❌ Slower indicator-based exit detection

### **1 Hour Interval**
**Pros:**
- ✅ **Very low costs** (~$7/month)
- ✅ **Minimal API usage**
- ✅ **Good for long-term holds**

**Cons:**
- ❌ **Slow entry detection** (might miss 30-min setups)
- ❌ **Slow indicator exits** (up to 1h delay)
- ❌ **Not responsive** to fast market changes

## 🎯 My Recommendation

### **For Normal Trading: Use 5 Minutes** ⭐

**Why 5m is the sweet spot:**

1. **TP/SL Orders Are Always Protected**
   - Hard stops (TP/SL) are monitored 24/7 by Binance
   - Even if agent is offline, TP/SL will trigger
   - You won't miss hard exits regardless of interval

2. **Indicator-Based Exits Are Fast Enough**
   - Most indicator signals don't reverse in <5 minutes
   - 5m is responsive enough to catch MACD/RSI/EMA changes
   - Professional traders often use 5-15m intervals

3. **Entry Opportunities Are Captured**
   - Most setups develop over 5+ minutes
   - Quick scalps might be missed, but those are risky anyway
   - Better to wait for confirmed setups (5m gives more signal quality)

4. **Cost Efficient**
   - 12 checks/hour vs 60 checks/hour
   - ~$86/month vs $432/month (80% cost savings)
   - Sustainable long-term

5. **Avoids Overtrading**
   - 1m interval might trigger on noise
   - 5m filters out false signals
   - Better win rate from higher-quality setups

### **When to Use 1m:**

- ✅ **Testing/Debugging** (like you're doing now)
- ✅ **Scalping strategies** (very short-term)
- ✅ **High volatility periods** (if you want to catch quick moves)
- ⚠️ **Budget for high API costs**

### **When to Use 15m-1h:**

- ✅ **Swing trading** (holding positions for hours/days)
- ✅ **Very cost-conscious** operations
- ✅ **Trend-following strategies** (less frequent decisions needed)
- ✅ **Long-term position management**

## 💡 Hybrid Strategy (Advanced)

If you want best of both worlds:

1. **Use 5m normally** for cost efficiency
2. **Switch to 1m during volatile periods** or when you have active positions with indicator-based exits
3. **Switch to 15m+ for quiet markets** or when holding positions for long-term

You could even implement dynamic intervals based on:
- Market volatility (ATR)
- Number of open positions
- Time of day (higher volatility periods)

## 🔒 Important: TP/SL Are Always Protected

**Remember:** Your TP/SL orders are **NOT affected by interval**. They're on the exchange and monitor 24/7:

```
Position opened @ $100
TP set @ $105
SL set @ $97

Even if agent sleeps for 1 hour:
✅ If price hits $105 → TP triggers immediately (Binance handles it)
✅ If price hits $97 → SL triggers immediately (Binance handles it)
✅ No risk of missing hard stops due to interval
```

Only **indicator-based exits** (from exit_plan) are affected by interval, and these are usually less critical than TP/SL.

## 📝 Summary

**Recommended: `INTERVAL=5m`**

- TP/SL always protected (exchange monitors 24/7)
- Fast enough for indicator-based exits
- Catches most entry opportunities
- Cost-efficient (80% cheaper than 1m)
- Professional-grade frequency

**For Testing: Keep at 1m temporarily**

- Faster feedback
- See if trades work
- Then switch to 5m for production

**Change .env and restart agent to apply!**

