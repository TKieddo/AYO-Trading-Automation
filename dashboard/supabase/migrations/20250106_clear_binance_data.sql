-- Clear old Binance data and prepare for Hyperliquid data
-- This migration removes all Binance-related data to start fresh with Hyperliquid

-- Clear all trades (Binance trades)
TRUNCATE TABLE trades CASCADE;

-- Clear all orders (Binance orders)
TRUNCATE TABLE orders CASCADE;

-- Clear all positions (Binance positions)
TRUNCATE TABLE positions CASCADE;

-- Clear account metrics (Binance metrics)
TRUNCATE TABLE account_metrics CASCADE;

-- Clear decisions (old decisions)
TRUNCATE TABLE decisions CASCADE;

-- Note: We keep prices table as it's exchange-agnostic
-- Note: We keep trading_logs as they may contain useful historical information

-- Reset sequences (if any)
DO $$ 
BEGIN
    -- Reset any auto-increment sequences if they exist
    PERFORM setval(pg_get_serial_sequence('trades', 'id'), 1, false);
    PERFORM setval(pg_get_serial_sequence('orders', 'id'), 1, false);
    PERFORM setval(pg_get_serial_sequence('positions', 'id'), 1, false);
    PERFORM setval(pg_get_serial_sequence('account_metrics', 'id'), 1, false);
    PERFORM setval(pg_get_serial_sequence('decisions', 'id'), 1, false);
EXCEPTION WHEN others THEN NULL;
END $$;

-- Log the cleanup
INSERT INTO trading_logs (level, message, data, timestamp) 
VALUES (
    'info',
    'Database cleared for Hyperliquid migration',
    '{"migration": "20250106_clear_binance_data", "tables_cleared": ["trades", "orders", "positions", "account_metrics", "decisions"]}'::jsonb,
    NOW()
) ON CONFLICT DO NOTHING;

