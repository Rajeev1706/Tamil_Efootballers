import { Router } from "express"
import { z } from "zod"
import { query } from "../db/pool.js"
import { authenticate, adminOnly } from "../middleware/auth.js"

const router = Router()

// POST /api/ucl/generate — auto-create 8 groups and distribute players evenly
router.post("/generate", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { playerIds } = z.object({
      playerIds: z.array(z.number().int().positive()).min(1)
    }).parse(req.body)

    const GROUP_COUNT = 8
    const GROUP_NAMES = ["Group A","Group B","Group C","Group D","Group E","Group F","Group G","Group H"]

    // Shuffle players randomly
    const shuffled = [...playerIds].sort(() => Math.random() - 0.5)

    // Create 8 groups with pending_draw status
    const groups = []
    for (const name of GROUP_NAMES) {
      const res = await query(
        "INSERT INTO ucl_groups (name, status) VALUES ($1, 'pending_draw') RETURNING *", [name]
      )
      groups.push(res.rows[0])
    }

    // Distribute players round-robin across groups
    // This ensures extras go 1-per-group starting from Group A
    for (let i = 0; i < shuffled.length; i++) {
      const groupId = groups[i % GROUP_COUNT].id
      await query(
        "UPDATE players SET ucl_group_id = $1 WHERE id = $2",
        [groupId, shuffled[i]]
      )
    }

    res.status(201).json({ groups, distributed: shuffled.length })
  } catch (err) { next(err) }
})

// POST /api/ucl/groups/:id/reset-fixtures — delete all UCL match records for a group
router.post("/groups/:id/reset-fixtures", authenticate, adminOnly, async (req, res, next) => {
  try {
    // Get all players in this group
    const playersRes = await query(
      "SELECT id FROM players WHERE ucl_group_id = $1", [req.params.id]
    )
    const playerIds = playersRes.rows.map(p => p.id)
    if (playerIds.length < 2) return res.json({ deleted: 0 })

    // Delete all UCL match records where both players are in this group
    const result = await query(`
      DELETE FROM match_records
      WHERE match_type = 'ucl'
        AND player_id   = ANY($1::int[])
        AND opponent_id = ANY($1::int[])
      RETURNING id
    `, [playerIds])

    res.json({ deleted: result.rowCount })
  } catch (err) { next(err) }
})

// GET /api/ucl/admin-groups — all groups including pending_draw (admin only)
router.get("/admin-groups", authenticate, adminOnly, async (req, res, next) => {
  try {
    const groupsRes = await query("SELECT * FROM ucl_groups ORDER BY name ASC")
    const playersRes = await query(`
      SELECT p.id, p.name, p.ucl_group_id AS "groupId", t.name AS team
      FROM players p
      LEFT JOIN teams t ON p.team_id = t.id
      WHERE p.ucl_group_id IS NOT NULL
      ORDER BY p.name ASC
    `)
    const groups = groupsRes.rows.map(g => ({
      ...g,
      players: playersRes.rows.filter(p => p.groupId === g.id),
    }))
    res.json(groups)
  } catch (err) { next(err) }
})

// POST /api/ucl/activate — mark all pending_draw groups as active (called after draw done)
router.post("/activate", authenticate, adminOnly, async (req, res, next) => {
  try {
    await query("UPDATE ucl_groups SET status = 'active' WHERE status = 'pending_draw'")
    res.json({ activated: true })
  } catch (err) { next(err) }
})

// GET /api/ucl/groups — all groups with their assigned players (public)
router.get("/groups", async (req, res, next) => {
  try {
    const groupsRes = await query("SELECT * FROM ucl_groups WHERE status = 'active' ORDER BY name ASC")
    const playersRes = await query(`
      SELECT p.id, p.name, p.ucl_group_id AS "groupId", t.name AS team
      FROM players p
      LEFT JOIN teams t ON p.team_id = t.id
      WHERE p.ucl_group_id IS NOT NULL
      ORDER BY p.name ASC
    `)
    const groups = groupsRes.rows.map(g => ({
      ...g,
      players: playersRes.rows.filter(p => p.groupId === g.id),
    }))
    res.json(groups)
  } catch (err) { next(err) }
})

// GET /api/ucl/unassigned — players not yet in any UCL group (admin)
router.get("/unassigned", authenticate, adminOnly, async (req, res, next) => {
  try {
    const result = await query(`
      SELECT p.id, p.name, t.name AS team
      FROM players p
      LEFT JOIN teams t ON p.team_id = t.id
      WHERE p.ucl_group_id IS NULL
      ORDER BY p.name ASC
    `)
    res.json(result.rows)
  } catch (err) { next(err) }
})

// POST /api/ucl/groups — create a new group
router.post("/groups", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { name } = z.object({ name: z.string().min(1) }).parse(req.body)
    const result = await query(
      "INSERT INTO ucl_groups (name) VALUES ($1) RETURNING *", [name]
    )
    res.status(201).json(result.rows[0])
  } catch (err) { next(err) }
})

// PATCH /api/ucl/groups/:id — rename group
router.patch("/groups/:id", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { name } = z.object({ name: z.string().min(1) }).parse(req.body)
    const result = await query(
      "UPDATE ucl_groups SET name = $1 WHERE id = $2 RETURNING *", [name, req.params.id]
    )
    if (!result.rows[0]) return res.status(404).json({ error: "Group not found" })
    res.json(result.rows[0])
  } catch (err) { next(err) }
})

// DELETE /api/ucl/groups/:id — delete group (players become unassigned)
router.delete("/groups/:id", authenticate, adminOnly, async (req, res, next) => {
  try {
    await query("UPDATE players SET ucl_group_id = NULL WHERE ucl_group_id = $1", [req.params.id])
    await query("DELETE FROM ucl_groups WHERE id = $1", [req.params.id])
    res.json({ deleted: true })
  } catch (err) { next(err) }
})

// POST /api/ucl/groups/:id/players — assign a player to this group
router.post("/groups/:id/players", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { playerId } = z.object({ playerId: z.number().int().positive() }).parse(req.body)
    const result = await query(
      "UPDATE players SET ucl_group_id = $1 WHERE id = $2 RETURNING id, name, ucl_group_id AS \"groupId\"",
      [req.params.id, playerId]
    )
    if (!result.rows[0]) return res.status(404).json({ error: "Player not found" })
    res.json(result.rows[0])
  } catch (err) { next(err) }
})

// DELETE /api/ucl/players/:playerId/group — unassign player from any group
router.delete("/players/:playerId/group", authenticate, adminOnly, async (req, res, next) => {
  try {
    await query("UPDATE players SET ucl_group_id = NULL WHERE id = $1", [req.params.playerId])
    res.json({ removed: true })
  } catch (err) { next(err) }
})

// GET /api/ucl/standings — computed group-stage standings (public)
router.get("/standings", async (req, res, next) => {
  try {
    const groupsRes = await query("SELECT * FROM ucl_groups WHERE status = 'active' ORDER BY name ASC")

    const statsRes = await query(`
      SELECT
        p.id, p.name, p.ucl_group_id AS "groupId", t.name AS team,
        COUNT(mr.id) AS played,
        SUM(CASE
          WHEN (mr.player_id = p.id AND mr.result = 'win') OR (mr.opponent_id = p.id AND mr.result = 'loss') THEN 1 ELSE 0
        END) AS won,
        SUM(CASE WHEN mr.result = 'draw' THEN 1 ELSE 0 END) AS drawn,
        SUM(CASE
          WHEN (mr.player_id = p.id AND mr.result = 'loss') OR (mr.opponent_id = p.id AND mr.result = 'win') THEN 1 ELSE 0
        END) AS lost,
        SUM(CASE WHEN mr.player_id = p.id THEN COALESCE(mr.player_score,0) ELSE COALESCE(mr.opponent_score,0) END) AS gf,
        SUM(CASE WHEN mr.player_id = p.id THEN COALESCE(mr.opponent_score,0) ELSE COALESCE(mr.player_score,0) END) AS ga
      FROM players p
      LEFT JOIN teams t ON p.team_id = t.id
      LEFT JOIN match_records mr
        ON (mr.player_id = p.id OR mr.opponent_id = p.id) AND mr.match_type = 'ucl'
      WHERE p.ucl_group_id IS NOT NULL
      GROUP BY p.id, p.name, p.ucl_group_id, t.name
    `)

    const groups = groupsRes.rows.map(g => {
      const players = statsRes.rows
        .filter(p => p.groupId === g.id)
        .map(p => {
          const won = parseInt(p.won) || 0
          const drawn = parseInt(p.drawn) || 0
          const lost = parseInt(p.lost) || 0
          const gf = parseInt(p.gf) || 0
          const ga = parseInt(p.ga) || 0
          return {
            id: p.id, name: p.name, team: p.team,
            played: parseInt(p.played) || 0,
            won, drawn, lost, gf, ga,
            gd: gf - ga,
            points: won * 3 + drawn,
          }
        })
        .sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf)

      return { id: g.id, name: g.name, players }
    })

    res.json(groups)
  } catch (err) { next(err) }
})

// GET /api/ucl/top-scorers — top 10 players by goals in UCL group stage (public)
router.get("/top-scorers", async (req, res, next) => {
  try {
    const result = await query(`
      SELECT
        p.id,
        p.name,
        t.name AS team,
        g.name AS "groupName",
        COALESCE(SUM(
          CASE
            WHEN mr.player_id   = p.id THEN COALESCE(mr.player_score, 0)
            WHEN mr.opponent_id = p.id THEN COALESCE(mr.opponent_score, 0)
            ELSE 0
          END
        ), 0) AS goals
      FROM players p
      LEFT JOIN match_records mr
        ON (mr.player_id = p.id OR mr.opponent_id = p.id)
        AND mr.match_type = 'ucl'
      LEFT JOIN teams t      ON p.team_id      = t.id
      LEFT JOIN ucl_groups g ON p.ucl_group_id = g.id
      WHERE p.ucl_group_id IS NOT NULL
      GROUP BY p.id, p.name, t.name, g.name
      ORDER BY goals DESC, p.name ASC
      LIMIT 10
    `)
    res.json(result.rows)
  } catch (err) { next(err) }
})

export default router