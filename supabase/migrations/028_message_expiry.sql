-- ============================================================
-- TAKAM — Migration 028: Message Expiry for Sync-Link
-- ============================================================

ALTER TABLE messages ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Index for performance when filtering expired messages
CREATE INDEX IF NOT EXISTS idx_messages_expires_at ON messages(expires_at);

-- End of migration
