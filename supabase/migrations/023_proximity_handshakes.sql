-- Migration: 023_proximity_handshakes
-- 1. Create the table for rotating handshake IDs
CREATE TABLE IF NOT EXISTS proximity_handshakes (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  handshake_id  TEXT        NOT NULL UNIQUE,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Index for fast lookup and cleanup
CREATE INDEX IF NOT EXISTS idx_handshake_id ON proximity_handshakes(handshake_id);
CREATE INDEX IF NOT EXISTS idx_handshake_expiry ON proximity_handshakes(expires_at);

-- 3. RLS
ALTER TABLE proximity_handshakes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create their own handshakes"
  ON proximity_handshakes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can see their own handshakes"
  ON proximity_handshakes FOR SELECT
  USING (auth.uid() = user_id);

-- 4. Cleanup function for expired handshakes (can be called by edge function or cron)
CREATE OR REPLACE FUNCTION delete_expired_handshakes()
RETURNS void AS $$
BEGIN
  DELETE FROM proximity_handshakes WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
