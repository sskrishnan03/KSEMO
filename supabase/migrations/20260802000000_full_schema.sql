/*
================================================================================
  KSEMO — COMPLETE DATABASE SCHEMA (single file, drop-and-recreate)

  This file REPLACES every previous migration. Running it on your Supabase
  project wipes the old schema and rebuilds it cleanly, matching exactly the
  tables the Ksemo app uses.

  Run this whole file in:  Supabase Dashboard → SQL Editor → New query → Run
  (or `supabase db push`).

  Tables created (only what the app actually uses):
    profiles        — user display info (username, avatar, role)
    chats           — conversations
    messages        — messages inside chats
    notifications   — in-app notifications
    user_settings   — per-user app preferences (JSON)
    ai_usage        — per-request AI usage log (admin-readable)
    feedback        — user feedback (admin-readable)
    logs            — admin/system log entries
    announcements   — admin-authored announcements
    shared_chats    — public share links (short tokens, no huge URLs)
    password_resets — server-managed password reset tokens (no client access)

  Removed vs the old schema (unused by the app):
    folders  (and chats.folder_id)  — never referenced anywhere in code
    reports                         — never referenced anywhere in code
    favorites                       — no favorites feature in the app
    uploads                         — no file-upload feature in the app
    old is_admin()                  — reimplemented against profiles.role

  Security:
  - RLS enabled on every table.
  - User rows are owner-scoped (auth.uid() = user_id).
  - Admin tables are readable by admins (profiles.role = 'admin').
  - profiles.role cannot be changed by the user (no self-promotion to admin).
  - shared_chats is readable by ANY visitor ONLY through get_shared_chat(token).
  - password_resets is fully locked down (service role only).
================================================================================
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. DROP EVERYTHING (idempotent — safe to run more than once)
-- ─────────────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.shared_chats      CASCADE;
DROP TABLE IF EXISTS public.password_resets   CASCADE;
DROP TABLE IF EXISTS public.favorites         CASCADE;
DROP TABLE IF EXISTS public.notifications     CASCADE;
DROP TABLE IF EXISTS public.messages          CASCADE;
DROP TABLE IF EXISTS public.user_settings     CASCADE;
DROP TABLE IF EXISTS public.ai_usage          CASCADE;
DROP TABLE IF EXISTS public.feedback          CASCADE;
DROP TABLE IF EXISTS public.logs              CASCADE;
DROP TABLE IF EXISTS public.announcements     CASCADE;
DROP TABLE IF EXISTS public.reports           CASCADE;
DROP TABLE IF EXISTS public.uploads           CASCADE;
DROP TABLE IF EXISTS public.chats             CASCADE;
DROP TABLE IF EXISTS public.folders           CASCADE;
DROP TABLE IF EXISTS public.profiles          CASCADE;

DROP FUNCTION IF EXISTS public.get_shared_chat(text) CASCADE;
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.touch_chat_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.protect_profile_role() CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Helper functions (defined FIRST so the RLS policies and triggers below
--    can reference them)
-- ─────────────────────────────────────────────────────────────────────────────

-- Is the current user an admin? Read from profiles.role (matches how the app
-- checks `profile.role === 'admin'` client-side). plpgsql so it can be created
-- before the profiles table exists.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Auto-create a profile row when a new auth user is created.
-- NOTE: read NEW.raw_user_meta_data into a local variable first — in some
-- PostgreSQL versions `NEW.jsonb->>'key'` confuses the PL/pgSQL parser into
-- treating NEW as a table ("missing FROM-clause entry for table new").
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta jsonb := NEW.raw_user_meta_data;
BEGIN
  INSERT INTO public.profiles (id, username, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(meta->>'username', split_part(NEW.email, '@', 1)),
    meta->>'full_name',
    meta->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    updated_at = now();
  RETURN NEW;
END;
$$;

-- Bump chats.updated_at whenever a message is inserted.
CREATE OR REPLACE FUNCTION public.touch_chat_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.chats SET updated_at = now() WHERE id = NEW.chat_id;
  RETURN NEW;
END;
$$;

-- Prevent users from changing their own role (no self-promotion to admin).
-- Policies cannot compare old/new rows, so enforce it with a trigger instead.
-- Service-role / dashboard sessions have auth.uid() = null and may change roles.
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Users cannot change their own role';
  END IF;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. profiles — user display info
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username   text NOT NULL UNIQUE,
  full_name  text,
  avatar_url text,
  bio        text,
  role       text NOT NULL DEFAULT 'user' CHECK (role IN ('user','moderator','admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select" ON public.profiles FOR SELECT
  TO authenticated USING (auth.uid() = id OR public.is_admin());

-- Users can only insert their own row, and only with a non-admin role.
-- NOTE: RLS policies do NOT have NEW/OLD pseudo-records (unlike triggers) —
-- bare column references in WITH CHECK already refer to the proposed new row.
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id AND role = 'user');

-- Users can update their own row. Role changes are blocked by the
-- protect_profile_role() trigger (policies cannot compare old vs new values).
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE
  TO authenticated USING (auth.uid() = id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. chats — conversations (folder_id removed — folders are unused)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.chats (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text NOT NULL DEFAULT 'New chat',
  model       text NOT NULL DEFAULT 'ksemo-pro',
  temperature real NOT NULL DEFAULT 0.7,
  max_tokens  int  NOT NULL DEFAULT 2048,
  pinned      boolean NOT NULL DEFAULT false,
  archived    boolean NOT NULL DEFAULT false,
  category    text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chats_select" ON public.chats FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "chats_insert" ON public.chats FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "chats_update" ON public.chats FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "chats_delete" ON public.chats FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS chats_user_updated_idx   ON public.chats(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS chats_user_pinned_idx    ON public.chats(user_id, pinned, updated_at DESC);
CREATE INDEX IF NOT EXISTS chats_title_fts_idx      ON public.chats USING gin(to_tsvector('english', title));

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. messages — messages inside chats
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id    uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('user','assistant','system')),
  content    text NOT NULL DEFAULT '',
  model      text,
  tokens     int,
  meta       jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_select" ON public.messages FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "messages_insert" ON public.messages FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "messages_update" ON public.messages FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "messages_delete" ON public.messages FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS messages_chat_created_idx ON public.messages(chat_id, created_at);
CREATE INDEX IF NOT EXISTS messages_content_fts_idx  ON public.messages USING gin(to_tsvector('english', content));

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. notifications — in-app notifications
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type       text NOT NULL DEFAULT 'system',
  title      text NOT NULL,
  body       text,
  read       boolean NOT NULL DEFAULT false,
  meta       jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select" ON public.notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "notifications_insert" ON public.notifications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notifications_delete" ON public.notifications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON public.notifications(user_id, read, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. user_settings — per-user app preferences
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.user_settings (
  user_id     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_settings_select" ON public.user_settings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user_settings_insert" ON public.user_settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_settings_update" ON public.user_settings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_settings_delete" ON public.user_settings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. ai_usage — per-request AI usage log (own + admin-readable)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.ai_usage (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  model             text NOT NULL,
  prompt_tokens     int NOT NULL DEFAULT 0,
  completion_tokens int NOT NULL DEFAULT 0,
  latency_ms        int,
  created_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_usage_select" ON public.ai_usage FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "ai_usage_insert" ON public.ai_usage FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS ai_usage_created_idx ON public.ai_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_model_idx   ON public.ai_usage(model, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. feedback — user feedback (own + admin-readable)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.feedback (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  category   text NOT NULL DEFAULT 'general',
  subject    text NOT NULL,
  body       text NOT NULL,
  status     text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feedback_select" ON public.feedback FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "feedback_insert" ON public.feedback FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. logs — admin/system log entries (admin-readable)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level      text NOT NULL DEFAULT 'info',
  source     text,
  message    text NOT NULL,
  meta       jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "logs_select" ON public.logs FOR SELECT
  TO authenticated USING (public.is_admin());
CREATE POLICY "logs_insert" ON public.logs FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. announcements — admin-authored announcements (all users read)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.announcements (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL,
  body       text NOT NULL,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "announcements_select" ON public.announcements FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "announcements_insert" ON public.announcements FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "announcements_update" ON public.announcements FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. shared_chats — public share links (short tokens)
--     Anyone can read a share ONLY through get_shared_chat(token).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.shared_chats (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id    uuid REFERENCES public.chats(id) ON DELETE CASCADE,
  token      text NOT NULL UNIQUE,
  title      text NOT NULL,
  messages   jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);
ALTER TABLE public.shared_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shared_chats_owner" ON public.shared_chats
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_shared_chats_token ON public.shared_chats(token);

CREATE OR REPLACE FUNCTION public.get_shared_chat(p_token text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'title', title,
    'messages', messages,
    'chat_id', chat_id,
    'created_at', created_at
  )
  FROM public.shared_chats
  WHERE token = p_token
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_shared_chat(text) TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. password_resets — server-managed reset tokens (fully locked, no client
--     access via anon/authenticated roles; the server uses the service key).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.password_resets (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email      text NOT NULL,
  token      text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used       boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.password_resets ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_password_resets_token ON public.password_resets(token);
CREATE INDEX IF NOT EXISTS idx_password_resets_email ON public.password_resets(email);

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. Triggers (functions are defined in section 1; tables must exist first)
-- ─────────────────────────────────────────────────────────────────────────────

-- Create a profile automatically when a new auth user signs up.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Bump chats.updated_at whenever a message is inserted.
DROP TRIGGER IF EXISTS on_message_inserted ON public.messages;
CREATE TRIGGER on_message_inserted
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_chat_updated_at();

-- Block authenticated users from changing their own role.
DROP TRIGGER IF EXISTS on_profile_role_change ON public.profiles;
CREATE TRIGGER on_profile_role_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role();
