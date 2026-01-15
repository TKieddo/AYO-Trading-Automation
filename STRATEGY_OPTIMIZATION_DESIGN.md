# Strategy Optimization System - Design

## 🎯 Concept

After backtesting a strategy, if results aren't meeting profitability targets, the AI can automatically optimize strategy parameters until:
- Target profitability is reached (60%, 70%, 80%, etc.)
- OR the AI determines further optimization isn't worth it
- OR maximum optimization iterations are reached

---

## 🔧 How It Works

### 1. **Optimization Trigger**
- User sets target profitability (e.g., 70%)
- User clicks "Optimize Strategy"
- System analyzes current backtest results
- If below target → Start optimization

### 2. **Parameter Identification**
- AI identifies which parameters can be optimized:
  - Indicator periods (RSI period, EMA periods, etc.)
  - Entry/exit thresholds
  - Stop loss / Take profit percentages
  - Position sizing rules
  - Timeframe preferences

### 3. **Optimization Methods**

#### Method A: LLM-Guided Optimization (Recommended)
- AI analyzes strategy code
- AI suggests parameter changes based on:
  - Current performance
  - Market conditions
  - Strategy logic
- Test suggested changes
- Iterate until target met

#### Method B: Grid Search
- Define parameter ranges
- Test all combinations
- Find best performing set

#### Method C: Bayesian Optimization
- Use ML to find optimal parameters
- More efficient than grid search
- Requires optimization library (scikit-optimize)

### 4. **Optimization Loop**
```
1. Analyze current strategy performance
2. Identify parameters to optimize
3. Generate parameter variations
4. Backtest each variation
5. Compare results
6. If target met → Stop, save best version
7. If not met → Generate new variations, repeat
8. If max iterations → Stop, return best found
```

---

## 📊 UI Components

### Optimization Settings Dialog
- Target profitability slider (60%, 70%, 80%, 90%)
- Max optimization iterations
- Parameters to optimize (checkboxes)
- Optimization method selection
- "Start Optimization" button

### Optimization Progress
- Current iteration
- Best profitability found so far
- Parameters being tested
- Progress bar
- "Stop Optimization" button

### Optimization Results
- Comparison table (original vs optimized)
- Parameter changes summary
- Performance improvement metrics
- "Accept Optimization" / "Reject" buttons

---

## 🗄️ Database Schema

### New Table: `strategy_optimizations`
```sql
CREATE TABLE strategy_optimizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    strategy_id UUID REFERENCES strategies(id),
    original_backtest_id UUID REFERENCES backtest_results(id),
    target_profitability DECIMAL(5, 2),
    status VARCHAR(50), -- 'running', 'completed', 'stopped', 'failed'
    best_profitability DECIMAL(10, 2),
    iterations_completed INTEGER,
    max_iterations INTEGER,
    parameters_tested JSONB,
    best_parameters JSONB,
    optimization_method VARCHAR(50),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 💻 Implementation

### 1. Optimization Engine (`src/backtesting/optimizer.py`)

```python
class StrategyOptimizer:
    def __init__(self, strategy, target_profitability, max_iterations=50):
        self.strategy = strategy
        self.target = target_profitability
        self.max_iterations = max_iterations
        self.best_result = None
        self.best_params = None
    
    def optimize(self):
        """Main optimization loop"""
        for iteration in range(self.max_iterations):
            # Generate parameter variations
            params = self.generate_parameters()
            
            # Test parameters
            result = self.backtest_with_params(params)
            
            # Update best if better
            if result.profitability > self.best_result.profitability:
                self.best_result = result
                self.best_params = params
            
            # Check if target met
            if result.profitability >= self.target:
                return self.best_result
            
            # AI decides if worth continuing
            if not self.should_continue(result, iteration):
                break
        
        return self.best_result
```

### 2. LLM-Guided Optimization

```python
class LLMOptimizer:
    def suggest_parameters(self, current_params, current_performance):
        """Use LLM to suggest parameter improvements"""
        prompt = f"""
        Current strategy performance:
        - Profitability: {current_performance.profitability}%
        - Sharpe Ratio: {current_performance.sharpe}
        - Max Drawdown: {current_performance.max_drawdown}%
        
        Current parameters:
        {json.dumps(current_params)}
        
        Suggest 3-5 parameter changes that could improve profitability.
        Focus on parameters that directly affect entry/exit timing.
        
        Return JSON with suggested changes and reasoning.
        """
        # Call LLM
        suggestions = self.llm.generate(prompt)
        return suggestions
```

### 3. Parameter Variation Generator

```python
def generate_variations(base_params, method='llm_guided'):
    """Generate parameter variations to test"""
    if method == 'llm_guided':
        # Use LLM to suggest smart variations
        return llm_suggest_variations(base_params)
    elif method == 'grid_search':
        # Generate all combinations
        return grid_search_variations(base_params)
    elif method == 'random':
        # Random variations within ranges
        return random_variations(base_params)
```

---

## 🎨 UI Flow

### Step 1: View Backtest Results
- User sees backtest result with 45% profitability
- Button: "Optimize Strategy" appears

### Step 2: Optimization Dialog
```
┌─────────────────────────────────────┐
│ Optimize Strategy                    │
├─────────────────────────────────────┤
│ Target Profitability: [70%] ─────── │
│ Max Iterations: [50]                │
│                                     │
│ Parameters to Optimize:             │
│ ☑ RSI Period (7-21)                │
│ ☑ EMA Fast Period (10-30)           │
│ ☑ EMA Slow Period (30-100)          │
│ ☑ Take Profit % (3-10%)             │
│ ☑ Stop Loss % (1-5%)                │
│                                     │
│ Optimization Method:                │
│ ○ LLM-Guided (Recommended)          │
│ ○ Grid Search                       │
│ ○ Random Search                     │
│                                     │
│ [Cancel]  [Start Optimization]      │
└─────────────────────────────────────┘
```

### Step 3: Optimization Progress
```
┌─────────────────────────────────────┐
│ Optimizing Strategy...              │
├─────────────────────────────────────┤
│ Iteration: 12 / 50                  │
│ ████████░░░░░░░░░░ 24%              │
│                                     │
│ Best Profitability Found: 58.3%    │
│ Target: 70%                         │
│                                     │
│ Current Test:                       │
│ - RSI Period: 14                    │
│ - EMA Fast: 20                      │
│ - EMA Slow: 50                      │
│                                     │
│ [Stop Optimization]                │
└─────────────────────────────────────┘
```

### Step 4: Optimization Complete
```
┌─────────────────────────────────────┐
│ Optimization Complete!              │
├─────────────────────────────────────┤
│ Original: 45.2% profitability       │
│ Optimized: 72.1% profitability      │
│ Improvement: +26.9%                 │
│                                     │
│ Parameter Changes:                  │
│ • RSI Period: 7 → 14                │
│ • EMA Fast: 10 → 20                │
│ • Take Profit: 5% → 7%              │
│                                     │
│ [View Full Results] [Accept] [Reject]│
└─────────────────────────────────────┘
```

---

## 🔄 Integration Points

### 1. Backtest Dashboard
- Add "Optimize" button to each backtest result
- Show optimization status badge
- Link to optimization results

### 2. Strategy Library
- Show "Optimized" badge for optimized strategies
- Show optimization history
- Compare original vs optimized versions

### 3. API Endpoints
- `POST /api/trading/optimize` - Start optimization
- `GET /api/trading/optimize/:id` - Get optimization status
- `POST /api/trading/optimize/:id/stop` - Stop optimization
- `GET /api/trading/optimize/:id/results` - Get results

---

## 🎯 Optimization Strategies

### Smart Optimization (LLM-Guided)
1. **Analyze Weak Points**: AI identifies what's causing low profitability
2. **Targeted Changes**: Focus on parameters that matter most
3. **Learning**: AI learns from each iteration
4. **Early Stopping**: AI can stop if no improvement

### Example Optimization Flow:
```
Iteration 1: RSI 7 → 10, Profitability: 48% (+2.8%)
Iteration 2: RSI 10 → 14, EMA Fast 10 → 15, Profitability: 52% (+4%)
Iteration 3: RSI 14, EMA Fast 15 → 20, TP 5% → 6%, Profitability: 58% (+6%)
...
Iteration 12: RSI 14, EMA Fast 20, EMA Slow 50, TP 7%, Profitability: 72% ✅
```

---

## 📈 Metrics to Track

- **Profitability Improvement**: Original vs Optimized
- **Iterations to Target**: How many iterations to reach target
- **Best Parameters Found**: What worked best
- **Optimization Time**: How long it took
- **Parameter Sensitivity**: Which parameters matter most

---

## 🚀 Implementation Priority

1. **Phase 1**: Basic optimization (grid search)
2. **Phase 2**: LLM-guided optimization
3. **Phase 3**: Advanced optimization (Bayesian, genetic algorithms)
4. **Phase 4**: Multi-objective optimization (profitability + Sharpe + drawdown)

---

## 💡 Smart Features

### Auto-Stop Conditions
- Target reached → Stop
- No improvement for 10 iterations → Stop
- AI determines not worth continuing → Stop
- Max iterations reached → Stop

### Optimization History
- Track all optimization attempts
- Learn from past optimizations
- Suggest starting parameters based on similar strategies

### Parameter Constraints
- Define min/max ranges for each parameter
- Prevent unrealistic values
- Ensure strategy logic remains intact

---

This system will make your strategies much more powerful by automatically finding the best parameters! 🚀

