-- Add is_active column to beta_access_keys table
ALTER TABLE beta_access_keys 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Update existing records to be active
UPDATE beta_access_keys 
SET is_active = true 
WHERE is_active IS NULL;
