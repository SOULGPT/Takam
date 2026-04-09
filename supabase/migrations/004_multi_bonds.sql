-- ============================================================
-- TAKAM — Migration 004: Expand bond_type to all relationship labels
-- Run in Supabase SQL Editor → Run
-- ============================================================

-- Drop the old check constraint (only had partner | friend)
ALTER TABLE bonds DROP CONSTRAINT IF EXISTS bonds_bond_type_check;

-- Add the full relationship-type set
ALTER TABLE bonds
  ADD CONSTRAINT bonds_bond_type_check
  CHECK (bond_type IN (
    'partner',
    'spouse',
    'bestfriend',
    'friend',
    'sibling',
    'parent',
    'child',
    'family',
    'colleague',
    'other'
  ));

-- Back-fill any NULL bond_type values (safety net)
UPDATE bonds SET bond_type = 'other' WHERE bond_type IS NULL;

-- Ensure bonds table is published for realtime (idempotent)
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE bonds; EXCEPTION WHEN others THEN NULL; END;
END $$;
