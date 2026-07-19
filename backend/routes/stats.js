const express = require("express");
const pool = require("../db/pool");
const { requireAuth } = require("../middleware");

const router = express.Router();

router.get("/today", requireAuth, async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const result = await pool.query(
      `SELECT u.username, COUNT(*) AS count
       FROM task_completions tc
       JOIN users u ON u.id = tc.user_id
       WHERE tc.completed_date = $1
         AND (
           tc.user_id = $2
           OR tc.user_id IN (
             SELECT CASE WHEN fc.user_id_a = $2 THEN fc.user_id_b ELSE fc.user_id_a END
             FROM family_connections fc
             WHERE fc.user_id_a = $2 OR fc.user_id_b = $2
           )
         )
       GROUP BY u.username
       ORDER BY count DESC`,
      [today, req.user.id]
    );
    res.json({ today, stats: result.rows.map(r => ({ username: r.username, count: Number(r.count) })) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

module.exports = router;
