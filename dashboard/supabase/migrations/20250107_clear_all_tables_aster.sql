-- Clear all tables for fresh start with Aster DEX
-- This migration removes all data from all tables to start fresh

-- Clear all orders (old Binance/Hyperliquid orders)
TRUNCATE TABLE orders CASCADE;

-- Clear all trades (old trades)
TRUNCATE TABLE trades CASCADE;

-- Clear all positions (old positions)
TRUNCATE TABLE positions CASCADE;

-- Clear account metrics (old metrics)
TRUNCATE TABLE account_metrics CASCADE;

-- Clear decisions (old decisions)
TRUNCATE TABLE decisions CASCADE;

-- Clear prices (price history)
TRUNCATE TABLE prices CASCADE;

-- Clear trading logs
TRUNCATE TABLE trading_logs CASCADE;

-- Clear PNL series
TRUNCATE TABLE pnl_series CASCADE;

-- Clear performance series
TRUNCATE TABLE performance_series CASCADE;

-- Clear wallet balance history
DO $$ 
BEGIN
    TRUNCATE TABLE wallet_balance_history CASCADE;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Clear wins_losses_stats (materialized view - refresh after clearing trades)
DO $$ 
BEGIN
    -- Refresh the materialized view to clear it (since underlying trades are cleared)
    IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'wins_losses_stats') THEN
        REFRESH MATERIALIZED VIEW wins_losses_stats;
    END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Clear order_metrics_summary table
DO $$ 
BEGIN
    TRUNCATE TABLE order_metrics_summary CASCADE;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

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

-- Log the cleanup (insert after clearing trading_logs, so we need to re-enable it temporarily)
-- Note: This will be the first entry in the newly cleared trading_logs table
DO $$ 
BEGIN
    INSERT INTO trading_logs (level, message, data, timestamp) 
    VALUES (
        'info',
        'Database cleared for Aster DEX migration - all tables cleared',
        '{"migration": "20250107_clear_all_tables_aster", "tables_cleared": ["orders", "trades", "positions", "account_metrics", "decisions", "prices", "trading_logs", "pnl_series", "performance_series", "wallet_balance_history", "wins_losses_stats", "order_metrics_summary"], "exchange": "aster"}'::jsonb,
        NOW()
    );
EXCEPTION WHEN others THEN NULL;
END $$;

