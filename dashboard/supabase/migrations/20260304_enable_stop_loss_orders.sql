-- Add explicit exchange stop-loss order toggle
-- This is separate from take_profit_strict_enforcement.

ALTER TABLE trading_settings
ADD COLUMN IF NOT EXISTS enable_stop_loss_orders boolean DEFAULT true;

COMMENT ON COLUMN trading_settings.enable_stop_loss_orders IS
'If true, place and maintain exchange-native stop-loss orders (recommended). If false, rely on bot-side stop checks only.';

UPDATE trading_settings
SET enable_stop_loss_orders = true
WHERE id = 'default' AND enable_stop_loss_orders IS NULL;

