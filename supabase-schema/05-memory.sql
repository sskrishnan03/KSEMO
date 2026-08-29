-- Migration: Persistent user-controlled Memory system
-- Adds `memory_settings` (single row per user, opt-in flags) and `memories`.
-- Idempotent: safe to run on top of an already-applied schema.sql.
-- Run this file in the Supabase SQL Editor after schema.sql.

-- ============================================
-- MEMORY SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS memory_settings (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    memory_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    generate_from_chats BOOLEAN NOT NULL DEFAULT FALSE,
    sensitive_memory_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MEMORIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS memories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(160) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(40) NOT NULL DEFAULT 'general'
        CHECK (category IN ('general', 'preference', 'personal', 'health', 'religion', 'politics', 'financial', 'relationship')),
    is_sensitive BOOLEAN NOT NULL DEFAULT FALSE,
    source VARCHAR(20) NOT NULL DEFAULT 'manual'
        CHECK (source IN ('manual', 'chat')),
    source_conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    consent_status VARCHAR(20) NOT NULL DEFAULT 'explicit'
        CHECK (consent_status IN ('explicit', 'silent')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memories_user_id ON memories(user_id);
CREATE INDEX IF NOT EXISTS idx_memories_user_category ON memories(user_id, category);

-- ============================================
-- TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_memory_settings_updated_at ON memory_settings;
CREATE TRIGGER update_memory_settings_updated_at BEFORE UPDATE ON memory_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_memories_updated_at ON memories;
CREATE TRIGGER update_memories_updated_at BEFORE UPDATE ON memories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
DROP POLICY IF EXISTS "Users can view own memory settings" ON memory_settings;
DROP POLICY IF EXISTS "Users can upsert own memory settings" ON memory_settings;
DROP POLICY IF EXISTS "Users can view own memories" ON memories;
DROP POLICY IF EXISTS "Users can insert own memories" ON memories;
DROP POLICY IF EXISTS "Users can update own memories" ON memories;
DROP POLICY IF EXISTS "Users can delete own memories" ON memories;

CREATE POLICY "Users can view own memory settings"
    ON memory_settings FOR SELECT
    USING (user_id = get_current_user_id());

CREATE POLICY "Users can upsert own memory settings"
    ON memory_settings FOR ALL
    USING (user_id = get_current_user_id())
    WITH CHECK (user_id = get_current_user_id());

CREATE POLICY "Users can view own memories"
    ON memories FOR SELECT
    USING (user_id = get_current_user_id());

CREATE POLICY "Users can insert own memories"
    ON memories FOR INSERT
    WITH CHECK (user_id = get_current_user_id());

CREATE POLICY "Users can update own memories"
    ON memories FOR UPDATE
    USING (user_id = get_current_user_id())
    WITH CHECK (user_id = get_current_user_id());

CREATE POLICY "Users can delete own memories"
    ON memories FOR DELETE
    USING (user_id = get_current_user_id());