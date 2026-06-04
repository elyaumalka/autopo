-- שריון לטיפול לפי שעות / חצי יום: הוספת שעת התחלה ושעת סיום למשימות תחזוקה
ALTER TABLE public.maintenance_tasks
  ADD COLUMN IF NOT EXISTS start_time time,
  ADD COLUMN IF NOT EXISTS end_time time;
