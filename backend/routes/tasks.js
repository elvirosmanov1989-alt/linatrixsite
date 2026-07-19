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
      `SELECT t.id, t.text, u.username AS created_by, t.created_at
       FROM tasks t
       JOIN users u ON u.id = t.created_by
       WHERE t.created_by = $1
          OR t.created_by IN (
            SELECT CASE WHEN fc.user_id_a = $1 THEN fc.user_id_b ELSE fc.user_id_a END
            FROM family_connections fc
            WHERE fc.user_id_a = $1 OR fc.user_id_b = $1
          )
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
      completedToday: completionsByTask[t.id] || [],
    }));

    res.json({ tasks, today });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

router.post("/", requireAuth, async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: "Task text required" });
  try {
    const result = await pool.query(
      "INSERT INTO tasks (text, created_by) VALUES ($1, $2) RETURNING id, text",
      [text.trim(), req.user.id]
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
