-- Add margin-based position sizing to trading_settings table
-- This allows users to specify margin (amount to risk) and leverage, system calculates notional

ALTER TABLE trading_settings
ADD COLUMN IF NOT EXISTS margin_per_position numeric(10,2) DEFAULT NULL;

-- Update position_sizing_mode constraint to include "margin"
ALTER TABLE trading_settings
DROP CONSTRAINT IF EXISTS trading_settings_position_sizing_mode_check;

ALTER TABLE trading_settings
ADD CONSTRAINT trading_settings_position_sizing_mode_check 
CHECK (position_sizing_mode IN ('auto', 'fixed', 'target_profit', 'margin'));

-- Add validation constraint for margin_per_position
ALTER TABLE trading_settings
DROP CONSTRAINT IF EXISTS margin_per_position_range;

ALTER TABLE trading_settings
ADD CONSTRAINT margin_per_position_range 
CHECK (margin_per_position IS NULL OR (margin_per_position >= 1 AND margin_per_position <= 100000));

-- Update default row if exists (set margin_per_position to NULL by default)
UPDATE trading_settings
SET margin_per_position = NULL
WHERE id = 'default'
AND margin_per_position IS NULL;

-- Add comment
COMMENT ON COLUMN trading_settings.margin_per_position IS 'Margin (amount to risk) per position in USD when position_sizing_mode is "margin". System calculates: Notional = Margin × Leverage';

