-- Coolify: choppy-market profile — wide ATR stops + risk sizing (not a 2% yank).
-- Example: 7% ATR stop with $6 risk → ~$86 notional / ~$8–9 margin at 10x (not $30).

UPDATE trading_settings
SET
  position_sizing_mode = 'risk',
  risk_per_trade_usd = 6,
  stop_loss_usd = -9,
  exit_mode = 'atr',
  tp_mode = 'atr_rr',
  tp_rr_ratio = 2.0,
  sl_atr_mult = 2.0,
  min_stop_price_pct = 1.5,
  max_stop_price_pct = 7.0,
  take_profit_usd = 12,
  margin_per_position = COALESCE(margin_per_position, 30),
  updated_at = now()
WHERE id = 'default';

SELECT id, position_sizing_mode, risk_per_trade_usd, stop_loss_usd,
       exit_mode, tp_mode, min_stop_price_pct, max_stop_price_pct
FROM trading_settings
WHERE id = 'default';
