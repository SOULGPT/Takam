-- ============================================================
-- TAKAM — Migration 007: Admin Dashboard & Support
-- ============================================================

-- 1. Extend Profiles for Admin / CRM
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false;

-- Update the new_user trigger to save email into profiles for the CRM
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 2. Prevent Infinite Recursion with an Admin Checker Function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
$$ LANGUAGE sql SECURITY DEFINER;

-- 3. Extend Gift Orders
ALTER TABLE gift_orders ADD COLUMN IF NOT EXISTS package_selected TEXT;
ALTER TABLE gift_orders ADD COLUMN IF NOT EXISTS receiver_number TEXT;
ALTER TABLE gift_orders ADD COLUMN IF NOT EXISTS sender_note TEXT;
ALTER TABLE gift_orders ADD COLUMN IF NOT EXISTS delivery_receipt TEXT;

-- 4. Support Tickets Table
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create support tickets"
  ON support_tickets FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own support tickets"
  ON support_tickets FOR SELECT USING (auth.uid() = user_id);

-- 5. Analytics Table
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert analytics"
  ON analytics_events FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL);


-- 6. ADMIN SECURITY BYPASSES
-- Admins can do EVERYTHING on all core tables.
-- The is_admin() function runs as SECURITY DEFINER so it ignores these policies cleanly.

CREATE POLICY "Admin Full Access - Profiles" ON profiles FOR ALL USING (public.is_admin());
CREATE POLICY "Admin Full Access - Bonds" ON bonds FOR ALL USING (public.is_admin());
CREATE POLICY "Admin Full Access - Vibes" ON vibes FOR ALL USING (public.is_admin());
CREATE POLICY "Admin Full Access - Gifts" ON gift_orders FOR ALL USING (public.is_admin());
CREATE POLICY "Admin Full Access - Support" ON support_tickets FOR ALL USING (public.is_admin());
CREATE POLICY "Admin Full Access - Analytics" ON analytics_events FOR ALL USING (public.is_admin());
