-- Fix check constraint on work_reports status and status_approval
ALTER TABLE work_reports DROP CONSTRAINT IF EXISTS work_reports_status_approval_check;
ALTER TABLE work_reports DROP CONSTRAINT IF EXISTS work_reports_status_check;
ALTER TABLE work_reports ADD CONSTRAINT work_reports_status_approval_check CHECK (status_approval IN ('PENDING', 'APPROVED', 'REJECTED', 'REVISION'));
ALTER TABLE work_reports ADD CONSTRAINT work_reports_status_check CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'REVISION'));
