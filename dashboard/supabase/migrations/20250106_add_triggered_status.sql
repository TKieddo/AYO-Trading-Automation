-- Add "triggered" status to orders table
-- This migration updates the orders table to support all Hyperliquid order statuses

-- Drop the existing CHECK constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Add new CHECK constraint with all statuses
ALTER TABLE orders ADD CONSTRAINT orders_status_check 
CHECK (status IN ('open', 'filled', 'canceled', 'rejected', 'triggered'));

-- Add comment
COMMENT ON COLUMN orders.status IS 'Order status: open, filled, canceled, rejected, or triggered';

