-- ============================================
-- KSEMO MEMORY SYSTEM MIGRATION
-- Two memory concepts only:
--   1. user_memories         - durable facts/preferences across conversations
--   2. conversation_memories - context for the current conversation only
-- Plus supporting tables: memory_suggestions (pending detections the user
-- must accept) and memory_settings (per-user privacy controls).
-- Run AFTER 01-schema.sql, 02-rls-policies.sql and 03-functions.sql.
-- ============================================

-- ============================================
-- CONVERSATIONS: per-conversation pause flag
-- ("Don't use memory for this conversation")
-- ============================================
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS memory_disabled BOOLEAN DEFAULT FALSE;

-- ============================================
-- USER MEMORIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_memories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    category VARCHAR(30) NOT NULL DEFAULT 'other' CHECK (category IN (
        'preference', 'personal_info', 'communication_style',
        'interest', 'skill_experience', 'instruction', 'goal', 'other'
    )),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    importance VARCHAR(10) NOT NULL DEFAULT 'medium' CHECK (importance IN ('low', 'medium', 'high')),
    confidence REAL NOT NULL DEFAULT 0.75 CHECK (confidence >= 0 AND confidence <= 1),
    source VARCHAR(20) NOT NULL DEFAULT 'inferred' CHECK (source IN ('explicit', 'inferred', 'suggested')),
    explanation TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    usage_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_user_memories_user_id ON user_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_user_memories_category ON user_memories(category);
CREATE INDEX IF NOT EXISTS idx_user_memories_status ON user_memories(status);
CREATE INDEX IF NOT EXISTS idx_user_memories_importance ON user_memories(importance);
CREATE INDEX IF NOT EXISTS idx_user_memories_expires_at ON user_memories(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_memories_content_gin ON user_memories USING gin(to_tsvector('english', content));

DROP TRIGGER IF EXISTS update_user_memories_updated_at ON user_memories;
CREATE TRIGGER update_user_memories_updated_at BEFORE UPDATE ON user_memories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- CONVERSATION MEMORIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS conversation_memories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    category VARCHAR(30) NOT NULL DEFAULT 'other' CHECK (category IN (
        'preference', 'personal_info', 'communication_style',
        'interest', 'skill_experience', 'instruction', 'goal', 'other'
    )),
    importance VARCHAR(10) NOT NULL DEFAULT 'medium' CHECK (importance IN ('low', 'medium', 'high')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_conversation_memories_conversation_id ON conversation_memories(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_memories_user_id ON conversation_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_memories_created_at ON conversation_memories(created_at);

DROP TRIGGER IF EXISTS update_conversation_memories_updated_at ON conversation_memories;
CREATE TRIGGER update_conversation_memories_updated_at BEFORE UPDATE ON conversation_memories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- MEMORY SUGGESTIONS TABLE
-- Pending detections awaiting user acceptance.
-- meta JSONB carries duplicate/conflict context:
--   { "kind": "new" | "duplicate" | "conflict",
--     "similarTo": [{ "id": "...", "content": "..." }] }
-- ============================================
CREATE TABLE IF NOT EXISTS memory_suggestions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    category VARCHAR(30) NOT NULL DEFAULT 'other' CHECK (category IN (
        'preference', 'personal_info', 'communication_style',
        'interest', 'skill_experience', 'instruction', 'goal', 'other'
    )),
    importance VARCHAR(10) NOT NULL DEFAULT 'medium' CHECK (importance IN ('low', 'medium', 'high')),
    confidence REAL NOT NULL DEFAULT 0.75 CHECK (confidence >= 0 AND confidence <= 1),
    reason TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'dismissed')),
    meta JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memory_suggestions_user_id ON memory_suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_memory_suggestions_status ON memory_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_memory_suggestions_conversation_id ON memory_suggestions(conversation_id);

DROP TRIGGER IF EXISTS update_memory_suggestions_updated_at ON memory_suggestions;
CREATE TRIGGER update_memory_suggestions_updated_at BEFORE UPDATE ON memory_suggestions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- MEMORY SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS memory_settings (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    memory_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    auto_suggest BOOLEAN NOT NULL DEFAULT TRUE,
    auto_save_inferred BOOLEAN NOT NULL DEFAULT FALSE,
    show_memory_usage BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_memory_settings_updated_at ON memory_settings;
CREATE TRIGGER update_memory_settings_updated_at BEFORE UPDATE ON memory_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- USAGE BUMP RPC
-- Records that memories were used while answering; non-critical stats.
-- ============================================
CREATE OR REPLACE FUNCTION bump_user_memory_usage(
    p_ids UUID[],
    p_user_id INTEGER,
    p_now TIMESTAMPTZ
) RETURNS VOID AS $$
BEGIN
    UPDATE user_memories
    SET usage_count = usage_count + 1,
        last_used_at = p_now
    WHERE id = ANY(p_ids)
      AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ROW LEVEL SECURITY
-- The backend uses the service role key (full bypass); these policies
-- protect direct client access, matching the existing table conventions.
-- ============================================
ALTER TABLE user_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own user memories" ON user_memories;
DROP POLICY IF EXISTS "Users can insert own user memories" ON user_memories;
DROP POLICY IF EXISTS "Users can update own user memories" ON user_memories;
DROP POLICY IF EXISTS "Users can delete own user memories" ON user_memories;

CREATE POLICY "Users can view own user memories"
    ON user_memories FOR SELECT
    USING (user_id = get_current_user_id());
CREATE POLICY "Users can insert own user memories"
    ON user_memories FOR INSERT
    WITH CHECK (user_id = get_current_user_id());
CREATE POLICY "Users can update own user memories"
    ON user_memories FOR UPDATE
    USING (user_id = get_current_user_id())
    WITH CHECK (user_id = get_current_user_id());
CREATE POLICY "Users can delete own user memories"
    ON user_memories FOR DELETE
    USING (user_id = get_current_user_id());

DROP POLICY IF EXISTS "Users can view own conversation memories" ON conversation_memories;
DROP POLICY IF EXISTS "Users can insert own conversation memories" ON conversation_memories;
DROP POLICY IF EXISTS "Users can update own conversation memories" ON conversation_memories;
DROP POLICY IF EXISTS "Users can delete own conversation memories" ON conversation_memories;

CREATE POLICY "Users can view own conversation memories"
    ON conversation_memories FOR SELECT
    USING (conversation_id IN (
        SELECT id FROM conversations WHERE user_id = get_current_user_id()
    ));
CREATE POLICY "Users can insert own conversation memories"
    ON conversation_memories FOR INSERT
    WITH CHECK (conversation_id IN (
        SELECT id FROM conversations WHERE user_id = get_current_user_id()
    ));
CREATE POLICY "Users can update own conversation memories"
    ON conversation_memories FOR UPDATE
    USING (conversation_id IN (
        SELECT id FROM conversations WHERE user_id = get_current_user_id()
    ))
    WITH CHECK (conversation_id IN (
        SELECT id FROM conversations WHERE user_id = get_current_user_id()
    ));
CREATE POLICY "Users can delete own conversation memories"
    ON conversation_memories FOR DELETE
    USING (conversation_id IN (
        SELECT id FROM conversations WHERE user_id = get_current_user_id()
    ));

DROP POLICY IF EXISTS "Users can view own memory suggestions" ON memory_suggestions;
DROP POLICY IF EXISTS "Users can insert own memory suggestions" ON memory_suggestions;
DROP POLICY IF EXISTS "Users can update own memory suggestions" ON memory_suggestions;
DROP POLICY IF EXISTS "Users can delete own memory suggestions" ON memory_suggestions;

CREATE POLICY "Users can view own memory suggestions"
    ON memory_suggestions FOR SELECT
    USING (user_id = get_current_user_id());
CREATE POLICY "Users can insert own memory suggestions"
    ON memory_suggestions FOR INSERT
    WITH CHECK (user_id = get_current_user_id());
CREATE POLICY "Users can update own memory suggestions"
    ON memory_suggestions FOR UPDATE
    USING (user_id = get_current_user_id())
    WITH CHECK (user_id = get_current_user_id());
CREATE POLICY "Users can delete own memory suggestions"
    ON memory_suggestions FOR DELETE
    USING (user_id = get_current_user_id());

DROP POLICY IF EXISTS "Users can view own memory settings" ON memory_settings;
DROP POLICY IF EXISTS "Users can upsert own memory settings" ON memory_settings;

CREATE POLICY "Users can view own memory settings"
    ON memory_settings FOR SELECT
    USING (user_id = get_current_user_id());
CREATE POLICY "Users can upsert own memory settings"
    ON memory_settings FOR ALL
    USING (user_id = get_current_user_id())
    WITH CHECK (user_id = get_current_user_id());
