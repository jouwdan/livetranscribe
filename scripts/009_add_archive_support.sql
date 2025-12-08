-- Add archived column to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false;

-- Create index for faster queries on archived events
CREATE INDEX IF NOT EXISTS idx_events_archived ON events(archived, user_id);

-- Update RLS policies to include archived events
-- Users can view their own archived events
CREATE POLICY "Users can view own archived events" ON events
  FOR SELECT USING (auth.uid() = user_id);
