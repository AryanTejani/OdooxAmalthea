-- Migration: Payroll Revamp
-- Rebuild payroll schema with proper status flow and attendance integration

-- 1. Drop and recreate payrun_status enum with new values
DROP TYPE IF EXISTS payrun_status CASCADE;
CREATE TYPE payrun_status AS ENUM ('draft', 'computed', 'validated', 'cancelled', 'done');

-- 2. Add new columns to payruns table
ALTER TABLE payruns ADD COLUMN IF NOT EXISTS period_month date;
ALTER TABLE payruns ADD COLUMN IF NOT EXISTS employees_count integer DEFAULT 0;
ALTER TABLE payruns ADD COLUMN IF NOT EXISTS gross_total numeric(12,2) DEFAULT 0;
ALTER TABLE payruns ADD COLUMN IF NOT EXISTS net_total numeric(12,2) DEFAULT 0;
ALTER TABLE payruns ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE payruns ADD COLUMN IF NOT EXISTS validated_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE payruns ADD COLUMN IF NOT EXISTS validated_at timestamptz;
ALTER TABLE payruns ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Add status column with new enum type
ALTER TABLE payruns ADD COLUMN IF NOT EXISTS status_new payrun_status DEFAULT 'draft';

-- 3. Add new columns to payslips table
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS period_month date;
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS components jsonb DEFAULT '{}';
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS basic numeric(12,2) DEFAULT 0;
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS allowances_total numeric(12,2) DEFAULT 0;
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS monthly_wage numeric(12,2) DEFAULT 0;
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS payable_days numeric(5,2) DEFAULT 0;
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS total_working_days integer DEFAULT 0;
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS attendance_days_amount numeric(12,2) DEFAULT 0;
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS paid_leave_days_amount numeric(12,2) DEFAULT 0;
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS pf_employee numeric(12,2) DEFAULT 0;
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS pf_employer numeric(12,2) DEFAULT 0;
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS status payrun_status DEFAULT 'draft';

-- Rename pf column to avoid confusion
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payslips' AND column_name = 'pf'
  ) THEN
    ALTER TABLE payslips RENAME COLUMN pf TO pf_old;
  END IF;
END $$;

-- 4. Add new columns to employees table
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_account text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES users(id) ON DELETE SET NULL;

-- 5. Backfill data for existing records
-- Update payruns: set period_month from month column
UPDATE payruns 
SET period_month = (month || '-01')::date
WHERE period_month IS NULL AND month IS NOT NULL;

-- Update payruns: set status_new from old status if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payruns' AND column_name = 'status'
    AND table_schema = 'public'
  ) THEN
    -- Old status column exists, migrate values
    EXECUTE '
      UPDATE payruns 
      SET status_new = CASE 
        WHEN status::text = ''DRAFT'' THEN ''draft''::payrun_status
        WHEN status::text = ''FINALIZED'' THEN ''done''::payrun_status
        ELSE ''draft''::payrun_status
      END
      WHERE status_new = ''draft''
    ';
    
    -- Drop old status column
    ALTER TABLE payruns DROP COLUMN status;
  END IF;
  
  -- Rename status_new to status (always do this)
  ALTER TABLE payruns RENAME COLUMN status_new TO status;
END $$;

-- Update payslips: copy user_id from employees
UPDATE payslips ps
SET user_id = e.user_id
FROM employees e
WHERE ps.employee_id = e.id AND ps.user_id IS NULL;

-- Update payslips: set period_month from payrun
UPDATE payslips ps
SET period_month = p.period_month
FROM payruns p
WHERE ps.payrun_id = p.id AND ps.period_month IS NULL;

-- Update payslips: copy pf_old to pf_employee if exists
UPDATE payslips
SET pf_employee = COALESCE(pf_old, 0)
WHERE pf_employee = 0 AND pf_old IS NOT NULL;

-- 6. Add indices for performance
CREATE INDEX IF NOT EXISTS payruns_period_month_idx ON payruns(company_id, period_month);
CREATE INDEX IF NOT EXISTS payslips_period_month_idx ON payslips(company_id, period_month);
CREATE INDEX IF NOT EXISTS payslips_employee_period_idx ON payslips(employee_id, period_month);
CREATE INDEX IF NOT EXISTS payslips_user_idx ON payslips(user_id);
CREATE INDEX IF NOT EXISTS employees_manager_idx ON employees(manager_id);

-- 7. Update unique constraint on payruns (company_id, period_month) instead of (company_id, month)
DROP INDEX IF EXISTS payruns_company_month_unq;
CREATE UNIQUE INDEX IF NOT EXISTS payruns_company_period_unq 
ON payruns(company_id, period_month) 
WHERE status != 'cancelled';

-- 8. Add comments for documentation
COMMENT ON COLUMN payruns.period_month IS 'Month period for payrun (set to 1st of month)';
COMMENT ON COLUMN payruns.status IS 'draft|computed|validated|cancelled|done';
COMMENT ON COLUMN payslips.status IS 'draft|computed|validated|cancelled|done';
COMMENT ON COLUMN payslips.components IS 'JSONB breakdown of salary components';
COMMENT ON COLUMN employees.bank_account IS 'Employee bank account number';
COMMENT ON COLUMN employees.manager_id IS 'Reference to manager user';

-- 9. Drop old columns that are no longer needed
ALTER TABLE payruns DROP COLUMN IF EXISTS generated_at;
-- Keep month column for now for reference, can be dropped later if needed
-- ALTER TABLE payruns DROP COLUMN IF EXISTS month;

ALTER TABLE payslips DROP COLUMN IF EXISTS pf_old;
-- Keep old breakdown column for now, can be dropped later if needed
-- ALTER TABLE payslips DROP COLUMN IF EXISTS breakdown;

