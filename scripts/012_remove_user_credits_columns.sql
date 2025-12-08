-- Remove user-level credits columns since credits are now managed per event
ALTER TABLE user_profiles 
DROP COLUMN IF EXISTS credits_minutes,
DROP COLUMN IF EXISTS max_attendees,
DROP COLUMN IF EXISTS credits_last_updated;

-- Note: Credits are now managed in the event_credits table
-- This allows for more granular control over event-specific allocations
