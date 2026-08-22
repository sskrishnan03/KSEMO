-- Row Level Security (RLS) Policies for KSEMO
-- This script sets up security policies to ensure users can only access their own data

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
ALTER TABLE voice_sessions ENABLE ROW LEVEL SECURITY;
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
    USING (auth.uid()::text = open_id OR id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1));

-- Users can update their own data
CREATE POLICY "Users can update own profile"
    ON users FOR UPDATE
    USING (auth.uid()::text = open_id OR id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1))
    WITH CHECK (auth.uid()::text = open_id OR id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1));

-- Service role can insert users (for authentication)
CREATE POLICY "Service role can insert users"
    ON users FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- USER PREFERENCES POLICIES
-- ============================================
-- Users can read their own preferences
CREATE POLICY "Users can view own preferences"
    ON user_preferences FOR SELECT
    USING (user_id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1));

-- Users can upsert their own preferences
CREATE POLICY "Users can upsert own preferences"
    ON user_preferences FOR ALL
    USING (user_id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1))
    WITH CHECK (user_id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1));

-- ============================================
-- PROJECTS POLICIES
-- ============================================
-- Users can read their own projects
CREATE POLICY "Users can view own projects"
    ON projects FOR SELECT
    USING (user_id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1));

-- Users can insert their own projects
CREATE POLICY "Users can insert own projects"
    ON projects FOR INSERT
    WITH CHECK (user_id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1));

-- Users can update their own projects
CREATE POLICY "Users can update own projects"
    ON projects FOR UPDATE
    USING (user_id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1))
    WITH CHECK (user_id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1));

-- Users can delete their own projects
CREATE POLICY "Users can delete own projects"
    ON projects FOR DELETE
    USING (user_id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1));

-- ============================================
-- CONVERSATIONS POLICIES
-- ============================================
-- Users can read their own conversations
CREATE POLICY "Users can view own conversations"
    ON conversations FOR SELECT
    USING (user_id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1));

-- Users can insert their own conversations
CREATE POLICY "Users can insert own conversations"
    ON conversations FOR INSERT
    WITH CHECK (user_id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1));

-- Users can update their own conversations
CREATE POLICY "Users can update own conversations"
    ON conversations FOR UPDATE
    USING (user_id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1))
    WITH CHECK (user_id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1));

-- Users can delete their own conversations
CREATE POLICY "Users can delete own conversations"
    ON conversations FOR DELETE
    USING (user_id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1));

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
        WHERE user_id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1)
    ));

-- Users can insert messages to their own conversations
CREATE POLICY "Users can insert messages to own conversations"
    ON messages FOR INSERT
    WITH CHECK (conversation_id IN (
        SELECT id FROM conversations 
        WHERE user_id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1)
    ));

-- Users can update messages in their own conversations
CREATE POLICY "Users can update messages in own conversations"
    ON messages FOR UPDATE
    USING (conversation_id IN (
        SELECT id FROM conversations 
        WHERE user_id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1)
    ))
    WITH CHECK (conversation_id IN (
        SELECT id FROM conversations 
        WHERE user_id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1)
    ));

-- Users can delete messages from their own conversations
CREATE POLICY "Users can delete messages from own conversations"
    ON messages FOR DELETE
    USING (conversation_id IN (
        SELECT id FROM conversations 
        WHERE user_id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1)
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
            WHERE user_id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1)
        )
    ));

-- Users can insert versions for their own messages
CREATE POLICY "Users can insert versions for own messages"
    ON message_versions FOR INSERT
    WITH CHECK (message_id IN (
        SELECT id FROM messages 
        WHERE conversation_id IN (
            SELECT id FROM conversations 
            WHERE user_id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1)
        )
    ));

-- ============================================
-- MESSAGE FEEDBACK POLICIES
-- ============================================
-- Users can read their own feedback
CREATE POLICY "Users can view own message feedback"
    ON message_feedback FOR SELECT
    USING (user_id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1));

-- Users can upsert their own feedback
CREATE POLICY "Users can upsert own message feedback"
    ON message_feedback FOR ALL
    USING (user_id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1))
    WITH CHECK (user_id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1));

-- ============================================
-- VOICE SESSIONS POLICIES
-- ============================================
-- Users can read their own voice sessions
CREATE POLICY "Users can view own voice sessions"
    ON voice_sessions FOR SELECT
    USING (user_id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1));

-- Users can insert their own voice sessions
CREATE POLICY "Users can insert own voice sessions"
    ON voice_sessions FOR INSERT
    WITH CHECK (user_id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1));

-- Users can update their own voice sessions
CREATE POLICY "Users can update own voice sessions"
    ON voice_sessions FOR UPDATE
    USING (user_id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1))
    WITH CHECK (user_id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1));

-- ============================================
-- FILES POLICIES
-- ============================================
-- Users can read their own files
CREATE POLICY "Users can view own files"
    ON files FOR SELECT
    USING (user_id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1));

-- Users can insert their own files
CREATE POLICY "Users can insert own files"
    ON files FOR INSERT
    WITH CHECK (user_id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1));

-- Users can update their own files
CREATE POLICY "Users can update own files"
    ON files FOR UPDATE
    USING (user_id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1))
    WITH CHECK (user_id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1));

-- Users can delete their own files
CREATE POLICY "Users can delete own files"
    ON files FOR DELETE
    USING (user_id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1));

-- ============================================
-- ATTACHMENTS POLICIES
-- ============================================
-- Users can read attachments from their own files/conversations
CREATE POLICY "Users can view own attachments"
    ON attachments FOR SELECT
    USING (file_id IN (
        SELECT id FROM files 
        WHERE user_id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1)
    ) OR conversation_id IN (
        SELECT id FROM conversations 
        WHERE user_id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1)
    ));

-- Users can insert attachments for their own files/conversations
CREATE POLICY "Users can insert own attachments"
    ON attachments FOR INSERT
    WITH CHECK (file_id IN (
        SELECT id FROM files 
        WHERE user_id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1)
    ) OR conversation_id IN (
        SELECT id FROM conversations 
        WHERE user_id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1)
    ));

-- ============================================
-- MEMORIES POLICIES
-- ============================================
-- Users can read their own memories
CREATE POLICY "Users can view own memories"
    ON memories FOR SELECT
    USING (user_id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1));

-- Users can insert their own memories
CREATE POLICY "Users can insert own memories"
    ON memories FOR INSERT
    WITH CHECK (user_id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1));

-- Users can update their own memories
CREATE POLICY "Users can update own memories"
    ON memories FOR UPDATE
    USING (user_id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1))
    WITH CHECK (user_id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1));

-- Users can delete their own memories
CREATE POLICY "Users can delete own memories"
    ON memories FOR DELETE
    USING (user_id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1));

-- ============================================
-- TASKS POLICIES
-- ============================================
-- Users can read their own tasks
CREATE POLICY "Users can view own tasks"
    ON tasks FOR SELECT
    USING (user_id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1));

-- Users can insert their own tasks
CREATE POLICY "Users can insert own tasks"
    ON tasks FOR INSERT
    WITH CHECK (user_id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1));

-- Users can update their own tasks
CREATE POLICY "Users can update own tasks"
    ON tasks FOR UPDATE
    USING (user_id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1))
    WITH CHECK (user_id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1));

-- Users can delete their own tasks
CREATE POLICY "Users can delete own tasks"
    ON tasks FOR DELETE
    USING (user_id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1));

-- ============================================
-- TASK ACTIVITIES POLICIES
-- ============================================
-- Users can read their own task activities
CREATE POLICY "Users can view own task activities"
    ON task_activities FOR SELECT
    USING (user_id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1));

-- Users can insert their own task activities
CREATE POLICY "Users can insert own task activities"
    ON task_activities FOR INSERT
    WITH CHECK (user_id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1));

-- Users can update their own task activities
CREATE POLICY "Users can update own task activities"
    ON task_activities FOR UPDATE
    USING (user_id = (SELECT id FROM users WHERE open_id = auth.uid()::text LIMIT 1))
    WITH CHECK (user_id = (SELECT id FROM users WHERE open_id::auth.uid()::text LIMIT 1));

-- ============================================
-- HELPER FUNCTION FOR USER ID LOOKUP
-- ============================================
-- This function helps convert auth.uid() to user_id
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT id FROM users 
        WHERE open_id = auth.uid()::text 
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
