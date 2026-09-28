-- Coolify: fix lose-more-than-we-make by aligning TP to ~2R vs $6 hard stop.
-- $30 margin + -$6 stop + $12 take-profit (USD mode).

UPDATE trading_settings
SET
  position_sizing_mode = 'margin',
  margin_per_position = 30,
  risk_per_trade_usd = 6,
  stop_loss_usd = -6,
  tp_mode = 'usd',
  take_profit_usd = 12,
  take_profit_percent = 40,
  exit_mode = COALESCE(exit_mode, 'atr'),
  updated_at = now()
WHERE id = 'default';

SELECT id, position_sizing_mode, margin_per_position, stop_loss_usd,
       tp_mode, take_profit_usd, take_profit_percent
FROM trading_settings
WHERE id = 'default';
