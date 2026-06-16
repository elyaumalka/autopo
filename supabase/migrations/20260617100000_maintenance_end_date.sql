-- שריון לטיפול כרשומה אחת שנפרשת על טווח תאריכים (כמו הזמנה), במקום שורה לכל יום
ALTER TABLE public.maintenance_tasks
  ADD COLUMN IF NOT EXISTS end_date date;
