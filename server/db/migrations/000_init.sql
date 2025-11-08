-- extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- users (auth)
CREATE TABLE IF NOT EXISTS users (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email        text UNIQUE NOT NULL,
  name         text NOT NULL,
  password_hash text,
  role         text NOT NULL DEFAULT 'user', -- 'user'|'admin'|'hr'|'manager'|'employee'
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- sessions (rotating refresh)
CREATE TABLE IF NOT EXISTS sessions (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash text NOT NULL,
  user_agent        text NOT NULL,
  ip                text NOT NULL,
  expires_at        timestamptz NOT NULL,
  revoked_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_expires_idx ON sessions(user_id, expires_at);

-- oauth accounts
CREATE TABLE IF NOT EXISTS accounts (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider            text NOT NULL,           -- 'google'
  provider_account_id text NOT NULL,           -- sub
  email               text,
  profile             jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_account_id)
);
CREATE INDEX IF NOT EXISTS accounts_user_idx ON accounts(user_id);

-- org structure
CREATE TABLE IF NOT EXISTS org_units (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       text NOT NULL,
  parent_id  uuid REFERENCES org_units(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS org_units_parent_idx ON org_units(parent_id);

-- employees
CREATE TABLE IF NOT EXISTS employees (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_unit_id uuid REFERENCES org_units(id) ON DELETE SET NULL,
  code        text UNIQUE NOT NULL,
  title       text,
  join_date   date NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS employees_org_idx ON employees(org_unit_id);

-- salary config
CREATE TABLE IF NOT EXISTS salary_config (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id  uuid UNIQUE NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  basic        numeric(12,2) NOT NULL,
  allowances   jsonb NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- attendance
DO $$ BEGIN
  CREATE TYPE attendance_status AS ENUM ('PRESENT','ABSENT','LEAVE','HALF_DAY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS attendance (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  day         date NOT NULL,              -- date-only
  in_at       timestamptz,
  out_at      timestamptz,
  status      attendance_status NOT NULL DEFAULT 'PRESENT',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id, day)
);
CREATE INDEX IF NOT EXISTS attendance_day_idx ON attendance(day);

-- leave
DO $$ BEGIN
  CREATE TYPE leave_type AS ENUM ('CASUAL','SICK','UNPAID');
  CREATE TYPE leave_status AS ENUM ('PENDING','APPROVED','REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS leave_requests (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id  uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  type         leave_type NOT NULL,
  start_date   date NOT NULL,
  end_date     date NOT NULL,
  reason       text,
  status       leave_status NOT NULL DEFAULT 'PENDING',
  approver_id  uuid REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS leave_emp_status_idx ON leave_requests(employee_id, status);

-- payroll
DO $$ BEGIN
  CREATE TYPE payrun_status AS ENUM ('DRAFT','FINALIZED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS payruns (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  month        text UNIQUE NOT NULL, -- 'YYYY-MM'
  status       payrun_status NOT NULL DEFAULT 'DRAFT',
  generated_at timestamptz
);

CREATE TABLE IF NOT EXISTS payslips (
  id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  payrun_id          uuid NOT NULL REFERENCES payruns(id) ON DELETE CASCADE,
  employee_id        uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  gross              numeric(12,2) NOT NULL,
  pf                 numeric(12,2) NOT NULL,
  professional_tax   numeric(12,2) NOT NULL,
  net                numeric(12,2) NOT NULL,
  breakdown          jsonb NOT NULL DEFAULT '{}',
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE(payrun_id, employee_id)
);
CREATE INDEX IF NOT EXISTS payslips_emp_idx ON payslips(employee_id);

-- activity/audit
CREATE TABLE IF NOT EXISTS activity (
  id         bigserial PRIMARY KEY,
  entity     text NOT NULL,
  ref_id     uuid NOT NULL,
  actor_id   uuid,
  action     text NOT NULL,
  meta       jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS activity_idx ON activity(entity, created_at DESC);

-- updated_at triggers
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS upd_users ON users;
CREATE TRIGGER upd_users BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS upd_org_units ON org_units;
CREATE TRIGGER upd_org_units BEFORE UPDATE ON org_units FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS upd_employees ON employees;
CREATE TRIGGER upd_employees BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS upd_salary_config ON salary_config;
CREATE TRIGGER upd_salary_config BEFORE UPDATE ON salary_config FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS upd_attendance ON attendance;
CREATE TRIGGER upd_attendance BEFORE UPDATE ON attendance FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS upd_leave_requests ON leave_requests;
CREATE TRIGGER upd_leave_requests BEFORE UPDATE ON leave_requests FOR EACH ROW EXECUTE FUNCTION set_updated_at();

