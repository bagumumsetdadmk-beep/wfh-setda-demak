-- Ensure Pegawai can update their own work reports
-- This is needed if previous RLS fixes accidentally removed the "FOR ALL" or "FOR UPDATE" policy for owners.

DROP POLICY IF EXISTS "Users can manage their own reports" ON work_reports;
CREATE POLICY "Users can manage their own reports" ON work_reports 
FOR ALL USING (auth.uid() = user_id);

-- Also ensure Atasan can view and update status
DROP POLICY IF EXISTS "Admins and Atasan can view all work reports v2" ON work_reports;
CREATE POLICY "Admins and Atasan can view all work reports v2" ON work_reports
FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'ATASAN'))
);

DROP POLICY IF EXISTS "Admins and Atasan can update work reports status v2" ON work_reports;
CREATE POLICY "Admins and Atasan can update work reports status v2" ON work_reports
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'ATASAN'))
);

-- Ensure updated_at exists on work_reports and attendance (optional but good practice)
-- If we want to use updated_at in the future, uncomment these:
-- ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
-- ALTER TABLE attendance ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

NOTIFY pgrst, 'reload schema';
