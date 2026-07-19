const express = require("express");
const pool = require("../db/pool");
const { requireAuth } = require("../middleware");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT m.id, u.username, m.text, m.created_at
       FROM messages m
       JOIN users u ON u.id = m.user_id
       ORDER BY m.created_at DESC
       LIMIT 100`
    );
    res.json({ messages: result.rows.reverse() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

router.post("/", requireAuth, async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: "Message text required" });
  try {
    const result = await pool.query(
      `INSERT INTO messages (user_id, text) VALUES ($1, $2)
       RETURNING id, text, created_at`,
      [req.user.id, text.trim()]
    );
    const message = {
      id: result.rows[0].id,
      username: req.user.username,
      text: result.rows[0].text,
      created_at: result.rows[0].created_at,
    };

    const io = req.app.get("io");
    io.emit("chat:message", message);

    res.status(201).json({ message });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

module.exports = router;
