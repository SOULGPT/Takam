-- ============================================================
-- TAKAM — Migration 037: Account Deletion RPC
-- ============================================================
-- This allows a user to fully delete their auth account from 
-- the client side to comply with Apple App Store Guideline 5.1.1(v)

CREATE OR REPLACE FUNCTION public.delete_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- We must delete from auth.users. 
  -- Due to foreign key ON DELETE CASCADE, this will automatically 
  -- wipe public.profiles, public.messages, public.bonds, etc.
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;
