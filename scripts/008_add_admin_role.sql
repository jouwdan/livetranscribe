-- Add is_admin column to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Set specific user as admin
UPDATE user_profiles 
SET is_admin = TRUE 
WHERE id = 'fc146582-9de2-4202-8316-118d47887814';

-- Create a SECURITY DEFINER function to check admin status without triggering RLS
CREATE OR REPLACE FUNCTION is_user_admin()
RETURNS BOOLEAN 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  SELECT is_admin INTO v_is_admin
  FROM user_profiles
  WHERE id = auth.uid();
  
  RETURN COALESCE(v_is_admin, FALSE);
END;
$$ LANGUAGE plpgsql;

-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON user_profiles;

-- Create new policies using the SECURITY DEFINER function
CREATE POLICY "Admins can view all profiles"
  ON user_profiles
  FOR SELECT
  USING (is_user_admin() = TRUE);

CREATE POLICY "Admins can update any profile"
  ON user_profiles
  FOR UPDATE
  USING (is_user_admin() = TRUE);
