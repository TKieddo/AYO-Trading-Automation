# Scalping Strategy Signal v2 by INFINITYTRADER - Implementation Guide

## 📋 Overview

This is a complete implementation of the **Scalping Strategy Signal v2** strategy, designed for multi-timeframe scalping with higher timeframe confirmation. The strategy combines moving averages, RSI, volume, ATR, and candlestick patterns to identify trading opportunities.

**Based on**: [TradingView Script](https://www.tradingview.com/script/D898fmMY-Scalping-Strategy-Signal-v2-by-INFINITYTRADER/)

---

## 🎯 Key Features

### **1. Multi-Timeframe Analysis**
- Uses higher timeframe (default: 4H) to generate signals
- Executes on lower timeframes (15m or 30m)
- Only trades at higher timeframe candle close (prevents over-trading)

### **2. Four Entry Methods**

#### **Standard Long Entry**
- Price crosses above 21-period MA
- Volume > 70% of 20-period average
- 1H RSI < 70 (not overbought)

#### **Special Long Entry**
- 6-period RSI crosses above 23
- Price > 1.5x ATR from 21 MA
- Price > prior close
- **Stop Loss**: 4H candle low

#### **RSI-Based Short Entry**
- 6-period RSI crosses below 68
- Volume confirmation required

#### **Trend-Based Short Entry**
- Price crosses below 21 MA
- Volume > 70% of average
- 1H RSI > 30 (not oversold)

#### **Candlestick Pattern Entries**
- **Long**: Two consecutive green 4H bars
- **Short**: Two consecutive red 4H bars
- **Stop Loss**: Base timeframe candle low/high

### **3. Re-Entry Logic**
- **Long Re-Entry**: After losing special long, triggers when:
  - 6-period RSI crosses 27
  - Price crosses above 21 MA
  
- **Short Re-Entry**: After losing short, triggers when:
  - 6-period RSI crosses 50
  - Price crosses below 21 MA

### **4. Multiple Exit Conditions**

#### **Manual Exits**
- **Long**: 21 MA crosses below 50 MA OR 1H RSI > 68
- **Short**: 21 MA crosses above 50 MA OR 1H RSI < 25

#### **ATR-Based Exits**
- **Stop Loss**: Entry price ± (ATR × 1.5) [default]
- **Take Profit**: Entry price ± (ATR × 4) [default]

#### **Trailing Stop**
- Adjusts 6x ATR from peak/trough
- Closes if price retraces within 1x ATR

#### **Special Exits**
- Special long exits if price opens below 4H candle low
- Candlestick pattern entries use tight stops from base timeframe

### **5. Lock-In Profit Feature**
- Locks in a percentage of profit (default: 50%)
- Prevents giving back gains in volatile markets
- Evaluated on 120-minute timeframe (reduces sensitivity)

---

## ⚙️ Input Parameters

### **Risk Management**
- `Initial Capital (USDT)`: Starting capital (default: 100)
- `ATR Stop-Loss Multiplier`: SL distance (default: 1.5)
- `ATR Take-Profit Multiplier`: TP distance (default: 4.0)
- `Use Trailing Stop`: Enable/disable trailing (default: true)
- `Trailing Stop ATR Multiplier`: Distance from peak (default: 6.0)
- `Trailing Stop Retrace ATR`: Retracement trigger (default: 1.0)
- `Use Lock-In Profit`: Enable profit lock (default: true)
- `Lock-In Profit %`: Percentage to lock (default: 50%)

### **Settings**
- `Higher Timeframe`: Analysis timeframe (default: 4H)
- `Base Timeframe`: Display timeframe (15m or 30m)

### **Indicators**
- `Fast MA Period`: Fast moving average (default: 21)
- `Slow MA Period`: Slow moving average (default: 50)
- `RSI Period`: RSI for filtering (default: 14)
- `Fast RSI Period`: RSI for entries (default: 6)
- `RSI Overbought Level`: Overbought threshold (default: 70)
- `RSI Oversold Level`: Oversold threshold (default: 30)
- `RSI Special Long Threshold`: Special long trigger (default: 23)
- `RSI Short Entry Threshold`: Short entry trigger (default: 68)
- `Volume SMA Period`: Volume average period (default: 20)
- `Volume Threshold`: Volume multiplier (default: 0.7 = 70%)
- `ATR Period`: ATR calculation period (default: 14)
- `ATR Distance for Special Long`: Special long distance (default: 1.5)

### **Re-Entry Settings**
- `Enable Re-Entry Logic`: Enable/disable re-entry (default: true)
- `RSI Re-Entry Long Threshold`: Long re-entry trigger (default: 27)
- `RSI Re-Entry Short Threshold`: Short re-entry trigger (default: 50)

### **Display Options**
- `Show Info Table`: Display info table (default: true)
- `Show Entry/Exit Signals`: Show signals on chart (default: true)
- `Show Moving Averages`: Show MA lines (default: true)
- `Show ATR Bands`: Show ATR bands (default: false)

---

## 📊 Info Table Display

The strategy displays a real-time info table (top-right) showing:
- **Signal**: Current position (LONG/SHORT/FLAT)
- **Entry Type**: Type of entry (Long, SpecialLong, Short)
- **Take Profit**: TP level
- **Stop Loss**: SL level
- **Equity**: Current account equity
- **Pair**: Trading pair
- **Trade Size**: Position size
- **HTF RSI**: Higher timeframe RSI
- **Fast RSI**: Fast RSI (6-period)
- **Volume OK**: Volume confirmation status

---

## 🚀 Setup Instructions

### **Step 1: Add to TradingView**
1. Open TradingView
2. Go to Pine Editor
3. Copy `SCALPING_STRATEGY_V2_INFINITY.pine` content
4. Click "Add to Chart"

### **Step 2: Configure Settings**
1. Set your **Initial Capital** (match your account)
2. Choose **Higher Timeframe** (default: 4H works well)
3. Select **Base Timeframe** (15m for more signals, 30m for fewer but stronger)
4. Adjust **ATR Multipliers** based on asset volatility:
   - **Low volatility**: 1.0-1.5 SL, 3.0-4.0 TP
   - **High volatility**: 2.0-2.5 SL, 5.0-6.0 TP

### **Step 3: Backtest**
1. Open Strategy Tester
2. Select date range (3+ months recommended)
3. Review metrics:
   - Win Rate (target: >45%)
   - Profit Factor (target: >2.0)
   - Max Drawdown (target: <10%)
   - Total Trades

### **Step 4: Paper Trade**
1. Enable alerts
2. Monitor for 1-2 weeks
3. Adjust parameters if needed
4. Go live with small position sizes

---

## 📈 Expected Performance

Based on backtest results from the original strategy:

### **Bull Market (Jul 2023 - Dec 2023)**
- **15-Minute**: 42.74% win rate, 108% P&L, 1.99% drawdown
- **30-Minute**: 49.58% win rate, 116.85% P&L, 2.34% drawdown

### **Bear Market (Jan 2022 - Jun 2022)**
- **15-Minute**: 44.4% win rate, 239.80% P&L, 3.74% drawdown
- **30-Minute**: 52.22% win rate, 258.77% P&L, 5.34% drawdown

### **Flat Market (Jan 2021 - Jun 2021)**
- **15-Minute**: 51.84% win rate, 340.33% P&L, 9.59% drawdown
- **30-Minute**: 55.11% win rate, 315.42% P&L, 7.21% drawdown

**Note**: Past performance doesn't guarantee future results. Always backtest on your specific asset and timeframe.

---

## 💡 Trading Tips

### **1. Timeframe Selection**
- **15-Minute**: More signals, faster action, higher frequency
- **30-Minute**: Fewer signals, stronger setups, better win rate
- **Recommendation**: Start with 30-minute for better consistency

### **2. Market Conditions**
- **Trending Markets**: All entry methods work well
- **Range-Bound Markets**: Focus on RSI-based entries
- **Volatile Markets**: Increase ATR multipliers, use trailing stops

### **3. Risk Management**
- Start with **small position sizes** (10-20% of capital)
- Use **trailing stops** to lock in profits
- Monitor **drawdown** - pause if >10%
- Don't override manual exits - trust the system

### **4. Entry Quality**
- **Best Entries**: Standard long/short with volume confirmation
- **Special Longs**: Higher risk, tighter stops, use smaller size
- **Candlestick Patterns**: Quick scalps, tight stops required

### **5. Exit Strategy**
- Let **trailing stops** work - don't exit manually too early
- **Lock-in profit** feature protects gains in volatile markets
- **Manual exits** are safety nets - trust ATR-based exits first

---

## ⚠️ Important Notes

### **Strategy Behavior**
1. **Fully Automated**: Designed for automation, avoid manual intervention
2. **Alignment Period**: Takes ~2 days to align with asset
3. **HTF Close Only**: Trades only trigger at higher timeframe candle close
4. **Backtest vs Live**: Live results may differ due to slippage, execution delays

### **Limitations**
1. **4H Dependency**: May delay entries in fast markets
2. **RSI/Volume Filters**: Can reduce trades in low-momentum periods
3. **Commission Impact**: 0.1% commission affects small scalps
4. **Slippage**: Fast markets may have execution slippage

### **Best Practices**
1. **Backtest First**: Always backtest 3+ months before going live
2. **Paper Trade**: Test alerts and execution for 1-2 weeks
3. **Start Small**: Begin with minimum position sizes
4. **Monitor Closely**: Watch first 10-20 trades carefully
5. **Adjust Parameters**: Optimize ATR multipliers for your asset

---

## 🔧 Troubleshooting

### **No Signals Appearing**
- Check if higher timeframe is set correctly
- Verify volume threshold isn't too high
- Ensure RSI levels aren't too restrictive
- Check if you're viewing the correct base timeframe

### **Too Many Signals**
- Increase volume threshold (0.8-1.0)
- Tighten RSI filters (raise overbought, lower oversold)
- Use 30-minute base timeframe instead of 15-minute

### **Too Few Signals**
- Decrease volume threshold (0.5-0.6)
- Loosen RSI filters
- Use 15-minute base timeframe
- Check if higher timeframe is appropriate

### **Stops Hit Too Often**
- Increase ATR stop-loss multiplier (2.0-2.5)
- Check if asset volatility matches settings
- Consider using fixed percentage stops

### **Profits Not Locked In**
- Verify "Use Lock-In Profit" is enabled
- Check lock-in percentage (try 30-40% for tighter control)
- Ensure trailing stop is enabled

---

## 📝 Alerts Setup

### **Entry Alerts**
- **Long Entry Signal**: Triggers on long entry conditions
- **Short Entry Signal**: Triggers on short entry conditions

### **Exit Alerts**
- **Long Exit Signal**: Triggers on long exit conditions
- **Short Exit Signal**: Triggers on short exit conditions

### **Alert Configuration**
1. Right-click on chart → "Add Alert"
2. Select strategy name
3. Choose alert condition
4. Set notification method
5. Configure message template

---

## 🎯 Summary

This strategy is a comprehensive scalping system that:
- ✅ Uses multi-timeframe analysis for precision
- ✅ Combines multiple entry methods for flexibility
- ✅ Implements robust risk management
- ✅ Features re-entry logic for recovery
- ✅ Provides visual feedback via info table
- ✅ Supports both automated and manual trading

**Remember**: Always backtest, paper trade, and start small. No strategy is perfect - adapt it to your trading style and market conditions.

Good luck and happy trading! 🚀

