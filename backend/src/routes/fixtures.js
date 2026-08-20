import { Router } from "express"
import { z } from "zod"
import { query, withTransaction } from "../db/pool.js"
import { authenticate, adminOnly } from "../middleware/auth.js"
import { generatePlayoffs } from "../services/playoffs.js"
import { addBdr } from "../services/bdrAwards.js"
import { reconcileTrophyRoster, awardOrReassignTrophy } from "../services/trophyAwards.js"
import { reconcileTeamTrophy } from "../services/teamTrophyAwards.js"
import { updateSeasonRecord } from "../services/seasonRecord.js"

const router = Router()

// ── Auto-add columns to fixtures if not present ──────────────────────────────
;(async () => {
  try {
    await query("ALTER TABLE fixtures ADD COLUMN IF NOT EXISTS group_stage BOOLEAN DEFAULT FALSE")
    await query("ALTER TABLE fixtures ADD COLUMN IF NOT EXISTS grp CHAR(1)")
    await query("ALTER TABLE fixtures ADD COLUMN IF NOT EXISTS is_knockout_leg BOOLEAN DEFAULT FALSE")
    await query("ALTER TABLE fixtures ADD COLUMN IF NOT EXISTS knockout_match_id INT")
    await query("ALTER TABLE fixtures ADD COLUMN IF NOT EXISTS knockout_leg INT")
  } catch (e) { console.error("[fixtures] migration:", e.message) }
})()

// Classic "circle method" round-robin: fix one team, rotate the rest each
// round. Produces N-1 rounds (N/2 matches each) covering every pairing
// exactly once — the first half of the season. The second half is derived
// directly from the first half by simply flipping home/away for every
// pairing, guaranteeing they're always exact mirrors of each other, never
// independently generated (which could drift out of sync).
function generateDoubleRoundRobin(teamIds) {
  const teams = [...teamIds]
  const hasBye = teams.length % 2 !== 0
  if (hasBye) teams.push(null) // null = bye slot, that team sits out the round

  const n = teams.length
  const half = n / 2
  const firstHalfRounds = []
  let arr = [...teams]

  for (let r = 0; r < n - 1; r++) {
    const roundPairs = []
    for (let i = 0; i < half; i++) {
      const t1 = arr[i]
      const t2 = arr[n - 1 - i]
      if (t1 !== null && t2 !== null) {
        // Alternate which side is "home" by round parity, purely to avoid
        // one team always sitting on the same side within the first half.
        roundPairs.push(r % 2 === 0 ? [t1, t2] : [t2, t1])
      }
    }
    firstHalfRounds.push(roundPairs)

    // Rotate: keep arr[0] fixed, shift everyone else one position
    const last = arr[n - 1]
    for (let i = n - 1; i > 1; i--) arr[i] = arr[i - 1]
    arr[1] = last
  }

  const secondHalfRounds = firstHalfRounds.map(roundPairs => roundPairs.map(([h, a]) => [a, h]))
  return [...firstHalfRounds, ...secondHalfRounds]
}

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
    ), 0) AS "liveResultsLogged",

    f.group_stage AS "groupStage",
    f.grp,
    f.is_knockout_leg AS "isKnockoutLeg",
    f.knockout_match_id AS "knockoutMatchId",
    f.knockout_leg AS "knockoutLeg",
    tkm.match_type AS "knockoutMatchType"

  FROM fixtures f
  JOIN teams ht ON f.home_team_id = ht.id
  JOIN teams at ON f.away_team_id = at.id
  LEFT JOIN team_knockout_matches tkm ON f.knockout_match_id = tkm.id
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

// POST /api/fixtures/generate — auto-creates the full double round-robin
// season schedule from every current team. Accepts { format: 'league' | 'league_knockout' }
// which controls whether a playoff bracket generates after the group stage.
router.post("/generate", authenticate, adminOnly, async (req, res, next) => {
  try {
    const existingRes = await query("SELECT COUNT(*) FROM fixtures")
    if (parseInt(existingRes.rows[0].count) > 0) {
      return res.status(400).json({ error: "Fixtures already exist. Delete them first if you want to regenerate the schedule." })
    }

    const teamsRes = await query("SELECT id FROM teams ORDER BY id")
    const teamIds = teamsRes.rows.map(r => r.id)
    if (teamIds.length < 2) {
      return res.status(400).json({ error: "Need at least 2 teams to generate a schedule." })
    }

    // Save the chosen format so close-fixture knows what to do at season end
    const format = req.body.format === "league" ? "league"
                 : req.body.format === "group_knockout" ? "group_knockout"
                 : "league_knockout"
    await query(`
      INSERT INTO app_settings (key, value) VALUES ('team_league_format', $1)
      ON CONFLICT (key) DO UPDATE SET value = $1
    `, [format])

    let fixturesCreated = 0

    if (format === "group_knockout") {
      const seasonRes = await query("SELECT value FROM app_settings WHERE key = 'current_season'")
      const season = parseInt(seasonRes.rows[0]?.value || "1")

      // Read group assignments from TLG (most recent TLG season)
      const tlgRes = await query(`
        SELECT gt.team_id, g.name AS grp
        FROM tlg_group_teams gt
        JOIN tlg_groups g ON g.id = gt.group_id
        JOIN tlg_seasons s ON s.id = g.season_id
        WHERE s.season_number = $1
        ORDER BY g.name ASC, gt.seed ASC
      `, [season])

      if (tlgRes.rows.length === 0) {
        return res.status(400).json({ error: "No TLG group assignments found for this season. Please do the TLG draw first." })
      }

      const groupA = tlgRes.rows.filter(r => r.grp === "A").map(r => r.team_id)
      const groupB = tlgRes.rows.filter(r => r.grp === "B").map(r => r.team_id)

      if (groupA.length !== 4 || groupB.length !== 4) {
        return res.status(400).json({ error: `TLG groups must have exactly 4 teams each (Group A: ${groupA.length}, Group B: ${groupB.length})` })
      }

      // Store group assignments in fixture_groups for knockout use
      for (const tid of groupA) {
        await query(`
          INSERT INTO fixture_groups (team_id, season_number, grp)
          VALUES ($1, $2, 'A')
          ON CONFLICT (team_id, season_number) DO UPDATE SET grp = 'A'
        `, [tid, season])
      }
      for (const tid of groupB) {
        await query(`
          INSERT INTO fixture_groups (team_id, season_number, grp)
          VALUES ($1, $2, 'B')
          ON CONFLICT (team_id, season_number) DO UPDATE SET grp = 'B'
        `, [tid, season])
      }

      // Generate home+away fixtures within each group
      const generateGroupFixtures = async (groupTeams, grpLetter) => {
        const groupRounds = generateDoubleRoundRobin(groupTeams)
        for (let i = 0; i < groupRounds.length; i++) {
          for (const [homeId, awayId] of groupRounds[i]) {
            await query(
              "INSERT INTO fixtures (home_team_id, away_team_id, round, scheduled_date, group_stage, grp) VALUES ($1, $2, $3, CURRENT_DATE, true, $4)",
              [homeId, awayId, i + 1, grpLetter]
            )
            fixturesCreated++
          }
        }
      }

      await generateGroupFixtures(groupA, "A")
      await generateGroupFixtures(groupB, "B")

      return res.json({ success: true, format, groupA, groupB, fixturesGenerated: fixturesCreated })
    }

    const rounds = generateDoubleRoundRobin(teamIds)
    for (let i = 0; i < rounds.length; i++) {
      const roundNumber = i + 1
      for (const [homeId, awayId] of rounds[i]) {
        await query(
          "INSERT INTO fixtures (home_team_id, away_team_id, round, scheduled_date) VALUES ($1, $2, $3, CURRENT_DATE)",
          [homeId, awayId, roundNumber]
        )
        fixturesCreated++
      }
    }

    res.json({ success: true, format, roundsGenerated: rounds.length, fixturesGenerated: fixturesCreated })
  } catch (err) { next(err) }
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

      // Only update played/won/drawn/lost for GROUP STAGE fixtures.
      // Knockout leg fixtures don't count toward league standings.
      if (!fix.is_knockout_leg) {
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
      }
    })

    // ── Auto-update knockout match when a leg fixture is closed ─────────────
    if (fix.is_knockout_leg && fix.knockout_match_id) {
      const { determineKnockoutWinner, advanceKnockoutWinner } = await import("../services/knockoutLogic.js")
      const km = (await query("SELECT * FROM team_knockout_matches WHERE id = $1", [fix.knockout_match_id])).rows[0]
      if (km) {
        // Store actual GOALS in leg columns for GD calculation
        const t1IsHome  = fix.home_team_id === km.team1_id
        const t1Goals   = t1IsHome ? homeGoals : awayGoals
        const t2Goals   = t1IsHome ? awayGoals : homeGoals
        const legCol    = fix.knockout_leg === 1
          ? "team1_leg1 = $1, team2_leg1 = $2"
          : "team1_leg2 = $1, team2_leg2 = $2"
        await query(`UPDATE team_knockout_matches SET ${legCol} WHERE id = $3`, [t1Goals, t2Goals, km.id])

        // Check if both legs are now complete
        const fresh = (await query("SELECT * FROM team_knockout_matches WHERE id = $1", [km.id])).rows[0]
        if (fresh.team1_leg1 !== null && fresh.team1_leg2 !== null) {
          const winnerId = determineKnockoutWinner(fresh)
          if (winnerId) {
            await query("UPDATE team_knockout_matches SET winner_id = $1, status = 'completed' WHERE id = $2", [winnerId, km.id])
            await advanceKnockoutWinner(fresh, winnerId)
          } else {
            // Tied on GD — admin must pick manually
            await query("UPDATE team_knockout_matches SET status = 'needs_decision' WHERE id = $1", [km.id])
          }
        }
      }
    }

    // When all GROUP STAGE fixtures are complete, check format and act accordingly
    // Knockout leg fixtures (is_knockout_leg=true) are handled separately
    const remainingRes = await query(`SELECT COUNT(*) FROM fixtures WHERE status != 'completed' AND group_stage = true`)
    if (parseInt(remainingRes.rows[0].count) === 0) {
      const seasonRes  = await query("SELECT value FROM app_settings WHERE key = 'current_season'")
      const formatRes  = await query("SELECT value FROM app_settings WHERE key = 'team_league_format'")
      const season     = parseInt(seasonRes.rows[0]?.value || "1")
      const format     = formatRes.rows[0]?.value || "league_knockout"

      if (format === "league") {
        // League-only: top of the table wins immediately — award trophies now
        // Import the trophy service inline to avoid circular deps
        const { reconcileTrophyRoster } = await import("../services/trophyAwards.js")

        // Find the team with the most points from the live standings
        const champRes = await query(`
          WITH fixture_scores AS (
            SELECT
              f.home_team_id, f.away_team_id,
              SUM(CASE WHEN p.team_id = f.home_team_id THEN CASE mr.result WHEN 'win' THEN 3 WHEN 'draw' THEN 1 ELSE 0 END
                       WHEN p.team_id = f.away_team_id THEN CASE mr.result WHEN 'loss' THEN 3 WHEN 'draw' THEN 1 ELSE 0 END ELSE 0 END) AS home_pts,
              SUM(CASE WHEN p.team_id = f.away_team_id THEN CASE mr.result WHEN 'win' THEN 3 WHEN 'draw' THEN 1 ELSE 0 END
                       WHEN p.team_id = f.home_team_id THEN CASE mr.result WHEN 'loss' THEN 3 WHEN 'draw' THEN 1 ELSE 0 END ELSE 0 END) AS away_pts,
              SUM(CASE WHEN p.team_id = f.home_team_id THEN mr.player_score WHEN p.team_id = f.away_team_id THEN mr.opponent_score ELSE 0 END) AS home_gf,
              SUM(CASE WHEN p.team_id = f.away_team_id THEN mr.player_score WHEN p.team_id = f.home_team_id THEN mr.opponent_score ELSE 0 END) AS away_gf
            FROM fixtures f
            LEFT JOIN match_records mr ON mr.fixture_id = f.id AND mr.match_type::text = 'league' AND mr.season_number = $1
            LEFT JOIN players p ON p.id = mr.player_id
            GROUP BY f.home_team_id, f.away_team_id
          ),
          team_pts AS (
            SELECT home_team_id AS team_id,
              SUM(CASE WHEN home_pts > away_pts THEN home_pts ELSE home_pts END) AS pts,
              SUM(home_gf) AS gf
            FROM fixture_scores GROUP BY home_team_id
            UNION ALL
            SELECT away_team_id,
              SUM(away_pts), SUM(away_gf)
            FROM fixture_scores GROUP BY away_team_id
          ),
          totals AS (
            SELECT team_id, SUM(pts) AS total_pts, SUM(gf) AS total_gf
            FROM team_pts GROUP BY team_id
          )
          SELECT t.id, t.name FROM totals tot
          JOIN teams t ON t.id = tot.team_id
          ORDER BY tot.total_pts DESC, tot.total_gf DESC LIMIT 1
        `, [season])

        if (champRes.rows[0]) {
          const champTeam  = champRes.rows[0]
          const playersRes = await query("SELECT id FROM players WHERE team_id = $1", [champTeam.id])
          const playerIds  = playersRes.rows.map(r => r.id)

          // Award Team League trophy to every player on the champion team
          await reconcileTrophyRoster({
            sourceKey:    `tl-champion-league-only-s${season}`,
            trophyColumn: "trophy2_count",
            playerIds,
            seasonNumber: season,
          })

          // Award Team League Golden Boot (trophy6_count) to top scorer
          const { awardOrReassignTrophy } = await import("../services/trophyAwards.js")
          const goldenBootRes = await query(`
            SELECT p.id,
              COALESCE(SUM(CASE
                WHEN mr.player_id   = p.id THEN mr.player_score
                WHEN mr.opponent_id = p.id THEN mr.opponent_score
                ELSE 0 END), 0) AS goals
            FROM players p
            LEFT JOIN match_records mr
              ON (mr.player_id = p.id OR mr.opponent_id = p.id)
              AND mr.match_type::text = 'league'
              AND mr.season_number = $1
            GROUP BY p.id
            ORDER BY goals DESC LIMIT 1
          `, [season])
          const goldenBoot = goldenBootRes.rows[0]
          await awardOrReassignTrophy({
            sourceKey:    `tl-golden-boot-league-only-s${season}`,
            trophyColumn: "trophy6_count",
            playerId:     goldenBoot?.goals > 0 ? goldenBoot.id : null,
            seasonNumber: season,
          })

          // Allocate BDR points based on final league standings
          // Use teams.points directly — same source as the league table display
          const standingsRes = await query(`
            SELECT id AS team_id,
              ROW_NUMBER() OVER (ORDER BY points DESC, goals_for - goals_against DESC, goals_for DESC) AS pos
            FROM teams
            ORDER BY points DESC
            LIMIT 8
          `)

          const bdrByPos = { 1: 12, 2: 9, 3: 7, 4: 5 }
          for (const row of standingsRes.rows) {
            const bdr = bdrByPos[row.pos] || 0
            if (bdr > 0) {
              const teamPlayers = await query("SELECT id FROM players WHERE team_id = $1", [row.team_id])
              for (const p of teamPlayers.rows) await addBdr(p.id, bdr)
            }
          }

          // Store champion team ID so the frontend celebration can detect it
          // (without a playoff Final to watch, the frontend needs another signal)
          await query(`
            INSERT INTO app_settings (key, value) VALUES ('league_only_champion_team_id', $1)
            ON CONFLICT (key) DO UPDATE SET value = $1
          `, [String(champTeam.id)])
          // Store completion timestamp for 48-hour celebration window
          await query(`
            INSERT INTO app_settings (key, value) VALUES ('league_champion_completed_at', $1)
            ON CONFLICT (key) DO UPDATE SET value = $1
          `, [new Date().toISOString()])

          // ── Auto-award Team League trophy to winning team (league-only format) ──
          await reconcileTeamTrophy({
            tournament:   "team_league",
            teamId:       champTeam.id,
            seasonNumber: season,
          })

          // ── Auto-fill season record — team league winner ─────────────────
          const tlPlayersRes = await query("SELECT name FROM players WHERE team_id = $1", [champTeam.id])
          await updateSeasonRecord(season, {
            team_league_winner:  champTeam.name,
            team_league_players: tlPlayersRes.rows.map(r => r.name),
          })
        }
      } else {
        // League + Knockout: generate the playoff bracket as before
        await generatePlayoffs(season)
      }
    }

    const fresh = await query(FIXTURE_SELECT + " WHERE f.id = $1", [req.params.id])
    res.json(fresh.rows[0])
  } catch (err) { next(err) }
})

// GET /api/fixtures/group-standings — public group standings for group_knockout format
router.get("/group-standings", async (req, res, next) => {
  try {
    const seasonRes = await query("SELECT value FROM app_settings WHERE key = 'current_season'")
    const season = parseInt(seasonRes.rows[0]?.value || "1")

    // Mirrors the teams-list CTE: for COMPLETED fixtures, use the stored
    // home_score/away_score (which are the summed match-points totals).
    // For UPCOMING fixtures that already have player results being logged,
    // derive the live score from match_records — exactly how the main
    // league table works so both views stay in sync.
    const result = await query(`
      WITH fixture_scores AS (
        SELECT
          f.id,
          f.home_team_id,
          f.away_team_id,
          f.status,
          f.home_goals,
          f.away_goals,
          -- Home match-points: use stored value once closed, else sum live records
          CASE
            WHEN f.status = 'completed' THEN COALESCE(f.home_score, 0)
            ELSE COALESCE(SUM(
              CASE
                WHEN COALESCE(mr.team_id, p.team_id) = f.home_team_id
                  THEN CASE mr.result WHEN 'win' THEN 3 WHEN 'draw' THEN 1 ELSE 0 END
                WHEN COALESCE(mr.team_id, p.team_id) = f.away_team_id
                  THEN CASE mr.result WHEN 'loss' THEN 3 WHEN 'draw' THEN 1 ELSE 0 END
                ELSE 0
              END
            ), 0)
          END AS home_pts,
          -- Away match-points
          CASE
            WHEN f.status = 'completed' THEN COALESCE(f.away_score, 0)
            ELSE COALESCE(SUM(
              CASE
                WHEN COALESCE(mr.team_id, p.team_id) = f.away_team_id
                  THEN CASE mr.result WHEN 'win' THEN 3 WHEN 'draw' THEN 1 ELSE 0 END
                WHEN COALESCE(mr.team_id, p.team_id) = f.home_team_id
                  THEN CASE mr.result WHEN 'loss' THEN 3 WHEN 'draw' THEN 1 ELSE 0 END
                ELSE 0
              END
            ), 0)
          END AS away_pts,
          -- Goals for home side
          CASE
            WHEN f.status = 'completed' THEN COALESCE(f.home_goals, 0)
            ELSE COALESCE(SUM(
              CASE
                WHEN COALESCE(mr.team_id, p.team_id) = f.home_team_id THEN mr.player_score
                WHEN COALESCE(mr.team_id, p.team_id) = f.away_team_id THEN mr.opponent_score
                ELSE 0
              END
            ), 0)
          END AS live_home_goals,
          -- Goals for away side
          CASE
            WHEN f.status = 'completed' THEN COALESCE(f.away_goals, 0)
            ELSE COALESCE(SUM(
              CASE
                WHEN COALESCE(mr.team_id, p.team_id) = f.away_team_id THEN mr.player_score
                WHEN COALESCE(mr.team_id, p.team_id) = f.home_team_id THEN mr.opponent_score
                ELSE 0
              END
            ), 0)
          END AS live_away_goals,
          CASE WHEN f.status = 'completed' THEN 1 ELSE COUNT(mr.id) END AS results_logged
        FROM fixtures f
        LEFT JOIN match_records mr
          ON mr.fixture_id = f.id
          AND mr.match_type = 'league'
          AND mr.season_number = $1
        LEFT JOIN players p ON p.id = mr.player_id
        WHERE f.group_stage = true
        GROUP BY f.id, f.home_team_id, f.away_team_id, f.status,
                 f.home_score, f.away_score, f.home_goals, f.away_goals
      ),
      fixture_outcomes AS (
        SELECT *,
          CASE
            WHEN results_logged = 0 THEN NULL
            WHEN home_pts > away_pts THEN 'home'
            WHEN away_pts > home_pts THEN 'away'
            ELSE 'draw'
          END AS outcome
        FROM fixture_scores
      ),
      per_team AS (
        -- Home side perspective
        SELECT home_team_id AS team_id, live_home_goals AS gf, live_away_goals AS ga, home_pts AS pts, outcome,
          (outcome = 'home') AS won, (outcome = 'draw') AS drawn, (outcome = 'away') AS lost
        FROM fixture_outcomes WHERE outcome IS NOT NULL
        UNION ALL
        -- Away side perspective
        SELECT away_team_id AS team_id, live_away_goals AS gf, live_home_goals AS ga, away_pts AS pts, outcome,
          (outcome = 'away') AS won, (outcome = 'draw') AS drawn, (outcome = 'home') AS lost
        FROM fixture_outcomes WHERE outcome IS NOT NULL
      ),
      team_stats AS (
        SELECT team_id,
          COUNT(*) AS played,
          COUNT(*) FILTER (WHERE won)   AS won,
          COUNT(*) FILTER (WHERE drawn) AS drawn,
          COUNT(*) FILTER (WHERE lost)  AS lost,
          COALESCE(SUM(gf), 0) AS gf,
          COALESCE(SUM(ga), 0) AS ga,
          COALESCE(SUM(pts), 0) AS pts
        FROM per_team
        GROUP BY team_id
      )
      SELECT
        fg.grp,
        t.id       AS "teamId",
        t.name     AS "teamName",
        t.logo_url AS "logoUrl",
        COALESCE(ts.played, 0)::int AS played,
        COALESCE(ts.won,    0)::int AS won,
        COALESCE(ts.drawn,  0)::int AS drawn,
        COALESCE(ts.lost,   0)::int AS lost,
        COALESCE(ts.gf,     0)::int AS gf,
        COALESCE(ts.ga,     0)::int AS ga,
        (COALESCE(ts.gf, 0) - COALESCE(ts.ga, 0))::int AS gd,
        COALESCE(ts.pts,    0)::int AS pts,
        -- Player matches logged in the CURRENT round fixture for this team.
        -- Current round = lowest round where status != 'completed' (same logic as
        -- TeamResults.jsx). Falls back to MAX(round) when all fixtures are done.
        COALESCE((
          SELECT COUNT(mr.id)
          FROM match_records mr
          JOIN fixtures f2 ON f2.id = mr.fixture_id
          WHERE (f2.home_team_id = t.id OR f2.away_team_id = t.id)
            AND f2.group_stage = true
            AND f2.round = (
              SELECT COALESCE(
                MIN(f3.round) FILTER (WHERE f3.status != 'completed'),
                MAX(f3.round)
              )
              FROM fixtures f3
              WHERE (f3.home_team_id = t.id OR f3.away_team_id = t.id)
                AND f3.group_stage = true
            )
            AND mr.match_type = 'league'
            AND mr.season_number = $1
        ), 0)::int AS "currentMatchesLogged",
        -- Number of players in this team
        (SELECT COUNT(*) FROM players p3 WHERE p3.team_id = t.id)::int AS "teamPlayerCount" 
      FROM fixture_groups fg
      JOIN teams t ON t.id = fg.team_id
      LEFT JOIN team_stats ts ON ts.team_id = t.id
      WHERE fg.season_number = $1
      ORDER BY fg.grp ASC, pts DESC, gd DESC, gf DESC
    `, [season])

    const groups = { A: [], B: [] }
    for (const row of result.rows) {
      const grp = row.grp?.trim()
      if (groups[grp]) groups[grp].push(row)
    }
    res.json(groups)
  } catch (err) { next(err) }
})
router.get("/format/public", async (req, res, next) => {
  try {
    const [formatRes, champRes] = await Promise.all([
      query("SELECT value FROM app_settings WHERE key = 'team_league_format'"),
      query("SELECT value FROM app_settings WHERE key = 'league_only_champion_team_id'"),
    ])
    res.json({
      format: formatRes.rows[0]?.value || "league_knockout",
      leagueOnlyChampionTeamId: champRes.rows[0]?.value ? parseInt(champRes.rows[0].value) : null,
    })
  } catch (err) { next(err) }
})

// GET /api/fixtures/format — admin version with pending fixture counts
router.get("/format", authenticate, adminOnly, async (req, res, next) => {
  try {
    const [formatRes, pendingRes, totalRes, champRes] = await Promise.all([
      query("SELECT value FROM app_settings WHERE key = 'team_league_format'"),
      query("SELECT COUNT(*) FROM fixtures WHERE status != 'completed'"),
      query("SELECT COUNT(*) FROM fixtures"),
      query("SELECT value FROM app_settings WHERE key = 'league_only_champion_team_id'"),
    ])
    res.json({
      format: formatRes.rows[0]?.value || "league_knockout",
      pendingFixtures: parseInt(pendingRes.rows[0].count),
      totalFixtures: parseInt(totalRes.rows[0].count),
      leagueOnlyChampionTeamId: champRes.rows[0]?.value ? parseInt(champRes.rows[0].value) : null,
    })
  } catch (err) { next(err) }
})

// PATCH /api/fixtures/format — change the team league format mid-season.
// Allowed any time while at least one fixture is still not completed.
// POST /api/fixtures/:id/reopen — admin reopens a completed fixture so team owners
// can continue logging player results. Reverses the played/won/drawn/lost team stats
// that were applied when the fixture was closed.
router.post("/:id/reopen", authenticate, adminOnly, async (req, res, next) => {
  try {
    const fixRes = await query("SELECT * FROM fixtures WHERE id = $1", [parseInt(req.params.id)])
    if (!fixRes.rows[0]) return res.status(404).json({ error: "Fixture not found" })
    const fix = fixRes.rows[0]
    if (fix.status !== "completed") {
      return res.status(400).json({ error: "Fixture is not completed — nothing to reopen" })
    }

    const homeScore = fix.home_score ?? 0
    const awayScore = fix.away_score ?? 0
    const homeResult = homeScore > awayScore ? "win" : homeScore < awayScore ? "loss" : "draw"
    const awayResult = homeResult === "win" ? "loss" : homeResult === "loss" ? "win" : "draw"

    await withTransaction(async ({ query: q }) => {
      // Reverse the played/won/drawn/lost that were applied on close
      for (const [teamId, result] of [
        [fix.home_team_id, homeResult],
        [fix.away_team_id, awayResult],
      ]) {
        await q(`
          UPDATE teams SET
            played = GREATEST(played - 1, 0),
            won    = GREATEST(won    - $1, 0),
            drawn  = GREATEST(drawn  - $2, 0),
            lost   = GREATEST(lost   - $3, 0)
          WHERE id = $4
        `, [result === "win" ? 1 : 0, result === "draw" ? 1 : 0, result === "loss" ? 1 : 0, teamId])
      }

      // Reset fixture back to upcoming, clear stored scores
      await q(`
        UPDATE fixtures
        SET status = 'upcoming', home_score = NULL, away_score = NULL,
            home_goals = NULL, away_goals = NULL
        WHERE id = $1
      `, [fix.id])

      // If this was a knockout leg, also clear the leg score on the knockout match
      if (fix.is_knockout_leg && fix.knockout_match_id) {
        const legCol = fix.knockout_leg === 1
          ? "team1_leg1 = NULL, team2_leg1 = NULL"
          : "team1_leg2 = NULL, team2_leg2 = NULL"
        await q(`UPDATE team_knockout_matches SET ${legCol}, status = 'pending', winner_id = NULL WHERE id = $1`, [fix.knockout_match_id])
      }
    })

    const fresh = await query(FIXTURE_SELECT + " WHERE f.id = $1", [fix.id])
    res.json(fresh.rows[0])
  } catch (err) { next(err) }
})

// Locked once the last fixture is closed (that's when the format triggers).
router.patch("/format", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { format } = req.body
    if (!["league", "league_knockout"].includes(format)) {
      return res.status(400).json({ error: "Format must be 'league' or 'league_knockout'" })
    }

    // Check if any fixtures still pending — if all done, it's too late to change
    const pendingRes = await query(`SELECT COUNT(*) FROM fixtures WHERE status != 'completed'`)
    const pending = parseInt(pendingRes.rows[0].count)
    if (pending === 0) {
      return res.status(400).json({ error: "Cannot change format — all fixtures are already completed." })
    }

    await query(`
      INSERT INTO app_settings (key, value) VALUES ('team_league_format', $1)
      ON CONFLICT (key) DO UPDATE SET value = $1
    `, [format])

    res.json({ success: true, format, pendingFixtures: pending })
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