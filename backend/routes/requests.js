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

