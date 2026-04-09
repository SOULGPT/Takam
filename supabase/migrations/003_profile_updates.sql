-- ============================================================
-- TAKAM — Migration 003: Profile fields + Bond type
-- Run this in Supabase SQL Editor → Run
-- ============================================================

-- ─── PROFILES: new columns ───────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS bio      TEXT,
  ADD COLUMN IF NOT EXISTS sex      TEXT CHECK (sex IN ('male','female','prefer_not_to_say')),
  ADD COLUMN IF NOT EXISTS country  TEXT;

-- Case-insensitive unique username (allows nulls)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique
  ON profiles (lower(username))
  WHERE username IS NOT NULL;

-- ─── BONDS: bond_type ────────────────────────────────────────
ALTER TABLE bonds
  ADD COLUMN IF NOT EXISTS bond_type TEXT NOT NULL DEFAULT 'partner'
    CHECK (bond_type IN ('partner','friend'));

-- ─── REALTIME: ensure both tables are published ──────────────
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE vibes; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE bonds; EXCEPTION WHEN others THEN NULL; END;
END $$;

-- ─── PARTNER PROFILE ACCESS ─────────────────────────────────
DROP POLICY IF EXISTS "Bond partners can view profile" ON profiles;
CREATE POLICY "Bond partners can view profile"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bonds
      WHERE (bonds.user_a = auth.uid() OR bonds.user_b = auth.uid())
        AND (bonds.user_a = profiles.id OR bonds.user_b = profiles.id)
        AND bonds.status = 'active'
    )
  );

-- ─── BOND JOIN POLICIES ─────────────────────────────────────
DROP POLICY IF EXISTS "Bond: lookup pending to join" ON bonds;
CREATE POLICY "Bond: lookup pending to join"
  ON bonds FOR SELECT
  USING (status = 'pending' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Bond: join pending bond" ON bonds;
CREATE POLICY "Bond: join pending bond"
  ON bonds FOR UPDATE
  USING  (status = 'pending' AND auth.uid() != user_a)
  WITH CHECK (user_b = auth.uid());
