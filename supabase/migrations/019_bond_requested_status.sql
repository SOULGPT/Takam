-- ============================================================
-- TAKAM — Migration 019: Bond requested status
-- ============================================================

-- Safely drop any existing CHECK constraint on the "status" column
DO $$ 
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT conname 
    FROM pg_constraint 
    WHERE conrelid = 'bonds'::regclass 
      AND contype = 'c' 
      AND pg_get_constraintdef(oid) LIKE '%status%'
  LOOP
    EXECUTE 'ALTER TABLE bonds DROP CONSTRAINT ' || quote_ident(rec.conname);
  END LOOP;
END $$;

-- Add the new constraint allowing 'requested'
ALTER TABLE bonds 
ADD CONSTRAINT bonds_status_check 
CHECK (status IN ('pending', 'requested', 'active', 'dissolved'));

-- Update "Bond: join pending bond" policy to allow setting status to 'requested'
DROP POLICY IF EXISTS "Bond: join pending bond" ON bonds;
CREATE POLICY "Bond: join pending bond"
  ON bonds FOR UPDATE
  USING  (status = 'pending' AND auth.uid() != user_a)
  WITH CHECK (user_b = auth.uid() AND status IN ('pending', 'requested', 'active'));

-- Allow a creator to accept/reject (delete or update) a requested bond
-- (Already handled by "Bond: members can update" and "Bond: creator can delete")
