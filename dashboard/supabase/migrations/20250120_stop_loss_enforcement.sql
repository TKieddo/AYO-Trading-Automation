-- Stop Loss Enforcement Migration
-- Adds stop_loss_usd and take_profit_strict_enforcement fields

-- Add new columns to trading_settings table
ALTER TABLE trading_settings
ADD COLUMN IF NOT EXISTS stop_loss_usd numeric(10,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS take_profit_strict_enforcement boolean DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN trading_settings.stop_loss_usd IS 'Stop loss in USD (e.g., -18 means close if loss >= $18). NULL = use percentage only';
COMMENT ON COLUMN trading_settings.take_profit_strict_enforcement IS 'If true, take profit percentage must be strictly enforced. If false, use market conditions for exits';

-- Update default settings
UPDATE trading_settings
SET 
  stop_loss_usd = NULL,
  take_profit_strict_enforcement = false
WHERE id = 'default';
