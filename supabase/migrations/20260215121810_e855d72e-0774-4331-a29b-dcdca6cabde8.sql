
-- Drop the overly permissive policies
DROP POLICY "Anyone can view by signing token" ON public.document_signatures;
DROP POLICY "Anyone can update signature by token" ON public.document_signatures;
