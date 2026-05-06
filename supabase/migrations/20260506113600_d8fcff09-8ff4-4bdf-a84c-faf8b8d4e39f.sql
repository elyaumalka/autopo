
-- Add J5 (auth hold) tracking to bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS sumit_auth_number text,
  ADD COLUMN IF NOT EXISTS sumit_authorized_amount numeric,
  ADD COLUMN IF NOT EXISTS sumit_authorized_at timestamptz;

ALTER TABLE public.rentals
  ADD COLUMN IF NOT EXISTS sumit_auth_number text,
  ADD COLUMN IF NOT EXISTS sumit_authorized_amount numeric,
  ADD COLUMN IF NOT EXISTS sumit_authorized_at timestamptz;

-- Invoices issued by Sumit
CREATE TABLE IF NOT EXISTS public.sumit_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id text NOT NULL,
  document_number text,
  document_type integer,
  document_type_name text,
  amount numeric NOT NULL,
  currency text DEFAULT 'ILS',
  pdf_url text,
  customer_id uuid,
  customer_name text,
  booking_id uuid,
  rental_id uuid,
  raw_response jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sumit_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees can view sumit_invoices" ON public.sumit_invoices
  FOR SELECT USING (has_any_role(auth.uid()));
CREATE POLICY "Employees can insert sumit_invoices" ON public.sumit_invoices
  FOR INSERT WITH CHECK (has_any_role(auth.uid()));
CREATE POLICY "Employees can update sumit_invoices" ON public.sumit_invoices
  FOR UPDATE USING (has_any_role(auth.uid()));
CREATE POLICY "Admins can delete sumit_invoices" ON public.sumit_invoices
  FOR DELETE USING (is_admin_or_manager(auth.uid()));

-- Payment transactions log
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type text NOT NULL, -- 'authorize' (J5) | 'charge' (J4) | 'charge_token' | 'save_token'
  status text NOT NULL DEFAULT 'pending', -- 'pending' | 'success' | 'failed'
  amount numeric,
  currency text DEFAULT 'ILS',
  auth_number text,
  card_last4 text,
  card_mask text,
  customer_id uuid,
  customer_name text,
  booking_id uuid,
  rental_id uuid,
  invoice_id uuid,
  error_message text,
  raw_response jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees can view payment_transactions" ON public.payment_transactions
  FOR SELECT USING (has_any_role(auth.uid()));
CREATE POLICY "Employees can insert payment_transactions" ON public.payment_transactions
  FOR INSERT WITH CHECK (has_any_role(auth.uid()));
CREATE POLICY "Employees can update payment_transactions" ON public.payment_transactions
  FOR UPDATE USING (has_any_role(auth.uid()));
CREATE POLICY "Admins can delete payment_transactions" ON public.payment_transactions
  FOR DELETE USING (is_admin_or_manager(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_sumit_invoices_booking ON public.sumit_invoices(booking_id);
CREATE INDEX IF NOT EXISTS idx_sumit_invoices_rental ON public.sumit_invoices(rental_id);
CREATE INDEX IF NOT EXISTS idx_sumit_invoices_customer ON public.sumit_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_payment_tx_booking ON public.payment_transactions(booking_id);
CREATE INDEX IF NOT EXISTS idx_payment_tx_customer ON public.payment_transactions(customer_id);
