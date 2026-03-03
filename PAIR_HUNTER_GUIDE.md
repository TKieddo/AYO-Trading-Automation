# 🎯 PAIR HUNTER - Dynamic Trading Pair Discovery

## What It Does

Instead of trading only hardcoded coins (BTC, ETH, SOL), Pair Hunter:
1. **Scans top 50 Binance futures** by volume every 5 cycles (25 min)
2. **Filters out scams** using blacklist + liquidity checks
3. **Scores pairs** by volatility + trend strength + RSI/EMA confluence
4. **Picks top 5-10** best setups for LLM to analyze
5. **Always monitors current positions** + hunts for new ones

**Result:** You always trade the best opportunities, never miss pumps.

---

## 🚀 How to Enable

### Step 1: Add to Railway Environment Variables

```
ENABLE_PAIR_HUNTER=true
PAIR_HUNTER_TOP_N=5
PAIR_HUNTER_REFRESH_INTERVAL=5
PAIR_HUNTER_MIN_VOLATILITY=2.0
```

### Step 2: Optional - Keep Hardcoded Assets as Fallback

```
ASSETS=BTC ETH SOL  # Fallback if Pair Hunter fails
```

### Step 3: Redeploy

```bash
cd C:\Users\tsebi\Downloads\ai-trading-agent-master
npx @railway/cli up
```

---

## 📊 Configuration Options

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_PAIR_HUNTER` | `false` | Enable dynamic pair discovery |
| `PAIR_HUNTER_TOP_N` | `5` | Number of top pairs to analyze |
| `PAIR_HUNTER_REFRESH_INTERVAL` | `5` | Refresh hunt every N cycles (5 cycles × 5 min = 25 min) |
| `PAIR_HUNTER_MIN_VOLATILITY` | `2.0` | Minimum 24h volatility % to consider |

---

## 🎯 Scoring System

Pairs are scored 0-100 based on:

| Factor | Points | Criteria |
|--------|--------|----------|
| **Volatility** | 0-30 | 6% vol = 30 points, sweet spot for scalping |
| **Trend Strength** | 0-30 | Strong uptrend/downtrend = more points |
| **Setup Quality** | 0-40 | RSI extreme + EMA alignment + volatility |

**Blacklist filters out:** SHIB, PEPE, FLOKI, BONK, DOGE, dead projects

**Liquidity filters:**
- Min $10M daily volume
- Min $0.01 price
- Max 0.5% bid-ask spread

---

## 💡 Example Workflow

**Scenario 1: Your Hardcoded Assets Are Dead**
- BTC: Sideways 0.3% move
- ETH: Sideways 0.5% move
- SOL: Sideways 0.4% move

**Pair Hunter Finds:**
- AVAX: Breaking out, 8% volatility, RSI 28 oversold
- LINK: Strong uptrend, 6% volatility, EMA bullish
- MATIC: Reversing, 7% volatility, MACD crossover

**Result:** Bot trades AVAX, LINK, MATIC instead of dead BTC/ETH/SOL

**Scenario 2: Your Position + New Opportunities**
- Current: Long BTC at +4% profit
- Pair Hunter finds: SOL setting up for breakout

**Result:** Bot monitors BTC position + enters SOL new trade

---

## 📈 Benefits vs Hardcoded

| Hardcoded Assets | Pair Hunter |
|------------------|-------------|
| Miss pumps in other coins | Catches ALL setups |
| Trade dead markets when flat | Always finds volatility |
| Manual research needed | Automatic discovery |
| Limited to 3-6 coins | Scans 50+ top pairs |
| Emotional bias ("I like BTC") | Pure data-driven |

---

## ⚠️ Important Notes

1. **Always monitors positions** - Even if hunting, current positions are priority
2. **Max 8 assets analyzed** - Keeps LLM calls fast/cheap
3. **Refreshes every 25 min** - Balances opportunity vs stability
4. **Requires exchange API** - Uses Binance futures data
5. **Fallback to hardcoded** - If hunter fails, uses ASSETS from .env

---

## 🔧 Recommended Settings

**For Active Scalping (Your Setup):**
```
ENABLE_PAIR_HUNTER=true
PAIR_HUNTER_TOP_N=5
PAIR_HUNTER_REFRESH_INTERVAL=3  # Refresh every 15 min (faster)
PAIR_HUNTER_MIN_VOLATILITY=3.0    # Need 3%+ volatility for 7% targets
```

**For Conservative Trading:**
```
ENABLE_PAIR_HUNTER=true
PAIR_HUNTER_TOP_N=3
PAIR_HUNTER_REFRESH_INTERVAL=10   # Refresh every 50 min
PAIR_HUNTER_MIN_VOLATILITY=5.0    # Only high volatility
```

---

## 🚀 NEXT STEPS

1. Add the 4 variables to Railway
2. Redeploy
3. Watch WhatsApp for "🔍 PAIR HUNTER" messages
4. See "🏆 TOP PAIRS DISCOVERED" in logs

**You'll never miss another pump!**
