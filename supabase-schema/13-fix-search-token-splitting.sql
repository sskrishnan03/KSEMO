-- PostgreSQL has string_to_array(), not split(). Recreate the search RPCs so
-- existing databases can apply this fix without rerunning the full schema.
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
        string_to_array(regexp_replace(lower(trim(p_query)), '[^[:alnum:]_]+', ' ', 'g'), ' '),
        ''
    );
    SELECT string_agg(quote_literal(t) || ':*', ' & ')
      INTO tsq
      FROM unnest(terms) AS t;

    RETURN QUERY
    SELECT c.id, c.title, m.id, m.content, m.role, m.created_at
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
        string_to_array(regexp_replace(lower(trim(p_query)), '[^[:alnum:]_]+', ' ', 'g'), ' '),
        ''
    );
    SELECT string_agg(quote_literal(t) || ':*', ' & ')
      INTO tsq
      FROM unnest(terms) AS t;

    RETURN QUERY
    SELECT c.id, c.title, c.updated_at
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
