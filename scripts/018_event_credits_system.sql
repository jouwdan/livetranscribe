-- Create event_credits table to store allocatable credits
CREATE TABLE IF NOT EXISTS event_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credits_minutes integer NOT NULL DEFAULT 0,
  max_attendees integer NOT NULL DEFAULT 0,
  allocated_to_event_id uuid REFERENCES events(id) ON DELETE SET NULL,
  allocated_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  notes text
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_event_credits_user_id ON event_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_event_credits_allocated ON event_credits(allocated_to_event_id);

-- Enable RLS
ALTER TABLE event_credits ENABLE ROW LEVEL SECURITY;

-- Drop existing policies before recreating to avoid duplicate errors
DROP POLICY IF EXISTS "Users can view their own event credits" ON event_credits;
DROP POLICY IF EXISTS "Admins can view all event credits" ON event_credits;
DROP POLICY IF EXISTS "Admins can insert event credits" ON event_credits;
DROP POLICY IF EXISTS "Users can update their own unallocated credits" ON event_credits;
DROP POLICY IF EXISTS "Admins can update any event credits" ON event_credits;

-- RLS Policies
CREATE POLICY "Users can view their own event credits"
  ON event_credits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all event credits"
  ON event_credits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can insert event credits"
  ON event_credits FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Users can update their own unallocated credits"
  ON event_credits FOR UPDATE
  USING (auth.uid() = user_id AND allocated_to_event_id IS NULL);

CREATE POLICY "Admins can update any event credits"
  ON event_credits FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Update handle_new_user function to create trial credit
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert user profile
  INSERT INTO public.user_profiles (id, email, credits_minutes, max_attendees, is_admin)
  VALUES (
    NEW.id,
    NEW.email,
    0, -- No user-level credits anymore
    0, -- No user-level max attendees anymore
    false
  );

  -- Create initial event credit without trial labeling
  INSERT INTO public.event_credits (user_id, credits_minutes, max_attendees, notes)
  VALUES (
    NEW.id,
    15, -- 15 minutes
    25, -- 25 max attendees
    NULL -- No notes, so it appears as a regular credit
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill credits without trial labeling
INSERT INTO event_credits (user_id, credits_minutes, max_attendees, notes)
SELECT 
  up.id,
  15,
  25,
  NULL
FROM user_profiles up
WHERE NOT EXISTS (
  SELECT 1 FROM event_credits ec WHERE ec.user_id = up.id
)
ON CONFLICT DO NOTHING;
