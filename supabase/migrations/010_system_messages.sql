-- ============================================================
-- TAKAM — Migration 010: System Messages & Chat Events
-- ============================================================

ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE;

-- End of migration
