ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS billing_rate_type text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS billing_rate_amount numeric;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS collection_date_type text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS collection_date date;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS collection_frequency text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS future_payment_method text;

ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS billing_rate_type text;
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS billing_rate_amount numeric;
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS collection_date_type text;
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS collection_date date;
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS collection_frequency text;
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS future_payment_method text;