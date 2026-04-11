-- Migration: 024_gift_ritual_updates
-- 1. Add context and budget columns to gift_orders
ALTER TABLE gift_orders 
ADD COLUMN IF NOT EXISTS mood TEXT,
ADD COLUMN IF NOT EXISTS occasion TEXT,
ADD COLUMN IF NOT EXISTS budget_tier TEXT CHECK (budget_tier IN ('micro', 'standard', 'premium')),
ADD COLUMN IF NOT EXISTS personal_note TEXT,
ADD COLUMN IF NOT EXISTS proposal_photo_url TEXT,
ADD COLUMN IF NOT EXISTS curator_message TEXT,
ADD COLUMN IF NOT EXISTS admin_status TEXT DEFAULT 'pending' 
  CHECK (admin_status IN ('pending', 'proposing', 'approved', 'declined', 'delivered'));

-- 2. Update status constraint if needed
-- (The existing constraint was: CHECK (status IN ('pending_reveal', 'approved', 'shipped', 'delivered')))
-- We keep 'pending_reveal' but the curator flow will use admin_status for internal logic.

-- 3. Policy update (already existed but ensuring requester can see their specific fields)
-- No changes needed to RLS if requester already had read access to their own orders.
