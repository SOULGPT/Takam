-- Migration: 026_profile_location
-- Adds tracking for last known location to enable Bridge midpoint calculation

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS last_latitude  DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS last_longitude DOUBLE PRECISION;

-- Note: No specific RLS changes needed as profiles already have restricted visibility.
-- Usually only partners can see profile details via Bond-joining logic.
