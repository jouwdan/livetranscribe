-- Add missing RLS policies for beta_access_keys

-- Policy: Admins can insert new beta keys
CREATE POLICY "Admins can insert beta keys"
  ON beta_access_keys
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Policy: Admins can delete beta keys
CREATE POLICY "Admins can delete beta keys"
  ON beta_access_keys
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Update existing policy to allow admins to update any beta key
DROP POLICY IF EXISTS "System can update beta keys" ON beta_access_keys;

CREATE POLICY "Admins and system can update beta keys"
  ON beta_access_keys
  FOR UPDATE
  USING (
    true  -- System can always update (for sign-up process)
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );
