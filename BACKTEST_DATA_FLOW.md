# Backtest Data Flow & AI Integration

## 📊 Where Backtest Data Comes From

### 1. **Historical Data Source: Binance API** (Real Data)
- **File**: `src/backtesting/data_loader.py`
- **Method**: `load_from_binance()`
- **Data**: Real OHLCV (Open, High, Low, Close, Volume) candles
- **Timeframes**: 1m, 5m, 15m, 1h, 4h, 1d
- **Date Range**: Any range you specify (e.g., last 3 months, 1 year, etc.)

### 2. **How It Works**:
```python
# In data_loader.py
def load_from_binance(symbol, interval, start_date, end_date):
    # Calls Binance public API
    # Fetches real historical candlestick data
    # Returns DataFrame with OHLCV data
```

**Example**:
- Symbol: `BTCUSDT`
- Timeframe: `5m` (5-minute candles)
- Start: `2024-01-01`
- End: `2024-12-31`
- **Result**: Real historical price data from Binance

---

## 🔧 Technical Indicators (TA-Lib)

### You Already Have TA-Lib! ✅
- **File**: `src/indicators/technical_analysis_client.py`
- **Library**: `pandas-ta` (TA-Lib compatible)
- **Used By**: Your AI agent for real-time trading decisions

### Indicators Calculated:
- **RSI** (Relative Strength Index)
- **EMA** (Exponential Moving Average)
- **MACD** (Moving Average Convergence Divergence)
- **ATR** (Average True Range)
- **Bollinger Bands**

### How It's Used in Backtesting:
```python
# In backtesting/engine.py
indicators = self._calculate_indicators(data)
# Uses your existing TechnicalAnalysisClient
# Calculates RSI, EMA, MACD, etc. for each candle
```

---

## 🤖 Where AI Comes In

### 1. **Strategy Extraction** (Video → Strategy)
- **Component**: `StrategyLearning.tsx`
- **API**: `/api/trading/learn-strategy`
- **AI Role**: 
  - Transcribes video
  - Extracts trading rules from transcript
  - Generates strategy code

### 2. **Strategy Execution** (Backtesting)
- **File**: `src/backtesting/engine.py`
- **AI Role**: 
  - Strategy uses AI-generated code
  - AI logic determines entry/exit signals
  - AI analyzes indicators to make decisions

### 3. **Optimization** (Improving Strategy)
- **File**: `src/backtesting/optimizer.py`
- **AI Role**:
  - LLM analyzes backtest results
  - Suggests parameter improvements
  - Tests variations until target met

### 4. **Live Trading** (Your Main Agent)
- **File**: `src/main.py` + `src/agent/decision_maker.py`
- **AI Role**: 
  - Uses same TA-Lib indicators
  - Makes trading decisions
  - Can incorporate backtested strategies

---

## 🔄 Complete Data Flow

### Backtest Execution Flow:

```
1. User clicks "Backtest" in Strategy Library
   ↓
2. BacktestDialog opens
   ↓
3. User sets parameters:
   - Symbol: BTCUSDT
   - Timeframe: 5m
   - Date Range: Last 3 months
   - Initial Capital: $300
   ↓
4. API: POST /api/trading/backtest/run
   ↓
5. Python Backtest Engine:
   a. Load historical data from Binance (REAL DATA)
      - Uses data_loader.py
      - Fetches OHLCV candles
   b. Calculate indicators using TA-Lib
      - Uses TechnicalAnalysisClient (same as your AI agent!)
      - RSI, EMA, MACD, etc.
   c. Run strategy through data
      - For each candle:
        - Calculate indicators
        - Strategy.generate_signals() (AI logic)
        - Check entry/exit conditions
        - Simulate trades
   d. Calculate metrics
      - Total return, Sharpe, drawdown, etc.
   ↓
6. Save results to database
   ↓
7. Display in Backtest Dashboard
```

---

## 📈 Real Data vs Mock Data

### Currently:
- **Mock Data**: API returns placeholder results for testing UI
- **Real Data Ready**: Code is set up to use Binance API

### To Use Real Data:
1. **Connect Python Backtest Engine**:
   - Create API bridge (FastAPI or subprocess)
   - Call `src/backtesting/engine.py`
   - Pass parameters from Next.js API

2. **Data Flow**:
   ```
   Next.js API → Python Script → Binance API → Real OHLCV Data
   → Calculate Indicators (TA-Lib) → Run Strategy → Results
   ```

---

## 🎯 AI Integration Points

### 1. **Strategy Code Generation**
- AI extracts strategy from video
- AI generates Python code
- Code inherits from `BaseStrategy`
- Uses same indicators as your trading agent

### 2. **Signal Generation**
- Strategy uses AI logic to generate signals
- Same indicator calculations as live trading
- Consistent decision-making

### 3. **Optimization**
- AI analyzes backtest performance
- AI suggests parameter changes
- AI decides when to stop optimizing

### 4. **Live Trading Integration**
- Backtested strategies can be activated
- Your main AI agent can use them
- Combines with LLM decisions

---

## 🔧 Current Implementation Status

### ✅ Ready:
- Data loader (Binance integration)
- TA-Lib indicators (your existing client)
- Backtest engine structure
- Metrics calculator
- Database schema

### 🚧 Needs Connection:
- Python backtest engine → Next.js API
- Real backtest execution (currently mock)
- Strategy code loading

### 📝 Next Steps:
1. Create Python API endpoint or subprocess bridge
2. Load strategy code dynamically
3. Execute real backtests
4. Return real results

---

## 💡 Key Points

1. **Real Data**: Uses Binance API for historical OHLCV (same as your live trading)
2. **Same Indicators**: Uses your existing TA-Lib setup (TechnicalAnalysisClient)
3. **AI Everywhere**: AI extracts strategy, generates code, optimizes, and can use in live trading
4. **Consistent**: Same indicator calculations as your main trading agent

The backtest uses **REAL historical data from Binance** and your **existing TA-Lib setup** - it's just not connected yet! 🚀

