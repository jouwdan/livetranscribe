-- Update handle_new_user function to reflect event credits system
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure a user_profile exists (without legacy credits columns)
  INSERT INTO public.user_profiles (id, email, full_name, is_admin)
  VALUES (NEW.id, NEW.email, NULL, FALSE)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  -- Grant default event credits if none exist yet
  INSERT INTO public.event_credits (user_id, credits_minutes, max_attendees, notes)
  VALUES (NEW.id, 15, 25, NULL)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger to ensure it references the updated function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
