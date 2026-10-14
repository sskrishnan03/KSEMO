-- Add the sensitive-memory preference to existing Supabase installations.
-- Keep it opt-in for all users, including existing memory settings rows.
ALTER TABLE public.memory_settings
  ADD COLUMN IF NOT EXISTS sensitive_memory_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Make PostgREST pick up the new column without waiting for its cache interval.
NOTIFY pgrst, 'reload schema';
