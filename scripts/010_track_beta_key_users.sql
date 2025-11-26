-- Create a table to track which users signed up with which beta keys
CREATE TABLE IF NOT EXISTS beta_key_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beta_key_id UUID NOT NULL REFERENCES beta_access_keys(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(beta_key_id, user_id)
);

-- Enable RLS
ALTER TABLE beta_key_usage ENABLE ROW LEVEL SECURITY;

-- Allow admins to view all usage
CREATE POLICY "Admins can view beta key usage"
ON beta_key_usage
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.is_admin = true
  )
);

-- Allow system to insert usage records
CREATE POLICY "System can insert beta key usage"
ON beta_key_usage
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_beta_key_usage_key_id ON beta_key_usage(beta_key_id);
CREATE INDEX IF NOT EXISTS idx_beta_key_usage_user_id ON beta_key_usage(beta_key_id);
