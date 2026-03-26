
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS weekly_rate numeric;

ALTER TABLE public.rentals 
  ADD COLUMN IF NOT EXISTS toll_charges numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rental_type text,
  ADD COLUMN IF NOT EXISTS rate_per_unit numeric;
