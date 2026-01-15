-- Create trading_settings table for persistent trading configuration
-- This allows users to set leverage, TP%, SL% via frontend and persist to database

CREATE TABLE IF NOT EXISTS trading_settings (
    id text PRIMARY KEY DEFAULT 'default',
    leverage integer NOT NULL DEFAULT 10,
    take_profit_percent numeric(5,2) NOT NULL DEFAULT 5.00,
    stop_loss_percent numeric(5,2) NOT NULL DEFAULT 3.00,
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    updated_by text,
    CONSTRAINT leverage_range CHECK (leverage >= 1 AND leverage <= 100),
    CONSTRAINT tp_percent_range CHECK (take_profit_percent >= 0.1 AND take_profit_percent <= 100),
    CONSTRAINT sl_percent_range CHECK (stop_loss_percent >= 0.1 AND stop_loss_percent <= 50)
);

-- Insert default settings if not exists
INSERT INTO trading_settings (id, leverage, take_profit_percent, stop_loss_percent)
VALUES ('default', 10, 5.00, 3.00)
ON CONFLICT (id) DO NOTHING;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_trading_settings_id ON trading_settings(id);

-- Add comment
COMMENT ON TABLE trading_settings IS 'Persistent trading configuration: leverage, take profit %, stop loss %';
COMMENT ON COLUMN trading_settings.id IS 'Settings ID (use "default" for global settings)';
COMMENT ON COLUMN trading_settings.leverage IS 'Default leverage multiplier (1-100)';
COMMENT ON COLUMN trading_settings.take_profit_percent IS 'Take profit percentage (e.g., 5.00 = 5%)';
COMMENT ON COLUMN trading_settings.stop_loss_percent IS 'Stop loss percentage (e.g., 3.00 = 3%)';

