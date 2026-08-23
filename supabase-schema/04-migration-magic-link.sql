-- Migration for magic link authentication
-- Add magic link fields to users table

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS magic_link_token_hash TEXT,
ADD COLUMN IF NOT EXISTS magic_link_expires_at TIMESTAMPTZ;

-- Create index for magic link token lookups
CREATE INDEX IF NOT EXISTS idx_users_magic_link_token_hash ON users(magic_link_token_hash);
