-- Migration: Add user assignments to projects and tasks
-- Allow multiple users to be assigned to projects and tasks

-- Project users junction table
CREATE TABLE IF NOT EXISTS project_users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);
CREATE INDEX IF NOT EXISTS project_users_project_idx ON project_users(project_id);
CREATE INDEX IF NOT EXISTS project_users_user_idx ON project_users(user_id);
CREATE INDEX IF NOT EXISTS project_users_company_idx ON project_users(company_id);

-- Task users junction table (for multiple assignees)
CREATE TABLE IF NOT EXISTS task_users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(task_id, user_id)
);
CREATE INDEX IF NOT EXISTS task_users_task_idx ON task_users(task_id);
CREATE INDEX IF NOT EXISTS task_users_user_idx ON task_users(user_id);
CREATE INDEX IF NOT EXISTS task_users_company_idx ON task_users(company_id);

-- Add company_id to projects and tasks if not exists (for multi-tenant support)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'projects' AND column_name = 'company_id') THEN
    ALTER TABLE projects ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS projects_company_idx ON projects(company_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'tasks' AND column_name = 'company_id') THEN
    ALTER TABLE tasks ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS tasks_company_idx ON tasks(company_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'time_logs' AND column_name = 'company_id') THEN
    ALTER TABLE time_logs ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS time_logs_company_idx ON time_logs(company_id);
  END IF;
END $$;

-- Migrate existing employee_id assignments to task_users
INSERT INTO task_users (task_id, user_id, company_id, created_at)
SELECT 
  t.id as task_id,
  e.user_id,
  e.company_id,
  now()
FROM tasks t
INNER JOIN employees e ON t.employee_id = e.id
WHERE t.employee_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM task_users tu 
    WHERE tu.task_id = t.id AND tu.user_id = e.user_id
  )
ON CONFLICT (task_id, user_id) DO NOTHING;

COMMENT ON TABLE project_users IS 'Junction table for assigning multiple users to projects';
COMMENT ON TABLE task_users IS 'Junction table for assigning multiple users to tasks';

