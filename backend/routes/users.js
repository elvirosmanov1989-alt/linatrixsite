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

