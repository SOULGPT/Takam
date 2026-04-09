-- ============================================================
-- TAKAM — Migration 009: PostgREST Foreign Key Resolutions
-- ============================================================
-- Supabase relies on explicit foreign keys pointing exactly to the 
-- target table in order to execute joined API queries natively.

ALTER TABLE analytics_events 
  DROP CONSTRAINT IF EXISTS analytics_events_user_id_fkey,
  ADD CONSTRAINT analytics_events_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE gift_orders 
  DROP CONSTRAINT IF EXISTS gift_orders_requester_id_fkey,
  ADD CONSTRAINT gift_orders_requester_id_fkey 
  FOREIGN KEY (requester_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE support_tickets 
  DROP CONSTRAINT IF EXISTS support_tickets_user_id_fkey,
  ADD CONSTRAINT support_tickets_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
