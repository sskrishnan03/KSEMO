-- Custom Database Functions for KSEMO
-- This script creates helper functions for common operations

-- ============================================
-- SEARCH FUNCTIONS
-- ============================================

-- Full-text search for messages
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
BEGIN
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
        AND to_tsvector('english', m.content) @@ plainto_tsquery('english', p_query)
    ORDER BY m.created_at DESC
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
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.title,
        c.updated_at
    FROM conversations c
    WHERE c.user_id = p_user_id
        AND c.is_archived = FALSE
        AND c.deleted_at IS NULL
        AND to_tsvector('english', c.title) @@ plainto_tsquery('english', p_query)
    ORDER BY c.updated_at DESC
    LIMIT 12;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Search memories
CREATE OR REPLACE FUNCTION search_memories(
    p_user_id INTEGER,
    p_query TEXT
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    category TEXT,
    project_id UUID,
    is_active BOOLEAN,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.content,
        m.category,
        m.project_id,
        m.is_active,
        m.updated_at
    FROM memories m
    WHERE m.user_id = p_user_id
        AND to_tsvector('english', m.content) @@ plainto_tsquery('english', p_query)
    ORDER BY m.updated_at DESC
    LIMIT 8;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- CONVERSATION MANAGEMENT FUNCTIONS
-- ============================================

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

-- ============================================
-- USER MANAGEMENT FUNCTIONS
-- ============================================

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
    -- Determine role based on open_id (you may want to customize this logic)
    v_role := 'user';
    
    -- Check if user exists
    SELECT id, role INTO v_user_id, v_role
    FROM users
    WHERE open_id = p_open_id
    LIMIT 1;
    
    IF v_user_id IS NOT NULL THEN
        -- Update existing user
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
        -- Insert new user
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

-- ============================================
-- SOFT DELETE FUNCTIONS
-- ============================================

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

-- ============================================
-- FEEDBACK FUNCTIONS
-- ============================================

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
    -- Try to update existing feedback
    UPDATE message_feedback
    SET 
        value = p_value,
        updated_at = NOW()
    WHERE message_id = p_message_id AND user_id = p_user_id
    RETURNING id INTO v_feedback_id;
    
    IF v_feedback_id IS NOT NULL THEN
        RETURN v_feedback_id;
    END IF;
    
    -- Insert new feedback
    INSERT INTO message_feedback (message_id, user_id, value)
    VALUES (p_message_id, p_user_id, p_value)
    RETURNING id INTO v_feedback_id;
    
    RETURN v_feedback_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PREFERENCE FUNCTIONS
-- ============================================

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

-- ============================================
-- UTILITY FUNCTIONS
-- ============================================

-- Function to generate unique share token
CREATE OR REPLACE FUNCTION generate_share_token()
RETURNS TEXT AS $$
BEGIN
    RETURN encode(gen_random_bytes(24), 'base64');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user owns a resource
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

-- Function to check if user owns a project
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

-- Function to get user by email
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
