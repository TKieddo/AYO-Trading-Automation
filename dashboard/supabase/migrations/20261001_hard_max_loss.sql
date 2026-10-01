-- Hard-cap dollar stop to risk_per_trade_usd (remove the old -9 / 1.5× buffer).
-- Also leave take-profit in price_percent if already set.

UPDATE trading_settings
SET
  stop_loss_usd = -ABS(COALESCE(NULLIF(risk_per_trade_usd, 0), 6)),
  risk_per_trade_usd = COALESCE(NULLIF(risk_per_trade_usd, 0), 6),
  updated_at = NOW()
WHERE id = 'default';

SELECT id, risk_per_trade_usd, stop_loss_usd, stop_loss_percent, tp_mode, take_profit_percent
FROM trading_settings
WHERE id = 'default';
