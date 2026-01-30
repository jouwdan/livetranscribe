-- ============================================================================
-- LiveTranscribe Database Schema
-- ============================================================================
-- This script creates the entire database schema from scratch.
-- Run this on a fresh Supabase project to set up all tables, functions, 
-- triggers, indexes, and RLS policies.
--
-- Usage: Execute this script in your Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLES
-- ============================================================================

-- Events table
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  organizer_key TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  archived BOOLEAN DEFAULT false,
  session_active BOOLEAN DEFAULT false,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Metrics columns
  total_transcriptions INTEGER DEFAULT 0,
  total_words INTEGER DEFAULT 0,
  peak_viewers INTEGER DEFAULT 0,
  average_viewers INTEGER DEFAULT 0,
  total_session_duration_minutes INTEGER DEFAULT 0,
  average_view_duration_minutes INTEGER DEFAULT 0,
  total_viewer_engagement_score INTEGER DEFAULT 0,
  -- Credit columns
  credits_minutes INTEGER DEFAULT 0,
  max_attendees INTEGER DEFAULT 0,
  credits_allocated_at TIMESTAMPTZ,
  -- Transcription model (gpt-4o-mini-transcribe, gpt-4o-transcribe, gpt-4o-transcribe-diarize)
  transcription_model TEXT DEFAULT 'gpt-4o-mini-transcribe'
);

-- Transcriptions table
CREATE TABLE IF NOT EXISTS transcriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  session_id UUID,
  text TEXT NOT NULL,
  speaker_id TEXT,
  sequence_number INTEGER NOT NULL,
  is_final BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Viewer sessions table
CREATE TABLE IF NOT EXISTS viewer_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_ping TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  scroll_events INTEGER DEFAULT 0,
  visibility_changes INTEGER DEFAULT 0,
  total_active_time_seconds INTEGER DEFAULT 0,
  transcriptions_viewed INTEGER DEFAULT 0,
  UNIQUE(event_id, session_id)
);

-- Beta access keys table
CREATE TABLE IF NOT EXISTS beta_access_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_key TEXT UNIQUE NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  used_by_email TEXT,
  used_at TIMESTAMPTZ,
  max_uses INTEGER DEFAULT 1,
  current_uses INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  notes TEXT
);

-- Beta key usage tracking table
CREATE TABLE IF NOT EXISTS beta_key_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beta_key_id UUID NOT NULL REFERENCES beta_access_keys(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(beta_key_id, user_id)
);

-- Event sessions table (for multiple sessions per event)
CREATE TABLE IF NOT EXISTS event_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  session_number INTEGER NOT NULL DEFAULT 1,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER DEFAULT 0,
  total_transcriptions INTEGER DEFAULT 0,
  total_words INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, session_number)
);

-- Event credits table
CREATE TABLE IF NOT EXISTS event_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credits_minutes INTEGER NOT NULL DEFAULT 0,
  max_attendees INTEGER NOT NULL DEFAULT 0,
  allocated_to_event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  allocated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- Survey responses table
CREATE TABLE IF NOT EXISTS survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add session_id foreign key to transcriptions
ALTER TABLE transcriptions 
ADD CONSTRAINT transcriptions_session_id_fkey 
FOREIGN KEY (session_id) REFERENCES event_sessions(id) ON DELETE CASCADE;

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Events indexes
CREATE INDEX IF NOT EXISTS idx_events_archived ON events(archived, user_id);
CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);

-- Transcriptions indexes
CREATE INDEX IF NOT EXISTS idx_transcriptions_event_sequence ON transcriptions(event_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_transcriptions_event_timestamp ON transcriptions(event_id, created_at);
CREATE INDEX IF NOT EXISTS idx_transcriptions_event_final ON transcriptions(event_id, is_final) WHERE is_final = true;
CREATE INDEX IF NOT EXISTS idx_transcriptions_event_seq_final ON transcriptions(event_id, sequence_number, is_final);
CREATE INDEX IF NOT EXISTS idx_transcriptions_session_id ON transcriptions(session_id);

-- Viewer sessions indexes
CREATE INDEX IF NOT EXISTS idx_viewer_sessions_event_id ON viewer_sessions(event_id);
CREATE INDEX IF NOT EXISTS idx_viewer_sessions_last_ping ON viewer_sessions(last_ping);
CREATE INDEX IF NOT EXISTS idx_viewer_sessions_event_activity ON viewer_sessions(event_id, last_activity_at);

-- Beta key usage indexes
CREATE INDEX IF NOT EXISTS idx_beta_key_usage_key_id ON beta_key_usage(beta_key_id);
CREATE INDEX IF NOT EXISTS idx_beta_key_usage_user_id ON beta_key_usage(user_id);

-- Event sessions indexes
CREATE INDEX IF NOT EXISTS idx_event_sessions_event_id ON event_sessions(event_id);

-- Event credits indexes
CREATE INDEX IF NOT EXISTS idx_event_credits_user_id ON event_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_event_credits_allocated ON event_credits(allocated_to_event_id);

-- Survey responses indexes
CREATE INDEX IF NOT EXISTS idx_survey_responses_event_id ON survey_responses(event_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_created_at ON survey_responses(created_at DESC);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to check if user is admin (SECURITY DEFINER to avoid RLS recursion)
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

-- Function to calculate event metrics
CREATE OR REPLACE FUNCTION calculate_event_metrics(p_event_id UUID)
RETURNS TABLE (
  total_transcriptions BIGINT,
  total_words BIGINT,
  peak_viewers INTEGER,
  average_viewers NUMERIC,
  total_duration_minutes INTEGER,
  unique_viewers BIGINT,
  total_sessions BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH transcription_stats AS (
    SELECT
      COUNT(*) AS trans_count,
      SUM(array_length(string_to_array(text, ' '), 1)) AS word_count
    FROM transcriptions
    WHERE event_id = p_event_id AND is_final = true
  ),
  viewer_stats AS (
    SELECT
      COUNT(DISTINCT session_id) AS unique_count,
      COUNT(*) AS session_count
    FROM viewer_sessions
    WHERE event_id = p_event_id
  )
  SELECT
    COALESCE(t.trans_count, 0)::BIGINT,
    COALESCE(t.word_count, 0)::BIGINT,
    0::INTEGER AS peak,
    0::NUMERIC AS avg,
    0::INTEGER,
    COALESCE(v.unique_count, 0)::BIGINT,
    COALESCE(v.session_count, 0)::BIGINT
  FROM transcription_stats t
  CROSS JOIN viewer_stats v;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get or create current session for an event
CREATE OR REPLACE FUNCTION get_or_create_current_session(p_event_id UUID, p_session_name TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session_id UUID;
  v_next_number INTEGER;
BEGIN
  -- Try to find an active session (started but not ended)
  SELECT id INTO v_session_id
  FROM event_sessions
  WHERE event_id = p_event_id
    AND started_at IS NOT NULL
    AND ended_at IS NULL
  ORDER BY started_at DESC
  LIMIT 1;
  
  -- If no active session, create a new one
  IF v_session_id IS NULL THEN
    SELECT COALESCE(MAX(session_number), 0) + 1 INTO v_next_number
    FROM event_sessions
    WHERE event_id = p_event_id;
    
    INSERT INTO event_sessions (event_id, name, session_number)
    VALUES (
      p_event_id, 
      COALESCE(p_session_name, 'Session ' || v_next_number),
      v_next_number
    )
    RETURNING id INTO v_session_id;
  END IF;
  
  RETURN v_session_id;
END;
$$;

-- Generic increment function for updating counters
CREATE OR REPLACE FUNCTION increment(
  row_id UUID,
  table_name TEXT,
  column_name TEXT,
  increment_by INTEGER DEFAULT 1
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE format(
    'UPDATE %I SET %I = COALESCE(%I, 0) + $1 WHERE id = $2',
    table_name,
    column_name,
    column_name
  )
  USING increment_by, row_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION increment(UUID, TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION increment(UUID, TEXT, TEXT, INTEGER) TO anon;

-- ============================================================================
-- TRIGGERS AND FUNCTIONS FOR AUTO-CREATION
-- ============================================================================

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create user profile
  INSERT INTO public.user_profiles (id, email, full_name, is_admin)
  VALUES (NEW.id, NEW.email, NULL, FALSE)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  -- Grant default event credits only if no unallocated credit exists
  INSERT INTO public.event_credits (user_id, credits_minutes, max_attendees, notes)
  SELECT NEW.id, 15, 25, NULL
  WHERE NOT EXISTS (
    SELECT 1 FROM public.event_credits
    WHERE user_id = NEW.id AND allocated_to_event_id IS NULL
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE viewer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE beta_access_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE beta_key_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- EVENTS POLICIES
-- ============================================================================

CREATE POLICY "Users can view own events"
  ON events FOR SELECT
  USING (auth.uid() = user_id OR is_active = true);

CREATE POLICY "Users can view own archived events" 
  ON events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can create events"
  ON events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own events"
  ON events FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own events"
  ON events FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- TRANSCRIPTIONS POLICIES
-- ============================================================================

CREATE POLICY "Allow public read access to transcriptions"
  ON transcriptions FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated insert to transcriptions"
  ON transcriptions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can delete transcriptions for own events"
  ON transcriptions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = transcriptions.event_id
      AND events.user_id = auth.uid()
    )
  );

-- ============================================================================
-- USER PROFILES POLICIES
-- ============================================================================

CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON user_profiles FOR SELECT
  USING (is_user_admin() = TRUE);

CREATE POLICY "Admins can update any profile"
  ON user_profiles FOR UPDATE
  USING (is_user_admin() = TRUE);

-- ============================================================================
-- VIEWER SESSIONS POLICIES
-- ============================================================================

CREATE POLICY "Anyone can join as viewer"
  ON viewer_sessions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update their session"
  ON viewer_sessions FOR UPDATE
  USING (true);

CREATE POLICY "Event owners can view sessions"
  ON viewer_sessions FOR SELECT
  USING (
    event_id IN (
      SELECT id FROM events WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete viewer sessions for own events"
  ON viewer_sessions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = viewer_sessions.event_id
      AND events.user_id = auth.uid()
    )
  );

-- ============================================================================
-- BETA ACCESS KEYS POLICIES
-- ============================================================================

CREATE POLICY "Anyone can validate beta keys"
  ON beta_access_keys FOR SELECT
  USING (true);

CREATE POLICY "Admins and system can update beta keys"
  ON beta_access_keys FOR UPDATE
  USING (
    true OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can insert beta keys"
  ON beta_access_keys FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can delete beta keys"
  ON beta_access_keys FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- ============================================================================
-- BETA KEY USAGE POLICIES
-- ============================================================================

CREATE POLICY "Admins can view beta key usage"
  ON beta_key_usage FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "System can insert beta key usage"
  ON beta_key_usage FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- EVENT SESSIONS POLICIES
-- ============================================================================

CREATE POLICY "Users can view sessions for their events"
  ON event_sessions FOR SELECT
  USING (
    event_id IN (
      SELECT id FROM events WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create sessions for their events"
  ON event_sessions FOR INSERT
  WITH CHECK (
    event_id IN (
      SELECT id FROM events WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update sessions for their events"
  ON event_sessions FOR UPDATE
  USING (
    event_id IN (
      SELECT id FROM events WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete sessions for their events"
  ON event_sessions FOR DELETE
  USING (
    event_id IN (
      SELECT id FROM events WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- EVENT CREDITS POLICIES
-- ============================================================================

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

CREATE POLICY "Users can delete their own event credits"
  ON event_credits FOR DELETE
  USING (auth.uid() = user_id AND allocated_to_event_id IS NULL);

CREATE POLICY "Admins can delete event credits"
  ON event_credits FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- ============================================================================
-- SURVEY RESPONSES POLICIES
-- ============================================================================

CREATE POLICY "Anyone can insert survey responses"
  ON survey_responses FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view all survey responses"
  ON survey_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Event owners can view their survey responses"
  ON survey_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = survey_responses.event_id
      AND events.user_id = auth.uid()
    )
  );

-- ============================================================================
-- REALTIME
-- ============================================================================

-- Enable realtime for transcriptions table
ALTER PUBLICATION supabase_realtime ADD TABLE transcriptions;

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Insert some initial beta keys for testing (optional)
INSERT INTO beta_access_keys (access_key, max_uses, notes) VALUES
  ('BETA-COMMUNITY-2024', 1, 'Community group access'),
  ('BETA-PARTNER-2024', 5, 'Partner organization access'),
  ('BETA-TEST-2024', 10, 'Testing access key')
ON CONFLICT (access_key) DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE events IS 'Main events table storing all transcription events';
COMMENT ON TABLE transcriptions IS 'Real-time transcriptions for each event';
COMMENT ON TABLE user_profiles IS 'Extended user profile information';
COMMENT ON TABLE viewer_sessions IS 'Track live viewers for each event';
COMMENT ON TABLE beta_access_keys IS 'Beta access keys for user registration';
COMMENT ON TABLE event_sessions IS 'Multiple sessions per event support';
COMMENT ON TABLE event_credits IS 'Credit allocation system for events';
COMMENT ON TABLE survey_responses IS 'Viewer feedback email collection';

COMMENT ON INDEX idx_transcriptions_event_sequence IS 'Primary query pattern for ordered transcriptions by event';
COMMENT ON INDEX idx_transcriptions_event_final IS 'Partial index for filtering final transcriptions only';

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
