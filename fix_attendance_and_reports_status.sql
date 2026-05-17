-- Add status and feedback columns to attendance and work_reports
ALTER TABLE attendance 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS catatan TEXT;

ALTER TABLE work_reports 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS catatan TEXT;

-- Reload schema cache Supabase
NOTIFY pgrst, 'reload schema';
