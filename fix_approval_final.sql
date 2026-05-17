-- 1. PASTIKAN KOLOM ADA
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING';
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS catatan TEXT;

ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING';
ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS catatan TEXT;
ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS status_approval TEXT DEFAULT 'PENDING';

-- Sinkronisasi kolom status dan status_approval
UPDATE work_reports SET status = status_approval WHERE status IS NULL OR status = 'PENDING';
UPDATE attendance SET status = 'PENDING' WHERE status IS NULL;
UPDATE work_reports SET status = 'PENDING' WHERE status IS NULL;

-- 2. PASTIKAN RLS FUNCTION BENAR DAN TIDAK RECURSIVE
CREATE OR REPLACE FUNCTION is_admin_or_atasan() RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'ATASAN'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. PERBAIKAN POLICY UNTUK PROFILES KE ADMINISTRATOR DAN ATASAN
DROP POLICY IF EXISTS "Admins and Atasan can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can view everything" ON profiles;
CREATE POLICY "Admins and Atasan can view all profiles" ON profiles 
FOR SELECT USING (is_admin_or_atasan());

-- 4. PERBAIKAN POLICY UNTUK ATTENDANCE
DROP POLICY IF EXISTS "Admins and Atasan can view all attendance" ON attendance;
DROP POLICY IF EXISTS "Admins can view all attendance" ON attendance;
CREATE POLICY "Admins and Atasan can view all attendance" ON attendance
FOR SELECT USING (is_admin_or_atasan());

DROP POLICY IF EXISTS "Admins and Atasan can update attendance status" ON attendance;
CREATE POLICY "Admins and Atasan can update attendance status" ON attendance
FOR UPDATE USING (is_admin_or_atasan());

-- 5. PERBAIKAN POLICY UNTUK WORK_REPORTS
DROP POLICY IF EXISTS "Admins and Atasan can view all work reports" ON work_reports;
DROP POLICY IF EXISTS "Admins can view all reports" ON work_reports;
CREATE POLICY "Admins and Atasan can view all work reports" ON work_reports
FOR SELECT USING (is_admin_or_atasan());

DROP POLICY IF EXISTS "Admins and Atasan can update work reports status" ON work_reports;
CREATE POLICY "Admins and Atasan can update work reports status" ON work_reports
FOR UPDATE USING (is_admin_or_atasan());

-- 6. PERBAIKAN POLICY UNTUK WFH SCHEDULES (Atasan bisa lihat, Admin bisa CRUD)
DROP POLICY IF EXISTS "Admins and Atasan can view all schedules" ON wfh_schedules;
DROP POLICY IF EXISTS "Admins can view all schedules" ON wfh_schedules;
CREATE POLICY "Admins and Atasan can view all schedules" ON wfh_schedules
FOR SELECT USING (is_admin_or_atasan());

-- Refresh schema cache untuk Supabase
NOTIFY pgrst, 'reload schema';
