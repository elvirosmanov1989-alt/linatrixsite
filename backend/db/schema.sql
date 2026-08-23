-- Family Task App - PostgreSQL schema
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(50) UNIQUE NOT NULL,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A family is a real group. Users can belong to more than one.
CREATE TABLE IF NOT EXISTS families (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    created_by    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS family_members (
    family_id     INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (family_id, user_id)
);

CREATE TABLE IF NOT EXISTS tasks (
    id              SERIAL PRIMARY KEY,
    text            TEXT NOT NULL,
    created_by      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS family_id INTEGER REFERENCES families(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS task_completions (
    id              SERIAL PRIMARY KEY,
    task_id         INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    completed_date  DATE NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (task_id, user_id, completed_date)
);

CREATE TABLE IF NOT EXISTS messages (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS family_requests (
    id            SERIAL PRIMARY KEY,
    from_user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status        VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (from_user_id, to_user_id)
);
ALTER TABLE family_requests ADD COLUMN IF NOT EXISTS family_id INTEGER REFERENCES families(id) ON DELETE CASCADE;
-- Old constraint only allowed one invite ever between two users. With multiple
-- families, the same two users may have a separate invite per family.
ALTER TABLE family_requests DROP CONSTRAINT IF EXISTS family_requests_from_user_id_to_user_id_key;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'family_requests_unique_invite'
  ) THEN
    ALTER TABLE family_requests
      ADD CONSTRAINT family_requests_unique_invite UNIQUE (from_user_id, to_user_id, family_id);
  END IF;
END $$;

-- Kept for backward compatibility with old data; no longer written to.
CREATE TABLE IF NOT EXISTS family_connections (
    id            SERIAL PRIMARY KEY,
    user_id_a     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_id_b     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id_a, user_id_b)
);

CREATE INDEX IF NOT EXISTS idx_task_completions_date ON task_completions(completed_date);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_family_requests_to_user ON family_requests(to_user_id, status);
CREATE INDEX IF NOT EXISTS idx_family_members_user ON family_members(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_family ON tasks(family_id);

