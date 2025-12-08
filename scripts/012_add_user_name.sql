-- Add name field to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS full_name TEXT;

-- Update RLS policy to allow users to update their own name
-- (already covered by existing "Users can update own profile" policy)
