-- ====================================================================
-- חובה להריץ פעם אחת ב-Supabase → SQL Editor כדי שהכל יעבוד.
-- (העמודות האלה דרושות לשעות שריון טיפול ולתוקף/הנפקת רישיון)
-- ====================================================================

-- שעות שריון לטיפול (חצי יום / טווח שעות)
ALTER TABLE public.maintenance_tasks
  ADD COLUMN IF NOT EXISTS start_time time,
  ADD COLUMN IF NOT EXISTS end_time time;

-- תאריך הנפקה ותוקף רישיון נהיגה (זיהוי וותק + תוקף)
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS license_issue_date date,
  ADD COLUMN IF NOT EXISTS license_expiry date;
