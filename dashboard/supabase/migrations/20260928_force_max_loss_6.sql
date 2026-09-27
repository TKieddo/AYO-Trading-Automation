-- Coolify-hosted Supabase: force $6 max-loss profile on the default settings row.
-- Run in Coolify Supabase SQL editor (not cloud Supabase).

UPDATE trading_settings
SET
  position_sizing_mode = 'risk',
  risk_per_trade_usd = 6,
  risk_per_trade_pct = COALESCE(risk_per_trade_pct, 0.5),
  stop_loss_usd = -6,
  min_notional_per_position = LEAST(COALESCE(min_notional_per_position, 50), 50),
  updated_at = now()
WHERE id = 'default';

SELECT id, position_sizing_mode, risk_per_trade_usd, stop_loss_usd, min_notional_per_position
FROM trading_settings
WHERE id = 'default';
