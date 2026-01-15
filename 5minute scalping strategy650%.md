//@version=5
strategy("$100 Crypto Scalper", overlay=true, initial_capital=100, currency=currency.USDT, default_qty_type=strategy.cash, default_qty_value=10)

// —————— Inputs —————— 
riskPerTrade = input.float(10.0, "Risk per Trade ($)", minval=1.0, step=0.5)  // Set risk per trade to $10
tpPercent = input.float(1.5, "Take-Profit (%)", step=0.1) / 100
slPercent = input.float(0.5, "Stop-Loss (%)", step=0.1) / 100

// —————— Indicators —————— 
ema5 = ta.ema(close, 5)
ema20 = ta.ema(close, 20)
rsi = ta.rsi(close, 10)
volAvg = ta.sma(volume, 20)
volumeSurge = volume > 1.5 * volAvg

// —————— Conditions —————— 
longCondition = ta.crossover(ema5, ema20) and rsi > 55 and volumeSurge
shortCondition = ta.crossunder(ema5, ema20) and rsi < 45 and volumeSurge

// —————— Position Sizing ——————
// Calculate position size based on fixed risk amount per trade
// Position size = (Risk per trade) / (Dollar risk per trade per contract) = (Risk in $) / (Stop loss in $)
positionSize = riskPerTrade / (slPercent * close)

// —————— Execute Trades —————— 
if (longCondition)
    strategy.entry("Long", strategy.long, qty=positionSize)
    strategy.exit("Exit Long", "Long", 
      limit=close * (1 + tpPercent), 
      stop=close * (1 - slPercent), 
      trail_points=close * tpPercent > 0 ? close * tpPercent / 2 : na, 
      trail_offset=close * tpPercent / 2)

if (shortCondition)
    strategy.entry("Short", strategy.short, qty=positionSize)
    strategy.exit("Exit Short", "Short", 
      limit=close * (1 - tpPercent), 
      stop=close * (1 + slPercent), 
      trail_points=close * tpPercent > 0 ? close * tpPercent / 2 : na, 
      trail_offset=close * tpPercent / 2)
