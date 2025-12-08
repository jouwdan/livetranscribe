-- Create survey_responses table to track viewer email subscriptions
CREATE TABLE IF NOT EXISTS survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for faster event lookups
CREATE INDEX IF NOT EXISTS idx_survey_responses_event_id ON survey_responses(event_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_created_at ON survey_responses(created_at DESC);

-- Enable RLS
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert (viewers can submit their email)
CREATE POLICY "Anyone can insert survey responses"
  ON survey_responses
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Policy: Admins can view all survey responses
CREATE POLICY "Admins can view all survey responses"
  ON survey_responses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Policy: Event owners can view their event's survey responses
CREATE POLICY "Event owners can view their survey responses"
  ON survey_responses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = survey_responses.event_id
      AND events.user_id = auth.uid()
    )
  );
