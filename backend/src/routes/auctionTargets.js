import { Router } from "express"
import { query }  from "../db/pool.js"
import { authenticate } from "../middleware/auth.js"

const router = Router()

// ── Ensure table exists (non-blocking, safe on startup) ──────────────────────
;(async () => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS auction_targets (
        id          SERIAL PRIMARY KEY,
        team_id     INT NOT NULL REFERENCES teams(id)   ON DELETE CASCADE,
        player_id   INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        priority    TEXT NOT NULL DEFAULT 'want',
        max_bid     INT,
        notes       TEXT DEFAULT '',
        rank_order          INT  DEFAULT 0,
        backup_for_player_id INT  REFERENCES players(id) ON DELETE SET NULL,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(team_id, player_id)
      )
    `)
    // Add is_captain column to players if not already present
    await query(`
      ALTER TABLE players ADD COLUMN IF NOT EXISTS is_captain BOOLEAN DEFAULT FALSE
    `)
  // Add backup_for_player_id column if it doesn't exist (safe migration)
    await query(`
      ALTER TABLE auction_targets
      ADD COLUMN IF NOT EXISTS backup_for_player_id INT REFERENCES players(id) ON DELETE SET NULL
    `).catch(() => {}) // ignore if column already exists
  } catch (err) {
    console.error("[auction-targets] table init error:", err.message)
  }
})()

// ── GET /api/auction-targets?teamId=X ────────────────────────────────────────
router.get("/", authenticate, async (req, res, next) => {
  try {
    const teamId = req.query.teamId || req.user?.teamId
    const r = await query(`
      SELECT
        at.id,
        at.team_id     AS "teamId",
        at.player_id   AS "playerId",
        at.priority,
        at.max_bid     AS "maxBid",
        at.notes,
        at.rank_order            AS "rankOrder",
        at.backup_for_player_id  AS "backupForPlayerId",
        bfp.name                 AS "backupForPlayerName",
        p.name,
        p.grade,
        p.market_value AS "marketValue",
        p.form,
        p.bdr_points   AS "bdrPoints",
        p.avatar_url   AS "avatarUrl",
        p.avatar_id    AS "avatarId",
        p.team_id      AS "currentTeamId",
        t.name         AS "currentTeam"
      FROM auction_targets at
      JOIN  players p ON at.player_id = p.id
      LEFT JOIN teams t ON p.team_id = t.id
      LEFT JOIN players bfp ON at.backup_for_player_id = bfp.id
      WHERE at.team_id = $1
      ORDER BY at.rank_order ASC, at.created_at ASC
    `, [teamId])
    res.json(r.rows)
  } catch (err) { next(err) }
})

// ── POST /api/auction-targets ─────────────────────────────────────────────────
router.post("/", authenticate, async (req, res, next) => {
  try {
    const { teamId, playerId, priority = "want", maxBid, notes = "", backupForPlayerId } = req.body
    const rankR = await query(
      `SELECT COALESCE(MAX(rank_order), -1) + 1 AS next FROM auction_targets WHERE team_id = $1`,
      [teamId]
    )
    const nextRank = rankR.rows[0].next
    const r = await query(`
      INSERT INTO auction_targets (team_id, player_id, priority, max_bid, notes, rank_order, backup_for_player_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (team_id, player_id) DO UPDATE
        SET priority             = EXCLUDED.priority,
            max_bid              = EXCLUDED.max_bid,
            notes                = EXCLUDED.notes,
            backup_for_player_id = EXCLUDED.backup_for_player_id
      RETURNING *
    `, [teamId, playerId, priority, maxBid ?? null, notes, nextRank, backupForPlayerId ?? null])
    res.json(r.rows[0])
  } catch (err) { next(err) }
})

// ── PATCH /api/auction-targets/reorder ───────────────────────────────────────
router.patch("/reorder", authenticate, async (req, res, next) => {
  try {
    const { orderedIds } = req.body
    for (let i = 0; i < orderedIds.length; i++) {
      await query(`UPDATE auction_targets SET rank_order = $1 WHERE id = $2`, [i, orderedIds[i]])
    }
    res.json({ ok: true })
  } catch (err) { next(err) }
})

// ── PATCH /api/auction-targets/:id ───────────────────────────────────────────
router.patch("/:id", authenticate, async (req, res, next) => {
  try {
    const { priority, maxBid, notes, rankOrder, backupForPlayerId } = req.body
    const sets = []; const vals = []; let i = 1
    if (priority           !== undefined) { sets.push(`priority             = $${i++}`); vals.push(priority) }
    if (maxBid             !== undefined) { sets.push(`max_bid              = $${i++}`); vals.push(maxBid ?? null) }
    if (notes              !== undefined) { sets.push(`notes                = $${i++}`); vals.push(notes) }
    if (rankOrder          !== undefined) { sets.push(`rank_order           = $${i++}`); vals.push(rankOrder) }
    if (backupForPlayerId  !== undefined) { sets.push(`backup_for_player_id = $${i++}`); vals.push(backupForPlayerId ?? null) }
    if (!sets.length) return res.json({ ok: true })
    vals.push(req.params.id)
    await query(`UPDATE auction_targets SET ${sets.join(", ")} WHERE id = $${i}`, vals)
    res.json({ ok: true })
  } catch (err) { next(err) }
})

// ── DELETE /api/auction-targets/:id ──────────────────────────────────────────
router.delete("/:id", authenticate, async (req, res, next) => {
  try {
    await query(`DELETE FROM auction_targets WHERE id = $1`, [req.params.id])
    res.json({ ok: true })
  } catch (err) { next(err) }
})

// ── GET /api/auction-targets/player/:playerId/interest ────────────────────────
// Admin: returns which teams have this player as a target + their priority.
// Team owner: returns just the count (sanitised — no team names revealed).
router.get("/player/:playerId/interest", authenticate, async (req, res, next) => {
  try {
    const isAdmin = req.user?.role === "admin"
    const result  = await query(`
      SELECT
        at.priority,
        at.max_bid   AS "maxBid",
        t.id         AS "teamId",
        t.name       AS "teamName",
        t.logo_url   AS "teamLogo"
      FROM auction_targets at
      JOIN teams t ON t.id = at.team_id
      WHERE at.player_id = $1
      ORDER BY
        CASE at.priority WHEN 'must_have' THEN 1 WHEN 'want' THEN 2 ELSE 3 END
    `, [req.params.playerId])

    if (isAdmin) {
      // Full data for admin
      res.json({ count: result.rows.length, teams: result.rows })
    } else {
      // Sanitised for team owners — count only, no team identities
      const mustHave = result.rows.filter(r => r.priority === "must_have").length
      const want     = result.rows.filter(r => r.priority === "want").length
      res.json({ count: result.rows.length, mustHave, want })
    }
  } catch (err) { next(err) }
})

export default router