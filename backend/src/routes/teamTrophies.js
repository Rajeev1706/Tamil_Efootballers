// backend/src/routes/teamTrophies.js
import express from "express"
import { query } from "../db/pool.js"
import { authenticate, adminOnly } from "../middleware/auth.js"

const router = express.Router()

// GET /api/team-trophies?season=7&year=2026 — all teams with trophy counts
router.get("/", async (req, res, next) => {
  try {
    const { season, year } = req.query
    const params = []
    let seasonFilter = ""

    if (season) {
      params.push(season)
      seasonFilter = `AND tt.season_number = $${params.length}`
    } else if (year) {
      // Filter by year — look up which seasons fall in that year via season_calendar
      params.push(year)
      seasonFilter = `AND tt.season_number IN (
        SELECT DISTINCT season_number FROM season_calendar
        WHERE EXTRACT(YEAR FROM event_date)::int = $${params.length}
      )`
    }

    const result = await query(`
      SELECT
        t.id, t.name, t.logo_url AS "logoUrl",
        COUNT(DISTINCT tt.id)::int AS "totalTrophies",
        ARRAY_AGG(tt.season_number ORDER BY tt.season_number) FILTER (WHERE tt.id IS NOT NULL) AS seasons,
        ARRAY_AGG(DISTINCT EXTRACT(YEAR FROM sc.event_date)::int) FILTER (WHERE tt.id IS NOT NULL) AS years
      FROM teams t
      LEFT JOIN team_trophies tt ON tt.team_id = t.id AND tt.tournament = 'team_league' ${seasonFilter}
      LEFT JOIN season_calendar sc ON sc.season_number = tt.season_number
      GROUP BY t.id, t.name, t.logo_url
      ORDER BY "totalTrophies" DESC, t.name ASC
    `, params)
    res.json(result.rows)
  } catch (err) { next(err) }
})

// GET /api/team-trophies/seasons — distinct seasons with their year from season_calendar
router.get("/seasons", async (_req, res, next) => {
  try {
    const result = await query(`
      SELECT
        tt.season_number,
        EXTRACT(YEAR FROM MIN(sc.event_date))::int AS year
      FROM team_trophies tt
      LEFT JOIN season_calendar sc ON sc.season_number = tt.season_number
      GROUP BY tt.season_number
      ORDER BY tt.season_number ASC
    `)
    res.json(result.rows)
  } catch (err) { next(err) }
})

// GET /api/team-trophies/:teamId — specific team trophies with year from season_calendar
router.get("/:teamId", async (req, res, next) => {
  try {
    const teamRes = await query(
      `SELECT id, name, logo_url AS "logoUrl" FROM teams WHERE id = $1`,
      [req.params.teamId]
    )
    if (!teamRes.rows[0]) return res.status(404).json({ error: "Team not found" })

    const trophyRes = await query(`
      SELECT
        tt.*,
        EXTRACT(YEAR FROM MIN(sc.event_date))::int AS year
      FROM team_trophies tt
      LEFT JOIN season_calendar sc ON sc.season_number = tt.season_number
      WHERE tt.team_id = $1
      GROUP BY tt.id
      ORDER BY tt.season_number ASC
    `, [req.params.teamId])
    res.json({ team: teamRes.rows[0], trophies: trophyRes.rows })
  } catch (err) { next(err) }
})

// POST /api/team-trophies — add trophy (admin)
router.post("/", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { teamId, seasonNumber, tournament = "team_league" } = req.body
    if (!teamId || !seasonNumber) return res.status(400).json({ error: "teamId and seasonNumber required" })
    const result = await query(
      `INSERT INTO team_trophies (team_id, season_number, tournament) VALUES ($1,$2,$3)
       ON CONFLICT (team_id, season_number, tournament) DO NOTHING RETURNING *`,
      [teamId, seasonNumber, tournament]
    )
    res.status(201).json(result.rows[0] || { message: "Already exists" })
  } catch (err) { next(err) }
})

// DELETE /api/team-trophies/:id — remove trophy (admin)
router.delete("/:id", authenticate, adminOnly, async (req, res, next) => {
  try {
    await query(`DELETE FROM team_trophies WHERE id = $1`, [req.params.id])
    res.json({ deleted: true })
  } catch (err) { next(err) }
})

export default router