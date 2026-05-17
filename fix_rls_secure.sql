-- CREATE FUNCTIONS TO AVOID INFINITE RECURSION
CREATE OR REPLACE FUNCTION is_atasan() RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ATASAN');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_admin_or_atasan() RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'ATASAN'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. Profiles: Izinkan Admin dan Atasan melihat semua profil pegawai
DROP POLICY IF EXISTS "Admins and Atasan can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can view everything" ON profiles;
CREATE POLICY "Admins and Atasan can view all profiles" ON profiles 
FOR SELECT USING (is_admin_or_atasan());

-- 2. Attendance: Izinkan Admin dan Atasan melihat dan mengupdate status semua absensi
DROP POLICY IF EXISTS "Admins and Atasan can view all attendance" ON attendance;
DROP POLICY IF EXISTS "Admins can view all attendance" ON attendance;
CREATE POLICY "Admins and Atasan can view all attendance" ON attendance
FOR SELECT USING (is_admin_or_atasan());

DROP POLICY IF EXISTS "Admins and Atasan can update attendance status" ON attendance;
CREATE POLICY "Admins and Atasan can update attendance status" ON attendance
FOR UPDATE USING (is_admin_or_atasan());

-- 3. Work Reports: Izinkan Admin dan Atasan melihat dan mengupdate status semua laporan
DROP POLICY IF EXISTS "Admins and Atasan can view all work reports" ON work_reports;
DROP POLICY IF EXISTS "Admins can view all reports" ON work_reports;
CREATE POLICY "Admins and Atasan can view all work reports" ON work_reports
FOR SELECT USING (is_admin_or_atasan());

DROP POLICY IF EXISTS "Admins and Atasan can update work reports status" ON work_reports;
CREATE POLICY "Admins and Atasan can update work reports status" ON work_reports
FOR UPDATE USING (is_admin_or_atasan());

-- 4. WFH Schedules: Izinkan Admin dan Atasan melihat semua jadwal ploting
DROP POLICY IF EXISTS "Admins and Atasan can view all schedules" ON wfh_schedules;
DROP POLICY IF EXISTS "Admins can view all schedules" ON wfh_schedules;
CREATE POLICY "Admins and Atasan can view all schedules" ON wfh_schedules
FOR SELECT USING (is_admin_or_atasan());

-- Hanya Admin yang bisa mengelola (CRUD) Jadwal WFH
DROP POLICY IF EXISTS "Only Admins can manage schedules" ON wfh_schedules;
DROP POLICY IF EXISTS "Admins can manage schedules" ON wfh_schedules;
DROP POLICY IF EXISTS "Admins can insert schedules" ON wfh_schedules;
DROP POLICY IF EXISTS "Admins can update schedules" ON wfh_schedules;
DROP POLICY IF EXISTS "Admins can delete schedules" ON wfh_schedules;

CREATE POLICY "Only Admins can insert schedules" ON wfh_schedules
FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "Only Admins can update schedules" ON wfh_schedules
FOR UPDATE USING (is_admin());

CREATE POLICY "Only Admins can delete schedules" ON wfh_schedules
FOR DELETE USING (is_admin());

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
