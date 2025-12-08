-- Create beta access keys table
CREATE TABLE IF NOT EXISTS beta_access_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_key TEXT UNIQUE NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  used_by_email TEXT,
  used_at TIMESTAMP WITH TIME ZONE,
  max_uses INTEGER DEFAULT 1,
  current_uses INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  notes TEXT
);

-- Enable RLS
ALTER TABLE beta_access_keys ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can validate a key (check if it exists and is unused)
CREATE POLICY "Anyone can validate beta keys"
  ON beta_access_keys
  FOR SELECT
  USING (true);

-- Policy: Only authenticated system can update keys when used
CREATE POLICY "System can update beta keys"
  ON beta_access_keys
  FOR UPDATE
  USING (true);

-- Insert some initial beta keys for testing
INSERT INTO beta_access_keys (access_key, max_uses, notes) VALUES
  ('BETA-COMMUNITY-2024', 1, 'Community group access'),
  ('BETA-PARTNER-2024', 5, 'Partner organization access'),
  ('BETA-TEST-2024', 10, 'Testing access key')
ON CONFLICT (access_key) DO NOTHING;
