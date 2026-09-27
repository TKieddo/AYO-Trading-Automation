-- Default max loss per trade to $6 (risk sizing + hard USD stop ceiling).
-- Safe to re-run. Only fills blanks / updates the default row profile.

UPDATE trading_settings
SET
  position_sizing_mode = COALESCE(NULLIF(position_sizing_mode, ''), 'risk'),
  risk_per_trade_usd = COALESCE(risk_per_trade_usd, 6),
  risk_per_trade_pct = COALESCE(risk_per_trade_pct, 0.5),
  stop_loss_usd = COALESCE(stop_loss_usd, -6),
  min_notional_per_position = COALESCE(min_notional_per_position, 50),
  updated_at = now()
WHERE id = 'default';

COMMENT ON COLUMN trading_settings.risk_per_trade_usd IS
  'Max USD loss if ATR stop is hit. Position size shrinks when stop is wider. Editable in Trading Settings UI.';

COMMENT ON COLUMN trading_settings.stop_loss_usd IS
  'Hard USD stop ceiling (negative). Closes if unrealized PnL hits this even before ATR stop. Prefer matching -risk_per_trade_usd.';
