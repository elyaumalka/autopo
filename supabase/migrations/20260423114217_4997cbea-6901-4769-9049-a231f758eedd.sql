
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS occupied_slots jsonb DEFAULT null;
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS occupied_slots jsonb DEFAULT null;
