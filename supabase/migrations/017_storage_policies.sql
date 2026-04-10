-- ============================================================
-- TAKAM — Migration 017: Storage RLS for Media (FIXED)
-- ============================================================

-- This migration sets up the necessary security policies for the 'chat-media' bucket.
-- We use DROP POLICY IF EXISTS to ensure idempotency without relying on non-existent internal tables.

-- 1. UPLOAD POLICY: Allow authenticated users to upload files to chat-media
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated uploads to chat-media" ON storage.objects;
    CREATE POLICY "Allow authenticated uploads to chat-media"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'chat-media');
END $$;

-- 2. DOWNLOAD/VIEW POLICY: Allow everyone (public) to view chat media
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow public read from chat-media" ON storage.objects;
    CREATE POLICY "Allow public read from chat-media"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'chat-media');
END $$;

-- 3. DELETE POLICY: Allow authenticated users to delete their own uploads from chat-media
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow owner to delete from chat-media" ON storage.objects;
    CREATE POLICY "Allow owner to delete from chat-media"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'chat-media' AND (select auth.uid()) = owner);
END $$;

-- 4. REDUNDANCY: Ensure walkie-bursts policies remain intact
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated uploads to walkie-bursts" ON storage.objects;
    CREATE POLICY "Allow authenticated uploads to walkie-bursts"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'walkie-bursts');

    DROP POLICY IF EXISTS "Allow public read from walkie-bursts" ON storage.objects;
    CREATE POLICY "Allow public read from walkie-bursts"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'walkie-bursts');
END $$;
