-- ============================================================
-- TAKAM — RLS Hotfix Patch
-- Run this in Supabase SQL Editor → New Query → Run
-- This patches the already-deployed schema to fix bond joining
-- and partner profile reads.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. BONDS — Allow any authenticated user to look up a pending bond
--    (required so a joiner can find the bond before they're user_b)
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Bond: lookup pending to join" ON bonds;
CREATE POLICY "Bond: lookup pending to join"
  ON bonds FOR SELECT
  USING (status = 'pending' AND auth.uid() IS NOT NULL);

-- ─────────────────────────────────────────────────────────────
-- 2. BONDS — Allow an authenticated user to JOIN a pending bond
--    They must not be the creator (user_a), and they can only
--    set user_b to themselves.
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Bond: join pending bond" ON bonds;
CREATE POLICY "Bond: join pending bond"
  ON bonds FOR UPDATE
  USING (status = 'pending' AND auth.uid() != user_a)
  WITH CHECK (user_b = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- 3. PROFILES — Allow bond partners to read each other's profile
--    (required for HomeScreen partner display and ProfileScreen)
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Bond partners can view profile" ON profiles;
CREATE POLICY "Bond partners can view profile"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bonds
      WHERE (bonds.user_a = auth.uid() OR bonds.user_b = auth.uid())
        AND (bonds.user_a = profiles.id  OR bonds.user_b = profiles.id)
        AND bonds.status = 'active'
    )
  );
