-- Create portfolio_activities table to store all money-related events
-- This includes trades, funding fees, transfers, deposits, withdrawals, etc.

CREATE TABLE IF NOT EXISTS portfolio_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(50) NOT NULL CHECK (type IN (
    'trade_pnl', 
    'funding_fee', 
    'transfer', 
    'deposit', 
    'withdrawal', 
    'commission', 
    'realized_pnl', 
    'unrealized_pnl'
  )),
  amount DECIMAL(20, 8) NOT NULL,
  symbol VARCHAR(10),
  description TEXT,
  timestamp TIMESTAMPTZ NOT NULL,
  income_id VARCHAR(255), -- Unique ID from Aster API to prevent duplicates
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create unique constraint on income_id to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS portfolio_activities_income_id_unique 
ON portfolio_activities(income_id) 
WHERE income_id IS NOT NULL;

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_portfolio_activities_timestamp ON portfolio_activities(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_portfolio_activities_type ON portfolio_activities(type);
CREATE INDEX IF NOT EXISTS idx_portfolio_activities_symbol ON portfolio_activities(symbol);

-- Enable RLS
ALTER TABLE portfolio_activities ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public read access
CREATE POLICY "Allow public read access" ON portfolio_activities FOR SELECT USING (true);

-- Comment on table
COMMENT ON TABLE portfolio_activities IS 'All money-related portfolio activities including trades, fees, transfers, deposits, withdrawals';

