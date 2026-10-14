-- Enable Library favorites on existing Supabase installations.
ALTER TABLE public.files
  ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_files_user_favorite
  ON public.files(user_id, is_favorite);
