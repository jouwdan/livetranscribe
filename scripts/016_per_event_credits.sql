-- Add credit fields to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS credits_minutes INTEGER DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS max_attendees INTEGER DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS credits_allocated_at TIMESTAMPTZ;

-- Move credits from user_profiles to events table

-- Function to check if event has sufficient credits
CREATE OR REPLACE FUNCTION check_event_credits(
  p_event_id UUID,
  p_duration_minutes INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  v_credits INTEGER;
BEGIN
  SELECT credits_minutes INTO v_credits
  FROM events
  WHERE id = p_event_id;
  
  RETURN v_credits >= p_duration_minutes;
END;
$$ LANGUAGE plpgsql;

-- Function to deduct credits from event after session
CREATE OR REPLACE FUNCTION deduct_event_credits(
  p_event_id UUID,
  p_duration_minutes INTEGER
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE events
  SET 
    credits_minutes = GREATEST(0, credits_minutes - p_duration_minutes)
  WHERE id = p_event_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to allocate credits to an event (for admin/purchase use)
CREATE OR REPLACE FUNCTION allocate_event_credits(
  p_event_id UUID,
  p_minutes INTEGER,
  p_max_attendees INTEGER
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE events
  SET 
    credits_minutes = credits_minutes + p_minutes,
    max_attendees = p_max_attendees,
    credits_allocated_at = NOW()
  WHERE id = p_event_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Keep user-level credits for backward compatibility and trial credits
-- Users still get 15 minutes trial on signup, but new events need credits allocated
