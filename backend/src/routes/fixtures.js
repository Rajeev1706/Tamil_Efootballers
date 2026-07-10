import { Router } from "express"
import { z } from "zod"
import { query, withTransaction } from "../db/pool.js"
import { authenticate, adminOnly } from "../middleware/auth.js"
import { claimAward, addBdr } from "../services/bdrAwards.js"

const router = Router()

const FIXTURE_SELECT = `
  SELECT
    f.id, f.round, f.status,
    f.scheduled_date AS date,
    f.home_score AS "homeScore", f.away_score AS "awayScore",
    f.home_goals AS "homeGoals", f.away_goals AS "awayGoals",
    ht.id AS "homeTeamId", ht.name AS home, ht.logo_url AS "homeLogo",
    at.id AS "awayTeamId", at.name AS away, at.logo_url AS "awayLogo",

    -- Live tally from player results already logged for this fixture in the
    -- Team Dashboard — same math "Close Fixture" uses, just read-only here so
    -- admin can see progress before actually closing.
    COALESCE((
      SELECT SUM(
        CASE
          WHEN p.team_id   = f.home_team_id THEN (CASE mr.result WHEN 'win' THEN 3 WHEN 'draw' THEN 1 ELSE 0 END)
          WHEN opp.team_id = f.home_team_id THEN (CASE mr.result WHEN 'win' THEN 0 WHEN 'draw' THEN 1 ELSE 3 END)
          ELSE 0
        END
      )
      FROM match_records mr
      JOIN players p   ON mr.player_id   = p.id
      JOIN players opp ON mr.opponent_id = opp.id
      WHERE mr.fixture_id = f.id AND mr.match_type = 'league'
    ), 0) AS "liveHomePts",

    COALESCE((
      SELECT SUM(
        CASE
          WHEN p.team_id   = f.away_team_id THEN (CASE mr.result WHEN 'win' THEN 3 WHEN 'draw' THEN 1 ELSE 0 END)
          WHEN opp.team_id = f.away_team_id THEN (CASE mr.result WHEN 'win' THEN 0 WHEN 'draw' THEN 1 ELSE 3 END)
          ELSE 0
        END
      )
      FROM match_records mr
      JOIN players p   ON mr.player_id   = p.id
      JOIN players opp ON mr.opponent_id = opp.id
      WHERE mr.fixture_id = f.id AND mr.match_type = 'league'
    ), 0) AS "liveAwayPts",

    COALESCE((
      SELECT SUM(
        CASE
          WHEN p.team_id   = f.home_team_id THEN COALESCE(mr.player_score, 0)
          WHEN opp.team_id = f.home_team_id THEN COALESCE(mr.opponent_score, 0)
          ELSE 0
        END
      )
      FROM match_records mr
      JOIN players p   ON mr.player_id   = p.id
      JOIN players opp ON mr.opponent_id = opp.id
      WHERE mr.fixture_id = f.id AND mr.match_type = 'league'
    ), 0) AS "liveHomeGoals",

    COALESCE((
      SELECT SUM(
        CASE
          WHEN p.team_id   = f.away_team_id THEN COALESCE(mr.player_score, 0)
          WHEN opp.team_id = f.away_team_id THEN COALESCE(mr.opponent_score, 0)
          ELSE 0
        END
      )
      FROM match_records mr
      JOIN players p   ON mr.player_id   = p.id
      JOIN players opp ON mr.opponent_id = opp.id
      WHERE mr.fixture_id = f.id AND mr.match_type = 'league'
    ), 0) AS "liveAwayGoals",

    COALESCE((
      SELECT COUNT(*) FROM match_records mr
      WHERE mr.fixture_id = f.id AND mr.match_type = 'league'
    ), 0) AS "liveResultsLogged"

  FROM fixtures f
  JOIN teams ht ON f.home_team_id = ht.id
  JOIN teams at ON f.away_team_id = at.id
`

// GET /api/fixtures  — all fixtures; optional ?teamId= or ?status=
// GET /api/fixtures — public read (matches standings/players/records being public);
// only creating/editing/deleting fixtures requires admin login (see routes below)
router.get("/", async (req, res, next) => {
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

      // If already completed, reverse the old stats using stored goals (not match points)
      if (f.status === "completed") {
        const oldHomeResult = f.home_score > f.away_score ? "win" : f.home_score < f.away_score ? "loss" : "draw"
        const oldAwayResult = oldHomeResult === "win" ? "loss" : oldHomeResult === "loss" ? "win" : "draw"
        const oldHomeGoals  = f.home_goals ?? 0
        const oldAwayGoals  = f.away_goals ?? 0
        for (const [teamId, res, scored, conceded, oldPts] of [
          [f.home_team_id, oldHomeResult, oldHomeGoals, oldAwayGoals, f.home_score],
          [f.away_team_id, oldAwayResult, oldAwayGoals, oldHomeGoals, f.away_score],
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

      // Save new score + goals + mark completed
      await q(`
        UPDATE fixtures SET home_score = $1, away_score = $2, home_goals = $3, away_goals = $4, status = 'completed'
        WHERE id = $5
      `, [homeScore, awayScore, homeGoals, awayGoals, req.params.id])

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

// POST /api/fixtures/:id/close — admin closes a fixture once player results
// are done being logged. Points/goals were already added LIVE to each team
// as every individual player result was logged (see records.js POST/PATCH/
// DELETE /team) — this endpoint does NOT touch score_points/gf/ga again.
// It only:
//   1. Sums each team's points earned from THIS fixture's player results
//   2. Compares those two fixture-scoped totals to decide win/draw/loss
//   3. Increments played/won/drawn/lost by 1 accordingly
//   4. Stores the derived totals on the fixture itself, so the existing
//      manual "edit result" endpoint can still correctly reverse/override
//      them later exactly like it already does today
//   5. Marks the fixture completed, which is what moves the Team Dashboard
//      on to the next round
router.post("/:id/close", authenticate, adminOnly, async (req, res, next) => {
  try {
    const fixRes = await query("SELECT * FROM fixtures WHERE id = $1", [req.params.id])
    if (!fixRes.rows[0]) return res.status(404).json({ error: "Fixture not found" })
    const fix = fixRes.rows[0]
    if (fix.status === "completed") {
      return res.status(400).json({ error: "Fixture is already closed" })
    }

    const recordsRes = await query(`
      SELECT mr.result, mr.player_score, mr.opponent_score,
             p.team_id AS player_team_id, opp.team_id AS opponent_team_id
      FROM match_records mr
      JOIN players p   ON mr.player_id   = p.id
      JOIN players opp ON mr.opponent_id = opp.id
      WHERE mr.fixture_id = $1 AND mr.match_type = 'league'
    `, [req.params.id])

    // Each record represents one match between whichever side is "player"
    // and whichever side is "opponent" — checking player_team_id ALONE is
    // enough to fully determine both sides, since the opponent is always
    // on the other team of this same fixture. (A previous version of this
    // fix checked player and opponent independently, which double-counted
    // every goal since both checks fired for every normal record.)
    let homePts = 0, awayPts = 0, homeGoals = 0, awayGoals = 0
    for (const r of recordsRes.rows) {
      const playerPts = r.result === "win" ? 3 : r.result === "draw" ? 1 : 0
      const oppPts    = r.result === "win" ? 0 : r.result === "loss" ? 3 : 1
      const pScore = r.player_score ?? 0
      const oScore = r.opponent_score ?? 0

      if (r.player_team_id === fix.home_team_id) {
        // player is home, opponent is away
        homePts += playerPts; awayPts += oppPts
        homeGoals += pScore;  awayGoals += oScore
      } else if (r.player_team_id === fix.away_team_id) {
        // player is away, opponent is home
        awayPts += playerPts; homePts += oppPts
        awayGoals += pScore;  homeGoals += oScore
      }
      // If player_team_id matches neither side, this record doesn't
      // belong to this fixture's two teams — skip it rather than guess.
    }

    const homeResult = homePts > awayPts ? "win" : homePts < awayPts ? "loss" : "draw"
    const awayResult = homeResult === "win" ? "loss" : homeResult === "loss" ? "win" : "draw"

    await withTransaction(async ({ query: q }) => {
      await q(`
        UPDATE fixtures
        SET status = 'completed', home_score = $1, away_score = $2, home_goals = $3, away_goals = $4
        WHERE id = $5
      `, [homePts, awayPts, homeGoals, awayGoals, req.params.id])

      for (const [teamId, r] of [[fix.home_team_id, homeResult], [fix.away_team_id, awayResult]]) {
        await q(`
          UPDATE teams SET
            played = played + 1,
            won    = won   + $1,
            drawn  = drawn + $2,
            lost   = lost  + $3
          WHERE id = $4
        `, [r === "win" ? 1 : 0, r === "draw" ? 1 : 0, r === "loss" ? 1 : 0, teamId])
      }
    })

    // Season-end BDR awards — only fires once the WHOLE league (every
    // fixture, not just this one) is completed, and only ever once per
    // season (claimAward guarantees that even if this runs concurrently
    // from two closes at once).
    const remainingRes = await query(`SELECT COUNT(*) FROM fixtures WHERE status != 'completed'`)
    if (parseInt(remainingRes.rows[0].count) === 0) {
      const seasonRes = await query("SELECT value FROM app_settings WHERE key = 'current_season'")
      const season = parseInt(seasonRes.rows[0]?.value || "1")
      if (await claimAward("team_league_season", season)) {
        const standingsRes = await query(`SELECT id FROM teams ORDER BY score_points DESC LIMIT 4`)
        const tierPoints = [12, 9, 7, 5]
        for (let i = 0; i < standingsRes.rows.length; i++) {
          const playersRes = await query(`SELECT id FROM players WHERE team_id = $1`, [standingsRes.rows[i].id])
          for (const p of playersRes.rows) await addBdr(p.id, tierPoints[i])
        }
        // Team League Golden Boot BDR award: none (0 points) — placement
        // awards above are unaffected.
      }
    }

    const fresh = await query(FIXTURE_SELECT + " WHERE f.id = $1", [req.params.id])
    res.json(fresh.rows[0])
  } catch (err) { next(err) }
})

router.patch("/round/:round/date", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { date } = z.object({ date: z.string().min(1) }).parse(req.body)
    const round = parseInt(req.params.round)
    if (isNaN(round)) return res.status(400).json({ error: "Invalid round" })

    const result = await query(
      "UPDATE fixtures SET scheduled_date = $1 WHERE round = $2 RETURNING id",
      [date, round]
    )
    res.json({ updated: result.rows.length, round, date })
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