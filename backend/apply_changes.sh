#!/bin/bash
set -e

echo "Writing backend/db/schema.sql"
cat > backend/db/schema.sql << 'FILE_EOF'
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

FILE_EOF

echo "Writing backend/routes/families.js"
cat > backend/routes/families.js << 'FILE_EOF'
const express = require("express");
const pool = require("../db/pool");
const { requireAuth } = require("../middleware");

const router = express.Router();

// Create a new family. The creator becomes its first member.
router.post("/", requireAuth, async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "Family name required" });
  try {
    const result = await pool.query(
      "INSERT INTO families (name, created_by) VALUES ($1, $2) RETURNING id, name",
      [name.trim(), req.user.id]
    );
    const family = result.rows[0];
    await pool.query(
      "INSERT INTO family_members (family_id, user_id) VALUES ($1, $2)",
      [family.id, req.user.id]
    );
    res.status(201).json({ family });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create family" });
  }
});

// All families the current user belongs to, each with its member list.
router.get("/mine", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT f.id, f.name, u.username
       FROM families f
       JOIN family_members fm ON fm.family_id = f.id
       JOIN users u ON u.id = fm.user_id
       WHERE f.id IN (SELECT family_id FROM family_members WHERE user_id = $1)
       ORDER BY f.id, u.username`,
      [req.user.id]
    );
    const familiesById = {};
    for (const row of result.rows) {
      if (!familiesById[row.id]) familiesById[row.id] = { id: row.id, name: row.name, members: [] };
      familiesById[row.id].members.push(row.username);
    }
    res.json({ families: Object.values(familiesById) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch families" });
  }
});

module.exports = router;

FILE_EOF

echo "Writing backend/routes/users.js"
cat > backend/routes/users.js << 'FILE_EOF'
const express = require("express");
const pool = require("../db/pool");
const { requireAuth } = require("../middleware");

const router = express.Router();

// Search users by username, for inviting into a family.
router.get("/search", requireAuth, async (req, res) => {
  const q = (req.query.q || "").trim();
  if (!q) return res.json({ users: [] });
  try {
    const result = await pool.query(
      "SELECT id, username FROM users WHERE id != $1 AND username ILIKE $2 ORDER BY username LIMIT 10",
      [req.user.id, `%${q}%`]
    );
    res.json({ users: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to search users" });
  }
});

router.get("/", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, username FROM users WHERE id != $1 ORDER BY username",
      [req.user.id]
    );
    res.json({ users: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

module.exports = router;

FILE_EOF

echo "Writing backend/routes/requests.js"
cat > backend/routes/requests.js << 'FILE_EOF'
const express = require("express");
const pool = require("../db/pool");
const { requireAuth } = require("../middleware");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT fr.id, u.username AS from_username, f.name AS family_name, fr.status
       FROM family_requests fr
       JOIN users u ON u.id = fr.from_user_id
       JOIN families f ON f.id = fr.family_id
       WHERE fr.to_user_id = $1 AND fr.status = 'pending'`,
      [req.user.id]
    );
    res.json({ requests: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch requests" });
  }
});

// Invite a user (found via search) into one of the sender's families.
router.post("/", requireAuth, async (req, res) => {
  const { toUsername, familyId } = req.body;
  if (!toUsername || !familyId) {
    return res.status(400).json({ error: "toUsername and familyId required" });
  }
  try {
    const membership = await pool.query(
      "SELECT 1 FROM family_members WHERE family_id = $1 AND user_id = $2",
      [familyId, req.user.id]
    );
    if (membership.rowCount === 0) {
      return res.status(403).json({ error: "You are not a member of that family" });
    }

    const toUserResult = await pool.query("SELECT id FROM users WHERE username = $1", [toUsername]);
    const toUser = toUserResult.rows[0];
    if (!toUser) return res.status(404).json({ error: "User not found" });

    const alreadyMember = await pool.query(
      "SELECT 1 FROM family_members WHERE family_id = $1 AND user_id = $2",
      [familyId, toUser.id]
    );
    if (alreadyMember.rowCount > 0) {
      return res.status(409).json({ error: "That user is already in this family" });
    }

    await pool.query(
      `INSERT INTO family_requests (from_user_id, to_user_id, family_id, status)
       VALUES ($1, $2, $3, 'pending')
       ON CONFLICT (from_user_id, to_user_id, family_id) DO NOTHING`,
      [req.user.id, toUser.id, familyId]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send request" });
  }
});

router.post("/:id/accept", requireAuth, async (req, res) => {
  const requestId = req.params.id;
  try {
    const result = await pool.query(
      `UPDATE family_requests SET status = 'accepted'
       WHERE id = $1 AND to_user_id = $2
       RETURNING family_id`,
      [requestId, req.user.id]
    );
    const request = result.rows[0];
    if (!request) return res.status(404).json({ error: "Request not found" });

    await pool.query(
      `INSERT INTO family_members (family_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (family_id, user_id) DO NOTHING`,
      [request.family_id, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to accept request" });
  }
});

// Repurposed: returns the user's families, shaped the same way the old
// pairwise "connections" list was, so counters.js needs no changes.
router.get("/connections", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT f.id, f.name, u.username
       FROM families f
       JOIN family_members fm ON fm.family_id = f.id
       JOIN users u ON u.id = fm.user_id
       WHERE f.id IN (SELECT family_id FROM family_members WHERE user_id = $1)
       ORDER BY f.id, u.username`,
      [req.user.id]
    );
    const familiesById = {};
    for (const row of result.rows) {
      if (!familiesById[row.id]) familiesById[row.id] = { id: row.id, name: row.name, members: [] };
      familiesById[row.id].members.push(row.username);
    }
    res.json({ connections: Object.values(familiesById) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch connections" });
  }
});

module.exports = router;

FILE_EOF

echo "Writing backend/routes/tasks.js"
cat > backend/routes/tasks.js << 'FILE_EOF'
const express = require("express");
const pool = require("../db/pool");
const { requireAuth } = require("../middleware");

const router = express.Router();

function todayDate() {
  return new Date().toISOString().split("T")[0];
}

router.get("/", requireAuth, async (req, res) => {
  try {
    const today = todayDate();
    const tasksResult = await pool.query(
      `SELECT t.id, t.text, u.username AS created_by, t.created_at, f.name AS family_name
       FROM tasks t
       JOIN users u ON u.id = t.created_by
       JOIN families f ON f.id = t.family_id
       WHERE t.family_id IN (SELECT family_id FROM family_members WHERE user_id = $1)
       ORDER BY t.created_at DESC`,
      [req.user.id]
    );

    const completionsResult = await pool.query(
      `SELECT tc.task_id, u.username
       FROM task_completions tc
       JOIN users u ON u.id = tc.user_id
       WHERE tc.completed_date = $1`,
      [today]
    );

    const completionsByTask = {};
    for (const row of completionsResult.rows) {
      if (!completionsByTask[row.task_id]) completionsByTask[row.task_id] = [];
      completionsByTask[row.task_id].push(row.username);
    }

    const tasks = tasksResult.rows.map((t) => ({
      id: t.id,
      text: t.text,
      createdBy: t.created_by,
      familyName: t.family_name,
      completedToday: completionsByTask[t.id] || [],
    }));

    res.json({ tasks, today });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

router.post("/", requireAuth, async (req, res) => {
  const { text, familyId } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: "Task text required" });
  if (!familyId) return res.status(400).json({ error: "familyId required" });
  try {
    const membership = await pool.query(
      "SELECT 1 FROM family_members WHERE family_id = $1 AND user_id = $2",
      [familyId, req.user.id]
    );
    if (membership.rowCount === 0) {
      return res.status(403).json({ error: "You are not a member of that family" });
    }

    const result = await pool.query(
      "INSERT INTO tasks (text, created_by, family_id) VALUES ($1, $2, $3) RETURNING id, text",
      [text.trim(), req.user.id, familyId]
    );
    res.status(201).json({ task: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create task" });
  }
});

router.post("/:id/complete", requireAuth, async (req, res) => {
  const taskId = req.params.id;
  const today = todayDate();
  try {
    const result = await pool.query(
      `INSERT INTO task_completions (task_id, user_id, completed_date)
       VALUES ($1, $2, $3)
       ON CONFLICT (task_id, user_id, completed_date) DO NOTHING
       RETURNING id`,
      [taskId, req.user.id, today]
    );
    const alreadyCompleted = result.rowCount === 0;
    res.json({ ok: true, alreadyCompleted });
  } catch (err) {
    if (err.code === "23503") {
      return res.status(404).json({ error: "Task not found" });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to complete task" });
  }
});

module.exports = router;

FILE_EOF

echo "Writing backend/server.js"
cat > backend/server.js << 'FILE_EOF'
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const initDb = require("./db/init");
const pool = require("./db/pool");

const authRoutes = require("./routes/auth");
const taskRoutes = require("./routes/tasks");
const statsRoutes = require("./routes/stats");
const messageRoutes = require("./routes/messages");
const userRoutes = require("./routes/users");
const requestRoutes = require("./routes/requests");
const familyRoutes = require("./routes/families");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" }, path: "/api/socket.io" });

app.set("io", io);
app.use(cors());
app.use(express.json());

app.get("/healthz", (req, res) => res.status(200).send("ok"));

app.get("/readyz", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).send("ready");
  } catch (err) {
    res.status(503).send("db not ready");
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/users", userRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/families", familyRoutes);

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  socket.on("disconnect", () => console.log("Client disconnected:", socket.id));
});

const PORT = process.env.PORT || 3000;

async function start() {
  const maxRetries = 10;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await initDb();
      break;
    } catch (err) {
      console.error(`DB init failed (attempt ${attempt}/${maxRetries}):`, err.message);
      if (attempt === maxRetries) process.exit(1);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  server.listen(PORT, () => {
    console.log(`Family Task App backend listening on port ${PORT}`);
  });
}

start();

FILE_EOF

echo "Writing public/index.html"
cat > public/index.html << 'FILE_EOF'
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Family Task App</title>
  <link rel="manifest" href="manifest.json" />
  <meta name="theme-color" content="#55735A" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">

  <style>
:root {
  --bg: #faf3e4;
  --surface: #ffffff;
  --surface-soft: #f3ecdb;
  --ink: #2e2a22;
  --ink-soft: #6b6354;
  --sage: #55735a;
  --sage-light: #e4ece0;
  --mustard: #d9a23b;
  --mustard-light: #f7e8c9;
  --brick: #b4593a;
  --brick-light: #f6e2d9;
  --line: rgba(46, 42, 34, 0.12);
  --shadow: 0 6px 20px rgba(46, 42, 34, 0.08);
  --radius: 14px;
  --font-display: 'Fraunces', Georgia, serif;
  --font-body: 'Inter', 'Segoe UI', Arial, sans-serif;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: var(--font-body);
  background: var(--bg);
  color: var(--ink);
}

h1, h2, h3 { font-family: var(--font-display); font-weight: 600; margin: 0; }
p { margin: 0; }

.hidden { display: none; }

.emptyHint {
  font-size: 13px;
  color: var(--ink-soft);
  padding: 8px 2px;
}

/* ---------- auth ---------- */
.container {
  max-width: 420px;
  margin: 64px auto;
  padding: 0 20px;
}

.brandMark { text-align: center; margin-bottom: 28px; }

.brandIcon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 16px;
  background: var(--sage-light);
  color: var(--sage);
  font-size: 26px;
  margin-bottom: 12px;
}

.brandMark h1 { font-size: 26px; color: var(--ink); }
.brandTag { font-size: 14px; color: var(--ink-soft); margin-top: 6px; }

.card {
  background: var(--surface);
  padding: 28px;
  border-radius: var(--radius);
  border: 1px solid var(--line);
  box-shadow: var(--shadow);
  margin-bottom: 20px;
}

.card h2 { font-size: 20px; margin-bottom: 4px; }

input, select {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: 10px;
  margin-top: 12px;
  font-size: 15px;
  font-family: var(--font-body);
  background: var(--surface);
  color: var(--ink);
}

input:focus, select:focus {
  outline: none;
  border-color: var(--sage);
  box-shadow: 0 0 0 3px var(--sage-light);
}

button {
  border: none;
  border-radius: 10px;
  padding: 12px 16px;
  background: var(--sage);
  color: #fff;
  cursor: pointer;
  font-weight: 500;
  font-family: var(--font-body);
  font-size: 14px;
  width: 100%;
  margin-top: 12px;
  transition: transform 0.1s ease, background 0.15s ease;
}

button:hover { background: #486350; }
button:active { transform: scale(0.98); }

.secondaryBtn {
  background: transparent;
  color: var(--ink-soft);
  border: 1px solid var(--line);
}
.secondaryBtn:hover { background: var(--surface-soft); }

/* ---------- app layout ---------- */
#app { display: none; min-height: 100vh; }

/* ---------- onboarding ---------- */
#onboarding {
  max-width: 460px;
  margin: 80px auto;
  padding: 0 20px;
  text-align: center;
}

#onboarding .brandIcon { margin: 0 auto 16px; }
#onboarding h1 { font-size: 26px; margin-bottom: 8px; }
#onboarding p.lead { color: var(--ink-soft); font-size: 15px; margin-bottom: 24px; }

#mainAppContent { display: none; min-height: 100vh; }

#sidebar {
  position: fixed;
  left: 0;
  top: 0;
  width: 260px;
  height: 100vh;
  background: var(--surface);
  border-right: 1px solid var(--line);
  padding: 24px 18px;
  overflow-y: auto;
}

.sidebarTop { margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--line); }
.welcomeLabel { font-family: var(--font-display); font-size: 18px; font-weight: 600; margin-bottom: 10px; }

.logoutBtn {
  background: transparent;
  color: var(--ink-soft);
  border: 1px solid var(--line);
  margin-top: 0;
  padding: 8px 12px;
  font-size: 13px;
  width: auto;
}
.logoutBtn:hover { background: var(--surface-soft); }

.menu { display: flex; flex-direction: column; gap: 8px; }

.menuItem {
  position: relative;
  background: transparent;
  padding: 12px 14px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 500;
  color: var(--ink);
  display: flex;
  align-items: center;
  gap: 10px;
}
.menuItem:hover { background: var(--surface-soft); }
.menuIcon { font-size: 18px; line-height: 1; }

.dropdownContent {
  display: none;
  margin-top: 8px;
  background: var(--surface-soft);
  border-radius: 10px;
  padding: 12px;
  width: 100%;
}
.dropdownContent input, .dropdownContent select { margin-top: 0; }
.dropdownContent .subLabel {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ink-soft);
  margin: 14px 0 6px;
}
.dropdownContent .subLabel:first-child { margin-top: 0; }

.familyCard {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 8px;
}
.familyCardName { font-weight: 600; font-size: 14px; }
.familyCardMembers { font-size: 12px; color: var(--ink-soft); margin-top: 2px; }

/* ---------- main content ---------- */
#mainContent { margin-left: 260px; padding: 32px 40px 60px; }

.eyebrow {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--sage);
  margin-bottom: 4px;
}

.statsStrip h1 { font-size: 28px; margin-bottom: 20px; }

.statsGrid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  margin-bottom: 32px;
}
.statsGrid h3 {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 16px;
  font-size: 15px;
  font-weight: 600;
  color: var(--ink);
}

.sectionHead { margin-bottom: 14px; }

.taskGrid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
}

/* ---------- task cards (JS-generated) ---------- */
.task {
  background: var(--surface);
  border: 1px solid var(--line);
  border-left: 4px solid var(--mustard);
  border-radius: var(--radius);
  padding: 18px 20px;
  box-shadow: var(--shadow);
}
.task:nth-child(3n+2) { border-left-color: var(--sage); }
.task:nth-child(3n) { border-left-color: var(--brick); }

.taskFamilyTag {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--sage);
  margin-bottom: 6px;
}

.task h2 { font-size: 17px; margin-bottom: 10px; color: var(--ink); }
.task p { font-size: 13px; color: var(--ink-soft); margin: 4px 0; line-height: 1.5; }
.task.completed { opacity: 0.6; }
.task h3 { font-size: 13px; color: var(--sage); margin-top: 10px; }

.task .completeBtn {
  background: var(--sage);
  color: #fff;
  width: auto;
  padding: 8px 14px;
  font-size: 13px;
  margin-top: 12px;
}
.task .completeBtn:hover { background: #486350; }

/* ---------- users / requests / counters (JS-generated) ---------- */
.message {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 10px;
  font-size: 14px;
  color: var(--ink);
}
.message strong { font-weight: 600; }
.message .mainBtn {
  background: var(--mustard);
  color: var(--ink);
  width: auto;
  padding: 8px 14px;
  font-size: 13px;
  margin-top: 10px;
}
.message .mainBtn:hover { background: #c68f2f; }

/* ---------- suggested tasks ---------- */
.suggestionChip {
  display: inline-block;
  width: auto;
  background: var(--surface);
  color: var(--ink);
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12px;
  margin: 0 6px 6px 0;
}
.suggestionChip:hover { background: var(--sage-light); border-color: var(--sage); }

/* ---------- chat ---------- */
#chatToggle {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: var(--sage);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  cursor: pointer;
  z-index: 999;
  box-shadow: var(--shadow);
}

#chatWindow {
  position: fixed;
  bottom: 96px;
  right: 24px;
  width: 340px;
  height: 460px;
  background: var(--surface);
  border-radius: var(--radius);
  border: 1px solid var(--line);
  display: none;
  flex-direction: column;
  overflow: hidden;
  z-index: 999;
  box-shadow: var(--shadow);
}

.chatHeader {
  background: var(--sage);
  color: #fff;
  padding: 14px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 500;
  font-size: 14px;
}
.chatClose { cursor: pointer; opacity: 0.85; }
.chatClose:hover { opacity: 1; }

#chatMessages { flex: 1; overflow-y: auto; padding: 14px; background: var(--surface-soft); }
#chatMessages .message { background: var(--surface); }

.chatInputRow { display: flex; gap: 8px; padding: 12px; border-top: 1px solid var(--line); }
.chatInputRow input { margin-top: 0; flex: 1; }
.chatInputRow button { width: auto; margin-top: 0; padding: 10px 16px; }

/* ---------- responsive ---------- */
@media (max-width: 768px) {
  #sidebar { position: static; width: 100%; height: auto; border-right: none; border-bottom: 1px solid var(--line); }
  #mainContent { margin-left: 0; padding: 24px 18px 60px; }
  #chatWindow { width: calc(100vw - 32px); right: 16px; }
}
  </style>
</head>

<body>

  <!-- AUTH -->
  <div id="auth" class="container">
    <div class="brandMark">
      <span class="brandIcon">&#8962;</span>
      <h1>Family Task App</h1>
      <p class="brandTag">Keep the household in sync</p>
    </div>

    <div id="loginBox" class="card">
      <h2>Log in</h2>
      <input id="loginUsername" placeholder="Username" />
      <input id="loginPassword" type="password" placeholder="Password" />
      <button onclick="login()">Log in</button>
      <button class="secondaryBtn" onclick="showRegister()">Not registered?</button>
    </div>

    <div id="registerBox" class="card hidden">
      <h2>Create account</h2>
      <input id="registerUsername" placeholder="Username" />
      <input id="registerEmail" type="email" placeholder="Email" />
      <input id="registerPassword" type="password" placeholder="Password" />
      <button onclick="register()">Create account</button>
      <button class="secondaryBtn" onclick="showLogin()">Back to log in</button>
    </div>
  </div>

  <!-- APP -->
  <div id="app">

    <!-- ONBOARDING: shown when the user belongs to no families -->
    <div id="onboarding">
      <span class="brandIcon">&#8962;</span>
      <h1>Start your family</h1>
      <p class="lead">Create a family, then invite the people you share tasks with.</p>
      <div class="card">
        <input id="onboardingFamilyNameInput" placeholder="Family name, e.g. The Nowaks" />
        <button onclick="createFamily('onboardingFamilyNameInput')">Create family</button>
      </div>
      <p class="lead" style="font-size:13px;">Already invited to one? Ask them to send the invite, then check <strong>Requests</strong> in the sidebar once you're in.</p>
    </div>

    <div id="mainAppContent">
      <!-- SIDEBAR -->
      <div id="sidebar">
        <div class="sidebarTop">
          <p id="welcomeUser" class="welcomeLabel"></p>
          <button class="logoutBtn" onclick="logout()">Log out</button>
        </div>

        <nav class="menu">
          <!-- FAMILY: existing families, create another, search & invite -->
          <div class="menuItem" onclick="toggleDropdown('usersDropdown')">
            <span class="menuIcon">&#128101;</span>
            <span class="menuLabel">Family</span>
            <div id="usersDropdown" class="dropdownContent" onclick="event.stopPropagation()">
              <p class="subLabel">Your families</p>
              <div id="familiesList"></div>

              <p class="subLabel">Create another</p>
              <input id="sidebarFamilyNameInput" placeholder="Family name" />
              <button onclick="createFamily('sidebarFamilyNameInput')">Create family</button>

              <p class="subLabel">Invite someone</p>
              <select id="inviteFamilySelect" style="display:none;"></select>
              <input id="inviteSearchInput" placeholder="Search by username" oninput="onInviteSearchInput()" />
              <div id="inviteResults"></div>
            </div>
          </div>

          <!-- REQUESTS -->
          <div class="menuItem" onclick="toggleDropdown('requestsDropdown')">
            <span class="menuIcon">&#128276;</span>
            <span class="menuLabel">Requests</span>
            <div id="requestsDropdown" class="dropdownContent" onclick="event.stopPropagation()">
              <div id="notificationsList"></div>
            </div>
          </div>

          <!-- TASKS -->
          <div class="menuItem" onclick="toggleDropdown('tasksDropdown')">
            <span class="menuIcon">&#128221;</span>
            <span class="menuLabel">Add task</span>
            <div id="tasksDropdown" onclick="event.stopPropagation()" class="dropdownContent">
              <select id="taskFamilySelect" style="display:none;"></select>
              <input id="taskInput" placeholder="New task" />
              <button onclick="addTask()">Add task</button>
              <p class="subLabel">Or pick a suggestion</p>
              <div id="suggestedTasksList"></div>
            </div>
          </div>

          <!-- SHARED COUNTERS -->
          <div class="menuItem" onclick="toggleDropdown('countersDropdown')">
            <span class="menuIcon">&#128279;</span>
            <span class="menuLabel">Shared counters</span>
            <div id="countersDropdown" class="dropdownContent" onclick="event.stopPropagation()">
              <div id="sharedCountersList"></div>
            </div>
          </div>
        </nav>
      </div>

      <!-- MAIN -->
      <div id="mainContent">
        <div class="statsStrip">
          <p class="eyebrow">Today</p>
          <h1>Daily stats</h1>
        </div>

        <div id="statsList" class="statsGrid"></div>

        <div class="sectionHead">
          <p class="eyebrow">Tasks</p>
        </div>
        <div id="taskList" class="taskGrid"></div>
      </div>
    </div>
  </div>

  <!-- CHAT -->
  <div id="chatToggle" aria-label="Open family chat">&#128172;</div>

  <div id="chatWindow">
    <div class="chatHeader">
      <span>Family chat</span>
      <span id="closeChat" class="chatClose">&#10005;</span>
    </div>
    <div id="chatMessages"></div>
    <div class="chatInputRow">
      <input id="chatInput" placeholder="Write a message..." />
      <button onclick="sendMessage()">Send</button>
    </div>
  </div>

  <script>
    function showRegister() {
      document.getElementById("loginBox").classList.add("hidden");
      document.getElementById("registerBox").classList.remove("hidden");
    }

    function showLogin() {
      document.getElementById("registerBox").classList.add("hidden");
      document.getElementById("loginBox").classList.remove("hidden");
    }

    function toggleDropdown(id) {
      const element = document.getElementById(id);
      const isOpen = element.style.display === "block";
      document.querySelectorAll(".dropdownContent").forEach((el) => (el.style.display = "none"));
      element.style.display = isOpen ? "none" : "block";
    }

    document.addEventListener("DOMContentLoaded", function () {
      const chatToggle = document.getElementById("chatToggle");
      const chatWindow = document.getElementById("chatWindow");
      const closeChat = document.getElementById("closeChat");

      chatToggle.addEventListener("click", function () {
        chatWindow.style.display = chatWindow.style.display === "flex" ? "none" : "flex";
      });

      closeChat.addEventListener("click", function () {
        chatWindow.style.display = "none";
      });
    });
  </script>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.7.5/socket.io.min.js"></script>
  <script>
    window.API_BASE = "/api";
  </script>

  <!-- JS -->
  <script type="module" src="./js/auth.js"></script>
  <script type="module" src="./js/families.js"></script>
  <script type="module" src="./js/profiles.js"></script>
  <script type="module" src="./js/requests.js"></script>
  <script type="module" src="./js/tasks.js"></script>
  <script type="module" src="./js/chat.js"></script>
  <script type="module" src="./js/counters.js"></script>
  <script type="module" src="./js/ui.js"></script>

</body>
</html>

FILE_EOF

echo "Writing public/js/families.js"
cat > public/js/families.js << 'FILE_EOF'
import { apiFetch } from "./api.js";

window.myFamilies = [];

window.createFamily = async function (inputId) {
  const input = document.getElementById(inputId);
  const name = input.value.trim();
  if (!name) return;
  try {
    await apiFetch("/families", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    input.value = "";
    await refreshFamilies();
    window.dispatchEvent(new Event("families:changed"));
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
};

function renderOnboarding(hasFamilies) {
  const onboarding = document.getElementById("onboarding");
  const mainApp = document.getElementById("mainAppContent");
  if (!onboarding || !mainApp) return;
  onboarding.style.display = hasFamilies ? "none" : "block";
  mainApp.style.display = hasFamilies ? "block" : "none";
}

function renderFamiliesList() {
  const list = document.getElementById("familiesList");
  if (!list) return;
  if (window.myFamilies.length === 0) {
    list.innerHTML = `<p class="emptyHint">You're not in a family yet.</p>`;
    return;
  }
  list.innerHTML = window.myFamilies
    .map(
      (fam) => `
      <div class="familyCard">
        <p class="familyCardName">${fam.name}</p>
        <p class="familyCardMembers">${fam.members.join(", ")}</p>
      </div>
    `
    )
    .join("");
}

function renderFamilySelect(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = window.myFamilies
    .map((fam) => `<option value="${fam.id}">${fam.name}</option>`)
    .join("");
  select.style.display = window.myFamilies.length > 1 ? "block" : "none";
}

window.refreshFamilies = async function () {
  let data;
  try {
    data = await apiFetch("/families/mine");
  } catch (err) {
    console.error(err);
    return;
  }
  window.myFamilies = data.families || [];
  renderOnboarding(window.myFamilies.length > 0);
  renderFamiliesList();
  renderFamilySelect("taskFamilySelect");
  renderFamilySelect("inviteFamilySelect");
};

window.addEventListener("auth:ready", refreshFamilies);

FILE_EOF

echo "Writing public/js/profiles.js"
cat > public/js/profiles.js << 'FILE_EOF'
import { apiFetch } from "./api.js";

window.sendFamilyRequest = async function (toUsername) {
  const select = document.getElementById("inviteFamilySelect");
  const familyId = select && select.value ? select.value : (window.myFamilies[0] && window.myFamilies[0].id);
  if (!familyId) {
    alert("Create a family first");
    return;
  }
  try {
    await apiFetch("/requests", {
      method: "POST",
      body: JSON.stringify({ toUsername, familyId }),
    });
    alert("Invite sent");
    document.getElementById("inviteSearchInput").value = "";
    document.getElementById("inviteResults").innerHTML = "";
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
};

let searchDebounce;
window.onInviteSearchInput = function () {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(runInviteSearch, 250);
};

async function runInviteSearch() {
  const input = document.getElementById("inviteSearchInput");
  const results = document.getElementById("inviteResults");
  if (!input || !results) return;
  const q = input.value.trim();
  if (!q) {
    results.innerHTML = "";
    return;
  }
  let data;
  try {
    data = await apiFetch(`/users/search?q=${encodeURIComponent(q)}`);
  } catch (err) {
    console.error(err);
    return;
  }
  if (data.users.length === 0) {
    results.innerHTML = `<p class="emptyHint">No matching users.</p>`;
    return;
  }
  results.innerHTML = data.users
    .map(
      (user) => `
      <div class="message">
        <strong>${user.username}</strong>
        <br><br>
        <button class="mainBtn" onclick="sendFamilyRequest('${user.username}')">Invite</button>
      </div>
    `
    )
    .join("");
}

FILE_EOF

echo "Writing public/js/requests.js"
cat > public/js/requests.js << 'FILE_EOF'
import { apiFetch } from "./api.js";

window.acceptRequest = async function (requestId) {
  try {
    await apiFetch(`/requests/${requestId}/accept`, { method: "POST" });
    alert("Joined the family");
    await refreshRequests();
    if (window.refreshFamilies) await window.refreshFamilies();
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
};

async function refreshRequests() {
  const notifications = document.getElementById("notificationsList");
  if (!notifications) return;
  let data;
  try {
    data = await apiFetch("/requests");
  } catch (err) {
    console.error(err);
    return;
  }
  if (data.requests.length === 0) {
    notifications.innerHTML = `<p class="emptyHint">No pending requests.</p>`;
    return;
  }
  notifications.innerHTML = "";
  data.requests.forEach((request) => {
    notifications.innerHTML += `
      <div class="message">
        <strong>${request.from_username}</strong> invited you to join <strong>${request.family_name}</strong>.
        <br><br>
        <button class="mainBtn" onclick="acceptRequest('${request.id}')">Accept</button>
      </div>
    `;
  });
}

const POLL_INTERVAL_MS = 8000;
window.addEventListener("DOMContentLoaded", () => {
  refreshRequests();
  setInterval(refreshRequests, POLL_INTERVAL_MS);
});
window.addEventListener("auth:ready", refreshRequests);

FILE_EOF

echo "Writing public/js/tasks.js"
cat > public/js/tasks.js << 'FILE_EOF'
import { apiFetch, getCurrentUser } from "./api.js";

const SUGGESTED_TASKS = [
  "Take out the trash",
  "Walk the dog",
  "Do the dishes",
  "Vacuum the living room",
  "Water the plants",
  "Grocery shopping",
  "Laundry",
  "Clean the bathroom",
  "Homework check-in",
  "Take out recycling",
];

window.addTask = async function (presetText) {
  const input = document.getElementById("taskInput");
  const text = (presetText || input.value).trim();
  if (!text) return;

  const select = document.getElementById("taskFamilySelect");
  const familyId = select && select.value ? select.value : (window.myFamilies[0] && window.myFamilies[0].id);
  if (!familyId) {
    alert("Create or join a family first");
    return;
  }

  try {
    await apiFetch("/tasks", {
      method: "POST",
      body: JSON.stringify({ text, familyId }),
    });
    input.value = "";
    await refreshTasks();
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
};

window.completeTask = async function (taskId) {
  try {
    const result = await apiFetch(`/tasks/${taskId}/complete`, { method: "POST" });
    if (result.alreadyCompleted) {
      alert("You already completed this today");
    }
    await refreshTasks();
    await refreshStats();
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
};

function renderSuggestedTasks() {
  const container = document.getElementById("suggestedTasksList");
  if (!container) return;
  container.innerHTML = SUGGESTED_TASKS.map(
    (text) => `<button type="button" class="suggestionChip" onclick="addTask('${text.replace(/'/g, "\\'")}')">${text}</button>`
  ).join("");
}

async function refreshTasks() {
  const taskList = document.getElementById("taskList");
  if (!taskList) return;
  let data;
  try {
    data = await apiFetch("/tasks");
  } catch (err) {
    console.error(err);
    return;
  }
  const currentUser = getCurrentUser();
  if (data.tasks.length === 0) {
    taskList.innerHTML = `<p class="emptyHint">No tasks yet. Add one to get started.</p>`;
    return;
  }
  taskList.innerHTML = "";
  data.tasks.forEach((task) => {
    const completedToday = currentUser && task.completedToday.includes(currentUser.username);
    const completedUsers = task.completedToday.length ? task.completedToday.join(", ") : "Nobody yet";
    taskList.innerHTML += `
      <div class="task ${completedToday ? "completed" : ""}">
        <p class="taskFamilyTag">${task.familyName}</p>
        <h2>${task.text}</h2>
        <p>Created by: ${task.createdBy || "Unknown"}</p>
        <p>Completed today by: ${completedUsers}</p>
        ${
          !completedToday
            ? `<button class="completeBtn" onclick="completeTask('${task.id}')">Complete Today</button>`
            : `<h3>You Completed This Today</h3>`
        }
      </div>
    `;
  });
}

async function refreshStats() {
  const statsList = document.getElementById("statsList");
  if (!statsList) return;
  let data;
  try {
    data = await apiFetch("/stats/today");
  } catch (err) {
    console.error(err);
    return;
  }
  if (data.stats.length === 0) {
    statsList.innerHTML = `<p class="emptyHint">No completions yet today.</p>`;
    return;
  }
  statsList.innerHTML = "";
  data.stats.forEach(({ username, count }) => {
    statsList.innerHTML += `<h3>${username}: ${count}</h3>`;
  });
}

const POLL_INTERVAL_MS = 5000;
window.addEventListener("DOMContentLoaded", () => {
  renderSuggestedTasks();
  refreshTasks();
  refreshStats();
  setInterval(refreshTasks, POLL_INTERVAL_MS);
  setInterval(refreshStats, POLL_INTERVAL_MS);
});
window.addEventListener("auth:ready", () => {
  refreshTasks();
  refreshStats();
});
window.addEventListener("families:changed", () => {
  refreshTasks();
});

FILE_EOF

echo "All files written."
