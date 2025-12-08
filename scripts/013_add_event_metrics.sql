-- Add metrics columns to events table
ALTER TABLE events
ADD COLUMN IF NOT EXISTS total_transcriptions integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_words integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS peak_viewers integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS average_viewers integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_session_duration_minutes integer DEFAULT 0;

-- Create function to calculate event metrics
CREATE OR REPLACE FUNCTION calculate_event_metrics(p_event_id uuid)
RETURNS TABLE (
  total_transcriptions bigint,
  total_words bigint,
  peak_viewers integer,
  average_viewers numeric,
  total_duration_minutes integer,
  unique_viewers bigint,
  total_sessions bigint
) AS $$
BEGIN
  RETURN QUERY
  WITH transcription_stats AS (
    SELECT
      COUNT(*) as trans_count,
      SUM(array_length(string_to_array(text, ' '), 1)) as word_count
    FROM transcriptions
    WHERE event_id = p_event_id AND is_final = true
  ),
  viewer_stats AS (
    SELECT
      COUNT(DISTINCT session_id) as unique_count,
      COUNT(*) as session_count
    FROM viewer_sessions
    WHERE event_id = p_event_id
  ),
  usage_stats AS (
    SELECT
      COALESCE(SUM(duration_minutes), 0) as total_duration
    FROM usage_logs
    WHERE event_id = p_event_id
  )
  SELECT
    COALESCE(t.trans_count, 0)::bigint,
    COALESCE(t.word_count, 0)::bigint,
    0::integer as peak, -- Would need time-series data for accurate calculation
    0::numeric as avg, -- Would need time-series data for accurate calculation
    COALESCE(u.total_duration, 0)::integer,
    COALESCE(v.unique_count, 0)::bigint,
    COALESCE(v.session_count, 0)::bigint
  FROM transcription_stats t
  CROSS JOIN viewer_stats v
  CROSS JOIN usage_stats u;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
