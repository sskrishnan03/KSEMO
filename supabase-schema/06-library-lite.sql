-- ============================================
-- LIBRARY LITE: favorites + file content for chat
-- Adds columns to the existing files table.
-- Run in the Supabase SQL editor (Dashboard → SQL Editor).
-- Safe to run multiple times.
-- ============================================

ALTER TABLE files ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT FALSE;
ALTER TABLE files ADD COLUMN IF NOT EXISTS content_text TEXT;

CREATE INDEX IF NOT EXISTS idx_files_user_favorite ON files(user_id, is_favorite);
