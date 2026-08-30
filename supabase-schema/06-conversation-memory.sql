-- Migration: Durable conversation memory table + auth safety net.
--
-- The KSEMO memory data layer writes extracted facts to a dedicated
-- `conversation_memories` table (facts mined from chats, kept private, and
-- used to personalize replies). The earlier schema only defined an unused
-- `memories` table, so every memory read/write failed with "relation does not
-- exist". This migration creates the table the code actually uses, hardens the
-- account table against duplicate emails, and (optionally) fills in the legacy
-- library columns referenced by older comments.
--
-- Idempotent: safe to run on top of an already-applied schema.sql.
-- Run this file in the Supabase SQL Editor after schema.sql.

-- ============================================
-- USERS: guarantee one row per email
-- ============================================
-- Email is the public login identifier shared by the email and Google flows,
-- so it must be unique. The determinism of open_id already prevents email-only
-- duplicates, but a user signing in once with Google and once with email would
-- otherwise create two rows. Deduplicate then lock it down.
UPDATE users
SET email = COALESCE(NULLIF(email, ''), 'unknown-' || id || '@local.invalid')
FROM users AS u
WHERE users.id = u.id;

DELETE FROM users a USING users b
WHERE a.id <> b.id
  AND a.email = b.email
  AND a.created_at > b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(email);

-- ============================================
-- CONVERSATION MEMORIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS conversation_memories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    category VARCHAR(40) NOT NULL DEFAULT 'general'
        CHECK (category IN ('general', 'preference', 'personal', 'health', 'religion', 'politics', 'financial', 'relationship')),
    importance INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversation_memories_user
    ON conversation_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_memories_user_category
    ON conversation_memories(user_id, category);
CREATE INDEX IF NOT EXISTS idx_conversation_memories_conversation
    ON conversation_memories(conversation_id);

-- ============================================
-- MEMORY SETTINGS: ensure sensitive flags exist on live table
-- ============================================
-- schema.sql already defines these columns; this is a safety net for older
-- databases that only ran version 05.
ALTER TABLE memory_settings
    ADD COLUMN IF NOT EXISTS generate_from_chats BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE memory_settings
    ADD COLUMN IF NOT EXISTS sensitive_memory_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
DROP POLICY IF EXISTS "Users can view own conversation memories"
    ON conversation_memories;
DROP POLICY IF EXISTS "Users can insert own conversation memories"
    ON conversation_memories;
DROP POLICY IF EXISTS "Users can update own conversation memories"
    ON conversation_memories;
DROP POLICY IF EXISTS "Users can delete own conversation memories"
    ON conversation_memories;

CREATE POLICY "Users can view own conversation memories"
    ON conversation_memories FOR SELECT
    USING (user_id = get_current_user_id());

CREATE POLICY "Users can insert own conversation memories"
    ON conversation_memories FOR INSERT
    WITH CHECK (user_id = get_current_user_id());

CREATE POLICY "Users can update own conversation memories"
    ON conversation_memories FOR UPDATE
    USING (user_id = get_current_user_id())
    WITH CHECK (user_id = get_current_user_id());

CREATE POLICY "Users can delete own conversation memories"
    ON conversation_memories FOR DELETE
    USING (user_id = get_current_user_id());
