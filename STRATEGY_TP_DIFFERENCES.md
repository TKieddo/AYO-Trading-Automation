# ✅ Strategy TP Differences - Scalping vs Trend

## Summary

Updated both strategies to have different TP approaches:

1. **Scalping Strategy**: Fixed 5% TP - close immediately at 5%
2. **Trend Strategy (LLM)**: Indicator-based exits - use technical analysis, not fixed high TPs

---

## 1. Scalping Strategy - Fixed 5% TP

### Changes Made:
- ✅ Default TP changed from 1.5% to **5.0%**
- ✅ System auto-closes at 5% profit
- ✅ Exit plans updated to indicate "close immediately at 5%"
- ✅ Removed trailing stop calculation (not needed for fixed 5% exit)

### Configuration:
```bash
SCALPING_TP_PERCENT=5.0  # Close immediately at 5% (default: 5.0)
SCALPING_SL_PERCENT=0.5  # Stop loss at 0.5%
```

### How It Works:
1. **Entry**: EMA5 crossover + RSI filter + volume surge
2. **TP**: Set to 5% from entry price
3. **Exit**: System automatically closes when 5% profit is reached
4. **No waiting**: Don't hold for higher profits - take the 5% and move on

### Example:
```
Entry: $100
TP: $105 (5%)
Current: $105.20
→ System closes immediately at 5% ✅
```

---

## 2. Trend Strategy (LLM) - Indicator-Based Exits

### Changes Made:
- ✅ Updated prompts to emphasize **using indicators for exits**
- ✅ Discouraged setting high fixed TPs (20%+)
- ✅ Encouraged using RSI, MACD, EMA, Support/Resistance for exit decisions
- ✅ TP should be based on nearest technical levels (8-15% typical)

### AI Instructions Updated:
```
- CRITICAL: This is a TREND strategy - use TECHNICAL INDICATORS 
  to determine exits, not fixed high TPs

- DO NOT set TP to 20%+ just because - use indicators to decide when to exit

- EXIT BASED ON INDICATORS:
  - RSI: Exit long if RSI > 70 (overbought)
  - MACD: Exit if MACD crosses below signal (for longs)
  - EMA: Exit if price crosses below EMA20/EMA50 (for longs)
  - Support/Resistance: Exit if price breaks key levels

- TP/SL SETUP:
  - Set TP based on NEAREST technical resistance (for longs)
  - Typical TP: 8-15% based on technical levels, NOT arbitrary high numbers
```

### How It Works:
1. **Entry**: AI analyzes indicators and suggests entry
2. **TP**: Set based on nearest technical resistance/support (typically 8-15%)
3. **Exit**: AI suggests close when indicators show reversal:
   - RSI overbought/oversold
   - MACD crossover
   - EMA crossover
   - Support/resistance break
4. **System Backup**: Still enforces max hold time, drawdown protection, etc.

### Example:
```
Entry: $100
TP: $110 (10% - based on resistance level)
Current: $108, RSI: 72 (overbought), MACD crossing below
→ AI suggests "sell" based on indicators ✅
```

---

## System Auto-Close Logic

### Scalping Trades:
- ✅ Auto-closes at 5% profit (immediate)
- ✅ Detected by checking if TP is in 4-6% range

### Trend Trades:
- ✅ Auto-closes at 15%+ profit (if reached)
- ✅ Auto-closes at 10%+ if TP is >20% away
- ✅ But AI should suggest closes based on indicators BEFORE these triggers

---

## Files Updated

1. ✅ `src/config_loader.py` - Changed default SCALPING_TP_PERCENT to 5.0
2. ✅ `src/main.py` - Added scalping detection and auto-close at 5%
3. ✅ `src/strategies/scalping_strategy.py` - Updated TP to 5%, updated exit plans
4. ✅ `src/strategies/llm_trend_strategy.py` - Updated prompts for indicator-based exits
5. ✅ `src/agent/decision_maker.py` - Updated prompts for indicator-based exits

---

## Key Differences

| Feature | Scalping Strategy | Trend Strategy (LLM) |
|---------|------------------|---------------------|
| **TP Approach** | Fixed 5% | Indicator-based (8-15% typical) |
| **Exit Method** | Auto-close at 5% | AI suggests based on indicators |
| **Hold Time** | Quick (minutes) | Longer (hours, up to 24h max) |
| **Profit Target** | 5% fixed | Based on technical levels |
| **Exit Triggers** | Price hits 5% | RSI, MACD, EMA, Support/Resistance |

---

## Configuration

### Scalping:
```bash
SCALPING_TP_PERCENT=5.0  # Close immediately at 5%
SCALPING_SL_PERCENT=0.5  # Stop loss at 0.5%
```

### Trend (LLM):
- No fixed TP percentage
- AI sets TP based on technical levels
- Typical range: 8-15% based on nearest resistance/support

---

## Result

✅ **Scalping**: Quick 5% profits, close immediately  
✅ **Trend**: Indicator-based exits, use technical analysis  
✅ **System**: Auto-closes scalping at 5%, provides backup for trend  
✅ **Clear Separation**: Different strategies, different approaches  

🎯 **Scalping = Quick 5% wins | Trend = Indicator-based exits**
