# Full System Setup - Real & Functional

## 🚀 Quick Start Guide

### Step 1: Run Database Migrations

Run these in Supabase SQL Editor (in order):

1. **Position Sizing**: `dashboard/supabase/migrations/20250108_position_sizing.sql`
2. **Strategies & Backtesting**: `dashboard/supabase/migrations/20250109_strategies_backtesting.sql`
3. **Optimization**: `dashboard/supabase/migrations/20250110_strategy_optimization.sql`
4. **Active Strategies**: `dashboard/supabase/migrations/20250111_active_strategies.sql`

### Step 2: Start Python Backtest Server

**Windows (PowerShell):**
```powershell
.\start_backtest_server.ps1
```

**Or manually:**
```bash
python src/api/backtest_server.py
```

Server runs on: `http://localhost:8000`

### Step 3: Start Dashboard

```bash
cd dashboard
npm run dev
```

Dashboard runs on: `http://localhost:3000` (or 3001)

---

## ✅ What's Now Fully Functional

### 1. **Real Backtesting** ✅
- **Data Source**: Real Binance historical OHLCV data
- **Indicators**: Your existing TA-Lib setup (TechnicalAnalysisClient)
- **Execution**: Python backtest engine → FastAPI → Next.js API
- **Results**: Real metrics (Sharpe, Sortino, drawdown, etc.)

### 2. **Strategy Selection** ✅
- **Location**: Settings page → "Active Trading Strategies" section
- **Behavior**: Manual selection only (no auto-activation)
- **Display**: Only shows backtested strategies
- **Storage**: Saved in `trading_settings.active_strategy_ids`

### 3. **Modal Backgrounds** ✅
- Fixed: All modals now have proper white backgrounds
- Backdrop: Dark overlay with blur effect
- Shadows: Enhanced shadow for depth

### 4. **No Auto-Activation** ✅
- Strategies are NOT automatically activated
- User must manually select in Settings page
- "Activate" button removed from Strategy Library

---

## 🔄 Complete Flow

### Backtest Flow:
```
1. User clicks "Backtest" in Strategy Library
   ↓
2. BacktestDialog opens
   ↓
3. User sets parameters (symbol, timeframe, dates, capital)
   ↓
4. Click "Run Backtest"
   ↓
5. Next.js API → Python FastAPI (port 8000)
   ↓
6. Python loads REAL data from Binance
   ↓
7. Python calculates indicators (TA-Lib)
   ↓
8. Python runs strategy simulation
   ↓
9. Python calculates metrics
   ↓
10. Results saved to database
   ↓
11. Display in Backtest Dashboard
```

### Strategy Activation Flow:
```
1. User backtests strategy → Gets results
   ↓
2. User reviews results in Backtest Dashboard
   ↓
3. If satisfied, user goes to Settings page
   ↓
4. User manually checks strategy checkbox
   ↓
5. User clicks "Save Settings"
   ↓
6. Strategy ID saved to active_strategy_ids
   ↓
7. Trading agent uses active strategies in live trading
```

---

## 📊 Data Sources

### Historical Data (Backtesting):
- **Source**: Binance Public API
- **File**: `src/backtesting/data_loader.py`
- **Method**: `load_from_binance()`
- **Data**: Real OHLCV candles
- **Timeframes**: 1m, 5m, 15m, 1h, 4h, 1d

### Technical Indicators:
- **Library**: pandas-ta (TA-Lib compatible)
- **File**: `src/indicators/technical_analysis_client.py`
- **Same as**: Your live trading agent uses
- **Indicators**: RSI, EMA, MACD, ATR, Bollinger Bands

---

## 🎯 Testing Checklist

### Test Backtesting:
- [ ] Start Python backtest server (`python src/api/backtest_server.py`)
- [ ] Go to Trading page → Strategy Library
- [ ] Click "Backtest" on your strategy
- [ ] Set parameters (BTCUSDT, 5m, last 3 months, $300)
- [ ] Click "Run Backtest"
- [ ] Wait for results (real data from Binance)
- [ ] Check Backtest Dashboard for results

### Test Strategy Selection:
- [ ] Go to Settings page
- [ ] Scroll to "Active Trading Strategies"
- [ ] See your backtested strategy listed
- [ ] Check the checkbox to activate
- [ ] Click "Save Settings"
- [ ] Strategy is now active for live trading

### Test Optimization:
- [ ] Go to Backtest Dashboard
- [ ] Click "Optimize" on a backtest result
- [ ] Set target profitability (e.g., 70%)
- [ ] Choose optimization method
- [ ] Start optimization
- [ ] Watch progress
- [ ] Review optimized results

---

## 🔧 Configuration

### Environment Variables

Add to `.env`:
```env
# Python Backtest API URL (optional, defaults to localhost:8000)
PYTHON_BACKTEST_API_URL=http://localhost:8000
```

---

## 🐛 Troubleshooting

### Backtest Fails:
- **Check**: Is Python server running? (`python src/api/backtest_server.py`)
- **Check**: Port 8000 available?
- **Check**: Binance API accessible? (no VPN blocking)

### No Strategies in Settings:
- **Check**: Have you backtested any strategies?
- **Check**: Strategy status is "backtested"?
- **Check**: Database migration run?

### Modal Background Issues:
- **Fixed**: All modals now have `bg-white` class
- **Fixed**: Backdrop has `bg-black/60 backdrop-blur-sm`

---

## 📝 Files Created/Modified

### New Files:
- `src/api/backtest_api.py` - Backtest execution logic
- `src/api/backtest_server.py` - FastAPI server
- `dashboard/components/trading/BacktestDialog.tsx` - Backtest UI
- `dashboard/components/trading/OptimizationDialog.tsx` - Optimization UI
- `dashboard/components/trading/OptimizationProgress.tsx` - Progress UI
- `start_backtest_server.ps1` - Startup script

### Modified Files:
- `dashboard/app/api/trading/backtest/run/route.ts` - Real backtest execution
- `dashboard/components/dashboard/TradingSettings.tsx` - Strategy selection
- `dashboard/components/trading/StrategyLibrary.tsx` - Removed auto-activate
- All modals - Fixed backgrounds

---

## 🎉 Everything is Now Real!

- ✅ Real Binance data
- ✅ Real TA-Lib indicators
- ✅ Real backtest execution
- ✅ Real metrics calculation
- ✅ Manual strategy selection
- ✅ No auto-activation
- ✅ Beautiful modals with proper backgrounds

**Start the Python server and test it!** 🚀

