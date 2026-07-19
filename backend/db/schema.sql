-- Family Task App - PostgreSQL schema
-- Replaces Firebase Realtime Database structure:
--   users/{uid}, tasks/{taskId}, dailyStats/{date}/{username},
--   messages/{msgId}, familyRequests/{id}, familyConnections/{id}

CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(50) UNIQUE NOT NULL,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
    id              SERIAL PRIMARY KEY,
    text            TEXT NOT NULL,
    created_by      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
