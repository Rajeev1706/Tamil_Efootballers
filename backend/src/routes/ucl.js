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

// Helper: generate round-robin schedule using circle method
function generateRoundRobin(playerIds) {
  const list = [...playerIds]
  if (list.length % 2 !== 0) list.push(null) // bye for odd count
  const total = list.length
  const rounds = []
  const seen = new Set() // track pairs to prevent duplicates

  for (let r = 0; r < total - 1; r++) {
    const round = []
    for (let i = 0; i < total / 2; i++) {
      const p1 = list[i]
      const p2 = list[total - 1 - i]
      if (!p1 || !p2) continue
      // Deduplicate — key is always smaller id first
      const key = [p1, p2].sort().join("-")
      if (!seen.has(key)) {
        seen.add(key)
        round.push({ p1, p2 })
      }
    }
    if (round.length > 0) rounds.push(round)
    // Rotate: keep first fixed, rotate the rest clockwise
    list.splice(1, 0, list.pop())
  }
  return rounds
}

// POST /api/ucl/activate — mark all pending_draw groups as active and generate fixtures
router.post("/activate", authenticate, adminOnly, async (req, res, next) => {
  try {
    await query("UPDATE ucl_groups SET status = 'active' WHERE status = 'pending_draw'")

    // Generate round-robin fixtures for every active group
    const groupsRes = await query("SELECT id FROM ucl_groups WHERE status = 'active'")
    for (const group of groupsRes.rows) {
      // Skip if fixtures already exist for this group
      const existing = await query("SELECT id FROM ucl_fixtures WHERE group_id = $1 LIMIT 1", [group.id])
      if (existing.rows.length > 0) continue

      const playersRes = await query("SELECT id FROM players WHERE ucl_group_id = $1", [group.id])
      const playerIds = playersRes.rows.map(p => p.id)
      if (playerIds.length < 2) continue

      const rounds = generateRoundRobin(playerIds)
      for (let r = 0; r < rounds.length; r++) {
        for (const { p1, p2 } of rounds[r]) {
          await query(
            "INSERT INTO ucl_fixtures (group_id, round_number, player1_id, player2_id) VALUES ($1,$2,$3,$4)",
            [group.id, r + 1, p1, p2]
          )
        }
      }
    }
    res.json({ activated: true })
  } catch (err) { next(err) }
})

// GET /api/ucl/fixtures — all fixtures with player and group info (admin)
router.get("/fixtures", authenticate, adminOnly, async (req, res, next) => {
  try {
    const result = await query(`
      SELECT
        f.id, f.group_id AS "groupId", f.round_number AS "roundNumber",
        f.player1_score AS "player1Score", f.player2_score AS "player2Score",
        f.status, f.match_record_id AS "matchRecordId",
        g.name AS "groupName",
        p1.id AS "player1Id", p1.name AS "player1Name",
        p2.id AS "player2Id", p2.name AS "player2Name"
      FROM ucl_fixtures f
      JOIN ucl_groups g ON f.group_id = g.id
      LEFT JOIN players p1 ON f.player1_id = p1.id
      LEFT JOIN players p2 ON f.player2_id = p2.id
      ORDER BY f.round_number ASC, g.name ASC
    `)
    res.json(result.rows)
  } catch (err) { next(err) }
})

// PATCH /api/ucl/fixtures/:id — save or update result
router.patch("/fixtures/:id", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { player1Score, player2Score } = z.object({
      player1Score: z.number().int().min(0),
      player2Score: z.number().int().min(0),
    }).parse(req.body)

    const fixRes = await query(`
      SELECT f.*, g.season_number
      FROM ucl_fixtures f
      JOIN ucl_groups g ON f.group_id = g.id
      WHERE f.id = $1
    `, [req.params.id])
    const fix = fixRes.rows[0]
    if (!fix) return res.status(404).json({ error: "Fixture not found" })

    const result = player1Score > player2Score ? "win"
                 : player2Score > player1Score ? "loss" : "draw"

    // Delete old match record if editing
    if (fix.match_record_id) {
      await query("DELETE FROM match_records WHERE id = $1", [fix.match_record_id])
    }

    const seasonRes = await query("SELECT value FROM app_settings WHERE key = 'current_season'")
    const season = parseInt(seasonRes.rows[0]?.value || "6")
    const oppGradeRes = await query("SELECT grade FROM players WHERE id = $1", [fix.player2_id])
    const oppGrade = oppGradeRes.rows[0]?.grade || "C"

    const mrRes = await query(`
      INSERT INTO match_records
        (player_id, opponent_id, result, opponent_grade, match_type, player_score, opponent_score, recorded_at, season_number)
      VALUES ($1,$2,$3,$4,'ucl',$5,$6,NOW(),$7)
      RETURNING id
    `, [fix.player1_id, fix.player2_id, result, oppGrade, player1Score, player2Score, season])

    await query(`
      UPDATE ucl_fixtures
      SET player1_score=$1, player2_score=$2, status='completed', match_record_id=$3
      WHERE id=$4
    `, [player1Score, player2Score, mrRes.rows[0].id, req.params.id])

    res.json({ updated: true })
  } catch (err) { next(err) }
})

// DELETE /api/ucl/fixtures/:id/result — clear a fixture result
router.delete("/fixtures/:id/result", authenticate, adminOnly, async (req, res, next) => {
  try {
    const fix = await query("SELECT match_record_id FROM ucl_fixtures WHERE id = $1", [req.params.id])
    if (fix.rows[0]?.match_record_id) {
      await query("DELETE FROM match_records WHERE id = $1", [fix.rows[0].match_record_id])
    }
    await query("UPDATE ucl_fixtures SET player1_score=NULL, player2_score=NULL, status='pending', match_record_id=NULL WHERE id=$1", [req.params.id])
    res.json({ cleared: true })
  } catch (err) { next(err) }
})

// POST /api/ucl/groups/:id/regenerate-fixtures — regenerate fixtures for one group
router.post("/groups/:id/regenerate-fixtures", authenticate, adminOnly, async (req, res, next) => {
  try {
    const groupId = parseInt(req.params.id)

    // Delete existing fixtures and their match records
    const mrRes = await query("SELECT match_record_id FROM ucl_fixtures WHERE group_id=$1 AND match_record_id IS NOT NULL", [groupId])
    const mrIds = mrRes.rows.map(r => r.match_record_id)
    if (mrIds.length > 0) await query("DELETE FROM match_records WHERE id = ANY($1::int[])", [mrIds])
    await query("DELETE FROM ucl_fixtures WHERE group_id=$1", [groupId])

    // Regenerate with current players
    const playersRes = await query("SELECT id FROM players WHERE ucl_group_id = $1", [groupId])
    const playerIds = playersRes.rows.map(p => p.id)
    if (playerIds.length < 2) return res.json({ generated: 0 })

    const rounds = generateRoundRobin(playerIds)
    let count = 0
    for (let r = 0; r < rounds.length; r++) {
      for (const { p1, p2 } of rounds[r]) {
        await query(
          "INSERT INTO ucl_fixtures (group_id, round_number, player1_id, player2_id) VALUES ($1,$2,$3,$4)",
          [groupId, r + 1, p1, p2]
        )
        count++
      }
    }
    res.json({ generated: count })
  } catch (err) { next(err) }
})

// POST /api/ucl/groups/:id/reset-fixtures — delete fixtures + match records for a group
router.post("/groups/:id/reset-fixtures", authenticate, adminOnly, async (req, res, next) => {
  try {
    const mrRes = await query("SELECT match_record_id FROM ucl_fixtures WHERE group_id=$1 AND match_record_id IS NOT NULL", [req.params.id])
    const mrIds = mrRes.rows.map(r => r.match_record_id)
    if (mrIds.length > 0) {
      await query(`DELETE FROM match_records WHERE id = ANY($1::int[])`, [mrIds])
    }
    await query("DELETE FROM ucl_fixtures WHERE group_id=$1", [req.params.id])
    res.json({ reset: true })
  } catch (err) { next(err) }
})

// GET /api/ucl/groups
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
      "INSERT INTO ucl_groups (name, status) VALUES ($1, 'active') RETURNING *", [name]
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
      WHERE p.ucl_group_id IS NOT NULL AND g.status = 'active'
      GROUP BY p.id, p.name, t.name, g.name
      ORDER BY goals DESC, p.name ASC
      LIMIT 10
    `)
    res.json(result.rows)
  } catch (err) { next(err) }
})

export default router