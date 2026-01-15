-- Strategies and Backtesting Schema
-- Run this in your Supabase SQL editor

-- Strategies table
CREATE TABLE IF NOT EXISTS strategies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    source_video_url TEXT,
    source_transcript TEXT,
    strategy_json JSONB,  -- Extracted strategy rules
    code_file_path TEXT,   -- Path to generated Python file
    status VARCHAR(50) DEFAULT 'extracted' CHECK (status IN ('extracted', 'generated', 'backtested', 'active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT
);

-- Backtest results table
CREATE TABLE IF NOT EXISTS backtest_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,
    strategy_name VARCHAR(255) NOT NULL,  -- Denormalized for easier queries
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    symbol VARCHAR(10) NOT NULL,
    timeframe VARCHAR(10) NOT NULL,  -- e.g., '5m', '15m', '1h'
    initial_capital DECIMAL(20, 2) NOT NULL,
    final_capital DECIMAL(20, 2) NOT NULL,
    total_return DECIMAL(10, 2) NOT NULL,  -- Percentage
    buy_and_hold_return DECIMAL(10, 2),  -- For comparison
    sharpe_ratio DECIMAL(10, 4),
    sortino_ratio DECIMAL(10, 4),
    max_drawdown DECIMAL(10, 2),  -- Percentage
    win_rate DECIMAL(5, 2),  -- Percentage
    profit_factor DECIMAL(10, 4),
    expectancy DECIMAL(10, 2),  -- Average profit per trade
    total_trades INTEGER DEFAULT 0,
    winning_trades INTEGER DEFAULT 0,
    losing_trades INTEGER DEFAULT 0,
    avg_hold_time_hours DECIMAL(10, 2),
    metrics_json JSONB,  -- Full metrics object
    equity_curve JSONB,  -- Array of {date, value} points
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Strategy performance tracking (for live strategies)
CREATE TABLE IF NOT EXISTS strategy_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    daily_return DECIMAL(10, 2),
    cumulative_return DECIMAL(10, 2),
    drawdown DECIMAL(10, 2),
    trades_count INTEGER DEFAULT 0,
    pnl DECIMAL(20, 8),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(strategy_id, date)
);

-- Historical data cache (for faster backtesting)
CREATE TABLE IF NOT EXISTS historical_ohlcv (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(10) NOT NULL,
    timeframe VARCHAR(10) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    open DECIMAL(20, 8) NOT NULL,
    high DECIMAL(20, 8) NOT NULL,
    low DECIMAL(20, 8) NOT NULL,
    close DECIMAL(20, 8) NOT NULL,
    volume DECIMAL(20, 8) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(symbol, timeframe, timestamp)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_strategies_status ON strategies(status);
CREATE INDEX IF NOT EXISTS idx_strategies_created_at ON strategies(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backtest_results_strategy_id ON backtest_results(strategy_id);
CREATE INDEX IF NOT EXISTS idx_backtest_results_created_at ON backtest_results(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backtest_results_total_return ON backtest_results(total_return DESC);
CREATE INDEX IF NOT EXISTS idx_strategy_performance_strategy_id ON strategy_performance(strategy_id);
CREATE INDEX IF NOT EXISTS idx_strategy_performance_date ON strategy_performance(date DESC);
CREATE INDEX IF NOT EXISTS idx_historical_ohlcv_symbol_timeframe ON historical_ohlcv(symbol, timeframe, timestamp DESC);

-- Comments
COMMENT ON TABLE strategies IS 'Trading strategies extracted from videos or manually created';
COMMENT ON TABLE backtest_results IS 'Backtest execution results and metrics';
COMMENT ON TABLE strategy_performance IS 'Daily performance tracking for active strategies';
COMMENT ON TABLE historical_ohlcv IS 'Cached historical OHLCV data for backtesting';

