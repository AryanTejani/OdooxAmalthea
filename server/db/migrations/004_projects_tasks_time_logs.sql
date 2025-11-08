-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        text NOT NULL,
  description text,
  status      text NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'COMPLETED', 'ON_HOLD'
  created_by  uuid REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS projects_status_idx ON projects(status);
CREATE INDEX IF NOT EXISTS projects_created_by_idx ON projects(created_by);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES employees(id) ON DELETE SET NULL, -- assigned employee
  title       text NOT NULL,
  description text,
  status      text NOT NULL DEFAULT 'TODO', -- 'TODO', 'IN_PROGRESS', 'COMPLETED'
  priority    text NOT NULL DEFAULT 'MEDIUM', -- 'LOW', 'MEDIUM', 'HIGH'
  due_date    date,
  created_by  uuid REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tasks_project_idx ON tasks(project_id);
CREATE INDEX IF NOT EXISTS tasks_employee_idx ON tasks(employee_id);
CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks(status);

-- Time logs table (like Clockies - tracks time spent on tasks)
CREATE TABLE IF NOT EXISTS time_logs (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  task_id     uuid REFERENCES tasks(id) ON DELETE SET NULL, -- optional: can log time without task
  project_id  uuid REFERENCES projects(id) ON DELETE SET NULL, -- optional: can log time directly to project
  description text, -- what the employee was working on
  start_time  timestamptz NOT NULL,
  end_time    timestamptz, -- null means timer is still running
  duration    integer, -- duration in seconds (calculated)
  billable    boolean NOT NULL DEFAULT true, -- billable vs non-billable hours
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS time_logs_employee_idx ON time_logs(employee_id);
CREATE INDEX IF NOT EXISTS time_logs_task_idx ON time_logs(task_id);
CREATE INDEX IF NOT EXISTS time_logs_project_idx ON time_logs(project_id);
CREATE INDEX IF NOT EXISTS time_logs_start_time_idx ON time_logs(start_time);
CREATE INDEX IF NOT EXISTS time_logs_employee_start_idx ON time_logs(employee_id, start_time);

-- Add updated_at trigger for new tables
DROP TRIGGER IF EXISTS upd_projects ON projects;
CREATE TRIGGER upd_projects BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS upd_tasks ON tasks;
CREATE TRIGGER upd_tasks BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS upd_time_logs ON time_logs;
CREATE TRIGGER upd_time_logs BEFORE UPDATE ON time_logs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Add realtime triggers for time_logs
DROP TRIGGER IF EXISTS rt_time_logs ON time_logs;
CREATE TRIGGER rt_time_logs AFTER INSERT OR UPDATE OR DELETE ON time_logs FOR EACH ROW EXECUTE FUNCTION rt_notify();

-- Add realtime triggers for tasks
DROP TRIGGER IF EXISTS rt_tasks ON tasks;
CREATE TRIGGER rt_tasks AFTER INSERT OR UPDATE OR DELETE ON tasks FOR EACH ROW EXECUTE FUNCTION rt_notify();

-- Add realtime triggers for projects
DROP TRIGGER IF EXISTS rt_projects ON projects;
CREATE TRIGGER rt_projects AFTER INSERT OR UPDATE OR DELETE ON projects FOR EACH ROW EXECUTE FUNCTION rt_notify();

