
ALTER TABLE public.customers
  ADD COLUMN is_foreign BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN passport_url TEXT;

CREATE TABLE public.customer_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  document_name TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'אחר',
  file_url TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees can view customer_documents" ON public.customer_documents
  FOR SELECT TO public USING (has_any_role(auth.uid()));

CREATE POLICY "Employees can insert customer_documents" ON public.customer_documents
  FOR INSERT TO public WITH CHECK (has_any_role(auth.uid()));

CREATE POLICY "Employees can update customer_documents" ON public.customer_documents
  FOR UPDATE TO public USING (has_any_role(auth.uid()));

CREATE POLICY "Admins can delete customer_documents" ON public.customer_documents
  FOR DELETE TO public USING (is_admin_or_manager(auth.uid()));
