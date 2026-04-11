-- ============================================================
-- TAKAM — Migration 030: Group Bonds
-- ============================================================

-- 1. GROUPS TABLE
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  group_code TEXT UNIQUE NOT NULL,
  cover_emoji TEXT DEFAULT '👥',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. GROUP MEMBERS TABLE
CREATE TABLE IF NOT EXISTS group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('host', 'moderator', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'removed', 'left')),
  UNIQUE(group_id, user_id)
);

-- 3. GROUP MESSAGES TABLE
CREATE TABLE IF NOT EXISTS group_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'vibe', 'system')),
  vibe_type TEXT,
  reply_to_id UUID REFERENCES group_messages(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. GROUP VIBES TABLE (Broadcasted vibes for high-impact)
CREATE TABLE IF NOT EXISTS group_vibes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups ON DELETE CASCADE,
  sent_by UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  vibe_type TEXT NOT NULL,
  custom_text TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. FUNCTION TO GENERATE 6-CHAR CODE
CREATE OR REPLACE FUNCTION generate_group_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- No I, O, 0, 1 for clarity
  result TEXT := '';
  i INTEGER := 0;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 6. RLS POLICIES
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_vibes ENABLE ROW LEVEL SECURITY;

-- Groups: Active members can view
CREATE POLICY "Members see group" ON groups FOR SELECT
USING (EXISTS (SELECT 1 FROM group_members WHERE group_id = groups.id AND user_id = auth.uid() AND status = 'active'));

-- Group Members: Members see fellow members
CREATE POLICY "Members see others" ON group_members FOR SELECT
USING (EXISTS (SELECT 1 FROM group_members WHERE group_id = group_members.group_id AND user_id = auth.uid() AND status = 'active'));

-- Group Messages: Members see/post messages
CREATE POLICY "Members see messages" ON group_messages FOR SELECT
USING (EXISTS (SELECT 1 FROM group_members WHERE group_id = group_messages.group_id AND user_id = auth.uid() AND status = 'active'));
CREATE POLICY "Members post messages" ON group_messages FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM group_members WHERE group_id = group_messages.group_id AND user_id = auth.uid() AND status = 'active'));

-- Group Vibes: Members see/post vibes
CREATE POLICY "Members see vibes" ON group_vibes FOR SELECT
USING (EXISTS (SELECT 1 FROM group_members WHERE group_id = group_vibes.group_id AND user_id = auth.uid() AND status = 'active'));

-- 7. PUSH NOTIFICATION TRIGGER (Placeholder for Edge Function Integration)
-- This function would be updated as part of the edge function setup
CREATE OR REPLACE FUNCTION notify_group_vibe()
RETURNS TRIGGER AS $$
BEGIN
  -- Logic to insert into a notifications queue or call edge function via net.http_post
  -- (Assuming Edge Function setup handles this broadcast)
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_group_vibe_sent
  AFTER INSERT ON group_vibes
  FOR EACH ROW EXECUTE FUNCTION notify_group_vibe();

-- End of migration
