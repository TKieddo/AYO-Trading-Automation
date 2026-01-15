-- Strategy Optimization Schema
-- Run this in your Supabase SQL editor

-- Strategy optimizations table
CREATE TABLE IF NOT EXISTS strategy_optimizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,
    original_backtest_id UUID REFERENCES backtest_results(id),
    target_profitability DECIMAL(5, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'stopped', 'failed')),
    best_profitability DECIMAL(10, 2),
    original_profitability DECIMAL(10, 2),
    improvement DECIMAL(10, 2),  -- Percentage improvement
    iterations_completed INTEGER DEFAULT 0,
    max_iterations INTEGER DEFAULT 50,
    parameters_tested JSONB,  -- Array of parameter sets tested
    best_parameters JSONB,  -- Best parameter set found
    original_parameters JSONB,  -- Original parameters
    optimization_method VARCHAR(50) DEFAULT 'llm_guided' CHECK (optimization_method IN ('llm_guided', 'grid_search', 'random_search', 'bayesian')),
    target_met BOOLEAN DEFAULT FALSE,
    stopped_reason TEXT,  -- Why optimization stopped
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optimization iterations table (detailed tracking)
CREATE TABLE IF NOT EXISTS optimization_iterations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    optimization_id UUID REFERENCES strategy_optimizations(id) ON DELETE CASCADE,
    iteration_number INTEGER NOT NULL,
    parameters JSONB NOT NULL,  -- Parameters tested in this iteration
    profitability DECIMAL(10, 2),
    sharpe_ratio DECIMAL(10, 4),
    max_drawdown DECIMAL(10, 2),
    win_rate DECIMAL(5, 2),
    total_trades INTEGER,
    backtest_result_id UUID REFERENCES backtest_results(id),
    llm_reasoning TEXT,  -- LLM's reasoning for these parameters
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(optimization_id, iteration_number)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_optimizations_strategy_id ON strategy_optimizations(strategy_id);
CREATE INDEX IF NOT EXISTS idx_optimizations_status ON strategy_optimizations(status);
CREATE INDEX IF NOT EXISTS idx_optimizations_created_at ON strategy_optimizations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_optimization_iterations_optimization_id ON optimization_iterations(optimization_id);
CREATE INDEX IF NOT EXISTS idx_optimization_iterations_iteration ON optimization_iterations(optimization_id, iteration_number);

-- Comments
COMMENT ON TABLE strategy_optimizations IS 'Strategy optimization runs and results';
COMMENT ON TABLE optimization_iterations IS 'Detailed tracking of each optimization iteration';

