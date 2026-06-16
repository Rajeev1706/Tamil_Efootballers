import { Router } from "express"
import { z } from "zod"
import { query } from "../db/pool.js"
import { authenticate } from "../middleware/auth.js"

const router = Router()

// GET /api/lineups/:fixtureId  — get saved lineup for my team in this fixture
router.get("/:fixtureId", authenticate, async (req, res, next) => {
  try {
    const teamId = req.user.teamId
    if (!teamId) return res.status(403).json({ error: "No team associated" })

    const result = await query(`
      SELECT
        fl.id, fl.slot,
        fl.my_player_id  AS "myPlayerId",
        fl.opp_player_id AS "oppPlayerId",
        mp.name AS "myPlayerName",  mp.grade AS "myPlayerGrade",
        op.name AS "oppPlayerName", op.grade AS "oppPlayerGrade"
      FROM fixture_lineups fl
      JOIN players mp ON fl.my_player_id  = mp.id
      JOIN players op ON fl.opp_player_id = op.id
      WHERE fl.fixture_id = $1 AND fl.team_id = $2
      ORDER BY fl.slot
    `, [req.params.fixtureId, teamId])

    res.json(result.rows)
  } catch (err) { next(err) }
})

// PUT /api/lineups/:fixtureId  — save/replace full lineup for this fixture
const saveSchema = z.object({
  matchups: z.array(z.object({
    slot:        z.number().int().min(1),
    myPlayerId:  z.number().int().positive(),
    oppPlayerId: z.number().int().positive(),
  })).min(1),
})

router.put("/:fixtureId", authenticate, async (req, res, next) => {
  try {
    const teamId = req.user.teamId
    if (!teamId) return res.status(403).json({ error: "No team associated" })

    // Verify fixture is upcoming and belongs to this team
    const fixRes = await query(
      `SELECT id, home_team_id, away_team_id, status
       FROM fixtures WHERE id = $1`,
      [req.params.fixtureId]
    )
    const fix = fixRes.rows[0]
    if (!fix) return res.status(404).json({ error: "Fixture not found" })
    if (fix.status !== "upcoming") return res.status(400).json({ error: "Fixture is already completed" })
    if (fix.home_team_id !== teamId && fix.away_team_id !== teamId) {
      return res.status(403).json({ error: "This fixture does not involve your team" })
    }

    const { matchups } = saveSchema.parse(req.body)

    // Delete existing lineup for this fixture+team then reinsert
    await query(
      "DELETE FROM fixture_lineups WHERE fixture_id = $1 AND team_id = $2",
      [req.params.fixtureId, teamId]
    )

    for (const m of matchups) {
      await query(`
        INSERT INTO fixture_lineups (fixture_id, team_id, slot, my_player_id, opp_player_id)
        VALUES ($1, $2, $3, $4, $5)
      `, [req.params.fixtureId, teamId, m.slot, m.myPlayerId, m.oppPlayerId])
    }

    res.json({ saved: true, count: matchups.length })
  } catch (err) { next(err) }
})

// DELETE /api/lineups/:fixtureId  — clear lineup (e.g. captain wants to redo)
router.delete("/:fixtureId", authenticate, async (req, res, next) => {
  try {
    const teamId = req.user.teamId
    if (!teamId) return res.status(403).json({ error: "No team associated" })

    await query(
      "DELETE FROM fixture_lineups WHERE fixture_id = $1 AND team_id = $2",
      [req.params.fixtureId, teamId]
    )
    res.json({ deleted: true })
  } catch (err) { next(err) }
})

// GET /api/lineups/h2h/:p1Id/:p2Id  — head to head match history between 2 players
router.get("/h2h/:p1Id/:p2Id", authenticate, async (req, res, next) => {
  try {
    const { p1Id, p2Id } = req.params

    const result = await query(`
      SELECT
        mr.id,
        mr.result,
        mr.match_type     AS "matchType",
        mr.opponent_grade AS "opponentGrade",
        mr.player_score   AS "playerScore",
        mr.opponent_score AS "opponentScore",
        mr.recorded_at    AS date,
        p1.name AS "p1Name", p1.grade AS "p1Grade",
        p2.name AS "p2Name", p2.grade AS "p2Grade"
      FROM match_records mr
      JOIN players p1 ON mr.player_id   = p1.id
      JOIN players p2 ON mr.opponent_id = p2.id
      WHERE (mr.player_id = $1 AND mr.opponent_id = $2)
         OR (mr.player_id = $2 AND mr.opponent_id = $1)
      ORDER BY mr.recorded_at DESC, mr.id DESC
    `, [p1Id, p2Id])

    res.json(result.rows)
  } catch (err) { next(err) }
})

export default router