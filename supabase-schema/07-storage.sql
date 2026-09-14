-- ============================================
-- KSEMO SUPABASE STORAGE SETUP
-- ============================================
-- KSEMO stores user file bytes in Supabase Storage (bucket: `ksemo-files`).
-- File METADATA lives in the `files` table (see schema.sql); only the raw
-- bytes live in Storage.
--
-- The production server creates the bucket automatically at first startup
-- (see server/storage.ts ensureStorageBucket()). Run the statements below in
-- the Supabase SQL editor only if you prefer to create it ahead of time or
-- are re-provisioning the project.
--
-- Requirements: the service-role key (SUPABASE_SERVICE_ROLE_KEY) is used by
-- the server, which bypasses Row Level Security on storage. No additional
-- storage policies are required for server-side access.

-- Ensure a private bucket named `ksemo-files` exists (max 50 MB per object).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('ksemo-files', 'ksemo-files', false, 52428800, NULL)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- Optional: harden the bucket so even the anon key cannot read objects
-- without an authenticated session or a signed URL. The server (service-role)
-- is unaffected. Without these policies the bucket stays fully locked by
-- default; the inserts below are explicit self-documentation.
-- ─────────────────────────────────────────────────────────────────────────────

-- Only the owner (via a privileged role) may manage objects.
-- The service role already bypasses RLS, so these are purely defensive.

-- Prevent anonymous uploads (deny by default). Note: INSERT policies may
-- only use WITH CHECK, never USING.
CREATE POLICY "ksemo_files_deny_anon_insert"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK ((bucket_id = 'ksemo-files') AND (false));

-- Prevent anonymous reads (deny by default).
CREATE POLICY "ksemo_files_deny_anon_select"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING ((bucket_id = 'ksemo-files') AND (false));