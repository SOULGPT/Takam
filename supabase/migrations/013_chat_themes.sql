-- ============================================================
-- TAKAM — Migration 013: Shared Chat Themes
-- ============================================================

-- Safely add the 'theme' variable defining the active color-way
ALTER TABLE bonds ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'classic';

-- End of migration
