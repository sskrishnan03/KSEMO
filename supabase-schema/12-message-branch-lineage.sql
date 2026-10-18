-- Persist branch parent/child links and other structured message state.
-- Safe to run on databases that already have the column.
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS metadata JSONB;

NOTIFY pgrst, 'reload schema';
