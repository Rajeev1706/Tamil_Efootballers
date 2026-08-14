// backend/src/routes/teamTrophies.js
import express from "express"
import { query } from "../db/pool.js"
import { authenticate, adminOnly } from "../middleware/auth.js"

const router = express.Router()

// ── Ensure team_season_history table exists ───────────────────────────────────
;(async () => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS season_calendar (
        id           SERIAL PRIMARY KEY,
        season_number INT,
        event_date   DATE,
        tournament   TEXT,
        round_label  TEXT,
        notes        TEXT,
        status       TEXT DEFAULT 'upcoming'
      )
    `)
    await query(`
      CREATE TABLE IF NOT EXISTS team_trophies (
        id            SERIAL PRIMARY KEY,
        team_id       INT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        season_number INT NOT NULL,
        tournament    TEXT NOT NULL DEFAULT 'team_league',
        awarded_at    TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(team_id, season_number, tournament)
      )
    `)
    await query(`
      CREATE TABLE IF NOT EXISTS team_season_history (
        id               SERIAL PRIMARY KEY,
        team_id          INT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        season_number    INT NOT NULL,
        year             INT,
        team_league_pos  INT,
        championship_pos INT,
        relegated        BOOLEAN DEFAULT FALSE,
        notes            TEXT,
        UNIQUE(team_id, season_number)
      )
    `)
    // Add year column if it doesn't exist (for existing deployments)
    await query(`ALTER TABLE team_season_history ADD COLUMN IF NOT EXISTS year INT`)
  } catch (e) { console.error("[teamTrophies] migration:", e.message) }
})()

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
      params.push(year)
      seasonFilter = `AND tt.season_number IN (
        SELECT DISTINCT season_number FROM season_calendar
        WHERE EXTRACT(YEAR FROM event_date)::int = $${params.length}
      )`
    }

    // Build a filtered join only for team_league (so year/season filter affects league count only)
    // Championship and europa counts always show ALL-TIME totals
    const tlFilter = seasonFilter ? `AND tt2.tournament = 'team_league' ${seasonFilter}` : `AND tt2.tournament = 'team_league'`

    const result = await query(`
      SELECT
        t.id, t.name, t.logo_url AS "logoUrl",
        COUNT(DISTINCT tt_all.id)::int AS "totalTrophies",
        COUNT(DISTINCT tt2.id)::int AS "teamLeagueCount",
        COUNT(DISTINCT CASE WHEN tt_all.tournament = 'championship' THEN tt_all.id END)::int AS "championshipCount",
        COUNT(DISTINCT CASE WHEN tt_all.tournament = 'europa'       THEN tt_all.id END)::int AS "europaCount",
        ARRAY_AGG(tt2.season_number ORDER BY tt2.season_number) FILTER (WHERE tt2.id IS NOT NULL) AS seasons,
        array_remove(array_agg(DISTINCT CASE WHEN tt_all.id IS NOT NULL AND sc.event_date IS NOT NULL THEN EXTRACT(YEAR FROM sc.event_date)::int END), NULL) AS years,
        COUNT(DISTINCT CASE WHEN tsh.relegated = true THEN tsh.id END)::int AS "relegationCount"
      FROM teams t
      LEFT JOIN team_trophies tt_all ON tt_all.team_id = t.id
      LEFT JOIN team_trophies tt2    ON tt2.team_id = t.id ${tlFilter}
      LEFT JOIN season_calendar sc   ON sc.season_number = tt_all.season_number
      LEFT JOIN team_season_history tsh ON tsh.team_id = t.id
      GROUP BY t.id, t.name, t.logo_url
      ORDER BY "teamLeagueCount" DESC, t.name ASC
    `, params)
    res.json(result.rows)
  } catch (err) { next(err) }
})

// POST /api/team-trophies/history — upsert a season record for a team (admin)
router.post("/history", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { teamId, seasonNumber, teamLeaguePos, championshipPos, relegated, notes } = req.body
    if (!teamId || !seasonNumber) return res.status(400).json({ error: "teamId and seasonNumber required" })
    const result = await query(`
      INSERT INTO team_season_history (team_id, season_number, team_league_pos, championship_pos, relegated, notes)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (team_id, season_number)
      DO UPDATE SET
        team_league_pos  = EXCLUDED.team_league_pos,
        championship_pos = EXCLUDED.championship_pos,
        relegated        = EXCLUDED.relegated,
        notes            = EXCLUDED.notes
      RETURNING *
    `, [teamId, seasonNumber, teamLeaguePos || null, championshipPos || null, relegated || false, notes || null])
    res.status(201).json(result.rows[0])
  } catch (err) { next(err) }
})

// DELETE /api/team-trophies/history/:id — remove a season history row (admin)
router.delete("/history/:id", authenticate, adminOnly, async (req, res, next) => {
  try {
    await query(`DELETE FROM team_season_history WHERE id = $1`, [req.params.id])
    res.json({ deleted: true })
  } catch (err) { next(err) }
})

// GET /api/team-trophies/seasons
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

// GET /api/team-trophies/:teamId — specific team with full season history
router.get("/:teamId", async (req, res, next) => {
  try {
    const teamRes = await query(
      `SELECT id, name, logo_url AS "logoUrl" FROM teams WHERE id = $1`,
      [req.params.teamId]
    )
    if (!teamRes.rows[0]) return res.status(404).json({ error: "Team not found" })

    // Team League trophies
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

    // Full season history (positions + relegation)
    const historyRes = await query(`
      SELECT tsh.*
      FROM team_season_history tsh
      WHERE tsh.team_id = $1
      ORDER BY tsh.season_number ASC
    `, [req.params.teamId])

    // Summary stats
    const statsRes = await query(`
      SELECT
        COUNT(*)::int AS "totalSeasons",
        COUNT(CASE WHEN relegated = true THEN 1 END)::int AS "relegationCount",
        MIN(team_league_pos) AS "bestLeaguePos",
        MIN(championship_pos) AS "bestChampionshipPos"
      FROM team_season_history
      WHERE team_id = $1
    `, [req.params.teamId])

    res.json({
      team:    teamRes.rows[0],
      trophies: trophyRes.rows,
      history:  historyRes.rows,
      stats:    statsRes.rows[0] || {},
    })
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