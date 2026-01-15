-- Supabase Schema for Alpha Arena Trading Dashboard
-- Run this in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Prices table (real-time price data)
CREATE TABLE IF NOT EXISTS prices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  symbol VARCHAR(10) NOT NULL,
  price DECIMAL(20, 8) NOT NULL,
  change_24h DECIMAL(20, 8) DEFAULT 0,
  change_24h_percent DECIMAL(10, 4) DEFAULT 0,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(symbol)
);

-- Positions table
CREATE TABLE IF NOT EXISTS positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  symbol VARCHAR(10) NOT NULL,
  side VARCHAR(10) NOT NULL CHECK (side IN ('long', 'short')),
  size DECIMAL(20, 8) NOT NULL,
  entry_price DECIMAL(20, 8) NOT NULL,
  current_price DECIMAL(20, 8) NOT NULL,
  liquidation_price DECIMAL(20, 8),
  unrealized_pnl DECIMAL(20, 8) DEFAULT 0,
  realized_pnl DECIMAL(20, 8) DEFAULT 0,
  leverage INTEGER,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id BIGINT NOT NULL,
  symbol VARCHAR(10) NOT NULL,
  side VARCHAR(10) NOT NULL CHECK (side IN ('buy', 'sell')),
  type VARCHAR(20) NOT NULL CHECK (type IN ('market', 'limit', 'stop', 'take_profit')),
  size DECIMAL(20, 8) NOT NULL,
  price DECIMAL(20, 8),
  status VARCHAR(20) NOT NULL CHECK (status IN ('open', 'filled', 'canceled', 'rejected', 'triggered')),
  filled_size DECIMAL(20, 8) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(order_id, symbol)
);

-- Trades table (executed trades)
CREATE TABLE IF NOT EXISTS trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  symbol VARCHAR(10) NOT NULL,
  side VARCHAR(10) NOT NULL CHECK (side IN ('buy', 'sell')),
  size DECIMAL(20, 8) NOT NULL,
  price DECIMAL(20, 8) NOT NULL,
  fee DECIMAL(20, 8) DEFAULT 0,
  pnl DECIMAL(20, 8),
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  order_id UUID REFERENCES orders(id)
);

-- Account metrics table
CREATE TABLE IF NOT EXISTS account_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  total_value DECIMAL(20, 8) NOT NULL,
  balance DECIMAL(20, 8) NOT NULL,
  open_positions INTEGER DEFAULT 0,
  total_pnl DECIMAL(20, 8) DEFAULT 0,
  daily_pnl DECIMAL(20, 8) DEFAULT 0,
  win_rate DECIMAL(5, 2) DEFAULT 0,
  total_trades INTEGER DEFAULT 0,
  leverage DECIMAL(5, 2) DEFAULT 1,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trading logs table
CREATE TABLE IF NOT EXISTS trading_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  level VARCHAR(20) NOT NULL CHECK (level IN ('info', 'warning', 'error', 'success')),
  message TEXT NOT NULL,
  data JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Decisions table (AI agent decisions)
CREATE TABLE IF NOT EXISTS decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset VARCHAR(10) NOT NULL,
  action VARCHAR(10) NOT NULL CHECK (action IN ('buy', 'sell', 'hold')),
  allocation_usd DECIMAL(20, 8),
  tp_price DECIMAL(20, 8),
  sl_price DECIMAL(20, 8),
  rationale TEXT,
  reasoning TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_prices_symbol ON prices(symbol);
CREATE INDEX IF NOT EXISTS idx_prices_timestamp ON prices(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_positions_symbol ON positions(symbol);
CREATE INDEX IF NOT EXISTS idx_positions_opened_at ON positions(opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_symbol ON orders(symbol);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
CREATE INDEX IF NOT EXISTS idx_trades_executed_at ON trades(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON trading_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_logs_level ON trading_logs(level);
CREATE INDEX IF NOT EXISTS idx_decisions_timestamp ON decisions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_decisions_asset ON decisions(asset);

-- Enable Row Level Security (optional, adjust as needed)
ALTER TABLE prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all reads (adjust for security as needed)
CREATE POLICY "Allow public read access" ON prices FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON positions FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON orders FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON trades FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON account_metrics FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON trading_logs FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON decisions FOR SELECT USING (true);

-- Real-time subscriptions (enabled by default in Supabase)
-- Prices table will broadcast changes automatically

