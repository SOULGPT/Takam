-- ============================================================
-- TAKAM — Full Database Schema v1.0
-- Run this in Supabase SQL Editor (or via supabase db push)
-- ============================================================

-- ─────────────────────────────────────────
-- EXTENSIONS
-- ─────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────
-- PROFILES
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id                UUID        PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name      TEXT,
  avatar_url        TEXT,
  subscription_tier TEXT        NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'ritual')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User can see own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Bond partners can read each other's profile (needed for HomeScreen / ProfileScreen)
CREATE POLICY "Bond partners can view profile"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bonds
      WHERE (bonds.user_a = auth.uid() OR bonds.user_b = auth.uid())
        AND (bonds.user_a = profiles.id OR bonds.user_b = profiles.id)
        AND bonds.status = 'active'
    )
  );

CREATE POLICY "User can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "User can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ─────────────────────────────────────────
-- BONDS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bonds (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_a      UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  user_b      UUID        REFERENCES auth.users ON DELETE SET NULL,
  bond_code   TEXT        NOT NULL UNIQUE,
  status      TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'dissolved')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE bonds ENABLE ROW LEVEL SECURITY;

-- Members can always see their own bonds
CREATE POLICY "Bond: members can select"
  ON bonds FOR SELECT
  USING (auth.uid() = user_a OR auth.uid() = user_b);

-- Any authenticated user can look up a pending bond by code (required to join)
CREATE POLICY "Bond: lookup pending to join"
  ON bonds FOR SELECT
  USING (status = 'pending' AND auth.uid() IS NOT NULL);

-- Only the creator can insert, and they must be user_a
CREATE POLICY "Bond: creator can insert"
  ON bonds FOR INSERT
  WITH CHECK (auth.uid() = user_a);

-- Members can update their own active bonds
CREATE POLICY "Bond: members can update"
  ON bonds FOR UPDATE
  USING (auth.uid() = user_a OR auth.uid() = user_b);

-- Any authenticated user can join a pending bond (sets themselves as user_b)
-- WITH CHECK ensures they can only set user_b to themselves
CREATE POLICY "Bond: join pending bond"
  ON bonds FOR UPDATE
  USING (status = 'pending' AND auth.uid() != user_a)
  WITH CHECK (user_b = auth.uid());

-- Creator can dissolve/delete
CREATE POLICY "Bond: creator can delete"
  ON bonds FOR DELETE
  USING (auth.uid() = user_a);

-- ─────────────────────────────────────────
-- VIBES
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vibes (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  bond_id     UUID        NOT NULL REFERENCES bonds ON DELETE CASCADE,
  sender_id   UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  vibe_type   TEXT        NOT NULL CHECK (vibe_type IN ('miss_you', 'love', 'thinking_of_you')),
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE vibes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vibe visibility"
  ON vibes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bonds
      WHERE bonds.id = vibes.bond_id
        AND (bonds.user_a = auth.uid() OR bonds.user_b = auth.uid())
    )
  );

CREATE POLICY "Vibe insert by sender"
  ON vibes FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM bonds
      WHERE bonds.id = bond_id
        AND (bonds.user_a = auth.uid() OR bonds.user_b = auth.uid())
        AND bonds.status = 'active'
    )
  );

-- ─────────────────────────────────────────
-- GIFT ORDERS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gift_orders (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  bond_id             UUID        NOT NULL REFERENCES bonds ON DELETE CASCADE,
  requester_id        UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  nature_profile      JSONB       NOT NULL DEFAULT '{}',
  delivery_address    TEXT        NOT NULL,
  stripe_payment_id   TEXT,
  is_approved         BOOLEAN     NOT NULL DEFAULT FALSE,
  status              TEXT        NOT NULL DEFAULT 'pending_reveal' 
                                  CHECK (status IN ('pending_reveal', 'approved', 'shipped', 'delivered')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE gift_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gift orders: requester access"
  ON gift_orders FOR ALL
  USING (auth.uid() = requester_id);

CREATE POLICY "Gift orders: partner can view"
  ON gift_orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bonds
      WHERE bonds.id = gift_orders.bond_id
        AND (bonds.user_a = auth.uid() OR bonds.user_b = auth.uid())
    )
  );

-- ─────────────────────────────────────────
-- AUTO-CREATE PROFILE ON SIGNUP
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'), NEW.raw_user_meta_data->>'avatar_url') ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ─────────────────────────────────────────
-- ENABLE REALTIME ON VIBES
-- ─────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE vibes;
ALTER PUBLICATION supabase_realtime ADD TABLE bonds;
