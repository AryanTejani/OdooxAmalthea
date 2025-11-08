-- helpful indexes for boards and queries
CREATE INDEX IF NOT EXISTS attendance_emp_day_idx ON attendance(employee_id, day);
CREATE INDEX IF NOT EXISTS leave_status_idx ON leave_requests(status, start_date);

