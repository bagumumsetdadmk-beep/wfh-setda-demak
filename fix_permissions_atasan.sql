-- KOMPREHENSIF FIX RLS untuk role ATASAN dan ADMIN
-- Jalankan kode ini di SQL Editor Supabase Anda untuk memastikan data muncul di Dashboard dan Persetujuan.

-- 1. Profiles: Izinkan Admin dan Atasan melihat semua profil pegawai
DROP POLICY IF EXISTS "Admins and Atasan can view all profiles" ON profiles;
CREATE POLICY "Admins and Atasan can view all profiles" ON profiles 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role IN ('ADMIN', 'ATASAN')
  )
);

-- 2. Attendance: Izinkan Admin dan Atasan melihat dan mengupdate status semua absensi
DROP POLICY IF EXISTS "Admins and Atasan can view all attendance" ON attendance;
CREATE POLICY "Admins and Atasan can view all attendance" ON attendance
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role IN ('ADMIN', 'ATASAN')
  )
);

DROP POLICY IF EXISTS "Admins and Atasan can update attendance status" ON attendance;
CREATE POLICY "Admins and Atasan can update attendance status" ON attendance
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role IN ('ADMIN', 'ATASAN')
  )
);

-- 3. Work Reports: Izinkan Admin dan Atasan melihat dan mengupdate status semua laporan
DROP POLICY IF EXISTS "Admins and Atasan can view all work reports" ON work_reports;
CREATE POLICY "Admins and Atasan can view all work reports" ON work_reports
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role IN ('ADMIN', 'ATASAN')
  )
);

DROP POLICY IF EXISTS "Admins and Atasan can update work reports status" ON work_reports;
CREATE POLICY "Admins and Atasan can update work reports status" ON work_reports
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role IN ('ADMIN', 'ATASAN')
  )
);

-- 4. WFH Schedules: Izinkan Admin dan Atasan melihat semua jadwal ploting
DROP POLICY IF EXISTS "Admins and Atasan can view all schedules" ON wfh_schedules;
CREATE POLICY "Admins and Atasan can view all schedules" ON wfh_schedules
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role IN ('ADMIN', 'ATASAN')
  )
);

-- Hanya Admin yang bisa mengelola (CRUD) Jadwal WFH
DROP POLICY IF EXISTS "Only Admins can manage schedules" ON wfh_schedules;
CREATE POLICY "Only Admins can manage schedules" ON wfh_schedules
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'ADMIN'
  )
);

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
