-- Active Strategies Configuration
-- Run this in your Supabase SQL editor

-- Add active_strategies field to trading_settings
ALTER TABLE trading_settings
ADD COLUMN IF NOT EXISTS active_strategy_ids JSONB DEFAULT '[]'::jsonb;

-- Add comment
COMMENT ON COLUMN trading_settings.active_strategy_ids IS 'Array of strategy IDs that are active for live trading. User must manually select strategies from settings page.';

-- Update default row
UPDATE trading_settings
SET active_strategy_ids = '[]'::jsonb
WHERE id = 'default'
AND active_strategy_ids IS NULL;

