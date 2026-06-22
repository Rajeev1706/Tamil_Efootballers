import { Router } from "express"
import { z } from "zod"
import { query, withTransaction } from "../db/pool.js"
import { authenticate, adminOnly } from "../middleware/auth.js"

const router = Router()

const FIXTURE_SELECT = `
  SELECT
    f.id, f.round, f.status,
    f.scheduled_date AS date,
    f.home_score AS "homeScore", f.away_score AS "awayScore",
    ht.id AS "homeTeamId", ht.name AS home,
    at.id AS "awayTeamId", at.name AS away
  FROM fixtures f
  JOIN teams ht ON f.home_team_id = ht.id
  JOIN teams at ON f.away_team_id = at.id
`

// GET /api/fixtures  — all fixtures; optional ?teamId= or ?status=
router.get("/", authenticate, async (req, res, next) => {
  try {
    const { teamId, status } = req.query
    let sql = FIXTURE_SELECT
    const params = []
    const conds = []

    if (teamId) {
      conds.push(`(f.home_team_id = $${params.length + 1} OR f.away_team_id = $${params.length + 1})`)
      params.push(teamId)
    }
    if (status) {
      conds.push(`f.status = $${params.length + 1}`)
      params.push(status)
    }
    if (conds.length) sql += " WHERE " + conds.join(" AND ")
    sql += " ORDER BY f.scheduled_date ASC, f.round ASC"

    const result = await query(sql, params)
    res.json(result.rows)
  } catch (err) { next(err) }
})

// GET /api/fixtures/recent  — last 5 completed (for dashboard widget)
router.get("/recent", async (req, res, next) => {
  try {
    const result = await query(
      FIXTURE_SELECT + " WHERE f.status = 'completed' ORDER BY f.scheduled_date DESC LIMIT 5"
    )
    res.json(result.rows)
  } catch (err) { next(err) }
})

// POST /api/fixtures  — admin creates a fixture
const createSchema = z.object({
  homeTeamId: z.number().int().positive(),
  awayTeamId: z.number().int().positive(),
  round:      z.number().int().positive(),
  date:       z.string(), // YYYY-MM-DD
})

router.post("/", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { homeTeamId, awayTeamId, round, date } = createSchema.parse(req.body)
    if (homeTeamId === awayTeamId) {
      return res.status(400).json({ error: "Home and away teams must differ" })
    }
    const result = await query(`
      INSERT INTO fixtures (home_team_id, away_team_id, round, scheduled_date)
      VALUES ($1, $2, $3, $4) RETURNING id
    `, [homeTeamId, awayTeamId, round, date])

    const fresh = await query(FIXTURE_SELECT + " WHERE f.id = $1", [result.rows[0].id])
    res.status(201).json(fresh.rows[0])
  } catch (err) { next(err) }
})

// PATCH /api/fixtures/:id/result  — admin enters or re-edits the score
const resultSchema = z.object({
  homeScore: z.number().int().min(0),
  awayScore: z.number().int().min(0),
  homeGoals: z.number().int().min(0),
  awayGoals: z.number().int().min(0),
})

router.patch("/:id/result", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { homeScore, awayScore, homeGoals, awayGoals } = resultSchema.parse(req.body)

    await withTransaction(async ({ query: q }) => {
      // Accept both upcoming AND completed — completed means admin is re-editing
      const fRes = await q("SELECT * FROM fixtures WHERE id = $1", [req.params.id])
      if (!fRes.rows[0]) throw Object.assign(new Error("Fixture not found"), { status: 404 })
      const f = fRes.rows[0]

      const statDelta = (result, scored, conceded) => ({
        won:   result === "win"  ? 1 : 0,
        drawn: result === "draw" ? 1 : 0,
        lost:  result === "loss" ? 1 : 0,
        gf: scored, ga: conceded,
      })

      // If already completed, reverse the old stats first before applying new ones
      if (f.status === "completed") {
        const oldHomeResult = f.home_score > f.away_score ? "win" : f.home_score < f.away_score ? "loss" : "draw"
        const oldAwayResult = oldHomeResult === "win" ? "loss" : oldHomeResult === "loss" ? "win" : "draw"
        for (const [teamId, res, scored, conceded, oldPts] of [
          [f.home_team_id, oldHomeResult, f.home_score, f.away_score, f.home_score],
          [f.away_team_id, oldAwayResult, f.away_score, f.home_score, f.away_score],
        ]) {
          const d = statDelta(res, scored, conceded)
          await q(`
            UPDATE teams SET
              played       = played - 1,
              won          = won - $1, drawn = drawn - $2, lost  = lost - $3,
              gf           = gf  - $4, ga    = ga    - $5,
              score_points = score_points - $7
            WHERE id = $6
          `, [d.won, d.drawn, d.lost, d.gf, d.ga, teamId, oldPts])
        }
      }

      // Save new score + mark completed
      await q(`
        UPDATE fixtures SET home_score = $1, away_score = $2, status = 'completed'
        WHERE id = $3
      `, [homeScore, awayScore, req.params.id])

      // W/D/L determined by match points
      const homeResult = homeScore > awayScore ? "win" : homeScore < awayScore ? "loss" : "draw"
      const awayResult = homeResult === "win" ? "loss" : homeResult === "loss" ? "win" : "draw"

      // GF/GA uses actual goals, score_points uses actual match scores
      for (const [teamId, res, scored, conceded, matchPts] of [
        [f.home_team_id, homeResult, homeGoals, awayGoals, homeScore],
        [f.away_team_id, awayResult, awayGoals, homeGoals, awayScore],
      ]) {
        const d = statDelta(res, scored, conceded)
        await q(`
          UPDATE teams SET
            played       = played + 1,
            won          = won + $1, drawn = drawn + $2, lost  = lost + $3,
            gf           = gf  + $4, ga    = ga    + $5,
            score_points = score_points + $7
          WHERE id = $6
        `, [d.won, d.drawn, d.lost, d.gf, d.ga, teamId, matchPts])
      }
    })

    const fresh = await query(FIXTURE_SELECT + " WHERE f.id = $1", [req.params.id])
    res.json(fresh.rows[0])
  } catch (err) { next(err) }
})

// PATCH /api/fixtures/:id  — admin edits fixture date/round (upcoming only)
const editSchema = z.object({
  round: z.number().int().positive().optional(),
  date:  z.string().optional(),
  homeTeamId: z.number().int().positive().optional(),
  awayTeamId: z.number().int().positive().optional(),
})

router.patch("/:id", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { round, date, homeTeamId, awayTeamId } = editSchema.parse(req.body)

    const result = await query(`
      UPDATE fixtures SET
        round        = COALESCE($1, round),
        scheduled_date = COALESCE($2, scheduled_date),
        home_team_id = COALESCE($3, home_team_id),
        away_team_id = COALESCE($4, away_team_id)
      WHERE id = $5
      RETURNING id
    `, [round ?? null, date ?? null, homeTeamId ?? null, awayTeamId ?? null, req.params.id])

    if (!result.rows[0]) return res.status(404).json({ error: "Fixture not found" })
    const fresh = await query(FIXTURE_SELECT + " WHERE f.id = $1", [req.params.id])
    res.json(fresh.rows[0])
  } catch (err) { next(err) }
})

// DELETE /api/fixtures/:id  — admin deletes fixture
router.delete("/:id", authenticate, adminOnly, async (req, res, next) => {
  try {
    const result = await query(
      "DELETE FROM fixtures WHERE id = $1 RETURNING id", [req.params.id]
    )
    if (!result.rows[0]) return res.status(404).json({ error: "Fixture not found" })
    res.json({ deleted: true })
  } catch (err) { next(err) }
})

export default router