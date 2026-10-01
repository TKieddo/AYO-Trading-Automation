-- Respect UI take_profit_percent as % of entry price (not ATR R:R, not margin ROI).
-- Previous choppy/align migrations set tp_mode=atr_rr which placed TPs ~2× ATR stop
-- (often 10–14% away) so a user 5%/7% setting never filled.
-- Note: trading_settings.id is TEXT ('default'), not integer 1.

ALTER TABLE trading_settings
  ADD COLUMN IF NOT EXISTS tp_mode TEXT NOT NULL DEFAULT 'price_percent';

UPDATE trading_settings
SET
  tp_mode = 'price_percent',
  take_profit_percent = CASE
    WHEN take_profit_percent IS NULL OR take_profit_percent <= 0 THEN 7
    WHEN take_profit_percent > 20 THEN 7  -- was likely ROI% (e.g. 40); reset to a sane price %
    ELSE take_profit_percent
  END,
  updated_at = NOW()
WHERE id = 'default';

COMMENT ON COLUMN trading_settings.tp_mode IS
  'Take-profit mode independent of stop: price_percent | roi_percent | usd | atr_rr. price_percent = TAKE_PROFIT_PERCENT is % of entry price.';

SELECT id, tp_mode, take_profit_percent, exit_mode, risk_per_trade_usd, max_stop_price_pct
FROM trading_settings
WHERE id = 'default';
