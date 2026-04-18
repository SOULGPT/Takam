-- ============================================================
-- TAKAM — Migration 034: Security Hardening (RLS & Throttling)
-- ============================================================

-- 1. Tighten Profiles UPDATE policy
-- Users should NOT be able to change their own role or premium status.
-- We'll replace the broad update policy with a more restrictive one.

DROP POLICY IF EXISTS "User can update own profile" ON profiles;

CREATE POLICY "User can update own profile (restricted)"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    (
      -- Ensure role, subscription_tier, and is_premium remain unchanged unless the user is an admin
      (role = (SELECT role FROM profiles WHERE id = auth.uid()) OR public.is_admin()) AND
      (subscription_tier = (SELECT subscription_tier FROM profiles WHERE id = auth.uid()) OR public.is_admin()) AND
      (is_premium = (SELECT is_premium FROM profiles WHERE id = auth.uid()) OR public.is_admin())
    )
  );

-- 2. Tighten Storage Bucket Policies
-- Ensure users can only upload to paths that start with their own Bond ID.

DROP POLICY IF EXISTS "Allow authenticated uploads to chat-media" ON storage.objects;
CREATE POLICY "Allow members of bond to upload to chat-media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'chat-media' AND
    (
      EXISTS (
        SELECT 1 FROM bonds
        WHERE bonds.id::text = (storage.foldername(name))[1]
          AND (bonds.user_a = auth.uid() OR bonds.user_b = auth.uid())
          AND bonds.status = 'active'
      )
    )
  );

DROP POLICY IF EXISTS "Allow authenticated uploads to walkie-bursts" ON storage.objects;
CREATE POLICY "Allow members of bond to upload to walkie-bursts"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'walkie-bursts' AND
    (
      EXISTS (
        SELECT 1 FROM bonds
        WHERE bonds.id::text = (storage.foldername(name))[1]
          AND (bonds.user_a = auth.uid() OR bonds.user_b = auth.uid())
          AND bonds.status = 'active'
      )
    )
  );

-- 3. Add Rate Limiting helper (Optional but recommended for DB level)
-- For now, we rely on the client-side throttling I implemented, 
-- but these DB changes are critical for core security.
