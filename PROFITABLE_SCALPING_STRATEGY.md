//@version=6
strategy("Fibonacci Scalping Strategy Optimized", overlay=true, initial_capital=100, default_qty_type=strategy.percent_of_equity, default_qty_value=15, commission_type=strategy.commission.percent, commission_value=0.1, pyramiding=2)

// Inputs
fib_lookback = input.int(30, "Fibonacci Lookback Period", minval=10, maxval=200)
rsi_period = input.int(14, "RSI Period", minval=1)
ema_fast = input.int(9, "Fast EMA", minval=1)
ema_slow = input.int(21, "Slow EMA", minval=1)
ema_trend = input.int(50, "Trend EMA", minval=1)
macd_fast = input.int(12, "MACD Fast", minval=1)
macd_slow = input.int(26, "MACD Slow", minval=1)
macd_signal = input.int(9, "MACD Signal", minval=1)

// Risk Management - Optimized for better returns
risk_percent = input.float(1.5, "Risk Per Trade %", minval=0.5, maxval=5.0)
tp1_percent = input.float(1.2, "Take Profit 1 %", minval=0.5, maxval=5.0)
tp2_percent = input.float(2.0, "Take Profit 2 %", minval=1.0, maxval=10.0)
tp3_percent = input.float(3.5, "Take Profit 3 %", minval=2.0, maxval=15.0)
sl_percent = input.float(0.6, "Stop Loss %", minval=0.3, maxval=2.0)
use_trailing = input.bool(true, "Use Trailing Stop After TP1")

// Focus on key Fibonacci levels only
use_fib_382 = input.bool(true, "Use Fib 38.2%")
use_fib_500 = input.bool(true, "Use Fib 50.0%")
use_fib_618 = input.bool(true, "Use Fib 61.8%")

// Indicators
rsi = ta.rsi(close, rsi_period)
ema9 = ta.ema(close, ema_fast)
ema21 = ta.ema(close, ema_slow)
ema50 = ta.ema(close, ema_trend)
[macd_line, signal_line, hist] = ta.macd(close, macd_fast, macd_slow, macd_signal)
atr = ta.atr(14)
volume_avg = ta.sma(volume, 20)

// Momentum indicators
price_change = ta.change(close, 1)
price_momentum_3 = ta.change(close, 3)
ema9_slope = ema9 - ema9[1]
ema21_slope = ema21 - ema21[1]

// Identify recent swing high and low
swing_high = ta.highest(high, fib_lookback)
swing_low = ta.lowest(low, fib_lookback)
swing_range = swing_high - swing_low

// Determine trend direction and strength
is_uptrend = close > ema9 and ema9 > ema21 and ema21 > ema50
is_downtrend = close < ema9 and ema9 < ema21 and ema21 < ema50
strong_uptrend = is_uptrend and ema9_slope > 0 and ema21_slope > 0
strong_downtrend = is_downtrend and ema9_slope < 0 and ema21_slope < 0

// Calculate Fibonacci retracement levels
fib_382 = is_uptrend ? swing_low + (swing_range * 0.382) : swing_high - (swing_range * 0.382)
fib_500 = is_uptrend ? swing_low + (swing_range * 0.500) : swing_high - (swing_range * 0.500)
fib_618 = is_uptrend ? swing_low + (swing_range * 0.618) : swing_high - (swing_range * 0.618)

// Check if price is near Fibonacci levels (tighter tolerance for better entries)
tolerance = math.max(swing_range * 0.003, atr * 0.5)
near_fib_382 = use_fib_382 and math.abs(close - fib_382) <= tolerance
near_fib_500 = use_fib_500 and math.abs(close - fib_500) <= tolerance
near_fib_618 = use_fib_618 and math.abs(close - fib_618) <= tolerance

on_fib_level = near_fib_382 or near_fib_500 or near_fib_618

// Volume confirmation - stronger requirement
volume_spike = volume > volume_avg * 1.1
volume_increasing = volume > volume[1]

// Entry Conditions - LONG (More selective but aggressive)
long_fib_bounce = (is_uptrend or strong_uptrend) and on_fib_level
long_rsi_ok = rsi > 30 and rsi < 60  // Not oversold, room to move up
long_macd_ok = macd_line > signal_line and hist > 0
long_macd_cross = ta.crossover(macd_line, signal_line)
long_momentum = price_change > 0 and price_momentum_3 > 0
long_ema_alignment = close > ema9 and ema9 > ema21
long_volume = volume_spike or (volume_increasing and volume > volume_avg)
long_price_action = close > open and close > close[1]  // Strong bullish candle

long_condition = long_fib_bounce and long_rsi_ok and (long_macd_ok or long_macd_cross) and long_momentum and long_ema_alignment and long_volume and long_price_action and strategy.position_size == 0

// Entry Conditions - SHORT (More selective but aggressive)
short_fib_bounce = (is_downtrend or strong_downtrend) and on_fib_level
short_rsi_ok = rsi > 40 and rsi < 70  // Not overbought, room to move down
short_macd_ok = macd_line < signal_line and hist < 0
short_macd_cross = ta.crossunder(macd_line, signal_line)
short_momentum = price_change < 0 and price_momentum_3 < 0
short_ema_alignment = close < ema9 and ema9 < ema21
short_volume = volume_spike or (volume_increasing and volume > volume_avg)
short_price_action = close < open and close < close[1]  // Strong bearish candle

short_condition = short_fib_bounce and short_rsi_ok and (short_macd_ok or short_macd_cross) and short_momentum and short_ema_alignment and short_volume and short_price_action and strategy.position_size == 0

// Entry Logic with better risk-reward
if long_condition
    entry_price = close
    sl_price = entry_price * (1 - sl_percent / 100)
    tp1_price = entry_price + (entry_price * tp1_percent / 100)
    tp2_price = entry_price + (entry_price * tp2_percent / 100)
    tp3_price = entry_price + (entry_price * tp3_percent / 100)
    
    strategy.entry("Long", strategy.long)
    strategy.exit("Long TP1", "Long", qty_percent=50, limit=tp1_price, stop=sl_price)
    strategy.exit("Long TP2", "Long", qty_percent=30, limit=tp2_price, stop=sl_price)
    strategy.exit("Long TP3", "Long", qty_percent=20, limit=tp3_price, stop=sl_price)

if short_condition
    entry_price = close
    sl_price = entry_price * (1 + sl_percent / 100)
    tp1_price = entry_price - (entry_price * tp1_percent / 100)
    tp2_price = entry_price - (entry_price * tp2_percent / 100)
    tp3_price = entry_price - (entry_price * tp3_percent / 100)
    
    strategy.entry("Short", strategy.short)
    strategy.exit("Short TP1", "Short", qty_percent=50, limit=tp1_price, stop=sl_price)
    strategy.exit("Short TP2", "Short", qty_percent=30, limit=tp2_price, stop=sl_price)
    strategy.exit("Short TP3", "Short", qty_percent=20, limit=tp3_price, stop=sl_price)

// Break-even and trailing stop management
var float long_entry_price = na
var float short_entry_price = na
var float long_breakeven = na
var float short_breakeven = na

// Track entry prices
if long_condition
    long_entry_price := close
if short_condition
    short_entry_price := close

// Break-even after TP1 (move stop to entry + small buffer)
if strategy.position_size > 0 and not na(long_entry_price)
    if close >= long_entry_price * (1 + tp1_percent / 100)
        long_breakeven := long_entry_price * 1.001  // 0.1% above entry
        if close <= long_breakeven
            strategy.close("Long", comment="Break-Even Stop")
            long_entry_price := na
            long_breakeven := na

if strategy.position_size < 0 and not na(short_entry_price)
    if close <= short_entry_price * (1 - tp1_percent / 100)
        short_breakeven := short_entry_price * 0.999  // 0.1% below entry
        if close >= short_breakeven
            strategy.close("Short", comment="Break-Even Stop")
            short_entry_price := na
            short_breakeven := na

// Trailing stop after TP1 for long
if strategy.position_size > 0 and use_trailing and not na(long_entry_price)
    if close >= long_entry_price * (1 + tp1_percent / 100)
        current_high = ta.highest(high, 20)
        trailing_stop = current_high - (atr * 1.0)
        if close <= trailing_stop
            strategy.close("Long", comment="Trailing Stop")
            long_entry_price := na

// Trailing stop after TP1 for short
if strategy.position_size < 0 and use_trailing and not na(short_entry_price)
    if close <= short_entry_price * (1 - tp1_percent / 100)
        current_low = ta.lowest(low, 20)
        trailing_stop = current_low + (atr * 1.0)
        if close >= trailing_stop
            strategy.close("Short", comment="Trailing Stop")
            short_entry_price := na

// Reset when no position
if strategy.position_size == 0
    long_entry_price := na
    short_entry_price := na
    long_breakeven := na
    short_breakeven := na

// Emergency Exits
if strategy.position_size > 0
    if ta.crossunder(macd_line, signal_line) or (rsi > 75 and close < ema9)
        strategy.close("Long", comment="Emergency Exit")
        long_entry_price := na
        
if strategy.position_size < 0
    if ta.crossover(macd_line, signal_line) or (rsi < 25 and close > ema9)
        strategy.close("Short", comment="Emergency Exit")
        short_entry_price := na

// Plotting
plot(ema9, "EMA 9", color=color.new(color.blue, 0), linewidth=2)
plot(ema21, "EMA 21", color=color.new(color.orange, 0), linewidth=2)
plot(ema50, "EMA 50", color=color.new(color.gray, 0), linewidth=1)

// Plot Fibonacci levels
plot(use_fib_382 ? fib_382 : na, "Fib 38.2%", color=color.new(color.orange, 70), linewidth=2, style=plot.style_line)
plot(use_fib_500 ? fib_500 : na, "Fib 50.0%", color=color.new(color.gray, 70), linewidth=2, style=plot.style_line)
plot(use_fib_618 ? fib_618 : na, "Fib 61.8%", color=color.new(color.blue, 70), linewidth=2, style=plot.style_line)

// Plot entry signals
plotshape(long_condition, style=shape.triangleup, location=location.belowbar, color=color.new(color.green, 0), size=size.normal, title="Long Signal")
plotshape(short_condition, style=shape.triangledown, location=location.abovebar, color=color.new(color.red, 0), size=size.normal, title="Short Signal")

// Background color when price is near Fibonacci levels
bgcolor(on_fib_level ? color.new(color.yellow, 95) : na, title="Near Fib Level")
