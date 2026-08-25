-- Row Level Security (RLS) Policies for KSEMO
-- This script sets up security policies to ensure users can only access their own data

-- ============================================
-- DROP EXISTING POLICIES
-- ============================================
-- Drop existing policies on all tables
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

DROP POLICY IF EXISTS "Users can view own memories" ON memories;
DROP POLICY IF EXISTS "Users can insert own memories" ON memories;
DROP POLICY IF EXISTS "Users can update own memories" ON memories;
DROP POLICY IF EXISTS "Users can delete own memories" ON memories;

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
-- This function helps convert auth.uid() to user_id
-- SECURITY DEFINER bypasses RLS to avoid circular dependency
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
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_activities ENABLE ROW LEVEL SECURITY;

-- ============================================
-- USERS TABLE POLICIES
-- ============================================
-- Users can read their own data
CREATE POLICY "Users can view own profile"
    ON users FOR SELECT
    USING (auth.uid()::text = open_id);

-- Users can update their own data
CREATE POLICY "Users can update own profile"
    ON users FOR UPDATE
    USING (auth.uid()::text = open_id)
    WITH CHECK (auth.uid()::text = open_id);

-- Authenticated users can insert their own record (for OAuth)
CREATE POLICY "Users can insert own profile"
    ON users FOR INSERT
    WITH CHECK (auth.uid()::text = open_id);

-- Service role can bypass restrictions
CREATE POLICY "Service role full access"
    ON users FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- USER PREFERENCES POLICIES
-- ============================================
-- Users can read their own preferences
CREATE POLICY "Users can view own preferences"
    ON user_preferences FOR SELECT
    USING (user_id = get_current_user_id());

-- Users can upsert their own preferences
CREATE POLICY "Users can upsert own preferences"
    ON user_preferences FOR ALL
    USING (user_id = get_current_user_id())
    WITH CHECK (user_id = get_current_user_id());

-- ============================================
-- PROJECTS POLICIES
-- ============================================
-- Users can read their own projects
CREATE POLICY "Users can view own projects"
    ON projects FOR SELECT
    USING (user_id = get_current_user_id());

-- Users can insert their own projects
CREATE POLICY "Users can insert own projects"
    ON projects FOR INSERT
    WITH CHECK (user_id = get_current_user_id());

-- Users can update their own projects
CREATE POLICY "Users can update own projects"
    ON projects FOR UPDATE
    USING (user_id = get_current_user_id())
    WITH CHECK (user_id = get_current_user_id());

-- Users can delete their own projects
CREATE POLICY "Users can delete own projects"
    ON projects FOR DELETE
    USING (user_id = get_current_user_id());

-- ============================================
-- CONVERSATIONS POLICIES
-- ============================================
-- Users can read their own conversations
CREATE POLICY "Users can view own conversations"
    ON conversations FOR SELECT
    USING (user_id = get_current_user_id());

-- Users can insert their own conversations
CREATE POLICY "Users can insert own conversations"
    ON conversations FOR INSERT
    WITH CHECK (user_id = get_current_user_id());

-- Users can update their own conversations
CREATE POLICY "Users can update own conversations"
    ON conversations FOR UPDATE
    USING (user_id = get_current_user_id())
    WITH CHECK (user_id = get_current_user_id());

-- Users can delete their own conversations
CREATE POLICY "Users can delete own conversations"
    ON conversations FOR DELETE
    USING (user_id = get_current_user_id());

-- Public can read public conversations via share token
CREATE POLICY "Public can view shared conversations"
    ON conversations FOR SELECT
    USING (is_public = true AND deleted_at IS NULL);

-- ============================================
-- MESSAGES POLICIES
-- ============================================
-- Users can read messages from their own conversations
CREATE POLICY "Users can view own conversation messages"
    ON messages FOR SELECT
    USING (conversation_id IN (
        SELECT id FROM conversations 
        WHERE user_id = get_current_user_id()
    ));

-- Users can insert messages to their own conversations
CREATE POLICY "Users can insert messages to own conversations"
    ON messages FOR INSERT
    WITH CHECK (conversation_id IN (
        SELECT id FROM conversations 
        WHERE user_id = get_current_user_id()
    ));

-- Users can update messages in their own conversations
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

-- Users can delete messages from their own conversations
CREATE POLICY "Users can delete messages from own conversations"
    ON messages FOR DELETE
    USING (conversation_id IN (
        SELECT id FROM conversations 
        WHERE user_id = get_current_user_id()
    ));

-- Public can read messages from public conversations
CREATE POLICY "Public can view messages from shared conversations"
    ON messages FOR SELECT
    USING (conversation_id IN (
        SELECT id FROM conversations 
        WHERE is_public = true AND deleted_at IS NULL
    ));

-- ============================================
-- MESSAGE VERSIONS POLICIES
-- ============================================
-- Users can read versions of their own messages
CREATE POLICY "Users can view own message versions"
    ON message_versions FOR SELECT
    USING (message_id IN (
        SELECT id FROM messages 
        WHERE conversation_id IN (
            SELECT id FROM conversations 
            WHERE user_id = get_current_user_id()
        )
    ));

-- Users can insert versions for their own messages
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
-- Users can read their own feedback
CREATE POLICY "Users can view own message feedback"
    ON message_feedback FOR SELECT
    USING (user_id = get_current_user_id());

-- Users can upsert their own feedback
CREATE POLICY "Users can upsert own message feedback"
    ON message_feedback FOR ALL
    USING (user_id = get_current_user_id())
    WITH CHECK (user_id = get_current_user_id());

-- ============================================
-- FILES POLICIES
-- ============================================
-- Users can read their own files
CREATE POLICY "Users can view own files"
    ON files FOR SELECT
    USING (user_id = get_current_user_id());

-- Users can insert their own files
CREATE POLICY "Users can insert own files"
    ON files FOR INSERT
    WITH CHECK (user_id = get_current_user_id());

-- Users can update their own files
CREATE POLICY "Users can update own files"
    ON files FOR UPDATE
    USING (user_id = get_current_user_id())
    WITH CHECK (user_id = get_current_user_id());

-- Users can delete their own files
CREATE POLICY "Users can delete own files"
    ON files FOR DELETE
    USING (user_id = get_current_user_id());

-- ============================================
-- ATTACHMENTS POLICIES
-- ============================================
-- Users can read attachments from their own files/conversations
CREATE POLICY "Users can view own attachments"
    ON attachments FOR SELECT
    USING (file_id IN (
        SELECT id FROM files 
        WHERE user_id = get_current_user_id()
    ) OR conversation_id IN (
        SELECT id FROM conversations 
        WHERE user_id = get_current_user_id()
    ));

-- Users can insert attachments for their own files/conversations
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
-- MEMORIES POLICIES
-- ============================================
-- Users can read their own memories
CREATE POLICY "Users can view own memories"
    ON memories FOR SELECT
    USING (user_id = get_current_user_id());

-- Users can insert their own memories
CREATE POLICY "Users can insert own memories"
    ON memories FOR INSERT
    WITH CHECK (user_id = get_current_user_id());

-- Users can update their own memories
CREATE POLICY "Users can update own memories"
    ON memories FOR UPDATE
    USING (user_id = get_current_user_id())
    WITH CHECK (user_id = get_current_user_id());

-- Users can delete their own memories
CREATE POLICY "Users can delete own memories"
    ON memories FOR DELETE
    USING (user_id = get_current_user_id());

-- ============================================
-- TASKS POLICIES
-- ============================================
-- Users can read their own tasks
CREATE POLICY "Users can view own tasks"
    ON tasks FOR SELECT
    USING (user_id = get_current_user_id());

-- Users can insert their own tasks
CREATE POLICY "Users can insert own tasks"
    ON tasks FOR INSERT
    WITH CHECK (user_id = get_current_user_id());

-- Users can update their own tasks
CREATE POLICY "Users can update own tasks"
    ON tasks FOR UPDATE
    USING (user_id = get_current_user_id())
    WITH CHECK (user_id = get_current_user_id());

-- Users can delete their own tasks
CREATE POLICY "Users can delete own tasks"
    ON tasks FOR DELETE
    USING (user_id = get_current_user_id());

-- ============================================
-- TASK ACTIVITIES POLICIES
-- ============================================
-- Users can read their own task activities
CREATE POLICY "Users can view own task activities"
    ON task_activities FOR SELECT
    USING (user_id = get_current_user_id());

-- Users can insert their own task activities
CREATE POLICY "Users can insert own task activities"
    ON task_activities FOR INSERT
    WITH CHECK (user_id = get_current_user_id());

-- Users can update their own task activities
CREATE POLICY "Users can update own task activities"
    ON task_activities FOR UPDATE
    USING (user_id = get_current_user_id())
    WITH CHECK (user_id = get_current_user_id());
