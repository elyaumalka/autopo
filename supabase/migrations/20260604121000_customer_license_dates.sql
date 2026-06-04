-- זיהוי וותק נהיגה ותוקף רישיון: תאריך הנפקה ותוקף הרישיון בכרטיס הלקוח
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS license_issue_date date,
  ADD COLUMN IF NOT EXISTS license_expiry date;
