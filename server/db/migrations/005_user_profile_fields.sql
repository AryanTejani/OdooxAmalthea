-- Add profile fields to users table
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS about text,
  ADD COLUMN IF NOT EXISTS job_love text,
  ADD COLUMN IF NOT EXISTS hobbies text,
  ADD COLUMN IF NOT EXISTS skills text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS certifications text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS manager text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS company text;

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS users_company_idx ON users(company);
CREATE INDEX IF NOT EXISTS users_department_idx ON users(department);

