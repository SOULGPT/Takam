-- ============================================================
-- TAKAM — Migration 015: Chat Media Support (Voice, Images)
-- ============================================================

-- 1. Add columns to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'text'; -- 'text', 'image', 'audio'

-- 2. Extend the CHECK constraint if necessary (optional but good practice)
-- Note: We stick to a simple column for speed now.

-- 3. Create Storage Bucket for chat-media (Must be done in Supabase UI or via SQL)
-- This SQL attempts to create the bucket and set up policies.
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-media', 'chat-media', true) ON CONFLICT (id) DO NOTHING;

-- Policies for chat-media
-- Allow all authenticated users to upload
CREATE POLICY "Allow authenticated uploads to chat-media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-media');

-- Allow everyone to read public chat media
CREATE POLICY "Allow public read from chat-media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'chat-media');

-- End of migration
