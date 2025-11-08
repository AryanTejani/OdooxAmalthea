-- Add attachment_url column to leave_requests table
ALTER TABLE leave_requests 
  ADD COLUMN IF NOT EXISTS attachment_url text;

-- Make reason mandatory (update existing NULL values first)
UPDATE leave_requests 
SET reason = 'No reason provided' 
WHERE reason IS NULL;

ALTER TABLE leave_requests 
  ALTER COLUMN reason SET NOT NULL;

COMMENT ON COLUMN leave_requests.attachment_url IS 'URL to attachment file stored in Cloudinary';

