-- ============================================================
-- TAKAM — Migration 020: Update Auth Trigger for metadata
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, username, bio, sex, country) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'), NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'username', NEW.raw_user_meta_data->>'bio', NEW.raw_user_meta_data->>'sex', NEW.raw_user_meta_data->>'country')
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    bio = EXCLUDED.bio,
    sex = EXCLUDED.sex,
    country = EXCLUDED.country
    WHERE EXCLUDED.username IS NOT NULL; 
    -- only update if metadata was actually provided
  RETURN NEW;
END;
$$;
