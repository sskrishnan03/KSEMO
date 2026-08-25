-- KSEMO Supabase Database Schema (consolidated)
-- Single file: tables, RLS policies, functions, and library lite.
-- Run this entire file in the Supabase SQL Editor.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    open_id VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(120),
    email VARCHAR(320),
    login_method VARCHAR(50),
    password_hash TEXT,
    reset_token_hash TEXT,
    reset_token_expires_at TIMESTAMPTZ,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_signed_in TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_open_id ON users(open_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ============================================
-- USER PREFERENCES TABLE
-- ============================================
CREATE TABLE user_preferences (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    selected_model VARCHAR(160),
    persona VARCHAR(20) DEFAULT 'balanced' CHECK (persona IN ('balanced', 'concise', 'creative', 'analytical')),
    custom_instructions TEXT,
    speech_rate INTEGER DEFAULT 100 CHECK (speech_rate >= 60 AND speech_rate <= 180),
    auto_play_responses BOOLEAN DEFAULT FALSE,
    reduce_motion BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PROJECTS TABLE
-- ============================================
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    instructions TEXT,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_is_archived ON projects(is_archived);

-- ============================================
-- CONVERSATIONS TABLE
-- ============================================
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    title VARCHAR(120) NOT NULL DEFAULT 'New conversation',
    conversation_type VARCHAR(20) DEFAULT 'text' CHECK (conversation_type IN ('text')),
    is_pinned BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    is_public BOOLEAN DEFAULT FALSE,
    share_token VARCHAR(64) UNIQUE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_project_id ON conversations(project_id);
CREATE INDEX idx_conversations_share_token ON conversations(share_token);
CREATE INDEX idx_conversations_is_archived ON conversations(is_archived);
CREATE INDEX idx_conversations_deleted_at ON conversations(deleted_at);
CREATE INDEX idx_conversations_is_pinned ON conversations(is_pinned);

-- ============================================
-- MESSAGES TABLE
-- ============================================
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
    content TEXT NOT NULL,
    model VARCHAR(160),
    status VARCHAR(20) DEFAULT 'sending' CHECK (status IN ('sending', 'streaming', 'completed', 'failed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_role ON messages(role);
CREATE INDEX idx_messages_status ON messages(status);
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- ============================================
-- MESSAGE VERSIONS TABLE
-- ============================================
CREATE TABLE message_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_message_versions_message_id ON message_versions(message_id);
CREATE INDEX idx_message_versions_created_at ON message_versions(created_at);

-- ============================================
-- MESSAGE FEEDBACK TABLE
-- ============================================
CREATE TABLE message_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    value VARCHAR(10) NOT NULL CHECK (value IN ('up', 'down')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(message_id, user_id)
);

CREATE INDEX idx_message_feedback_message_id ON message_feedback(message_id);
CREATE INDEX idx_message_feedback_user_id ON message_feedback(user_id);

-- ============================================
-- FILES TABLE
-- ============================================
CREATE TABLE files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    storage_key VARCHAR(500) NOT NULL,
    url TEXT NOT NULL,
    filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(160) NOT NULL,
    size_bytes BIGINT NOT NULL,
    status VARCHAR(20) DEFAULT 'ready' CHECK (status IN ('ready', 'failed')),
    is_favorite BOOLEAN DEFAULT FALSE,
    content_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_files_user_id ON files(user_id);
CREATE INDEX idx_files_project_id ON files(project_id);
CREATE INDEX idx_files_storage_key ON files(storage_key);
CREATE INDEX idx_files_status ON files(status);
CREATE INDEX idx_files_user_favorite ON files(user_id, is_favorite);

-- ============================================
-- ATTACHMENTS TABLE
-- ============================================
CREATE TABLE attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_attachments_file_id ON attachments(file_id);
CREATE INDEX idx_attachments_conversation_id ON attachments(conversation_id);
CREATE INDEX idx_attachments_message_id ON attachments(message_id);

-- ============================================
-- TASKS TABLE
-- ============================================
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agent_id VARCHAR(64),
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    title VARCHAR(200) NOT NULL,
    details TEXT,
    status VARCHAR(20) DEFAULT 'inbox' CHECK (status IN ('inbox', 'planned', 'in_progress', 'completed', 'cancelled')),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    due_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_conversation_id ON tasks(conversation_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_due_at ON tasks(due_at);

-- ============================================
-- TASK ACTIVITIES TABLE
-- ============================================
CREATE TABLE task_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
    summary TEXT NOT NULL,
    detail TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_task_activities_user_id ON task_activities(user_id);
CREATE INDEX idx_task_activities_task_id ON task_activities(task_id);
CREATE INDEX idx_task_activities_status ON task_activities(status);
CREATE INDEX idx_task_activities_created_at ON task_activities(created_at);

-- ============================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_message_feedback_updated_at BEFORE UPDATE ON message_feedback
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_files_updated_at BEFORE UPDATE ON files
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_task_activities_updated_at BEFORE UPDATE ON task_activities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- CONVERSATION UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations SET updated_at = NOW() WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_conversation_on_message_change
    AFTER INSERT OR UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_conversation_timestamp();

-- ============================================
-- FULL-TEXT SEARCH INDEXES
-- ============================================
CREATE INDEX idx_messages_content_gin ON messages USING gin(to_tsvector('english', content));
CREATE INDEX idx_conversations_title_gin ON conversations USING gin(to_tsvector('english', title));

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Service role full access" ON users;

DROP POLICY IF EXISTS "Users can view own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can upsert own preferences" ON user_preferences;

DROP POLICY IF EXISTS "Users can view own projects" ON projects;
DROP POLICY IF EXISTS "Users can insert own projects" ON projects;
DROP POLICY IF EXISTS "Users can update own projects" ON projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON projects;

DROP POLICY IF EXISTS "Users can view own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can insert own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can delete own conversations" ON conversations;
DROP POLICY IF EXISTS "Public can view shared conversations" ON conversations;

DROP POLICY IF EXISTS "Users can view own conversation messages" ON messages;
DROP POLICY IF EXISTS "Users can insert messages to own conversations" ON messages;
DROP POLICY IF EXISTS "Users can update messages in own conversations" ON messages;
DROP POLICY IF EXISTS "Users can delete messages from own conversations" ON messages;
DROP POLICY IF EXISTS "Public can view messages from shared conversations" ON messages;

DROP POLICY IF EXISTS "Users can view own message versions" ON message_versions;
DROP POLICY IF EXISTS "Users can insert versions for own messages" ON message_versions;

DROP POLICY IF EXISTS "Users can view own message feedback" ON message_feedback;
DROP POLICY IF EXISTS "Users can upsert own message feedback" ON message_feedback;

DROP POLICY IF EXISTS "Users can view own files" ON files;
DROP POLICY IF EXISTS "Users can insert own files" ON files;
DROP POLICY IF EXISTS "Users can update own files" ON files;
DROP POLICY IF EXISTS "Users can delete own files" ON files;

DROP POLICY IF EXISTS "Users can view own attachments" ON attachments;
DROP POLICY IF EXISTS "Users can insert own attachments" ON attachments;

DROP POLICY IF EXISTS "Users can view own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can insert own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can delete own tasks" ON tasks;

DROP POLICY IF EXISTS "Users can view own task activities" ON task_activities;
DROP POLICY IF EXISTS "Users can insert own task activities" ON task_activities;
DROP POLICY IF EXISTS "Users can update own task activities" ON task_activities;

-- ============================================
-- HELPER FUNCTION FOR USER ID LOOKUP
-- ============================================
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT id FROM users
        WHERE open_id = auth.uid()::text
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_activities ENABLE ROW LEVEL SECURITY;

-- ============================================
-- USERS TABLE POLICIES
-- ============================================
CREATE POLICY "Users can view own profile"
    ON users FOR SELECT
    USING (auth.uid()::text = open_id);

CREATE POLICY "Users can update own profile"
    ON users FOR UPDATE
    USING (auth.uid()::text = open_id)
    WITH CHECK (auth.uid()::text = open_id);

CREATE POLICY "Users can insert own profile"
    ON users FOR INSERT
    WITH CHECK (auth.uid()::text = open_id);

CREATE POLICY "Service role full access"
    ON users FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- USER PREFERENCES POLICIES
-- ============================================
CREATE POLICY "Users can view own preferences"
    ON user_preferences FOR SELECT
    USING (user_id = get_current_user_id());

CREATE POLICY "Users can upsert own preferences"
    ON user_preferences FOR ALL
    USING (user_id = get_current_user_id())
    WITH CHECK (user_id = get_current_user_id());

-- ============================================
-- PROJECTS POLICIES
-- ============================================
CREATE POLICY "Users can view own projects"
    ON projects FOR SELECT
    USING (user_id = get_current_user_id());

CREATE POLICY "Users can insert own projects"
    ON projects FOR INSERT
    WITH CHECK (user_id = get_current_user_id());

CREATE POLICY "Users can update own projects"
    ON projects FOR UPDATE
    USING (user_id = get_current_user_id())
    WITH CHECK (user_id = get_current_user_id());

CREATE POLICY "Users can delete own projects"
    ON projects FOR DELETE
    USING (user_id = get_current_user_id());

-- ============================================
-- CONVERSATIONS POLICIES
-- ============================================
CREATE POLICY "Users can view own conversations"
    ON conversations FOR SELECT
    USING (user_id = get_current_user_id());

CREATE POLICY "Users can insert own conversations"
    ON conversations FOR INSERT
    WITH CHECK (user_id = get_current_user_id());

CREATE POLICY "Users can update own conversations"
    ON conversations FOR UPDATE
    USING (user_id = get_current_user_id())
    WITH CHECK (user_id = get_current_user_id());

CREATE POLICY "Users can delete own conversations"
    ON conversations FOR DELETE
    USING (user_id = get_current_user_id());

CREATE POLICY "Public can view shared conversations"
    ON conversations FOR SELECT
    USING (is_public = true AND deleted_at IS NULL);

-- ============================================
-- MESSAGES POLICIES
-- ============================================
CREATE POLICY "Users can view own conversation messages"
    ON messages FOR SELECT
    USING (conversation_id IN (
        SELECT id FROM conversations
        WHERE user_id = get_current_user_id()
    ));

CREATE POLICY "Users can insert messages to own conversations"
    ON messages FOR INSERT
    WITH CHECK (conversation_id IN (
        SELECT id FROM conversations
        WHERE user_id = get_current_user_id()
    ));

CREATE POLICY "Users can update messages in own conversations"
    ON messages FOR UPDATE
    USING (conversation_id IN (
        SELECT id FROM conversations
        WHERE user_id = get_current_user_id()
    ))
    WITH CHECK (conversation_id IN (
        SELECT id FROM conversations
        WHERE user_id = get_current_user_id()
    ));

CREATE POLICY "Users can delete messages from own conversations"
    ON messages FOR DELETE
    USING (conversation_id IN (
        SELECT id FROM conversations
        WHERE user_id = get_current_user_id()
    ));

CREATE POLICY "Public can view messages from shared conversations"
    ON messages FOR SELECT
    USING (conversation_id IN (
        SELECT id FROM conversations
        WHERE is_public = true AND deleted_at IS NULL
    ));

-- ============================================
-- MESSAGE VERSIONS POLICIES
-- ============================================
CREATE POLICY "Users can view own message versions"
    ON message_versions FOR SELECT
    USING (message_id IN (
        SELECT id FROM messages
        WHERE conversation_id IN (
            SELECT id FROM conversations
            WHERE user_id = get_current_user_id()
        )
    ));

CREATE POLICY "Users can insert versions for own messages"
    ON message_versions FOR INSERT
    WITH CHECK (message_id IN (
        SELECT id FROM messages
        WHERE conversation_id IN (
            SELECT id FROM conversations
            WHERE user_id = get_current_user_id()
        )
    ));

-- ============================================
-- MESSAGE FEEDBACK POLICIES
-- ============================================
CREATE POLICY "Users can view own message feedback"
    ON message_feedback FOR SELECT
    USING (user_id = get_current_user_id());

CREATE POLICY "Users can upsert own message feedback"
    ON message_feedback FOR ALL
    USING (user_id = get_current_user_id())
    WITH CHECK (user_id = get_current_user_id());

-- ============================================
-- FILES POLICIES
-- ============================================
CREATE POLICY "Users can view own files"
    ON files FOR SELECT
    USING (user_id = get_current_user_id());

CREATE POLICY "Users can insert own files"
    ON files FOR INSERT
    WITH CHECK (user_id = get_current_user_id());

CREATE POLICY "Users can update own files"
    ON files FOR UPDATE
    USING (user_id = get_current_user_id())
    WITH CHECK (user_id = get_current_user_id());

CREATE POLICY "Users can delete own files"
    ON files FOR DELETE
    USING (user_id = get_current_user_id());

-- ============================================
-- ATTACHMENTS POLICIES
-- ============================================
CREATE POLICY "Users can view own attachments"
    ON attachments FOR SELECT
    USING (file_id IN (
        SELECT id FROM files
        WHERE user_id = get_current_user_id()
    ) OR conversation_id IN (
        SELECT id FROM conversations
        WHERE user_id = get_current_user_id()
    ));

CREATE POLICY "Users can insert own attachments"
    ON attachments FOR INSERT
    WITH CHECK (file_id IN (
        SELECT id FROM files
        WHERE user_id = get_current_user_id()
    ) OR conversation_id IN (
        SELECT id FROM conversations
        WHERE user_id = get_current_user_id()
    ));

-- ============================================
-- TASKS POLICIES
-- ============================================
CREATE POLICY "Users can view own tasks"
    ON tasks FOR SELECT
    USING (user_id = get_current_user_id());

CREATE POLICY "Users can insert own tasks"
    ON tasks FOR INSERT
    WITH CHECK (user_id = get_current_user_id());

CREATE POLICY "Users can update own tasks"
    ON tasks FOR UPDATE
    USING (user_id = get_current_user_id())
    WITH CHECK (user_id = get_current_user_id());

CREATE POLICY "Users can delete own tasks"
    ON tasks FOR DELETE
    USING (user_id = get_current_user_id());

-- ============================================
-- TASK ACTIVITIES POLICIES
-- ============================================
CREATE POLICY "Users can view own task activities"
    ON task_activities FOR SELECT
    USING (user_id = get_current_user_id());

CREATE POLICY "Users can insert own task activities"
    ON task_activities FOR INSERT
    WITH CHECK (user_id = get_current_user_id());

CREATE POLICY "Users can update own task activities"
    ON task_activities FOR UPDATE
    USING (user_id = get_current_user_id())
    WITH CHECK (user_id = get_current_user_id());

-- ============================================
-- DATABASE FUNCTIONS
-- ============================================

-- Search messages
CREATE OR REPLACE FUNCTION search_messages(
    p_user_id INTEGER,
    p_query TEXT
)
RETURNS TABLE (
    conversation_id UUID,
    conversation_title TEXT,
    message_id UUID,
    content TEXT,
    role TEXT,
    created_at TIMESTAMPTZ
) AS $$
DECLARE
    terms TEXT[];
    tsq TEXT;
BEGIN
    terms := array_remove(
        split(regexp_replace(lower(trim(p_query)), '[^[:alnum:]_]+', ' ', 'g'), ' '),
        ''
    );
    SELECT string_agg(quote_literal(t) || ':*', ' & ')
      INTO tsq
      FROM unnest(terms) AS t;

    RETURN QUERY
    SELECT
        c.id AS conversation_id,
        c.title AS conversation_title,
        m.id AS message_id,
        m.content,
        m.role,
        m.created_at
    FROM messages m
    JOIN conversations c ON m.conversation_id = c.id
    WHERE c.user_id = p_user_id
        AND c.is_archived = FALSE
        AND c.deleted_at IS NULL
        AND (
            (tsq IS NOT NULL AND to_tsvector('english', m.content) @@ to_tsquery('english', tsq))
            OR EXISTS (
                SELECT 1 FROM unnest(terms) AS t
                WHERE position(t IN lower(m.content)) > 0
            )
        )
    ORDER BY
        CASE WHEN position(lower(trim(p_query)) IN lower(m.content)) > 0 THEN 0 ELSE 1 END,
        m.created_at DESC
    LIMIT 30;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Search conversation titles
CREATE OR REPLACE FUNCTION search_conversation_titles(
    p_user_id INTEGER,
    p_query TEXT
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    updated_at TIMESTAMPTZ
) AS $$
DECLARE
    terms TEXT[];
    tsq TEXT;
BEGIN
    terms := array_remove(
        split(regexp_replace(lower(trim(p_query)), '[^[:alnum:]_]+', ' ', 'g'), ' '),
        ''
    );
    SELECT string_agg(quote_literal(t) || ':*', ' & ')
      INTO tsq
      FROM unnest(terms) AS t;

    RETURN QUERY
    SELECT
        c.id,
        c.title,
        c.updated_at
    FROM conversations c
    WHERE c.user_id = p_user_id
        AND c.is_archived = FALSE
        AND c.deleted_at IS NULL
        AND (
            (tsq IS NOT NULL AND to_tsvector('english', c.title) @@ to_tsquery('english', tsq))
            OR EXISTS (
                SELECT 1 FROM unnest(terms) AS t
                WHERE position(t IN lower(c.title)) > 0
            )
        )
    ORDER BY
        CASE
            WHEN lower(c.title) = lower(trim(p_query)) THEN 0
            WHEN position(lower(trim(p_query)) IN lower(c.title)) = 1 THEN 1
            WHEN c.title ILIKE '%' || trim(p_query) || '%' THEN 2
            ELSE 3
        END,
        c.updated_at DESC
    LIMIT 12;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get public conversation by share token
CREATE OR REPLACE FUNCTION get_public_conversation_by_token(
    p_share_token TEXT
)
RETURNS TABLE (
    conversation_id UUID,
    title TEXT,
    conversation_type TEXT,
    created_at TIMESTAMPTZ,
    message_id UUID,
    message_role TEXT,
    message_content TEXT,
    message_created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id AS conversation_id,
        c.title,
        c.conversation_type,
        c.created_at,
        m.id AS message_id,
        m.role AS message_role,
        m.content AS message_content,
        m.created_at AS message_created_at
    FROM conversations c
    LEFT JOIN messages m ON c.id = m.conversation_id
    WHERE c.share_token = p_share_token
        AND c.is_public = TRUE
        AND c.deleted_at IS NULL
        AND (m.role IS NULL OR m.role IN ('user', 'assistant'))
    ORDER BY m.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Upsert user function
CREATE OR REPLACE FUNCTION upsert_user(
    p_open_id TEXT,
    p_name TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_login_method TEXT DEFAULT NULL,
    p_password_hash TEXT DEFAULT NULL,
    p_last_signed_in TIMESTAMPTZ DEFAULT NOW()
)
RETURNS INTEGER AS $$
DECLARE
    v_user_id INTEGER;
    v_role TEXT;
BEGIN
    v_role := 'user';

    SELECT id, role INTO v_user_id, v_role
    FROM users
    WHERE open_id = p_open_id
    LIMIT 1;

    IF v_user_id IS NOT NULL THEN
        UPDATE users
        SET
            name = COALESCE(p_name, name),
            email = COALESCE(p_email, email),
            login_method = COALESCE(p_login_method, login_method),
            password_hash = COALESCE(p_password_hash, password_hash),
            last_signed_in = p_last_signed_in,
            updated_at = NOW()
        WHERE id = v_user_id;

        RETURN v_user_id;
    ELSE
        INSERT INTO users (
            open_id, name, email, login_method,
            password_hash, role, last_signed_in
        )
        VALUES (
            p_open_id, p_name, p_email, p_login_method,
            p_password_hash, v_role, p_last_signed_in
        )
        RETURNING id INTO v_user_id;

        RETURN v_user_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Move conversation to trash
CREATE OR REPLACE FUNCTION move_conversation_to_trash(
    p_conversation_id UUID,
    p_user_id INTEGER
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE conversations
    SET
        deleted_at = NOW(),
        is_pinned = FALSE,
        updated_at = NOW()
    WHERE id = p_conversation_id AND user_id = p_user_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Restore conversation from trash
CREATE OR REPLACE FUNCTION restore_conversation(
    p_conversation_id UUID,
    p_user_id INTEGER
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE conversations
    SET
        deleted_at = NULL,
        is_archived = FALSE,
        updated_at = NOW()
    WHERE id = p_conversation_id AND user_id = p_user_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set message feedback (upsert)
CREATE OR REPLACE FUNCTION set_message_feedback(
    p_message_id UUID,
    p_user_id INTEGER,
    p_value TEXT
)
RETURNS UUID AS $$
DECLARE
    v_feedback_id UUID;
BEGIN
    UPDATE message_feedback
    SET
        value = p_value,
        updated_at = NOW()
    WHERE message_id = p_message_id AND user_id = p_user_id
    RETURNING id INTO v_feedback_id;

    IF v_feedback_id IS NOT NULL THEN
        RETURN v_feedback_id;
    END IF;

    INSERT INTO message_feedback (message_id, user_id, value)
    VALUES (p_message_id, p_user_id, p_value)
    RETURNING id INTO v_feedback_id;

    RETURN v_feedback_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Upsert user preferences
CREATE OR REPLACE FUNCTION upsert_user_preferences(
    p_user_id INTEGER,
    p_selected_model TEXT DEFAULT NULL,
    p_persona TEXT DEFAULT 'balanced',
    p_custom_instructions TEXT DEFAULT NULL,
    p_speech_rate INTEGER DEFAULT 100,
    p_auto_play_responses BOOLEAN DEFAULT FALSE,
    p_reduce_motion BOOLEAN DEFAULT FALSE
)
RETURNS BOOLEAN AS $$
BEGIN
    INSERT INTO user_preferences (
        user_id, selected_model, persona, custom_instructions,
        speech_rate, auto_play_responses, reduce_motion
    )
    VALUES (
        p_user_id, p_selected_model, p_persona, p_custom_instructions,
        p_speech_rate, p_auto_play_responses, p_reduce_motion
    )
    ON CONFLICT (user_id) DO UPDATE SET
        selected_model = COALESCE(p_selected_model, user_preferences.selected_model),
        persona = COALESCE(p_persona, user_preferences.persona),
        custom_instructions = COALESCE(p_custom_instructions, user_preferences.custom_instructions),
        speech_rate = COALESCE(p_speech_rate, user_preferences.speech_rate),
        auto_play_responses = COALESCE(p_auto_play_responses, user_preferences.auto_play_responses),
        reduce_motion = COALESCE(p_reduce_motion, user_preferences.reduce_motion),
        updated_at = NOW();

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Generate unique share token
CREATE OR REPLACE FUNCTION generate_share_token()
RETURNS TEXT AS $$
BEGIN
    RETURN encode(gen_random_bytes(24), 'base64');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user owns a conversation
CREATE OR REPLACE FUNCTION user_owns_conversation(
    p_conversation_id UUID,
    p_user_id INTEGER
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM conversations
        WHERE id = p_conversation_id AND user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user owns a project
CREATE OR REPLACE FUNCTION user_owns_project(
    p_project_id UUID,
    p_user_id INTEGER
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM projects
        WHERE id = p_project_id AND user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user by email
CREATE OR REPLACE FUNCTION get_user_by_email(p_email TEXT)
RETURNS TABLE (
    id INTEGER,
    open_id TEXT,
    name TEXT,
    email TEXT,
    password_hash TEXT,
    reset_token_hash TEXT,
    reset_token_expires_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        id, open_id, name, email, password_hash,
        reset_token_hash, reset_token_expires_at
    FROM users
    WHERE email = p_email
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
