-- Add sessions table to support multiple sessions per event
CREATE TABLE IF NOT EXISTS public.event_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  session_number INTEGER NOT NULL DEFAULT 1,
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER DEFAULT 0,
  total_transcriptions INTEGER DEFAULT 0,
  total_words INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, session_number)
);

-- Add session_id to transcriptions table
ALTER TABLE public.transcriptions 
ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.event_sessions(id) ON DELETE CASCADE;

-- Create index for faster session queries
CREATE INDEX IF NOT EXISTS idx_transcriptions_session_id ON public.transcriptions(session_id);
CREATE INDEX IF NOT EXISTS idx_event_sessions_event_id ON public.event_sessions(event_id);

-- Enable RLS on event_sessions
ALTER TABLE public.event_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for event_sessions
CREATE POLICY "Users can view sessions for their events"
  ON public.event_sessions FOR SELECT
  USING (
    event_id IN (
      SELECT id FROM public.events WHERE user_id = auth.uid()
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

-- Create default session for existing events
INSERT INTO public.event_sessions (event_id, name, session_number)
SELECT id, 'Session 1', 1
FROM public.events
WHERE NOT EXISTS (
  SELECT 1 FROM public.event_sessions WHERE event_id = events.id
);

-- Update existing transcriptions to link to default sessions
UPDATE public.transcriptions t
SET session_id = s.id
FROM public.event_sessions s
WHERE t.event_id = s.event_id 
  AND s.session_number = 1
  AND t.session_id IS NULL;

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
