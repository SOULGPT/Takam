-- ============================================================
-- TAKAM — Migration 032: Fix Group Bonds RLS (Final Patch)
-- ============================================================

-- 1. ROLE-AWARE HELPER FUNCTION (Bypasses RLS)
-- This function runs as the system owner (Security Definer) and can safely 
-- query group_members to check roles without triggering an infinite RLS loop.
CREATE OR REPLACE FUNCTION check_group_role(gid UUID, uid UUID, allowed_roles TEXT[])
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM group_members 
    WHERE group_id = gid 
      AND user_id = uid 
      AND status = 'active' 
      AND role = ANY(allowed_roles)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. DROP PROBLEM-CAUSING POLICIES
-- We drop all current policies on group_members to ensure a clean slate.
DROP POLICY IF EXISTS "Members see others" ON group_members;
DROP POLICY IF EXISTS "Privileged members can manage others" ON group_members;
DROP POLICY IF EXISTS "Safe management policy" ON group_members; -- From previous attempts if exists

-- 3. RE-IMPLEMENT POLICIES USING SAFE FUNCTIONS
-- SELECT: Active members can see their group peers
CREATE POLICY "Members see group peers" ON group_members FOR SELECT
USING (check_group_membership(group_id, auth.uid()));

-- ALL: Host/Moderators can manage other members (Recursive-Safe)
CREATE POLICY "Admin manage members" ON group_members FOR ALL
USING (check_group_role(group_id, auth.uid(), ARRAY['host', 'moderator']));

-- 4. ENSURE CONSISTENCY IN OTHER TABLES
-- We update groups to use the most explicit check
DROP POLICY IF EXISTS "Members see group" ON groups;
CREATE POLICY "Members see group" ON groups FOR SELECT
USING (check_group_membership(id, auth.uid()));

DROP POLICY IF EXISTS "Members see messages" ON group_messages;
CREATE POLICY "Members see messages" ON group_messages FOR SELECT
USING (check_group_membership(group_id, auth.uid()));

DROP POLICY IF EXISTS "Members see vibes" ON group_vibes;
CREATE POLICY "Members see vibes" ON group_vibes FOR SELECT
USING (check_group_membership(group_id, auth.uid()));
