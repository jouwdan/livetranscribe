-- Add logo_url column to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS logo_url TEXT;
