-- Close when margin ROI hits TAKE_PROFIT_PERCENT (what OKX/UI % PnL shows),
-- not when price itself moves that %. At 10x, 7% ROI ≈ 0.7% price move.

UPDATE trading_settings
SET
  tp_mode = 'roi_percent',
  take_profit_percent = COALESCE(NULLIF(take_profit_percent, 0), 7),
  updated_at = NOW()
WHERE id = 'default';

SELECT id, tp_mode, take_profit_percent, leverage, stop_loss_usd, risk_per_trade_usd
FROM trading_settings
WHERE id = 'default';
