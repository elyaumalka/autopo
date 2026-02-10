-- Add photos column to rentals for storing rental images
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS photos jsonb DEFAULT '[]'::jsonb;