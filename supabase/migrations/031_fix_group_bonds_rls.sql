-- ============================================================
-- TAKAM — Migration 031: Fix Group Bonds RLS Recursion
-- ============================================================

-- 1. SECURITY DEFINER FUNCTION
-- This allows us to check membership without triggering a recursive RLS loop.
CREATE OR REPLACE FUNCTION check_group_membership(gid UUID, uid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM group_members 
    WHERE group_id = gid AND user_id = uid AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. GROUPS TABLE POLICIES
DROP POLICY IF EXISTS "Members see group" ON groups;
CREATE POLICY "Members see group" ON groups FOR SELECT
USING (check_group_membership(id, auth.uid()));

CREATE POLICY "Authenticated users can create groups" ON groups FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Hosts can manage groups" ON groups FOR ALL
USING (auth.uid() = created_by);

-- 3. GROUP MEMBERS TABLE POLICIES
DROP POLICY IF EXISTS "Members see others" ON group_members;
CREATE POLICY "Members see others" ON group_members FOR SELECT
USING (check_group_membership(group_id, auth.uid()));

CREATE POLICY "Users can join groups" ON group_members FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Members can manage their own status" ON group_members FOR UPDATE
USING (auth.uid() = user_id);

-- This allows hosts/moderators to manage other members
CREATE POLICY "Privileged members can manage others" ON group_members FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM group_members 
    WHERE group_id = group_members.group_id 
      AND user_id = auth.uid() 
      AND role IN ('host', 'moderator')
  )
);

-- 4. MESSAGES & VIBES (Ensuring SELECT is optimized)
DROP POLICY IF EXISTS "Members see messages" ON group_messages;
CREATE POLICY "Members see messages" ON group_messages FOR SELECT
USING (check_group_membership(group_id, auth.uid()));

DROP POLICY IF EXISTS "Members see vibes" ON group_vibes;
CREATE POLICY "Members see vibes" ON group_vibes FOR SELECT
USING (check_group_membership(group_id, auth.uid()));

-- Ensure INSERT is allowed for vibes
DROP POLICY IF EXISTS "Members send vibes" ON group_vibes;
CREATE POLICY "Members send vibes" ON group_vibes FOR INSERT
WITH CHECK (check_group_membership(group_id, auth.uid()));
