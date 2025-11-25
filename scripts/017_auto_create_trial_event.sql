-- Update the handle_new_user function to give users trial credits
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create user profile with trial credits
  -- Users get 15 minutes and 25 attendees as a free trial
  -- They can use this credit to create any event they want
  INSERT INTO public.user_profiles (id, email, credits_minutes, max_attendees, credits_last_updated)
  VALUES (NEW.id, NEW.email, 15, 25, NOW())
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger to use the updated function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Give trial credits to existing users who don't have any yet
UPDATE user_profiles
SET 
  credits_minutes = 15,
  max_attendees = 25,
  credits_last_updated = NOW()
WHERE credits_minutes = 0 OR credits_minutes IS NULL;
