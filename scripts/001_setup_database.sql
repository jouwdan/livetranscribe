-- LiveTranscribe Database Setup
-- A simple, open-source live transcription system

-- ======================
-- Core Tables
-- ======================

-- User profiles table
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Events table
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug TEXT UNIQUE NOT NULL,
  organizer_key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  is_active BOOLEAN DEFAULT false,
  archived BOOLEAN DEFAULT false,
  session_active BOOLEAN DEFAULT false,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event sessions table (multiple sessions per event)
CREATE TABLE IF NOT EXISTS public.event_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
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

-- Transcriptions table
CREATE TABLE IF NOT EXISTS public.transcriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.event_sessions(id) ON DELETE CASCADE,
  speaker_id TEXT NOT NULL,
  text TEXT NOT NULL,
  sequence_number INTEGER NOT NULL,
  is_final BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ======================
-- Indexes
-- ======================

CREATE INDEX IF NOT EXISTS idx_events_slug ON public.events(slug);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON public.events(user_id);
CREATE INDEX IF NOT EXISTS idx_event_sessions_event_id ON public.event_sessions(event_id);
CREATE INDEX IF NOT EXISTS idx_transcriptions_event_id ON public.transcriptions(event_id);
CREATE INDEX IF NOT EXISTS idx_transcriptions_session_id ON public.transcriptions(session_id);
CREATE INDEX IF NOT EXISTS idx_transcriptions_sequence ON public.transcriptions(event_id, sequence_number);

-- ======================
-- Row Level Security
-- ======================

-- Enable RLS on all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcriptions ENABLE ROW LEVEL SECURITY;

-- User Profiles Policies
CREATE POLICY "Users can view own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- Events Policies
CREATE POLICY "Users can view own events"
  ON public.events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Active events are publicly viewable"
  ON public.events FOR SELECT
  USING (is_active = true);

CREATE POLICY "Authenticated users can create events"
  ON public.events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own events"
  ON public.events FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own events"
  ON public.events FOR DELETE
  USING (auth.uid() = user_id);

-- Event Sessions Policies
CREATE POLICY "Users can view sessions for their events"
  ON public.event_sessions FOR SELECT
  USING (
    event_id IN (
      SELECT id FROM public.events WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Public can view sessions for active events"
  ON public.event_sessions FOR SELECT
  USING (
    event_id IN (
      SELECT id FROM public.events WHERE is_active = true
    )
  );

CREATE POLICY "Users can create sessions for their events"
  ON public.event_sessions FOR INSERT
  WITH CHECK (
    event_id IN (
      SELECT id FROM public.events WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update sessions for their events"
  ON public.event_sessions FOR UPDATE
  USING (
    event_id IN (
      SELECT id FROM public.events WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete sessions for their events"
  ON public.event_sessions FOR DELETE
  USING (
    event_id IN (
      SELECT id FROM public.events WHERE user_id = auth.uid()
    )
  );

-- Transcriptions Policies
CREATE POLICY "Transcriptions viewable for active events"
  ON public.transcriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.events 
      WHERE events.id = transcriptions.event_id 
      AND events.is_active = true
    )
  );

CREATE POLICY "Users can view transcriptions for own events"
  ON public.transcriptions FOR SELECT
  USING (
    event_id IN (
      SELECT id FROM public.events WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert transcriptions"
  ON public.transcriptions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can delete transcriptions for own events"
  ON public.transcriptions FOR DELETE
  USING (
    event_id IN (
      SELECT id FROM public.events WHERE user_id = auth.uid()
    )
  );

-- ======================
-- Realtime
-- ======================

-- Enable realtime for transcriptions
ALTER PUBLICATION supabase_realtime ADD TABLE public.transcriptions;

-- ======================
-- Helper Functions
-- ======================

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
  FROM public.event_sessions
  WHERE event_id = p_event_id
    AND started_at IS NOT NULL
    AND ended_at IS NULL
  ORDER BY started_at DESC
  LIMIT 1;
  
  -- If no active session, create a new one
  IF v_session_id IS NULL THEN
    SELECT COALESCE(MAX(session_number), 0) + 1 INTO v_next_number
    FROM public.event_sessions
    WHERE event_id = p_event_id;
    
    INSERT INTO public.event_sessions (event_id, name, session_number)
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

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
