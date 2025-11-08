-- PostgreSQL triggers for realtime NOTIFY
-- Run this after running migrations

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Function to notify on attendance changes
CREATE OR REPLACE FUNCTION notify_attendance_change()
RETURNS TRIGGER AS $$
DECLARE
  payload JSON;
BEGIN
  payload = json_build_object(
    'table', 'attendance',
    'op', TG_OP,
    'row', json_build_object(
      'id', NEW.id,
      'employeeId', NEW."employeeId",
      'day', NEW.day,
      'inAt', NEW."inAt",
      'outAt', NEW."outAt",
      'status', NEW.status
    )
  );
  
  PERFORM pg_notify('realtime', payload::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for attendance INSERT/UPDATE
DROP TRIGGER IF EXISTS attendance_notify ON "Attendance";
CREATE TRIGGER attendance_notify
  AFTER INSERT OR UPDATE ON "Attendance"
  FOR EACH ROW
  EXECUTE FUNCTION notify_attendance_change();

-- Function to notify on leave request changes
CREATE OR REPLACE FUNCTION notify_leave_change()
RETURNS TRIGGER AS $$
DECLARE
  payload JSON;
BEGIN
  payload = json_build_object(
    'table', 'leaveRequest',
    'op', TG_OP,
    'row', json_build_object(
      'id', NEW.id,
      'employeeId', NEW."employeeId",
      'type', NEW.type,
      'startDate', NEW."startDate",
      'endDate', NEW."endDate",
      'status', NEW.status,
      'approverId', NEW."approverId"
    )
  );
  
  PERFORM pg_notify('realtime', payload::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for leave request INSERT/UPDATE
DROP TRIGGER IF EXISTS leave_request_notify ON "LeaveRequest";
CREATE TRIGGER leave_request_notify
  AFTER INSERT OR UPDATE ON "LeaveRequest"
  FOR EACH ROW
  EXECUTE FUNCTION notify_leave_change();

-- Auto-update updated_at timestamp (if not using Prisma @updatedAt)
-- This is optional as Prisma handles @updatedAt automatically
-- But can be useful for manual updates


