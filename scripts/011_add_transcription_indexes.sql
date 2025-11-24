-- Add performance indexes for transcriptions table

-- Primary lookup pattern: get all transcriptions for an event, ordered
CREATE INDEX IF NOT EXISTS idx_transcriptions_event_sequence 
ON transcriptions(event_id, sequence_number);

-- Lookup pattern: get transcriptions by timestamp for an event
CREATE INDEX IF NOT EXISTS idx_transcriptions_event_timestamp 
ON transcriptions(event_id, created_at);

-- Filter pattern: get only final transcriptions for an event
CREATE INDEX IF NOT EXISTS idx_transcriptions_event_final 
ON transcriptions(event_id, is_final) 
WHERE is_final = true;

-- Composite index for the most common query pattern
CREATE INDEX IF NOT EXISTS idx_transcriptions_event_seq_final 
ON transcriptions(event_id, sequence_number, is_final);

-- Add comment explaining the indexes
COMMENT ON INDEX idx_transcriptions_event_sequence IS 'Primary query pattern for ordered transcriptions by event';
COMMENT ON INDEX idx_transcriptions_event_final IS 'Partial index for filtering final transcriptions only';
