-- ============================================================
-- TAKAM — Migration 035: Server-Side Rate Limiting (Triggers)
-- ============================================================

-- This migration adds database-level triggers to prevent spamming
-- even if someone bypasses the client-side restrictions.

-- 1. Create a function to check for rapid inserts
CREATE OR REPLACE FUNCTION public.check_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  last_insert_time TIMESTAMPTZ;
  min_interval INTERVAL := '1 second'; -- Allow max 1 insert per second
BEGIN
  -- We look at the specific table and the sender/user
  -- Note: TG_TABLE_NAME is the table being inserted into
  IF TG_TABLE_NAME = 'messages' THEN
    SELECT created_at INTO last_insert_time
    FROM public.messages
    WHERE sender_id = auth.uid()
    ORDER BY created_at DESC
    LIMIT 1;
  ELSIF TG_TABLE_NAME = 'vibes' THEN
    SELECT sent_at INTO last_insert_time
    FROM public.vibes
    WHERE sender_id = auth.uid()
    ORDER BY sent_at DESC
    LIMIT 1;
  END IF;

  IF last_insert_time IS NOT NULL AND (now() - last_insert_time) < min_interval THEN
    RAISE EXCEPTION 'Rate limit exceeded. Please wait a moment between interactions.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Apply the trigger to messages
DROP TRIGGER IF EXISTS tr_rate_limit_messages ON public.messages;
CREATE TRIGGER tr_rate_limit_messages
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE PROCEDURE public.check_rate_limit();

-- 3. Apply the trigger to vibes
DROP TRIGGER IF EXISTS tr_rate_limit_vibes ON public.vibes;
CREATE TRIGGER tr_rate_limit_vibes
  BEFORE INSERT ON public.vibes
  FOR EACH ROW EXECUTE PROCEDURE public.check_rate_limit();
