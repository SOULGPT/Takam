-- ============================================================
-- TAKAM — Migration 021: Unread Global Counts
-- Run in Supabase SQL Editor → Run
-- ============================================================

CREATE OR REPLACE FUNCTION get_unread_counts()
RETURNS TABLE (bond_id UUID, unread_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id AS bond_id,
    (
      (SELECT count(*) FROM messages m WHERE m.bond_id = b.id AND m.sender_id != auth.uid() AND m.read_at IS NULL)
      +
      (SELECT count(*) FROM vibes v WHERE v.bond_id = b.id AND v.sender_id != auth.uid() AND v.read_at IS NULL)
    )::BIGINT AS unread_count
  FROM bonds b
  WHERE (b.user_a = auth.uid() OR b.user_b = auth.uid())
  AND b.status = 'active';
END;
$$;

-- End of migration
