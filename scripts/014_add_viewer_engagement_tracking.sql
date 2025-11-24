-- Add columns to viewer_sessions for tracking engagement metrics
ALTER TABLE viewer_sessions
ADD COLUMN IF NOT EXISTS scroll_events integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS visibility_changes integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_active_time_seconds integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_activity_at timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS transcriptions_viewed integer DEFAULT 0;

-- Add index for better performance on event queries
CREATE INDEX IF NOT EXISTS idx_viewer_sessions_event_activity 
ON viewer_sessions(event_id, last_activity_at);

-- Add computed columns to events table for aggregate metrics
ALTER TABLE events
ADD COLUMN IF NOT EXISTS average_view_duration_minutes integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_viewer_engagement_score integer DEFAULT 0;
