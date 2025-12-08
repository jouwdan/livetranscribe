-- Create a generic increment function for updating counters
-- This function safely increments numeric columns in any table
CREATE OR REPLACE FUNCTION increment(
  row_id UUID,
  table_name TEXT,
  column_name TEXT,
  increment_by INTEGER DEFAULT 1
)
RETURNS void
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment(UUID, TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION increment(UUID, TEXT, TEXT, INTEGER) TO anon;
