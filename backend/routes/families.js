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

