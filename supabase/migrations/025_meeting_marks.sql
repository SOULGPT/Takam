-- Migration: 025_meeting_marks
-- 1. Create the table
CREATE TABLE IF NOT EXISTS meeting_marks (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  bond_id      UUID        NOT NULL REFERENCES bonds ON DELETE CASCADE,
  created_by   UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  latitude     DOUBLE PRECISION NOT NULL,
  longitude    DOUBLE PRECISION NOT NULL,
  category     TEXT        CHECK (category IN ('coffee', 'dinner', 'meet', 'stay')),
  label        TEXT,
  is_active    BOOLEAN     DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Indices for performance
CREATE INDEX IF NOT EXISTS idx_meeting_marks_bond_id ON meeting_marks(bond_id);

-- 3. Enable RLS
ALTER TABLE meeting_marks ENABLE ROW LEVEL SECURITY;

-- 4. Policies
-- Partners in a bond can see marks
CREATE POLICY "MeetingMarks: select by bond"
  ON meeting_marks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bonds
      WHERE bonds.id = bond_id
        AND (bonds.user_a = auth.uid() OR bonds.user_b = auth.uid())
    )
  );

-- Partners can drop marks
CREATE POLICY "MeetingMarks: insert by bond"
  ON meeting_marks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bonds
      WHERE bonds.id = bond_id
        AND (bonds.user_a = auth.uid() OR bonds.user_b = auth.uid())
        AND bonds.status = 'active'
    )
  );

-- Either partner can deactivate/delete (soft delete)
CREATE POLICY "MeetingMarks: update by bond"
  ON meeting_marks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM bonds
      WHERE bonds.id = bond_id
        AND (bonds.user_a = auth.uid() OR bonds.user_b = auth.uid())
    )
  );

-- 5. Add to Realtime Publication
ALTER PUBLICATION supabase_realtime ADD TABLE meeting_marks;
