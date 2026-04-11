-- Migration: 027_sync_link_calendar
-- 1. Add timezone column to profiles if it doesn't exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS timezone TEXT;

-- 2. Create Shared Calendar Table
CREATE TABLE IF NOT EXISTS shared_calendar (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  bond_id      UUID        NOT NULL REFERENCES bonds(id) ON DELETE CASCADE,
  creator_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title        TEXT        NOT NULL,
  description  TEXT,
  category     TEXT        NOT NULL CHECK (category IN ('Sleep', 'Work', 'Commute', 'Event', 'Flight', 'Bonding')),
  start_time   TIMESTAMPTZ NOT NULL,
  end_time     TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Event Tasks Table (Nested Checklist)
CREATE TABLE IF NOT EXISTS event_tasks (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id     UUID        NOT NULL REFERENCES shared_calendar(id) ON DELETE CASCADE,
  bond_id      UUID        NOT NULL REFERENCES bonds(id) ON DELETE CASCADE,
  title        TEXT        NOT NULL,
  is_completed BOOLEAN     DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable Indices
CREATE INDEX IF NOT EXISTS idx_shared_calendar_bond_id ON shared_calendar(bond_id);
CREATE INDEX IF NOT EXISTS idx_event_tasks_event_id ON event_tasks(event_id);

-- 5. Enable RLS
ALTER TABLE shared_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_tasks ENABLE ROW LEVEL SECURITY;

-- 6. Shared Calendar Policies
CREATE POLICY "Calendar: partners can view"
  ON shared_calendar FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bonds
      WHERE bonds.id = bond_id
        AND (bonds.user_a = auth.uid() OR bonds.user_b = auth.uid())
    )
  );

CREATE POLICY "Calendar: partners can insert"
  ON shared_calendar FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bonds
      WHERE bonds.id = bond_id
        AND (bonds.user_a = auth.uid() OR bonds.user_b = auth.uid())
        AND bonds.status = 'active'
    )
  );

CREATE POLICY "Calendar: partners can update"
  ON shared_calendar FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM bonds
      WHERE bonds.id = bond_id
        AND (bonds.user_a = auth.uid() OR bonds.user_b = auth.uid())
    )
  );

CREATE POLICY "Calendar: partners can delete"
  ON shared_calendar FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM bonds
      WHERE bonds.id = bond_id
        AND (bonds.user_a = auth.uid() OR bonds.user_b = auth.uid())
    )
  );

-- 7. Event Tasks Policies
CREATE POLICY "Tasks: partners can view"
  ON event_tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bonds
      WHERE bonds.id = bond_id
        AND (bonds.user_a = auth.uid() OR bonds.user_b = auth.uid())
    )
  );

CREATE POLICY "Tasks: partners can insert"
  ON event_tasks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bonds
      WHERE bonds.id = bond_id
        AND (bonds.user_a = auth.uid() OR bonds.user_b = auth.uid())
        AND bonds.status = 'active'
    )
  );

CREATE POLICY "Tasks: partners can update"
  ON event_tasks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM bonds
      WHERE bonds.id = bond_id
        AND (bonds.user_a = auth.uid() OR bonds.user_b = auth.uid())
    )
  );

CREATE POLICY "Tasks: partners can delete"
  ON event_tasks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM bonds
      WHERE bonds.id = bond_id
        AND (bonds.user_a = auth.uid() OR bonds.user_b = auth.uid())
    )
  );

-- 8. Add to Realtime Publication
ALTER PUBLICATION supabase_realtime ADD TABLE shared_calendar;
ALTER PUBLICATION supabase_realtime ADD TABLE event_tasks;
