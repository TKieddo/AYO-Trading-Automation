-- Migration: Add order metrics and fees/profit summary table
-- Stores aggregated metrics for orders and fees/profit calculations

-- Create order_metrics_summary table for historical tracking
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS order_metrics_summary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Order metrics
    total_orders INTEGER DEFAULT 0,
    open_orders INTEGER DEFAULT 0,
    filled_orders INTEGER DEFAULT 0,
    canceled_orders INTEGER DEFAULT 0,
    rejected_orders INTEGER DEFAULT 0,
    open_pct DECIMAL(5, 2) DEFAULT 0,
    filled_pct DECIMAL(5, 2) DEFAULT 0,
    canceled_pct DECIMAL(5, 2) DEFAULT 0,
    rejected_pct DECIMAL(5, 2) DEFAULT 0,
    -- Fees and profit
    total_fees DECIMAL(20, 8) DEFAULT 0,
    total_pnl DECIMAL(20, 8) DEFAULT 0,
    net_profit DECIMAL(20, 8) DEFAULT 0,
    avg_fee_per_trade DECIMAL(20, 8) DEFAULT 0,
    fee_to_pnl_ratio DECIMAL(10, 4) DEFAULT 0,
    profit_margin DECIMAL(10, 4) DEFAULT 0,
    -- Metadata
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(timestamp)
  );
EXCEPTION WHEN others THEN NULL;
END $$;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_order_metrics_summary_timestamp ON order_metrics_summary(timestamp DESC);

-- Create a function to upsert order metrics summary
CREATE OR REPLACE FUNCTION upsert_order_metrics_summary(
  p_timestamp TIMESTAMPTZ,
  p_total_orders INTEGER,
  p_open_orders INTEGER,
  p_filled_orders INTEGER,
  p_canceled_orders INTEGER,
  p_rejected_orders INTEGER,
  p_total_fees DECIMAL,
  p_total_pnl DECIMAL,
  p_net_profit DECIMAL,
  p_avg_fee_per_trade DECIMAL,
  p_fee_to_pnl_ratio DECIMAL,
  p_profit_margin DECIMAL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  p_open_pct DECIMAL(5, 2);
  p_filled_pct DECIMAL(5, 2);
  p_canceled_pct DECIMAL(5, 2);
  p_rejected_pct DECIMAL(5, 2);
BEGIN
  -- Calculate percentages
  p_open_pct := CASE WHEN p_total_orders > 0 THEN ROUND((p_open_orders::numeric / p_total_orders::numeric * 100)::numeric, 2) ELSE 0 END;
  p_filled_pct := CASE WHEN p_total_orders > 0 THEN ROUND((p_filled_orders::numeric / p_total_orders::numeric * 100)::numeric, 2) ELSE 0 END;
  p_canceled_pct := CASE WHEN p_total_orders > 0 THEN ROUND((p_canceled_orders::numeric / p_total_orders::numeric * 100)::numeric, 2) ELSE 0 END;
  p_rejected_pct := CASE WHEN p_total_orders > 0 THEN ROUND((p_rejected_orders::numeric / p_total_orders::numeric * 100)::numeric, 2) ELSE 0 END;

  -- Upsert
  INSERT INTO order_metrics_summary (
    timestamp,
    total_orders, open_orders, filled_orders, canceled_orders, rejected_orders,
    open_pct, filled_pct, canceled_pct, rejected_pct,
    total_fees, total_pnl, net_profit, avg_fee_per_trade, fee_to_pnl_ratio, profit_margin,
    calculated_at
  ) VALUES (
    p_timestamp,
    p_total_orders, p_open_orders, p_filled_orders, p_canceled_orders, p_rejected_orders,
    p_open_pct, p_filled_pct, p_canceled_pct, p_rejected_pct,
    p_total_fees, p_total_pnl, p_net_profit, p_avg_fee_per_trade, p_fee_to_pnl_ratio, p_profit_margin,
    NOW()
  )
  ON CONFLICT (timestamp) DO UPDATE SET
    total_orders = EXCLUDED.total_orders,
    open_orders = EXCLUDED.open_orders,
    filled_orders = EXCLUDED.filled_orders,
    canceled_orders = EXCLUDED.canceled_orders,
    rejected_orders = EXCLUDED.rejected_orders,
    open_pct = EXCLUDED.open_pct,
    filled_pct = EXCLUDED.filled_pct,
    canceled_pct = EXCLUDED.canceled_pct,
    rejected_pct = EXCLUDED.rejected_pct,
    total_fees = EXCLUDED.total_fees,
    total_pnl = EXCLUDED.total_pnl,
    net_profit = EXCLUDED.net_profit,
    avg_fee_per_trade = EXCLUDED.avg_fee_per_trade,
    fee_to_pnl_ratio = EXCLUDED.fee_to_pnl_ratio,
    profit_margin = EXCLUDED.profit_margin,
    calculated_at = NOW();
END;
$$;

-- Add comment
COMMENT ON TABLE order_metrics_summary IS 'Aggregated order metrics and fees/profit summary for historical tracking';
COMMENT ON FUNCTION upsert_order_metrics_summary IS 'Upsert order metrics and fees summary with automatic percentage calculations';

