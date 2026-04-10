-- Migration: 014_walkie_bursts
-- 1. Add 'content' column to vibes for audio URLs
-- 2. Drop the restrictive vibe_type check constraint and replace with an expanded one

ALTER TABLE vibes ADD COLUMN IF NOT EXISTS content TEXT;

-- Find the existing check constraint name if possible, or just drop it if we know the pattern
-- In 001_schema.sql it was: CHECK (vibe_type IN ('miss_you', 'love', 'thinking_of_you'))
ALTER TABLE vibes DROP CONSTRAINT IF EXISTS vibes_vibe_type_check;

ALTER TABLE vibes ADD CONSTRAINT vibes_vibe_type_check 
  CHECK (vibe_type IN ('miss_you', 'love', 'thinking_of_you', 'walkie_burst', 'thought', 'checkin'));

-- Also add a column for read_at if not present from 006 (just in case)
ALTER TABLE vibes ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
