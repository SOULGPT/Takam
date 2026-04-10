-- ============================================================
-- TAKAM — Migration 016: Media Stability & Storage Buckets
-- ============================================================

-- 1. Relax the 'content' constraint on messages
-- This allows messages that ONLY contain an image or an audio file
ALTER TABLE messages ALTER COLUMN content DROP NOT NULL;

-- 2. Create 'walkie-bursts' storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('walkie-bursts', 'walkie-bursts', true) ON CONFLICT (id) DO NOTHING;

-- 3. Storage Policies for walkie-bursts
-- Allow authenticated users to upload their bursts
DO $$
BEGIN
    CREATE POLICY "Allow authenticated uploads to walkie-bursts"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'walkie-bursts');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Allow public read access to bursts
DO $$
BEGIN
    CREATE POLICY "Allow public read from walkie-bursts"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'walkie-bursts');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 4. Ensure chat-media policies are robust
DO $$
BEGIN
    INSERT INTO storage.buckets (id, name, public) VALUES ('chat-media', 'chat-media', true) ON CONFLICT (id) DO NOTHING;
EXCEPTION
    WHEN others THEN NULL;
END $$;

-- Refresh realtime publication for messages to ensure all columns (media_url, etc) are picked up
-- Postgres ALTER PUBLICATION does not support IF EXISTS for DROP TABLE.
-- Using a DO block to safely ensure the table is added to publication.
DO $$
BEGIN
    -- Try to add it (in case it's not there)
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE messages;
    EXCEPTION
        WHEN duplicate_object THEN NULL; -- Already exists, that's fine
    END;
END $$;
