CREATE OR REPLACE FUNCTION rt_notify() RETURNS trigger AS $$
DECLARE payload json;
BEGIN
  IF TG_OP = 'INSERT' THEN
    payload := json_build_object('table', TG_TABLE_NAME, 'op', TG_OP, 'row', row_to_json(NEW));
  ELSE
    payload := json_build_object('table', TG_TABLE_NAME, 'op', TG_OP, 'row', row_to_json(NEW), 'old', row_to_json(OLD));
  END IF;
  PERFORM pg_notify('realtime', payload::text);
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS rt_attendance ON attendance;
CREATE TRIGGER rt_attendance AFTER INSERT OR UPDATE ON attendance FOR EACH ROW EXECUTE FUNCTION rt_notify();

DROP TRIGGER IF EXISTS rt_leave_requests ON leave_requests;
CREATE TRIGGER rt_leave_requests AFTER INSERT OR UPDATE ON leave_requests FOR EACH ROW EXECUTE FUNCTION rt_notify();

