-- Migration: Add task_name to time_logs table for manual task entry
-- This allows users to manually enter task names without requiring projects/tasks

ALTER TABLE time_logs 
ADD COLUMN IF NOT EXISTS task_name text;

-- Create index for task_name searches
CREATE INDEX IF NOT EXISTS time_logs_task_name_idx ON time_logs(task_name) WHERE task_name IS NOT NULL;

COMMENT ON COLUMN time_logs.task_name IS 'Manual task name entered by user (alternative to task_id/project_id)';

