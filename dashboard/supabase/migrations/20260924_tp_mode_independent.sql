-- Independent take-profit mode (stop stays ATR/fixed via exit_mode).
ALTER TABLE trading_settings
  ADD COLUMN IF NOT EXISTS tp_mode TEXT NOT NULL DEFAULT 'roi_percent',
  ADD COLUMN IF NOT EXISTS take_profit_usd NUMERIC NULL;

COMMENT ON COLUMN trading_settings.tp_mode IS
  'Take-profit mode independent of stop: roi_percent | usd | atr_rr';
COMMENT ON COLUMN trading_settings.take_profit_usd IS
  'Absolute USD profit lock when tp_mode=usd (e.g. 5 = close at +$5)';

-- Keep existing rows on the scalping-friendly default.
UPDATE trading_settings
SET tp_mode = COALESCE(NULLIF(tp_mode, ''), 'roi_percent')
WHERE tp_mode IS NULL OR tp_mode = '';
