-- Create function to calculate actual event usage from transcriptions
CREATE OR REPLACE FUNCTION calculate_event_usage(event_ids uuid[])
RETURNS TABLE (
  total_minutes numeric,
  total_transcriptions bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(
      EXTRACT(EPOCH FROM (MAX(t.created_at) - MIN(t.created_at))) / 60
    ), 0)::numeric as total_minutes,
    COUNT(t.id) as total_transcriptions
  FROM transcriptions t
  WHERE t.event_id = ANY(event_ids)
  GROUP BY t.event_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION calculate_event_usage(uuid[]) TO authenticated;
