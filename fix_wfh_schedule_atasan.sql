-- Izinkan atasan untuk update status jadwal WFH
DROP POLICY IF EXISTS "Only Admins can update schedules" ON wfh_schedules;

CREATE POLICY "Admins and Atasan can update schedules" ON wfh_schedules
FOR UPDATE USING (is_admin_or_atasan());

NOTIFY pgrst, 'reload schema';
