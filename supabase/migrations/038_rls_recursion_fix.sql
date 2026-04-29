-- ============================================================
-- TAKAM — Migration 038: Fix Profiles RLS Recursion
-- ============================================================

-- 1. SECURITY DEFINER FUNCTION
-- This allows us to check bond partnership without triggering a recursive RLS loop.
CREATE OR REPLACE FUNCTION check_bond_partnership(profile_id UUID, uid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM bonds 
    WHERE (user_a = uid OR user_b = uid)
      AND (user_a = profile_id OR user_b = profile_id)
      AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. UPDATE PROFILES POLICY
DROP POLICY IF EXISTS "Bond partners can view profile" ON profiles;
CREATE POLICY "Bond partners can view profile" ON profiles FOR SELECT
USING (check_bond_partnership(id, auth.uid()));
