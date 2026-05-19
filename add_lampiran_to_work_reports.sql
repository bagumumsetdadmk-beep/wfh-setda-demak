-- 1. Tambahkan kolom lampiran ke tabel work_reports
ALTER TABLE work_reports 
ADD COLUMN IF NOT EXISTS lampiran TEXT;
