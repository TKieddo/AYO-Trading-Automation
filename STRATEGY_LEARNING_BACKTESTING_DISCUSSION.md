# Strategy Learning & Backtesting - Discussion & Requirements

## Overview

This document outlines what would be needed to add **strategy learning from videos** and **backtesting capabilities** to your trading agent, based on analysis of the reference project and best practices.

---

## 🎯 What You Want to Achieve

1. **Video Strategy Learning**: Provide a YouTube/video link → AI extracts the trading strategy
2. **Strategy Implementation**: AI converts the strategy into executable code
3. **Backtesting**: Test the strategy on historical data
4. **Integration**: Use successful strategies in live trading

---

## 📋 Components Needed

### 1. **Video Processing & Strategy Extraction**

#### What You Need:
- **Video Download**: Download video from YouTube/URL
- **Transcription**: Convert speech to text (whisper, OpenAI Whisper API, or similar)
- **Strategy Extraction**: Use LLM to analyze transcript and extract:
  - Entry conditions (e.g., "RSI < 30 AND price crosses above EMA20")
  - Exit conditions (e.g., "Take profit at 5% OR stop loss at 3%")
  - Position sizing rules
  - Timeframe preferences
  - Risk management rules

#### Technologies:
- **YouTube Download**: `yt-dlp` or `pytube`
- **Transcription**: 
  - OpenAI Whisper API (paid, accurate)
  - `whisper` library (free, local)
  - AssemblyAI (paid, good accuracy)
- **Strategy Extraction**: Your existing DeepSeek LLM with a specialized prompt

#### Example Flow:
```
Video URL → Download → Transcribe → LLM Analysis → Strategy JSON
```

#### Strategy JSON Format:
```json
{
  "name": "RSI Oversold Bounce Strategy",
  "description": "Buy when RSI < 30 and price bounces off support",
  "entry_conditions": {
    "rsi": {"operator": "<", "value": 30},
    "price_action": "bounce_off_support",
    "timeframe": "15m"
  },
  "exit_conditions": {
    "take_profit_percent": 5.0,
    "stop_loss_percent": 3.0,
    "trailing_stop": false
  },
  "position_sizing": "fixed_percentage",
  "risk_per_trade": 2.0
}
```

---

### 2. **Strategy Code Generation**

#### What You Need:
- **Code Generator**: LLM that converts strategy JSON → Python code
- **Strategy Base Class**: Similar to reference project's `BaseStrategy`
- **Template System**: Pre-built templates for common patterns

#### Strategy Base Class (from reference):
```python
class BaseStrategy:
    def __init__(self, name: str):
        self.name = name
    
    def generate_signals(self) -> dict:
        """
        Returns:
            {
                'token': str,
                'signal': float (0-1),
                'direction': 'BUY' | 'SELL' | 'NEUTRAL',
                'metadata': dict
            }
        """
        raise NotImplementedError
```

#### Code Generation Prompt:
```
You are a trading strategy code generator. Convert this strategy into Python code:

Strategy: {strategy_json}

Requirements:
1. Inherit from BaseStrategy
2. Implement generate_signals() method
3. Use technical indicators from TechnicalAnalysisClient
4. Return proper signal format
5. Include error handling
```

---

### 3. **Backtesting Engine**

#### What You Need:

##### A. Historical Data Collection
- **OHLCV Data**: Candlestick data (open, high, low, close, volume)
- **Timeframes**: Support multiple timeframes (1m, 5m, 15m, 1h, 4h, 1d)
- **Data Sources**:
  - Binance API (free, good coverage)
  - Your existing exchange APIs (Aster/Hyperliquid)
  - Historical data storage (CSV, database, or Parquet)

##### B. Backtesting Framework
Two approaches:

**Option 1: Simple Event-Based (Easier)**
- Simulate trades step-by-step through historical data
- Track positions, PnL, drawdowns
- Good for: Simple strategies, quick testing

**Option 2: Vectorized (Faster, More Complex)**
- Use pandas/numpy for vectorized operations
- Much faster for large datasets
- Good for: Complex strategies, large backtests

##### C. Backtesting Metrics
Calculate:
- **Total Return %**: (End Value - Start Value) / Start Value * 100
- **Sharpe Ratio**: Risk-adjusted returns
- **Sortino Ratio**: Downside risk-adjusted returns
- **Max Drawdown %**: Largest peak-to-trough decline
- **Win Rate**: % of profitable trades
- **Profit Factor**: Gross Profit / Gross Loss
- **Expectancy**: Average profit per trade
- **Number of Trades**: Total trades executed
- **Average Hold Time**: How long positions are held

##### D. Backtesting Flow
```
1. Load historical data (OHLCV)
2. Calculate indicators (RSI, EMA, MACD, etc.)
3. For each candle:
   a. Check entry conditions
   b. If entry → Open position, record entry price
   c. Check exit conditions
   d. If exit → Close position, record PnL
4. Calculate metrics
5. Generate report
```

#### Technologies:
- **Data Storage**: 
  - CSV files (simple)
  - SQLite/PostgreSQL (better for large datasets)
  - Parquet files (efficient)
- **Backtesting Library**:
  - `backtrader` (popular, feature-rich)
  - `backtesting.py` (simple, clean API)
  - Custom implementation (full control)

#### Example Backtest Output:
```json
{
  "strategy_name": "RSI Oversold Bounce",
  "start_date": "2024-01-01",
  "end_date": "2024-12-31",
  "initial_capital": 300.0,
  "final_capital": 450.0,
  "total_return": 50.0,
  "buy_and_hold_return": 30.0,
  "sharpe_ratio": 1.85,
  "sortino_ratio": 2.10,
  "max_drawdown": -15.5,
  "win_rate": 58.5,
  "profit_factor": 1.75,
  "total_trades": 127,
  "avg_hold_time_hours": 4.5
}
```

---

### 4. **Database Schema for Strategies**

#### Tables Needed:

**strategies**
```sql
CREATE TABLE strategies (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    source_video_url TEXT,
    source_transcript TEXT,
    strategy_json JSONB,  -- Extracted strategy rules
    code_file_path TEXT,   -- Path to generated Python file
    status VARCHAR(50),    -- 'extracted', 'generated', 'backtested', 'active'
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);
```

**backtest_results**
```sql
CREATE TABLE backtest_results (
    id UUID PRIMARY KEY,
    strategy_id UUID REFERENCES strategies(id),
    start_date DATE,
    end_date DATE,
    initial_capital DECIMAL(20, 2),
    final_capital DECIMAL(20, 2),
    total_return DECIMAL(10, 2),
    sharpe_ratio DECIMAL(10, 4),
    sortino_ratio DECIMAL(10, 4),
    max_drawdown DECIMAL(10, 2),
    win_rate DECIMAL(5, 2),
    total_trades INTEGER,
    metrics_json JSONB,  -- Full metrics
    created_at TIMESTAMPTZ
);
```

**strategy_performance**
```sql
CREATE TABLE strategy_performance (
    id UUID PRIMARY KEY,
    strategy_id UUID REFERENCES strategies(id),
    date DATE,
    daily_return DECIMAL(10, 2),
    cumulative_return DECIMAL(10, 2),
    drawdown DECIMAL(10, 2),
    trades_count INTEGER,
    created_at TIMESTAMPTZ
);
```

---

### 5. **UI Components (Dashboard)**

#### New Pages/Sections:

**A. Strategy Learning Page**
- Input: Video URL field
- Process: "Extract Strategy" button
- Output: 
  - Extracted strategy summary
  - Strategy rules (JSON view)
  - "Generate Code" button
  - "Backtest" button

**B. Strategy Library Page**
- List of all strategies
- Status badges (extracted, generated, backtested, active)
- Actions: View, Edit, Backtest, Activate, Delete

**C. Backtest Dashboard**
- Similar to reference project's backtest dashboard
- Table of backtest results
- Filters: Date range, strategy, return threshold
- Charts: Equity curve, drawdown, trade distribution
- Export: CSV, PDF reports

**D. Strategy Comparison**
- Compare multiple strategies side-by-side
- Visual charts comparing returns, drawdowns
- Best strategy recommendations

---

### 6. **Integration with Live Trading**

#### How It Works:
1. User backtests strategy → Good results
2. User activates strategy in dashboard
3. Strategy code is loaded into trading agent
4. Agent uses strategy signals alongside LLM decisions
5. Can combine: Strategy signals + LLM validation (like reference project)

#### Integration Points:
- **Strategy Agent**: Similar to reference project's `StrategyAgent`
- **Signal Combination**: Merge strategy signals with LLM decisions
- **Risk Management**: Apply your existing position sizing rules

---

## 🔧 Technical Architecture

### File Structure:
```
src/
├── strategies/
│   ├── base_strategy.py          # Base class
│   ├── generated/                # AI-generated strategies
│   │   └── strategy_*.py
│   └── custom/                   # Manual strategies
│       └── example_strategy.py
├── backtesting/
│   ├── engine.py                 # Main backtesting engine
│   ├── data_loader.py           # Load historical data
│   ├── metrics.py                # Calculate metrics
│   └── report.py                # Generate reports
├── strategy_learning/
│   ├── video_processor.py       # Download & transcribe
│   ├── strategy_extractor.py    # Extract strategy from transcript
│   └── code_generator.py        # Generate Python code
└── agents/
    └── strategy_agent.py         # Execute strategies in live trading
```

---

## 📊 Backtesting Workflow Example

### Step-by-Step:

1. **User provides video URL**
   ```
   https://www.youtube.com/watch?v=abc123
   ```

2. **System processes video**
   ```
   Download → Transcribe → Extract Strategy
   ```

3. **Strategy extracted**
   ```json
   {
     "name": "Golden Cross Strategy",
     "entry": "EMA50 crosses above EMA200",
     "exit": "Take profit 10% or stop loss 5%"
   }
   ```

4. **Code generated**
   ```python
   class GoldenCrossStrategy(BaseStrategy):
       def generate_signals(self):
           # Check EMA50 > EMA200
           # Return BUY signal
   ```

5. **Backtest runs**
   ```
   Load 1 year of BTC data
   Simulate trades
   Calculate metrics
   ```

6. **Results displayed**
   ```
   Total Return: 45%
   Sharpe Ratio: 1.8
   Max Drawdown: -12%
   Win Rate: 62%
   ```

7. **User activates strategy**
   ```
   Strategy → Active
   Agent uses it in live trading
   ```

---

## 🎯 What Makes This Better Than Reference Project

### Improvements:

1. **Video Integration**: Reference project doesn't extract from videos
2. **Automated Code Generation**: AI generates strategy code automatically
3. **Better UI**: Integrated into your existing dashboard
4. **Database Persistence**: All strategies and results stored in Supabase
5. **Seamless Integration**: Strategies work with your existing position sizing
6. **Multi-Strategy Support**: Run multiple strategies simultaneously

---

## 🚀 Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Strategy base class
- [ ] Historical data collection
- [ ] Basic backtesting engine
- [ ] Database schema

### Phase 2: Strategy Learning (Week 3-4)
- [ ] Video download & transcription
- [ ] Strategy extraction from transcripts
- [ ] Code generation

### Phase 3: Backtesting (Week 5-6)
- [ ] Full backtesting engine
- [ ] Metrics calculation
- [ ] Report generation
- [ ] Backtest dashboard UI

### Phase 4: Integration (Week 7-8)
- [ ] Strategy agent for live trading
- [ ] Signal combination logic
- [ ] Performance monitoring

---

## 💡 Key Considerations

### Challenges:

1. **Video Quality**: Poor audio = bad transcription
2. **Strategy Ambiguity**: Videos may not have clear rules
3. **Overfitting**: Strategies that work in backtest may fail live
4. **Data Quality**: Need clean, accurate historical data
5. **Execution Slippage**: Backtests assume perfect execution (not realistic)

### Solutions:

1. **Multiple Transcription Services**: Fallback options
2. **LLM Validation**: Ask clarifying questions if strategy unclear
3. **Walk-Forward Analysis**: Test on out-of-sample data
4. **Data Validation**: Check for gaps, errors in historical data
5. **Slippage Modeling**: Add realistic slippage to backtests

---

## 📚 Recommended Libraries

### Python:
- **Backtesting**: `backtesting.py` (simple) or `backtrader` (advanced)
- **Data**: `pandas`, `numpy`
- **Video**: `yt-dlp`, `pytube`
- **Transcription**: `openai-whisper`, `whisper` (local)
- **Charts**: `plotly`, `matplotlib`
- **Database**: `supabase-py` (already using)

### Optional:
- **Strategy Optimization**: `scipy.optimize` for parameter tuning
- **Walk-Forward**: Custom implementation
- **Monte Carlo**: `numpy.random` for simulation

---

## 🎓 Learning Resources

1. **Backtesting Best Practices**: 
   - Avoid look-ahead bias
   - Use walk-forward analysis
   - Test on multiple timeframes
   - Consider transaction costs

2. **Strategy Development**:
   - Start simple, add complexity gradually
   - Test edge cases
   - Document assumptions
   - Version control strategies

---

## ❓ Questions to Consider

1. **How much historical data?** (1 year? 5 years?)
2. **Which assets?** (BTC only? All your trading pairs?)
3. **Timeframe?** (Same as live trading interval?)
4. **Transaction costs?** (Include fees in backtests?)
5. **Slippage?** (Model realistic execution prices?)
6. **Strategy activation?** (Manual approval? Auto if metrics pass threshold?)

---

## 🎯 Next Steps (When Ready)

1. **Start with backtesting engine** (most critical)
2. **Add historical data collection**
3. **Build strategy base class**
4. **Then add video learning** (can work without it initially)
5. **Finally integrate with live trading**

---

## 💬 Discussion Points

**What do you think?**
- Does this architecture make sense?
- Any features from reference project you want to keep?
- Any concerns about complexity?
- Should we start with backtesting first, or video learning?

Let me know your thoughts and we can refine the approach before implementation! 🚀

