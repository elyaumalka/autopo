-- ===========================================
-- AUTOPO CRM DATABASE SCHEMA
-- ===========================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- ENUMS
-- ===========================================

-- User roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'employee');

-- Vehicle status enum
CREATE TYPE public.vehicle_status AS ENUM ('זמין', 'מושכר', 'בטיפול', 'תאונה', 'לא פעיל', 'נמכר');

-- Vehicle type enum
CREATE TYPE public.vehicle_type AS ENUM ('5 מקומות', '7 מקומות');

-- Fuel type enum
CREATE TYPE public.fuel_type AS ENUM ('בנזין', 'דיזל', 'היברידי', 'חשמלי');

-- Customer status enum
CREATE TYPE public.customer_status AS ENUM ('פעיל', 'לא פעיל', 'חסום');

-- Payment method enum
CREATE TYPE public.payment_method AS ENUM ('מזומן', 'אשראי', 'צ׳ק', 'העברה בנקאית');

-- Booking status enum
CREATE TYPE public.booking_status AS ENUM ('ממתין', 'מאושר', 'פעיל', 'הושלם', 'בוטל');

-- Rental type enum
CREATE TYPE public.rental_type AS ENUM ('חצי יום', '24 שעות', 'שבוע', 'חודש');

-- Rental status enum
CREATE TYPE public.rental_status AS ENUM ('פעיל', 'הושלם', 'בוטל');

-- Payment status enum
CREATE TYPE public.payment_status AS ENUM ('לא שולם', 'מקדמה', 'שולם');

-- Income type enum
CREATE TYPE public.income_type AS ENUM ('השכרה', 'קילומטרז׳ נוסף', 'דוח תנועה', 'כביש 6', 'נזק', 'אחר');

-- Expense type enum
CREATE TYPE public.expense_type AS ENUM ('דלק', 'טיפול', 'ביטוח', 'רישוי', 'תיקון', 'שטיפה', 'חניה', 'כביש 6', 'הוצאה קבועה', 'אחר');

-- Collection task status enum
CREATE TYPE public.collection_status AS ENUM ('פתוח', 'בטיפול', 'נסגר', 'חלקי');

-- Maintenance type enum
CREATE TYPE public.maintenance_type AS ENUM ('טיפול תקופתי', 'החלפת שמן', 'צמיגים', 'בלמים', 'טסט', 'חידוש רישוי', 'ביטוח', 'אחר');

-- Task status enum
CREATE TYPE public.task_status AS ENUM ('ממתין', 'בתהליך', 'הושלם');

-- General task type enum
CREATE TYPE public.general_task_type AS ENUM ('כללי', 'טלפון', 'פגישה', 'מסמכים', 'אחר');

-- Priority enum
CREATE TYPE public.priority AS ENUM ('נמוכה', 'בינונית', 'גבוהה', 'דחוף');

-- Traffic ticket status enum
CREATE TYPE public.ticket_status AS ENUM ('חדש', 'הועבר ללקוח', 'שולם', 'בערעור');

-- Accident type enum
CREATE TYPE public.accident_type AS ENUM ('תביעה חיצונית', 'תביעה פנימית');

-- Accident status enum
CREATE TYPE public.accident_status AS ENUM ('פתוח', 'בטיפול', 'בהמתנה לביטוח', 'נסגר');

-- ===========================================
-- TABLES
-- ===========================================

-- 1. User Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. User Roles (separate table for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'employee',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (user_id, role)
);

-- 3. Vehicles
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_plate TEXT NOT NULL UNIQUE,
  vehicle_type vehicle_type,
  manufacturer TEXT NOT NULL,
  model TEXT NOT NULL,
  color TEXT,
  year INTEGER,
  fuel_type fuel_type,
  current_km NUMERIC DEFAULT 0,
  monthly_rate NUMERIC,
  daily_rate NUMERIC,
  half_day_rate NUMERIC,
  km_limit NUMERIC,
  extra_km_price NUMERIC,
  hourly_delay_rate NUMERIC,
  status vehicle_status DEFAULT 'זמין' NOT NULL,
  image_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 4. Customers
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  id_number TEXT NOT NULL UNIQUE,
  license_front_url TEXT,
  license_back_url TEXT,
  address TEXT,
  city TEXT,
  payment_method payment_method,
  status customer_status DEFAULT 'פעיל' NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 5. Bookings
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  vehicle_details TEXT,
  start_date DATE NOT NULL,
  start_time TIME,
  end_date DATE NOT NULL,
  end_time TIME,
  rental_type rental_type,
  rental_cost NUMERIC,
  status booking_status DEFAULT 'ממתין' NOT NULL,
  payment_status payment_status DEFAULT 'לא שולם',
  deposit_amount NUMERIC,
  contract_signed BOOLEAN DEFAULT false,
  contract_url TEXT,
  declaration_signed BOOLEAN DEFAULT false,
  declaration_url TEXT,
  waiver_signed BOOLEAN DEFAULT false,
  waiver_url TEXT,
  credit_hold NUMERIC,
  payment_method payment_method,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 6. Rentals
CREATE TABLE public.rentals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  vehicle_details TEXT,
  start_date DATE NOT NULL,
  start_time TIME,
  start_km NUMERIC,
  planned_end_date DATE,
  planned_end_time TIME,
  actual_end_date DATE,
  actual_end_time TIME,
  end_km NUMERIC,
  extra_km NUMERIC,
  extra_km_cost NUMERIC,
  base_cost NUMERIC,
  additional_charges NUMERIC DEFAULT 0,
  additional_charges_details TEXT,
  total_cost NUMERIC,
  paid_amount NUMERIC DEFAULT 0,
  remaining_payment NUMERIC,
  credit_hold NUMERIC,
  status rental_status DEFAULT 'פעיל' NOT NULL,
  invoice_number TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 7. Incomes
CREATE TABLE public.incomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  rental_id UUID REFERENCES public.rentals(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  date DATE NOT NULL,
  type income_type NOT NULL,
  payment_method payment_method,
  invoice_number TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 8. Expenses
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  vehicle_details TEXT,
  type expense_type NOT NULL,
  description TEXT,
  amount NUMERIC NOT NULL,
  date DATE NOT NULL,
  payment_method payment_method,
  is_recurring BOOLEAN DEFAULT false,
  receipt_url TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 9. Collection Tasks
CREATE TABLE public.collection_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  rental_id UUID REFERENCES public.rentals(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  vehicle_details TEXT,
  debt_date DATE,
  payment_due_date DATE,
  amount NUMERIC NOT NULL,
  reason TEXT,
  status collection_status DEFAULT 'פתוח' NOT NULL,
  paid_amount NUMERIC DEFAULT 0,
  call_history JSONB DEFAULT '[]'::jsonb,
  reminder_date DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 10. Maintenance Tasks
CREATE TABLE public.maintenance_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE NOT NULL,
  vehicle_details TEXT,
  type maintenance_type NOT NULL,
  description TEXT,
  due_date DATE,
  due_km NUMERIC,
  status task_status DEFAULT 'ממתין' NOT NULL,
  completed_date DATE,
  cost NUMERIC,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 11. General Tasks
CREATE TABLE public.general_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  type general_task_type DEFAULT 'כללי',
  description TEXT,
  due_date DATE NOT NULL,
  due_time TIME,
  reminder_date DATE,
  reminder_time TIME,
  priority priority DEFAULT 'בינונית' NOT NULL,
  status task_status DEFAULT 'ממתין' NOT NULL,
  notes TEXT,
  assigned_to UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 12. Traffic Tickets
CREATE TABLE public.traffic_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL NOT NULL,
  vehicle_details TEXT,
  ticket_number TEXT NOT NULL,
  location TEXT,
  date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  status ticket_status DEFAULT 'חדש' NOT NULL,
  driver_declaration BOOLEAN DEFAULT false,
  company_declaration BOOLEAN DEFAULT false,
  declaration_url TEXT,
  paid_date DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 13. Accidents
CREATE TABLE public.accidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL NOT NULL,
  vehicle_details TEXT,
  date DATE NOT NULL,
  type accident_type NOT NULL,
  other_party_name TEXT,
  other_party_phone TEXT,
  other_party_id TEXT,
  other_vehicle_plate TEXT,
  description TEXT,
  damage_photos JSONB DEFAULT '[]'::jsonb,
  status accident_status DEFAULT 'פתוח' NOT NULL,
  insurance_claim_number TEXT,
  estimated_cost NUMERIC,
  actual_cost NUMERIC,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ===========================================
-- SECURITY DEFINER FUNCTIONS
-- ===========================================

-- Function to check user role (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if user is admin or manager
CREATE OR REPLACE FUNCTION public.is_admin_or_manager(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'manager')
  )
$$;

-- Function to check if user has any role (is authenticated employee)
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
  )
$$;

-- ===========================================
-- TRIGGERS
-- ===========================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for all tables with updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_rentals_updated_at BEFORE UPDATE ON public.rentals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_incomes_updated_at BEFORE UPDATE ON public.incomes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_collection_tasks_updated_at BEFORE UPDATE ON public.collection_tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_maintenance_tasks_updated_at BEFORE UPDATE ON public.maintenance_tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_general_tasks_updated_at BEFORE UPDATE ON public.general_tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_traffic_tickets_updated_at BEFORE UPDATE ON public.traffic_tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_accidents_updated_at BEFORE UPDATE ON public.accidents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===========================================
-- ENABLE RLS
-- ===========================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.general_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.traffic_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accidents ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- RLS POLICIES
-- ===========================================

-- Profiles: Users can read/update their own profile
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- User Roles: Only admins can manage roles, users can view their own
CREATE POLICY "Users can view their own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Vehicles: All authenticated employees can view/manage
CREATE POLICY "Employees can view vehicles" ON public.vehicles FOR SELECT USING (public.has_any_role(auth.uid()));
CREATE POLICY "Employees can insert vehicles" ON public.vehicles FOR INSERT WITH CHECK (public.has_any_role(auth.uid()));
CREATE POLICY "Employees can update vehicles" ON public.vehicles FOR UPDATE USING (public.has_any_role(auth.uid()));
CREATE POLICY "Admins can delete vehicles" ON public.vehicles FOR DELETE USING (public.is_admin_or_manager(auth.uid()));

-- Customers: All authenticated employees can view/manage
CREATE POLICY "Employees can view customers" ON public.customers FOR SELECT USING (public.has_any_role(auth.uid()));
CREATE POLICY "Employees can insert customers" ON public.customers FOR INSERT WITH CHECK (public.has_any_role(auth.uid()));
CREATE POLICY "Employees can update customers" ON public.customers FOR UPDATE USING (public.has_any_role(auth.uid()));
CREATE POLICY "Admins can delete customers" ON public.customers FOR DELETE USING (public.is_admin_or_manager(auth.uid()));

-- Bookings: All authenticated employees can view/manage
CREATE POLICY "Employees can view bookings" ON public.bookings FOR SELECT USING (public.has_any_role(auth.uid()));
CREATE POLICY "Employees can insert bookings" ON public.bookings FOR INSERT WITH CHECK (public.has_any_role(auth.uid()));
CREATE POLICY "Employees can update bookings" ON public.bookings FOR UPDATE USING (public.has_any_role(auth.uid()));
CREATE POLICY "Admins can delete bookings" ON public.bookings FOR DELETE USING (public.is_admin_or_manager(auth.uid()));

-- Rentals: All authenticated employees can view/manage
CREATE POLICY "Employees can view rentals" ON public.rentals FOR SELECT USING (public.has_any_role(auth.uid()));
CREATE POLICY "Employees can insert rentals" ON public.rentals FOR INSERT WITH CHECK (public.has_any_role(auth.uid()));
CREATE POLICY "Employees can update rentals" ON public.rentals FOR UPDATE USING (public.has_any_role(auth.uid()));
CREATE POLICY "Admins can delete rentals" ON public.rentals FOR DELETE USING (public.is_admin_or_manager(auth.uid()));

-- Incomes: All authenticated employees can view/manage
CREATE POLICY "Employees can view incomes" ON public.incomes FOR SELECT USING (public.has_any_role(auth.uid()));
CREATE POLICY "Employees can insert incomes" ON public.incomes FOR INSERT WITH CHECK (public.has_any_role(auth.uid()));
CREATE POLICY "Employees can update incomes" ON public.incomes FOR UPDATE USING (public.has_any_role(auth.uid()));
CREATE POLICY "Admins can delete incomes" ON public.incomes FOR DELETE USING (public.is_admin_or_manager(auth.uid()));

-- Expenses: All authenticated employees can view/manage
CREATE POLICY "Employees can view expenses" ON public.expenses FOR SELECT USING (public.has_any_role(auth.uid()));
CREATE POLICY "Employees can insert expenses" ON public.expenses FOR INSERT WITH CHECK (public.has_any_role(auth.uid()));
CREATE POLICY "Employees can update expenses" ON public.expenses FOR UPDATE USING (public.has_any_role(auth.uid()));
CREATE POLICY "Admins can delete expenses" ON public.expenses FOR DELETE USING (public.is_admin_or_manager(auth.uid()));

-- Collection Tasks: All authenticated employees can view/manage
CREATE POLICY "Employees can view collection_tasks" ON public.collection_tasks FOR SELECT USING (public.has_any_role(auth.uid()));
CREATE POLICY "Employees can insert collection_tasks" ON public.collection_tasks FOR INSERT WITH CHECK (public.has_any_role(auth.uid()));
CREATE POLICY "Employees can update collection_tasks" ON public.collection_tasks FOR UPDATE USING (public.has_any_role(auth.uid()));
CREATE POLICY "Admins can delete collection_tasks" ON public.collection_tasks FOR DELETE USING (public.is_admin_or_manager(auth.uid()));

-- Maintenance Tasks: All authenticated employees can view/manage
CREATE POLICY "Employees can view maintenance_tasks" ON public.maintenance_tasks FOR SELECT USING (public.has_any_role(auth.uid()));
CREATE POLICY "Employees can insert maintenance_tasks" ON public.maintenance_tasks FOR INSERT WITH CHECK (public.has_any_role(auth.uid()));
CREATE POLICY "Employees can update maintenance_tasks" ON public.maintenance_tasks FOR UPDATE USING (public.has_any_role(auth.uid()));
CREATE POLICY "Admins can delete maintenance_tasks" ON public.maintenance_tasks FOR DELETE USING (public.is_admin_or_manager(auth.uid()));

-- General Tasks: All authenticated employees can view/manage
CREATE POLICY "Employees can view general_tasks" ON public.general_tasks FOR SELECT USING (public.has_any_role(auth.uid()));
CREATE POLICY "Employees can insert general_tasks" ON public.general_tasks FOR INSERT WITH CHECK (public.has_any_role(auth.uid()));
CREATE POLICY "Employees can update general_tasks" ON public.general_tasks FOR UPDATE USING (public.has_any_role(auth.uid()));
CREATE POLICY "Admins can delete general_tasks" ON public.general_tasks FOR DELETE USING (public.is_admin_or_manager(auth.uid()));

-- Traffic Tickets: All authenticated employees can view/manage
CREATE POLICY "Employees can view traffic_tickets" ON public.traffic_tickets FOR SELECT USING (public.has_any_role(auth.uid()));
CREATE POLICY "Employees can insert traffic_tickets" ON public.traffic_tickets FOR INSERT WITH CHECK (public.has_any_role(auth.uid()));
CREATE POLICY "Employees can update traffic_tickets" ON public.traffic_tickets FOR UPDATE USING (public.has_any_role(auth.uid()));
CREATE POLICY "Admins can delete traffic_tickets" ON public.traffic_tickets FOR DELETE USING (public.is_admin_or_manager(auth.uid()));

-- Accidents: All authenticated employees can view/manage
CREATE POLICY "Employees can view accidents" ON public.accidents FOR SELECT USING (public.has_any_role(auth.uid()));
CREATE POLICY "Employees can insert accidents" ON public.accidents FOR INSERT WITH CHECK (public.has_any_role(auth.uid()));
CREATE POLICY "Employees can update accidents" ON public.accidents FOR UPDATE USING (public.has_any_role(auth.uid()));
CREATE POLICY "Admins can delete accidents" ON public.accidents FOR DELETE USING (public.is_admin_or_manager(auth.uid()));

-- ===========================================
-- STORAGE BUCKETS
-- ===========================================

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('vehicle-images', 'vehicle-images', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('customer-documents', 'customer-documents', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('contracts', 'contracts', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('accident-photos', 'accident-photos', false);

-- Storage policies for vehicle-images (public)
CREATE POLICY "Public can view vehicle images" ON storage.objects FOR SELECT USING (bucket_id = 'vehicle-images');
CREATE POLICY "Employees can upload vehicle images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'vehicle-images' AND public.has_any_role(auth.uid()));
CREATE POLICY "Employees can update vehicle images" ON storage.objects FOR UPDATE USING (bucket_id = 'vehicle-images' AND public.has_any_role(auth.uid()));
CREATE POLICY "Admins can delete vehicle images" ON storage.objects FOR DELETE USING (bucket_id = 'vehicle-images' AND public.is_admin_or_manager(auth.uid()));

-- Storage policies for customer-documents
CREATE POLICY "Employees can view customer documents" ON storage.objects FOR SELECT USING (bucket_id = 'customer-documents' AND public.has_any_role(auth.uid()));
CREATE POLICY "Employees can upload customer documents" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'customer-documents' AND public.has_any_role(auth.uid()));
CREATE POLICY "Employees can update customer documents" ON storage.objects FOR UPDATE USING (bucket_id = 'customer-documents' AND public.has_any_role(auth.uid()));
CREATE POLICY "Admins can delete customer documents" ON storage.objects FOR DELETE USING (bucket_id = 'customer-documents' AND public.is_admin_or_manager(auth.uid()));

-- Storage policies for contracts
CREATE POLICY "Employees can view contracts" ON storage.objects FOR SELECT USING (bucket_id = 'contracts' AND public.has_any_role(auth.uid()));
CREATE POLICY "Employees can upload contracts" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'contracts' AND public.has_any_role(auth.uid()));
CREATE POLICY "Employees can update contracts" ON storage.objects FOR UPDATE USING (bucket_id = 'contracts' AND public.has_any_role(auth.uid()));
CREATE POLICY "Admins can delete contracts" ON storage.objects FOR DELETE USING (bucket_id = 'contracts' AND public.is_admin_or_manager(auth.uid()));

-- Storage policies for receipts
CREATE POLICY "Employees can view receipts" ON storage.objects FOR SELECT USING (bucket_id = 'receipts' AND public.has_any_role(auth.uid()));
CREATE POLICY "Employees can upload receipts" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'receipts' AND public.has_any_role(auth.uid()));
CREATE POLICY "Employees can update receipts" ON storage.objects FOR UPDATE USING (bucket_id = 'receipts' AND public.has_any_role(auth.uid()));
CREATE POLICY "Admins can delete receipts" ON storage.objects FOR DELETE USING (bucket_id = 'receipts' AND public.is_admin_or_manager(auth.uid()));

-- Storage policies for accident-photos
CREATE POLICY "Employees can view accident photos" ON storage.objects FOR SELECT USING (bucket_id = 'accident-photos' AND public.has_any_role(auth.uid()));
CREATE POLICY "Employees can upload accident photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'accident-photos' AND public.has_any_role(auth.uid()));
CREATE POLICY "Employees can update accident photos" ON storage.objects FOR UPDATE USING (bucket_id = 'accident-photos' AND public.has_any_role(auth.uid()));
CREATE POLICY "Admins can delete accident photos" ON storage.objects FOR DELETE USING (bucket_id = 'accident-photos' AND public.is_admin_or_manager(auth.uid()));