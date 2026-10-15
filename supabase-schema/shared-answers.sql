CREATE TABLE IF NOT EXISTS shared_answers (
    share_token VARCHAR(64) PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shared_answers_user_id
    ON shared_answers(user_id);

ALTER TABLE shared_answers ENABLE ROW LEVEL SECURITY;
