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

