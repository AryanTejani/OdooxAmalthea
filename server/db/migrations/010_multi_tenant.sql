-- Multi-tenant SaaS migration
-- Add companies table and company_id to all tenant-scoped tables

-- Companies table
CREATE TABLE IF NOT EXISTS companies (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         text NOT NULL,
  code         text NOT NULL UNIQUE,          -- short code, 2-6 uppercase letters/numbers
  logo_url     text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS companies_code_idx ON companies(code);

-- Users: add company_id and avatar_url
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- Enforce uniqueness within a company (remove old unique constraint first if exists)
DO $$ 
BEGIN
  -- Drop old unique constraint on email if exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_email_key'
  ) THEN
    ALTER TABLE users DROP CONSTRAINT users_email_key;
  END IF;
  
  -- Drop old unique constraint on login_id if exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_login_id_key'
  ) THEN
    ALTER TABLE users DROP CONSTRAINT users_login_id_key;
  END IF;
  
  -- Drop old unique constraint on employees.code if exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employees_code_key'
  ) THEN
    ALTER TABLE employees DROP CONSTRAINT employees_code_key;
  END IF;
  
  -- Drop old unique constraint on payruns.month if exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payruns_month_key'
  ) THEN
    ALTER TABLE payruns DROP CONSTRAINT payruns_month_key;
  END IF;
END $$;

-- Create company-scoped unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS users_company_email_unq ON users(company_id, lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS users_company_loginid_unq ON users(company_id, login_id) WHERE login_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_company_idx ON users(company_id);

-- Add company_id columns to all tables FIRST (before backfilling)
ALTER TABLE org_units   ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE employees   ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE salary_config ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE attendance  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE payruns     ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE payslips    ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE activity    ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE projects    ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE tasks       ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE time_logs   ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE CASCADE;

-- Create indexes for company_id on all tables
CREATE INDEX IF NOT EXISTS org_units_company_idx ON org_units(company_id);
CREATE INDEX IF NOT EXISTS employees_company_idx ON employees(company_id);
CREATE INDEX IF NOT EXISTS salary_config_company_idx ON salary_config(company_id);
CREATE INDEX IF NOT EXISTS attendance_company_idx ON attendance(company_id);
CREATE INDEX IF NOT EXISTS leave_requests_company_idx ON leave_requests(company_id);
CREATE INDEX IF NOT EXISTS payruns_company_idx ON payruns(company_id);
CREATE INDEX IF NOT EXISTS payslips_company_idx ON payslips(company_id);
CREATE INDEX IF NOT EXISTS activity_company_idx ON activity(company_id);
CREATE INDEX IF NOT EXISTS projects_company_idx ON projects(company_id);
CREATE INDEX IF NOT EXISTS tasks_company_idx ON tasks(company_id);
CREATE INDEX IF NOT EXISTS time_logs_company_idx ON time_logs(company_id);

-- Update unique constraints to be company-scoped
CREATE UNIQUE INDEX IF NOT EXISTS employees_company_code_unq ON employees(company_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS payruns_company_month_unq ON payruns(company_id, month);

-- Backfill existing single-tenant data into one company (AFTER columns are added)
DO $$
DECLARE 
  cid uuid;
  existing_count int;
BEGIN
  -- Check if any companies exist
  SELECT COUNT(*) INTO existing_count FROM companies;
  
  IF existing_count = 0 THEN
    -- Create default company for existing data
    INSERT INTO companies(name, code, logo_url) 
    VALUES ('WorkZen Demo', 'WZ', NULL) 
    RETURNING id INTO cid;
    
    -- Update all existing users to belong to this company
    UPDATE users SET company_id = cid WHERE company_id IS NULL;
    
    -- Update employees (via their user_id)
    UPDATE employees SET company_id = cid 
    WHERE company_id IS NULL 
    AND EXISTS (SELECT 1 FROM users u WHERE u.id = employees.user_id AND u.company_id = cid);
    
    -- Update org_units (they will be backfilled via employees/company association)
    -- First, get company_id from employees who belong to org_units
    UPDATE org_units o SET company_id = (
      SELECT DISTINCT e.company_id 
      FROM employees e 
      WHERE e.org_unit_id = o.id 
      AND e.company_id IS NOT NULL 
      LIMIT 1
    )
    WHERE company_id IS NULL;
    
    -- Update remaining org_units that don't have employees yet
    UPDATE org_units SET company_id = cid WHERE company_id IS NULL;
  END IF;
END $$;

-- Backfill company_id on operational tables from joins to users/employees
-- (This runs after the DO block above, but also handles any records that weren't covered)

-- Employees: get company_id from users (if any were missed)
UPDATE employees e SET company_id = u.company_id 
FROM users u 
WHERE e.user_id = u.id 
AND e.company_id IS NULL 
AND u.company_id IS NOT NULL;

-- Org units: get company_id from employees (if any were missed)
UPDATE org_units o SET company_id = (
  SELECT DISTINCT e.company_id 
  FROM employees e 
  WHERE e.org_unit_id = o.id 
  AND e.company_id IS NOT NULL 
  LIMIT 1
)
WHERE company_id IS NULL;

-- Salary config: get company_id from employees
UPDATE salary_config sc SET company_id = e.company_id 
FROM employees e 
WHERE sc.employee_id = e.id 
AND sc.company_id IS NULL 
AND e.company_id IS NOT NULL;

-- Attendance: get company_id from employees
UPDATE attendance a SET company_id = e.company_id 
FROM employees e 
WHERE a.employee_id = e.id 
AND a.company_id IS NULL 
AND e.company_id IS NOT NULL;

-- Leave requests: get company_id from employees
UPDATE leave_requests lr SET company_id = e.company_id 
FROM employees e 
WHERE lr.employee_id = e.id 
AND lr.company_id IS NULL 
AND e.company_id IS NOT NULL;

-- Payruns: get company_id from payslips -> employees
UPDATE payruns p SET company_id = (
  SELECT DISTINCT e.company_id 
  FROM payslips ps 
  JOIN employees e ON ps.employee_id = e.id 
  WHERE ps.payrun_id = p.id 
  AND e.company_id IS NOT NULL 
  LIMIT 1
)
WHERE company_id IS NULL;

-- Payslips: get company_id from employees
UPDATE payslips ps SET company_id = e.company_id 
FROM employees e 
WHERE ps.employee_id = e.id 
AND ps.company_id IS NULL 
AND e.company_id IS NOT NULL;

-- Activity: get company_id from actor (user)
UPDATE activity a SET company_id = u.company_id 
FROM users u 
WHERE a.actor_id = u.id 
AND a.company_id IS NULL 
AND u.company_id IS NOT NULL;

-- Projects: get company_id from created_by (user)
UPDATE projects p SET company_id = u.company_id 
FROM users u 
WHERE p.created_by = u.id 
AND p.company_id IS NULL 
AND u.company_id IS NOT NULL;

-- Tasks: get company_id from employee or project
UPDATE tasks t SET company_id = COALESCE(
  (SELECT e.company_id FROM employees e WHERE e.id = t.employee_id),
  (SELECT p.company_id FROM projects p WHERE p.id = t.project_id)
)
WHERE company_id IS NULL;

-- Time logs: get company_id from employees
UPDATE time_logs tl SET company_id = e.company_id 
FROM employees e 
WHERE tl.employee_id = e.id 
AND tl.company_id IS NULL 
AND e.company_id IS NOT NULL;

-- Activity samples: add company_id column and backfill
ALTER TABLE activity_samples ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS activity_samples_company_idx ON activity_samples(company_id);

-- Backfill activity_samples from employees
UPDATE activity_samples as2 SET company_id = e.company_id 
FROM employees e 
WHERE as2.employee_id = e.id 
AND as2.company_id IS NULL 
AND e.company_id IS NOT NULL;

-- Set NOT NULL constraints (after backfill)
-- Note: We'll make these nullable for now to allow gradual migration, but add constraints in application layer

