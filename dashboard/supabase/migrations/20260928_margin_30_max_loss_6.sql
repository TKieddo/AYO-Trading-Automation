-- Coolify Supabase: fixed $30 margin + $6 hard max loss (not risk-sized shrink).
-- Run in Coolify SQL editor, then redeploy the agent.

UPDATE trading_settings
SET
  position_sizing_mode = 'margin',
  margin_per_position = 30,
  risk_per_trade_usd = 6,
  stop_loss_usd = -6,
  updated_at = now()
WHERE id = 'default';

SELECT id, position_sizing_mode, margin_per_position, risk_per_trade_usd, stop_loss_usd
FROM trading_settings
WHERE id = 'default';
