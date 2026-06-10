-- הגדרות פר-השכרה לתחנת ההשכרה:
-- האם נדרשת תפיסת מסגרת אשראי, ומצב תשלום מראש (אופציונלי / חובה / חלקי-חובה)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS require_credit_hold boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS prepay_mode text NOT NULL DEFAULT 'optional';
