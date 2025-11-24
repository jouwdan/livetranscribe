-- Add credit system to user_profiles table
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS credits_minutes INTEGER DEFAULT 15;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS max_attendees INTEGER DEFAULT 25;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS credits_last_updated TIMESTAMPTZ DEFAULT NOW();

-- Function to check if user has sufficient credits for a session
CREATE OR REPLACE FUNCTION check_user_credits(
  p_user_id UUID,
  p_duration_minutes INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  v_credits INTEGER;
BEGIN
  SELECT credits_minutes INTO v_credits
  FROM user_profiles
  WHERE id = p_user_id;
  
  RETURN v_credits >= p_duration_minutes;
END;
$$ LANGUAGE plpgsql;

-- Function to deduct credits after session
CREATE OR REPLACE FUNCTION deduct_user_credits(
  p_user_id UUID,
  p_duration_minutes INTEGER
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE user_profiles
  SET 
    credits_minutes = GREATEST(0, credits_minutes - p_duration_minutes),
    credits_last_updated = NOW()
  WHERE id = p_user_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to add credits to user (for admin use)
CREATE OR REPLACE FUNCTION add_user_credits(
  p_user_id UUID,
  p_minutes INTEGER,
  p_max_attendees INTEGER DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE user_profiles
  SET 
    credits_minutes = credits_minutes + p_minutes,
    max_attendees = COALESCE(p_max_attendees, max_attendees),
    credits_last_updated = NOW()
  WHERE id = p_user_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Create profiles for all existing auth users who don't have one yet
INSERT INTO user_profiles (id, email, credits_minutes, max_attendees, credits_last_updated)
SELECT 
  id, 
  email,
  15,
  25,
  NOW()
FROM auth.users
WHERE id NOT IN (SELECT id FROM user_profiles)
ON CONFLICT (id) DO NOTHING;

-- Update existing profiles to ensure they have credits
UPDATE user_profiles 
SET 
  credits_minutes = COALESCE(credits_minutes, 15),
  max_attendees = COALESCE(max_attendees, 25),
  credits_last_updated = COALESCE(credits_last_updated, NOW())
WHERE credits_minutes IS NULL OR max_attendees IS NULL;

-- Create function to auto-create user_profile when new auth user is created
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, credits_minutes, max_attendees, credits_last_updated)
  VALUES (NEW.id, NEW.email, 15, 25, NOW())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users table to auto-create profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
