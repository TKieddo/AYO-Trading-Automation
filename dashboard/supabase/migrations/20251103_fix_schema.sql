-- Ayo Trading Dashboard - Idempotent schema alignment
-- Safe to run multiple times; guards ensure no hard failures on existing state

-- 1) Ensure uuid extension exists (harmless if already present)
DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
EXCEPTION WHEN others THEN NULL; END $$;

-- 2) prices: use composite PK (symbol, timestamp); allow multiple rows per symbol over time
-- Drop conflicting constraints if present
DO $$ BEGIN
  ALTER TABLE prices DROP CONSTRAINT IF EXISTS prices_symbol_key;
  ALTER TABLE prices DROP CONSTRAINT IF EXISTS prices_pkey;
  EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Add PK on (symbol, timestamp)
DO $$ BEGIN
  ALTER TABLE prices ADD CONSTRAINT prices_pkey PRIMARY KEY (symbol, timestamp);
EXCEPTION WHEN others THEN NULL; END $$;

-- Helpful indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_prices_symbol ON prices(symbol);
CREATE INDEX IF NOT EXISTS idx_prices_timestamp ON prices(timestamp DESC);

-- 3) positions: upsert by id (text)
DO $$ BEGIN
  ALTER TABLE positions ALTER COLUMN id DROP DEFAULT;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE positions ALTER COLUMN id TYPE text USING id::text;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE positions DROP CONSTRAINT IF EXISTS positions_pkey;
  ALTER TABLE positions ADD CONSTRAINT positions_pkey PRIMARY KEY (id);
EXCEPTION WHEN others THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_positions_symbol ON positions(symbol);
CREATE INDEX IF NOT EXISTS idx_positions_opened_at ON positions(opened_at DESC);

-- 4) decisions: upsert by id (text)
DO $$ BEGIN
  ALTER TABLE decisions ALTER COLUMN id DROP DEFAULT;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE decisions ALTER COLUMN id TYPE text USING id::text;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE decisions DROP CONSTRAINT IF EXISTS decisions_pkey;
  ALTER TABLE decisions ADD CONSTRAINT decisions_pkey PRIMARY KEY (id);
EXCEPTION WHEN others THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_decisions_timestamp ON decisions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_decisions_asset ON decisions(asset);

-- 5) orders: upsert by order_id (text), not composite
DO $$ BEGIN
  ALTER TABLE orders ALTER COLUMN order_id TYPE text USING order_id::text;
EXCEPTION WHEN others THEN NULL; END $$;

-- Drop any old unique constraints that include symbol
DO $$ BEGIN
  ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_id_symbol_key;
  DROP INDEX IF EXISTS orders_order_id_symbol_key;
EXCEPTION WHEN others THEN NULL; END $$;

-- Ensure unique index on order_id alone
CREATE UNIQUE INDEX IF NOT EXISTS orders_order_id_key ON orders (order_id);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_symbol ON orders(symbol);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- 6) trading_logs: helpful indexes
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON trading_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_logs_level ON trading_logs(level);

-- 7) pnl/performance auxiliary tables (optional; create if missing)
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS pnl_series (
    timestamp timestamptz PRIMARY KEY,
    daily_pnl numeric,
    cumulative_pnl numeric
  );
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS performance_series (
    date timestamptz PRIMARY KEY,
    value numeric,
    pnl numeric
  );
EXCEPTION WHEN others THEN NULL; END $$;

-- 8) account_metrics: ensure basic indexes
CREATE INDEX IF NOT EXISTS idx_account_metrics_timestamp ON account_metrics(timestamp DESC);

-- 9) RLS note: writes use service role. No policy changes required if service role is used.
-- If you wish to disable RLS in dev (optional), uncomment below:
-- ALTER TABLE prices DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE positions DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE trades DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE account_metrics DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE trading_logs DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE decisions DISABLE ROW LEVEL SECURITY;


