-- Fix check constraint on attendance status to allow 'REVISION'
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_status_check;
ALTER TABLE attendance ADD CONSTRAINT attendance_status_check CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'REVISION'));

-- Ensure status column exists if it doesn't (just in case)
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING';

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
