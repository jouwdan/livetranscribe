-- Create viewer_sessions table to track live viewers
CREATE TABLE IF NOT EXISTS viewer_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_ping TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  left_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(event_id, session_id)
);

-- Enable RLS
ALTER TABLE viewer_sessions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert viewer sessions
CREATE POLICY "Anyone can join as viewer"
  ON viewer_sessions
  FOR INSERT
  WITH CHECK (true);

-- Allow anyone to update their session ping
CREATE POLICY "Anyone can update their session"
  ON viewer_sessions
  FOR UPDATE
  USING (true);

-- Event owners can view sessions for their events
CREATE POLICY "Event owners can view sessions"
  ON viewer_sessions
  FOR SELECT
  USING (
    event_id IN (
      SELECT id FROM events WHERE user_id = auth.uid()
    )
  );

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_viewer_sessions_event_id ON viewer_sessions(event_id);
CREATE INDEX IF NOT EXISTS idx_viewer_sessions_last_ping ON viewer_sessions(last_ping);
