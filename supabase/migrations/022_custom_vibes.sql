-- Migration: 022_custom_vibes
-- Drop the existing vibe_type check constraint and replace it with one that includes 'custom'

ALTER TABLE vibes DROP CONSTRAINT IF EXISTS vibes_vibe_type_check;

ALTER TABLE vibes ADD CONSTRAINT vibes_vibe_type_check 
  CHECK (vibe_type IN ('miss_you', 'love', 'thinking_of_you', 'walkie_burst', 'thought', 'checkin', 'custom'));

-- Ensure content column is large enough for JSON metadata (it's already TEXT, which is fine)
