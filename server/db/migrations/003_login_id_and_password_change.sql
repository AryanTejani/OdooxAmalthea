-- Add login_id, must_change_password, and phone to users table
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS login_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS phone text;

-- Create index on login_id for faster lookups
CREATE INDEX IF NOT EXISTS users_login_id_idx ON users(login_id);

-- Update existing users: set login_id = email for backward compatibility (optional)
-- UPDATE users SET login_id = email WHERE login_id IS NULL;

