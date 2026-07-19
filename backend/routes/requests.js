const express = require("express");
const pool = require("../db/pool");
const { requireAuth } = require("../middleware");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT fr.id, u.username AS from_username, fr.status
       FROM family_requests fr
       JOIN users u ON u.id = fr.from_user_id
       WHERE fr.to_user_id = $1 AND fr.status = 'pending'`,
      [req.user.id]
    );
    res.json({ requests: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch requests" });
  }
});

router.post("/", requireAuth, async (req, res) => {
  const { toUsername } = req.body;
  if (!toUsername) return res.status(400).json({ error: "toUsername required" });
  try {
    const toUserResult = await pool.query("SELECT id FROM users WHERE username = $1", [toUsername]);
    const toUser = toUserResult.rows[0];
    if (!toUser) return res.status(404).json({ error: "User not found" });

    await pool.query(
      `INSERT INTO family_requests (from_user_id, to_user_id, status)
       VALUES ($1, $2, 'pending')
       ON CONFLICT (from_user_id, to_user_id) DO NOTHING`,
      [req.user.id, toUser.id]
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
       RETURNING from_user_id, to_user_id`,
      [requestId, req.user.id]
    );
    const request = result.rows[0];
    if (!request) return res.status(404).json({ error: "Request not found" });

    await pool.query(
      `INSERT INTO family_connections (user_id_a, user_id_b)
       VALUES ($1, $2)
       ON CONFLICT (user_id_a, user_id_b) DO NOTHING`,
      [request.from_user_id, request.to_user_id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to accept request" });
  }
});


router.get("/connections", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT fc.id,
              ua.username AS username_a,
              ub.username AS username_b
       FROM family_connections fc
       JOIN users ua ON ua.id = fc.user_id_a
       JOIN users ub ON ub.id = fc.user_id_b
       WHERE fc.user_id_a = $1 OR fc.user_id_b = $1`,
      [req.user.id]
    );
    const connections = result.rows.map(r => ({
      id: r.id,
      members: [r.username_a, r.username_b],
    }));
    res.json({ connections });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch connections" });
  }
});

module.exports = router;
