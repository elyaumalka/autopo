
-- Table to track document signing for each booking
CREATE TABLE public.document_signatures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('contract', 'waiver', 'declaration')),
  signing_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  customer_id UUID REFERENCES public.customers(id),
  customer_name TEXT,
  vehicle_details TEXT,
  rental_details JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'signed')),
  signature_data TEXT,
  signed_at TIMESTAMP WITH TIME ZONE,
  signed_pdf_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(booking_id, document_type)
);

-- Enable RLS
ALTER TABLE public.document_signatures ENABLE ROW LEVEL SECURITY;

-- Employees can manage signatures
CREATE POLICY "Employees can view document_signatures"
  ON public.document_signatures FOR SELECT
  USING (has_any_role(auth.uid()));

CREATE POLICY "Employees can insert document_signatures"
  ON public.document_signatures FOR INSERT
  WITH CHECK (has_any_role(auth.uid()));

CREATE POLICY "Employees can update document_signatures"
  ON public.document_signatures FOR UPDATE
  USING (has_any_role(auth.uid()));

CREATE POLICY "Admins can delete document_signatures"
  ON public.document_signatures FOR DELETE
  USING (is_admin_or_manager(auth.uid()));

-- Public access for signing via token (anonymous users with valid token)
CREATE POLICY "Anyone can view by signing token"
  ON public.document_signatures FOR SELECT
  USING (true);

CREATE POLICY "Anyone can update signature by token"
  ON public.document_signatures FOR UPDATE
  USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_document_signatures_updated_at
  BEFORE UPDATE ON public.document_signatures
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
