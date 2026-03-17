-- Drop the overly permissive update policy
DROP POLICY IF EXISTS "Public can update license URLs" ON public.customers;

-- Create a more restrictive policy: public can only update via edge function
-- The upload will go through an edge function that validates the token
-- No direct public UPDATE needed on the table