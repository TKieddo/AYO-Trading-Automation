-- Create portfolio_assets table to store calculated portfolio asset data
-- This table will be synced from the API and used for display

CREATE TABLE IF NOT EXISTS public.portfolio_assets (
  symbol character varying(10) NOT NULL,
  name character varying(100) NOT NULL,
  logo_url text NULL,
  price numeric(20, 8) NULL DEFAULT 0,
  change_24h numeric(10, 4) NULL DEFAULT 0,
  holding_qty numeric(20, 8) NULL DEFAULT 0,
  holding_value numeric(20, 8) NULL DEFAULT 0,
  available_balance numeric(20, 8) NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT portfolio_assets_pkey PRIMARY KEY (symbol)
);

-- Add total_available_balance summary field if it doesn't exist
-- We'll use a special symbol 'TOTAL' to store portfolio summary
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'portfolio_assets' AND column_name = 'total_available_balance'
  ) THEN
    ALTER TABLE public.portfolio_assets ADD COLUMN total_available_balance numeric(20, 8) NULL DEFAULT 0;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_portfolio_assets_holding_value 
  ON public.portfolio_assets USING btree (holding_value DESC);

CREATE INDEX IF NOT EXISTS idx_portfolio_assets_updated_at 
  ON public.portfolio_assets USING btree (updated_at DESC);

-- Enable RLS
ALTER TABLE public.portfolio_assets ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public read access
CREATE POLICY "Allow public read access" ON public.portfolio_assets 
  FOR SELECT USING (true);

-- Note: Service role bypasses RLS by default, so no explicit write policy needed
-- But we can add a policy for authenticated users if needed in the future

-- Comment on table
COMMENT ON TABLE public.portfolio_assets IS 'Stores calculated portfolio asset data synced from API for consistent display';
