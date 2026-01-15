-- Create wallet_balance_history table to track account value over time
-- This allows us to calculate Day/Week/Month percentage changes

CREATE TABLE IF NOT EXISTS wallet_balance_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_value DECIMAL(20, 8) NOT NULL,
  available_balance DECIMAL(20, 8) NOT NULL,
  total_positions_value DECIMAL(20, 8) DEFAULT 0,
  unrealized_pnl DECIMAL(20, 8) DEFAULT 0,
  network VARCHAR(20) DEFAULT 'mainnet', -- 'mainnet' or 'testnet'
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create unique constraint on (timestamp, network) to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS wallet_balance_history_timestamp_network_unique 
ON wallet_balance_history(timestamp, network);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_wallet_balance_history_timestamp ON wallet_balance_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_balance_history_network ON wallet_balance_history(network);
CREATE INDEX IF NOT EXISTS idx_wallet_balance_history_network_timestamp ON wallet_balance_history(network, timestamp DESC);

-- Enable RLS
ALTER TABLE wallet_balance_history ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public read access
CREATE POLICY "Allow public read access" ON wallet_balance_history FOR SELECT USING (true);

-- Function to get percentage change between two timestamps
CREATE OR REPLACE FUNCTION get_balance_change_percent(
  p_network VARCHAR DEFAULT 'mainnet',
  p_hours_ago INTEGER DEFAULT 24
)
RETURNS DECIMAL(10, 4) AS $$
DECLARE
  current_balance DECIMAL(20, 8);
  past_balance DECIMAL(20, 8);
BEGIN
  -- Get current balance (most recent)
  SELECT account_value INTO current_balance
  FROM wallet_balance_history
  WHERE network = p_network
  ORDER BY timestamp DESC
  LIMIT 1;
  
  -- Get past balance (p_hours_ago hours ago)
  SELECT account_value INTO past_balance
  FROM wallet_balance_history
  WHERE network = p_network
    AND timestamp <= NOW() - (p_hours_ago || ' hours')::INTERVAL
  ORDER BY timestamp DESC
  LIMIT 1;
  
  -- Calculate percentage change
  IF past_balance IS NULL OR past_balance = 0 THEN
    RETURN 0;
  END IF;
  
  RETURN ((current_balance - past_balance) / past_balance) * 100;
END;
$$ LANGUAGE plpgsql;

-- Comment on table
COMMENT ON TABLE wallet_balance_history IS 'Historical wallet balance snapshots for calculating percentage changes (Day/Week/Month)';

