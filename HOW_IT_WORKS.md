# How The Trading Agent Works - Complete Explanation

## 🕐 Execution Flow Overview

The agent operates in **discrete cycles**, not continuous monitoring. Here's exactly how it works:

### 1. **Timing: Interval-Based Execution**

- **You set an interval** (e.g., `--interval 5m` means every 5 minutes)
- The agent runs a **single decision cycle** every interval
- It is **NOT** listening every second
- It is **NOT** using limit orders waiting for pullbacks
- It **IS** using **snapshot-based decision making**

### 2. **What Happens Each Cycle** (Every 5 minutes with `--interval 5m`)

```
Cycle Start
    ↓
1. Fetch Current Market Data (Snapshot at that moment)
   - Get current prices for all assets (BTC, ETH, SOL, etc.)
   - Fetch technical indicators (RSI, EMA, MACD, ATR) from Binance
   - Get account state (balance, positions, PnL)
   ↓
2. Build Context for AI Agent
   - Package all data into JSON context
   - Include position status (which assets are flat vs have positions)
   - Include market indicators (RSI values, EMA levels, etc.)
   ↓
3. AI Agent Analyzes (LLM Call)
   - AI receives the snapshot data
   - AI analyzes: "RSI is 28 (oversold), EMA20 is above price, MACD turning positive..."
   - AI decides: BUY, SELL, or HOLD for each asset
   ↓
4. Execute Decisions IMMEDIATELY
   - If AI says BUY: Place MARKET order → Fills immediately at current price
   - If AI says SELL: Place MARKET order → Fills immediately at current price
   - Place TP/SL orders right after entry
   ↓
5. Sleep Until Next Interval
   - Wait 5 minutes (or whatever interval you set)
   - Then start cycle again
```

## 🔄 Key Points

### **Market Orders, Not Limit Orders**

- The agent uses **MARKET orders** → **immediate execution** at current price
- **NOT** limit orders waiting for pullbacks
- When the AI decides to buy, it buys **RIGHT NOW** at whatever price is available

### **Snapshot-Based Analysis**

- Data is gathered **once per cycle** (every 5 minutes in your case)
- The AI sees a "snapshot" of the market at that moment
- It makes decisions based on that snapshot
- If conditions are met **during that snapshot** → trade happens
- If conditions are met **between cycles** → you miss it (until next cycle)

### **Example Timeline**

```
Time: 10:00 AM (Cycle 1)
  → Fetch data: BTC=$100, RSI=25, EMA=95
  → AI: "RSI oversold, price below EMA, buy signal!"
  → Execute: MARKET BUY @ $100
  → Position opened
  → Wait 5 minutes

Time: 10:05 AM (Cycle 2)
  → Fetch data: BTC=$102, RSI=35, Position exists
  → AI: "Position in profit, hold"
  → No new trades
  → Wait 5 minutes

Time: 10:10 AM (Cycle 3)
  → Fetch data: BTC=$105, Hit TP price
  → TP order triggers → Position closes
  → AI sees no position → Looks for new entry
  → Wait 5 minutes
```

## 🎯 Entry Logic

### When You Have NO Position (Flat):

1. Agent checks all assets at cycle start
2. For each flat asset, AI analyzes:
   - RSI levels (oversold/overbought?)
   - EMA alignment (price above/below moving averages?)
   - MACD signals (bullish/bearish crossover?)
   - Volume, ATR, etc.
3. AI scores the opportunity
4. If **strong signal** → AI allocates capital → **MARKET order executes**

### When You HAVE a Position:

1. Agent checks exit conditions
2. Monitors TP/SL levels (placed as trigger orders on exchange)
3. Checks invalidation conditions from exit_plan
4. If conditions met → Exit position → Look for next opportunity

## 📊 How Technical Analysis Works

### Data Collection (Each Cycle):

```python
# For each asset (BTC, ETH, SOL, etc.):
1. Fetch current price from Binance
2. Calculate EMA(20) from last 20 candles
3. Calculate RSI(7) and RSI(14)
4. Calculate MACD
5. Calculate ATR for stop placement
6. Get funding rate, open interest
7. Package all into context
```

### AI Analysis:

```
AI receives:
- BTC: price=$100k, RSI=28, EMA20=$95k, MACD=positive, ATR=$2k
- ETH: price=$4k, RSI=45, EMA20=$4.1k, MACD=negative, ATR=$50

AI reasons:
"BTC: RSI 28 is oversold (<30), price above EMA20, MACD positive = BUY signal!
 ETH: RSI 45 is neutral, price below EMA20 = no clear signal, HOLD"

AI outputs:
- BTC: action="buy", allocation_usd=1000, tp_price=105000, sl_price=97000
- ETH: action="hold"
```

## ⚠️ Important Limitations

### 1. **Missed Opportunities Between Cycles**

- If price hits your entry criteria at 10:02 AM, but cycle runs at 10:00 and 10:05
- You'll miss it until 10:05
- **Solution**: Use shorter intervals (5m is good, 1m is aggressive)

### 2. **No Real-Time Monitoring**

- TP/SL orders are placed on exchange (they monitor continuously)
- But AI decisions only happen every interval
- If you want to exit based on indicator changes, you wait until next cycle

### 3. **Market Orders = Immediate Execution**

- No waiting for better prices
- No limit orders at support/resistance
- Executes immediately when AI decides

## 🛠️ How TP/SL Orders Work

### Take-Profit (TP):

1. When entry fills, TP order is placed on Binance
2. TP is a **trigger order** that monitors continuously (even between cycles)
3. Example: Long position @ $100, TP @ $105
4. If price reaches $105 → TP triggers → Position closes automatically
5. You don't need to wait for next cycle - Binance handles it

### Stop-Loss (SL):

1. Similar to TP - placed as trigger order on Binance
2. Monitors continuously
3. If price hits SL → Position closes immediately
4. Works 24/7, not just during agent cycles

## 🔧 The Bug You Found

### What Was Happening:

1. Entry order placed → Fills immediately (MARKET order)
2. TP/SL orders placed immediately after
3. **Problem**: TP/SL might trigger immediately if:
   - TP price too close to entry (e.g., TP=$0.185, entry=$0.184)
   - Or position size mismatch
   - Or trigger logic error

### The Fix:

1. Added delay between entry and TP/SL (wait for position to exist)
2. Verify position exists before placing TP/SL
3. Validate TP/SL prices are in correct direction
4. Use actual position size instead of calculated amount
5. Added fallback to use `closePosition=true` if quantity issues

## 📈 Optimization Tips

1. **Shorter Intervals** = More opportunities, more trades
   - 5m: Good balance
   - 1m: Very aggressive, many API calls
   - 15m+: Might miss quick moves

2. **Leverage**: Currently 10x default
   - Higher = More risk/reward
   - Lower = Safer

3. **TP/SL Distance**: 
   - Make sure TP is far enough from entry (e.g., 2-5%)
   - Make sure SL is far enough from entry (e.g., 1-2%)
   - Use ATR-based calculations (already in prompts)

## 🎯 Summary

**How it actually works:**
- ✅ **Interval-based**: Checks every X minutes (you set this)
- ✅ **Market orders**: Immediate execution when AI decides
- ✅ **Snapshot analysis**: One-time data fetch per cycle
- ✅ **TP/SL on exchange**: Monitor continuously (handled by Binance)
- ❌ **NOT** real-time monitoring every second
- ❌ **NOT** limit orders waiting for prices
- ❌ **NOT** continuous indicator streaming

**Think of it like:**
- A trader who checks the market every 5 minutes
- Makes decisions based on what they see at that moment
- Executes trades immediately
- Sets TP/SL and lets exchange monitor them
- Comes back in 5 minutes to check again

This is why shorter intervals (5m) catch more opportunities than longer ones (1h).

