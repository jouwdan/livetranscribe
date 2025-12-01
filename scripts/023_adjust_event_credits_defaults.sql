-- Allow multiple credits per user for allocations
ALTER TABLE public.event_credits
  DROP CONSTRAINT IF EXISTS event_credits_user_id_key;

-- Recreate handle_new_user to guard inserts without relying on constraint
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure a user_profile exists (without legacy credits columns)
  INSERT INTO public.user_profiles (id, email, full_name, is_admin)
  VALUES (NEW.id, NEW.email, NULL, FALSE)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  -- Grant default event credits only if no unallocated credit exists yet
  INSERT INTO public.event_credits (user_id, credits_minutes, max_attendees, notes)
  SELECT NEW.id, 15, 25, NULL
  WHERE NOT EXISTS (
    SELECT 1 FROM public.event_credits
    WHERE user_id = NEW.id AND allocated_to_event_id IS NULL
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
