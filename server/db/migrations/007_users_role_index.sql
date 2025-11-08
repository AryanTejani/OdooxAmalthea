-- Ensure role column exists and has an index
-- This migration is idempotent

-- Create index on role for faster lookups
CREATE INDEX IF NOT EXISTS users_role_idx ON users(role);

-- Add comment for documentation
COMMENT ON COLUMN users.role IS 'User role: employee, admin, hr, payroll';

