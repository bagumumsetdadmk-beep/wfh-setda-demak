-- 1. Buat fungsi Security Definer untuk mengecek status admin (Mencegah Infinite Recursion)
CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Perbaiki Policy di tabel profiles
DROP POLICY IF EXISTS "Admins can view everything" ON profiles;
CREATE POLICY "Admins can view everything" ON profiles FOR SELECT USING (
  is_admin()
);

-- Atasan/Admin harus bisa juga Insert, Select, Update, Delete di WFH Schedules.

-- Policy untuk INSERT
CREATE POLICY "Admins can insert schedules" ON wfh_schedules FOR INSERT WITH CHECK (
  is_admin()
);

-- Policy untuk SELECT 
CREATE POLICY "Admins can view all schedules" ON wfh_schedules FOR SELECT USING (
  is_admin()
);

-- Policy untuk UPDATE
CREATE POLICY "Admins can update schedules" ON wfh_schedules FOR UPDATE USING (
  is_admin()
);

-- Policy untuk DELETE
CREATE POLICY "Admins can delete schedules" ON wfh_schedules FOR DELETE USING (
  is_admin()
);
