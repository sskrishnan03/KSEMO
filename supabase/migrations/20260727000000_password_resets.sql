/*
  password_resets — server-managed reset tokens for custom email flow.
  No RLS needed; only the server (service-role key) reads/writes this table.
*/
CREATE TABLE IF NOT EXISTS password_resets (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email     text NOT NULL,
  token     text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used      boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token);
CREATE INDEX IF NOT EXISTS idx_password_resets_email ON password_resets(email);
