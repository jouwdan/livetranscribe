-- Add description field to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS description TEXT;
