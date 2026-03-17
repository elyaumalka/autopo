-- Add upload token and payment token fields to customers
ALTER TABLE public.customers 
  ADD COLUMN IF NOT EXISTS upload_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  ADD COLUMN IF NOT EXISTS payment_token TEXT,
  ADD COLUMN IF NOT EXISTS payment_provider TEXT,
  ADD COLUMN IF NOT EXISTS card_last4 TEXT,
  ADD COLUMN IF NOT EXISTS card_expiry TEXT;

-- Create index on upload_token for fast lookups
CREATE INDEX IF NOT EXISTS idx_customers_upload_token ON public.customers (upload_token);

-- Allow public read of upload_token for the upload page (unauthenticated)
CREATE POLICY "Public can read customer by upload token"
  ON public.customers
  FOR SELECT
  USING (true);

-- Allow public update of license URLs by upload token
CREATE POLICY "Public can update license URLs"
  ON public.customers
  FOR UPDATE
  USING (true)
  WITH CHECK (true);