-- Ensure all authenticated users can view WFH schedules and basic Profile info
-- This allows Pegawai and Atasan to see everyone's WFH status as requested.

-- 1. Profiles: Allow all authenticated users to view all profiles (FOR SELECT only)
DROP POLICY IF EXISTS "Admins and Atasan can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
FOR SELECT USING (auth.role() = 'authenticated');

-- 2. WFH Schedules: Allow all authenticated users to see all schedules
DROP POLICY IF EXISTS "Admins and Atasan can view all schedules" ON wfh_schedules;
DROP POLICY IF EXISTS "Everyone can view WFH schedules" ON wfh_schedules;
CREATE POLICY "Everyone can view WFH schedules" ON wfh_schedules
FOR SELECT USING (auth.role() = 'authenticated');

-- 3. Ensure Atasan can still update schedules for approval (from previous fix)
DROP POLICY IF EXISTS "Admins and Atasan can update schedules" ON wfh_schedules;
CREATE POLICY "Admins and Atasan can update schedules" ON wfh_schedules
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'ATASAN'))
);

-- 4. Attendance: Also allow all authenticated users to view attendance (needed for some dashboard activity views)
-- Actually, the user didn't ask for this, but it might be useful if they want to see WHO is in today.
-- But for now, let's stick to the request.

NOTIFY pgrst, 'reload schema';
