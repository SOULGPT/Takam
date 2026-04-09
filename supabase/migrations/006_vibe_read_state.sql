-- ============================================================
-- TAKAM — Migration 006: Vibe Read States
-- Run in Supabase SQL Editor → Run
-- ============================================================

-- Add read_at column to vibes to track unseen vibes
ALTER TABLE vibes ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- Backfill existing vibes so users aren't suddenly bombarded with past vibes
UPDATE vibes SET read_at = NOW() WHERE read_at IS NULL;

-- Ensure Publication for realtime vibes is active
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE vibes; EXCEPTION WHEN others THEN NULL; END;
END $$;
