-- Add position sizing configuration to trading_settings table
-- This allows users to configure target profit per 1% move and allocation strategy

ALTER TABLE trading_settings
ADD COLUMN IF NOT EXISTS target_profit_per_1pct_move numeric(10,2) DEFAULT 1.00,
ADD COLUMN IF NOT EXISTS allocation_per_position numeric(10,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS max_positions integer DEFAULT 6,
ADD COLUMN IF NOT EXISTS position_sizing_mode text DEFAULT 'auto' CHECK (position_sizing_mode IN ('auto', 'fixed', 'target_profit'));

-- Update constraints
ALTER TABLE trading_settings
DROP CONSTRAINT IF EXISTS target_profit_range,
ADD CONSTRAINT target_profit_range CHECK (target_profit_per_1pct_move >= 0.01 AND target_profit_per_1pct_move <= 1000),
DROP CONSTRAINT IF EXISTS allocation_range,
ADD CONSTRAINT allocation_range CHECK (allocation_per_position IS NULL OR (allocation_per_position >= 1 AND allocation_per_position <= 100000)),
DROP CONSTRAINT IF EXISTS max_positions_range,
ADD CONSTRAINT max_positions_range CHECK (max_positions >= 1 AND max_positions <= 50);

-- Update default row if exists
UPDATE trading_settings
SET 
  target_profit_per_1pct_move = 1.00,
  max_positions = 6,
  position_sizing_mode = 'auto'
WHERE id = 'default'
AND (target_profit_per_1pct_move IS NULL OR max_positions IS NULL OR position_sizing_mode IS NULL);

-- Add comments
COMMENT ON COLUMN trading_settings.target_profit_per_1pct_move IS 'Target profit in USD per 1% price move (e.g., 1.00 = $1 profit on 1% move)';
COMMENT ON COLUMN trading_settings.allocation_per_position IS 'Fixed allocation per position in USD (NULL = auto-calculate based on target profit)';
COMMENT ON COLUMN trading_settings.max_positions IS 'Maximum number of concurrent positions (1-50)';
COMMENT ON COLUMN trading_settings.position_sizing_mode IS 'Position sizing mode: auto (calculate from target profit), fixed (use allocation_per_position), target_profit (calculate from target_profit_per_1pct_move)';

