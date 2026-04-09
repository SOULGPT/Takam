-- ============================================================
-- TAKAM — Migration 005: Messages and Push Tokens
-- Run in Supabase SQL Editor → Run
-- ============================================================

-- 1. Add Push Token to Profiles
-- Used to send Expo Push Notifications when they aren't looking at the screen
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS expo_push_token TEXT;

-- 2. Create Messages Table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bond_id UUID NOT NULL REFERENCES bonds ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ -- NULL means unread
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 3. Messages RLS Policies
-- Users can see messages belonging to their active/pending bonds
CREATE POLICY "Messages: select" ON messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM bonds 
    WHERE id = messages.bond_id 
      AND (user_a = auth.uid() OR user_b = auth.uid())
  )
);

-- Users can only insert messages into their active bonds, and must be the sender
CREATE POLICY "Messages: insert" ON messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND
  EXISTS (
    SELECT 1 FROM bonds 
    WHERE id = bond_id 
      AND (user_a = auth.uid() OR user_b = auth.uid()) 
      AND status = 'active'
  )
);

-- Users can update (mark as read) if they belong to the bond
CREATE POLICY "Messages: update" ON messages FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM bonds 
    WHERE id = bond_id 
      AND (user_a = auth.uid() OR user_b = auth.uid())
  )
);

-- 4. Enable Realtime
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE messages; EXCEPTION WHEN others THEN NULL; END;
END $$;
