-- FIX RLS for ATASAN and ADMIN to view all data for approval
-- 1. Profiles
DROP POLICY IF EXISTS "Admins can view everything" ON profiles;
CREATE POLICY "Admins and Atasan can view all profiles" ON profiles 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role IN ('ADMIN', 'ATASAN')
  )
);

-- 2. Attendance
DROP POLICY IF EXISTS "Admins can view all attendance" ON attendance;
CREATE POLICY "Admins and Atasan can view all attendance" ON attendance
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role IN ('ADMIN', 'ATASAN')
  )
);

DROP POLICY IF EXISTS "Admins can update attendance status" ON attendance;
CREATE POLICY "Admins and Atasan can update attendance status" ON attendance
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role IN ('ADMIN', 'ATASAN')
  )
);

-- 3. Work Reports
DROP POLICY IF EXISTS "Admins can view all work reports" ON work_reports;
CREATE POLICY "Admins and Atasan can view all work reports" ON work_reports
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role IN ('ADMIN', 'ATASAN')
  )
);

DROP POLICY IF EXISTS "Admins can update work reports status" ON work_reports;
CREATE POLICY "Admins and Atasan can update work reports status" ON work_reports
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role IN ('ADMIN', 'ATASAN')
  )
);

-- 4. WFH Schedules
DROP POLICY IF EXISTS "Admins can view all schedules" ON wfh_schedules;
CREATE POLICY "Admins and Atasan can view all schedules" ON wfh_schedules
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role IN ('ADMIN', 'ATASAN')
  )
);

DROP POLICY IF EXISTS "Admins can manage schedules" ON wfh_schedules;
CREATE POLICY "Admins and Atasan can manage schedules" ON wfh_schedules
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role IN ('ADMIN', 'ATASAN')
  )
);

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
