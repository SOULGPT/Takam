-- ============================================================
-- TAKAM — Migration 029: Local Chat Themes
-- ============================================================

CREATE TABLE IF NOT EXISTS user_chat_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  bond_id UUID NOT NULL REFERENCES bonds ON DELETE CASCADE,
  theme_key TEXT NOT NULL DEFAULT 'classic',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, bond_id)
);

ALTER TABLE user_chat_preferences ENABLE ROW LEVEL SECURITY;

-- Users can only see and edit their own preferences
CREATE POLICY "Users: select self" ON user_chat_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users: upsert self" ON user_chat_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users: update self" ON user_chat_preferences FOR UPDATE USING (auth.uid() = user_id);

-- Index for fast lookup by bond
CREATE INDEX IF NOT EXISTS idx_user_chat_prefs_lookup ON user_chat_preferences(user_id, bond_id);

-- End of migration
