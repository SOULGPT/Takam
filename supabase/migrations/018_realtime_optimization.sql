-- ============================================================
-- TAKAM — Migration 018: Realtime Optimization
-- ============================================================

-- Ensure messages table has full replica identity to include all columns in realtime payloads
ALTER TABLE messages REPLICA IDENTITY FULL;

-- Ensure media columns exist (safely)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'media_url') THEN
        ALTER TABLE messages ADD COLUMN media_url TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'media_type') THEN
        ALTER TABLE messages ADD COLUMN media_type TEXT DEFAULT 'text';
    END IF;
END $$;

-- Explicitly add columns to the realtime publication
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
EXCEPTION WHEN duplicate_object THEN
    -- Table might already be in publication, which is fine
    NULL;
END $$;
