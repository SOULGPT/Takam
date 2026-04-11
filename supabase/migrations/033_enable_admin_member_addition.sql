-- ============================================================
-- TAKAM — Migration 033: Enable Admin Member Addition
-- ============================================================

-- Allow admins (Host/Moderator) to insert new members into a group.
-- We explicitly grant this power so they don't have to rely only on the "Join via Code" flow.
DROP POLICY IF EXISTS "Users can join groups" ON group_members;

CREATE POLICY "Enable member addition and self-joining" ON group_members FOR INSERT
WITH CHECK (
  -- Case A: The user is joining themselves (auth.uid() matches target user_id)
  (auth.uid() = user_id) OR
  -- Case B: The performer is an existing Host or Moderator of the group
  (check_group_role(group_id, auth.uid(), ARRAY['host', 'moderator']))
);

-- Note: SELECT, UPDATE, and DELETE are already covered by safe functions in Migration 032.
