-- Migration: Add wins/losses statistics support
-- Wins/Losses are calculated dynamically from trades table, but this migration
-- adds indexes and views for performance optimization

-- Add index on pnl for faster filtering of wins/losses
CREATE INDEX IF NOT EXISTS idx_trades_pnl ON trades(pnl) WHERE pnl IS NOT NULL;

-- Add composite index for filtered queries (symbol + pnl + executed_at)
CREATE INDEX IF NOT EXISTS idx_trades_symbol_pnl_executed ON trades(symbol, pnl, executed_at DESC) WHERE pnl IS NOT NULL;

-- Create a materialized view for wins/losses statistics (optional optimization)
-- This can be refreshed periodically for better performance on large datasets
DO $$ BEGIN
  CREATE MATERIALIZED VIEW IF NOT EXISTS wins_losses_stats AS
  WITH trade_stats AS (
    SELECT 
      COUNT(*) FILTER (WHERE pnl >= 0) as win_count,
      COUNT(*) FILTER (WHERE pnl < 0) as loss_count,
      COUNT(*) as total_count,
      COALESCE(SUM(pnl) FILTER (WHERE pnl >= 0), 0) as wins_total_pnl,
      COALESCE(SUM(pnl) FILTER (WHERE pnl < 0), 0) as losses_total_pnl,
      COALESCE(AVG(pnl) FILTER (WHERE pnl >= 0), 0) as wins_avg_pnl,
      COALESCE(AVG(pnl) FILTER (WHERE pnl < 0), 0) as losses_avg_pnl,
      MAX(executed_at) as last_trade_at
    FROM trades
    WHERE pnl IS NOT NULL
  )
  SELECT 
    win_count,
    loss_count,
    total_count,
    CASE 
      WHEN total_count > 0 THEN ROUND((win_count::numeric / total_count::numeric * 100)::numeric, 2)
      ELSE 0
    END as win_pct,
    CASE 
      WHEN total_count > 0 THEN ROUND((loss_count::numeric / total_count::numeric * 100)::numeric, 2)
      ELSE 0
    END as loss_pct,
    wins_total_pnl,
    losses_total_pnl,
    wins_avg_pnl,
    losses_avg_pnl,
    last_trade_at,
    NOW() as calculated_at
  FROM trade_stats;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Create index on the materialized view
CREATE UNIQUE INDEX IF NOT EXISTS wins_losses_stats_unique ON wins_losses_stats (calculated_at);

-- Create a function to refresh the materialized view
-- Note: CONCURRENTLY requires a unique index, which we created above
CREATE OR REPLACE FUNCTION refresh_wins_losses_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if the materialized view exists before refreshing
  IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'wins_losses_stats') THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY wins_losses_stats;
  END IF;
END;
$$;

-- Add comment explaining usage
COMMENT ON MATERIALIZED VIEW wins_losses_stats IS 'Materialized view of wins/losses statistics. Refresh using refresh_wins_losses_stats() function.';
COMMENT ON INDEX idx_trades_pnl IS 'Index on trades.pnl for faster wins/losses filtering';
COMMENT ON INDEX idx_trades_symbol_pnl_executed IS 'Composite index for filtered trades queries by symbol, pnl, and execution time';

