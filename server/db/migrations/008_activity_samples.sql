-- Activity samples table for minute-by-minute activity tracking
-- Used to compute attendance and work hours from time tracker data

CREATE TABLE IF NOT EXISTS activity_samples (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  minute_start timestamptz NOT NULL,
  idle_ms integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activity_samples_employee_minute_unique UNIQUE(employee_id, minute_start)
);

-- Index for fast queries
-- Primary index on employee_id and minute_start (covers UNIQUE constraint and most queries)
CREATE INDEX IF NOT EXISTS activity_samples_employee_minute_start_idx ON activity_samples(employee_id, minute_start);

-- Index on minute_start for time-range queries
CREATE INDEX IF NOT EXISTS activity_samples_minute_start_idx ON activity_samples(minute_start);

-- Add realtime trigger for activity_samples
DROP TRIGGER IF EXISTS rt_activity_samples ON activity_samples;
CREATE TRIGGER rt_activity_samples AFTER INSERT OR UPDATE ON activity_samples FOR EACH ROW EXECUTE FUNCTION rt_notify();

-- Comment for documentation
COMMENT ON TABLE activity_samples IS 'Minute-by-minute activity samples for computing attendance. idle_ms is 0-60000ms idle within that minute. Active minutes = 60 - (idle_ms/1000) seconds.';

