-- ============================================================
-- TAKAM — Migration 012: Chat Interactive Features (Replies, Pins)
-- ============================================================

ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;

-- Create an index to quickly lookup pinned messages within a bond
CREATE INDEX IF NOT EXISTS idx_messages_pinned ON messages(bond_id, is_pinned) WHERE is_pinned = TRUE;

-- End of migration
