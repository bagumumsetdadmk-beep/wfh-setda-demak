ALTER TABLE work_reports DROP CONSTRAINT IF EXISTS work_reports_user_id_date_key;
ALTER TABLE work_reports DROP CONSTRAINT IF EXISTS work_reports_user_id_tanggal_key;
ALTER TABLE work_reports DROP CONSTRAINT IF EXISTS work_reports_user_id_tanggal_tipe_key;

-- Add a new unique constraint allowing one of each type per user per day
ALTER TABLE work_reports ADD CONSTRAINT work_reports_user_id_tanggal_tipe_key UNIQUE (user_id, tanggal, tipe);
