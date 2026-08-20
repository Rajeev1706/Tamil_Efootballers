// backend/src/routes/teamKnockout.js
// Team Knockout — Champions + Europa brackets generated from Team League
// group stage final standings (group_knockout format only).
//
// Match types:
//   champions_sf1, champions_sf2, champions_final, champions_3rd
//   europa_sf1,    europa_sf2,    europa_final,    europa_7th
//
// Each match now has 2 legs created as rows in the `fixtures` table after the
// admin runs the toss (coin flip) and picks home leg.  Team owners log player
// results through their Team Dashboard exactly like group-stage fixtures.
// When admin closes each leg fixture, scores auto-update here and the winner
// is determined by aggregate GD (goals), falling back to "needs_decision" for a tie.

import { Router } from "express"
import { z } from "zod"
import { query, withTransaction } from "../db/pool.js"
import { authenticate, adminOnly } from "../middleware/auth.js"
import { determineKnockoutWinner, advanceKnockoutWinner } from "../services/knockoutLogic.js"

const router = Router()

// ── Auto-create / migrate tables ─────────────────────────────────────────────
;(async () => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS fixture_groups (
        id            SERIAL PRIMARY KEY,
        team_id       INT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        season_number INT NOT NULL,
        grp           CHAR(1) NOT NULL CHECK (grp IN ('A','B')),
        UNIQUE(team_id, season_number)
      )
    `)
    await query(`
      CREATE TABLE IF NOT EXISTS team_knockout_matches (
        id              SERIAL PRIMARY KEY,
        season_number   INT NOT NULL,
        match_type      TEXT NOT NULL,
        team1_id        INT REFERENCES teams(id) ON DELETE SET NULL,
        team2_id        INT REFERENCES teams(id) ON DELETE SET NULL,
        team1_leg1      INT,
        team1_leg2      INT,
        team2_leg1      INT,
        team2_leg2      INT,
        winner_id       INT REFERENCES teams(id) ON DELETE SET NULL,
        status          TEXT NOT NULL DEFAULT 'pending',
        toss_done       BOOLEAN DEFAULT false,
        toss_winner_id  INT REFERENCES teams(id) ON DELETE SET NULL,
        home_choice     TEXT CHECK (home_choice IN ('leg1','leg2')),
        leg1_fixture_id INT,
        leg2_fixture_id INT,
        created_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    // Add toss columns to existing tables (safe if already present)
    for (const sql of [
      `ALTER TABLE team_knockout_matches ADD COLUMN IF NOT EXISTS toss_done BOOLEAN DEFAULT false`,
      `ALTER TABLE team_knockout_matches ADD COLUMN IF NOT EXISTS toss_winner_id INT REFERENCES teams(id) ON DELETE SET NULL`,
      `ALTER TABLE team_knockout_matches ADD COLUMN IF NOT EXISTS home_choice TEXT`,
      `ALTER TABLE team_knockout_matches ADD COLUMN IF NOT EXISTS leg1_fixture_id INT`,
      `ALTER TABLE team_knockout_matches ADD COLUMN IF NOT EXISTS leg2_fixture_id INT`,
    ]) { await query(sql).catch(() => {}) }
  } catch (e) { console.error("[teamKnockout] migration:", e.message) }
})()

// ── Helper: get final group standings ────────────────────────────────────────
async function getGroupStandings(season) {
  const result = await query(`
    SELECT
      fg.grp,
      t.id   AS team_id,
      t.name AS team_name,
      t.logo_url AS "logoUrl",
      COALESCE(SUM(
        CASE
          WHEN f.home_team_id = t.id AND f.home_score > f.away_score  THEN 3
          WHEN f.away_team_id = t.id AND f.away_score > f.home_score  THEN 3
          WHEN f.home_score = f.away_score                             THEN 1
          ELSE 0
        END
      ), 0) AS pts,
      COALESCE(SUM(
        CASE
          WHEN f.home_team_id = t.id THEN f.home_score - f.away_score
          WHEN f.away_team_id = t.id THEN f.away_score - f.home_score
          ELSE 0
        END
      ), 0) AS gd,
      COALESCE(SUM(
        CASE
          WHEN f.home_team_id = t.id THEN f.home_score
          WHEN f.away_team_id = t.id THEN f.away_score
          ELSE 0
        END
      ), 0) AS gf
    FROM fixture_groups fg
    JOIN teams t ON t.id = fg.team_id
    LEFT JOIN fixtures f
      ON (f.home_team_id = t.id OR f.away_team_id = t.id)
      AND f.status = 'completed'
      AND f.group_stage = true
    WHERE fg.season_number = $1
    GROUP BY fg.grp, t.id, t.name, t.logo_url
    ORDER BY fg.grp ASC, pts DESC, gd DESC, gf DESC
  `, [season])

  const groups = { A: [], B: [] }
  for (const row of result.rows) groups[row.grp].push(row)
  return groups
}

// ── Full match SELECT ─────────────────────────────────────────────────────────
const MATCH_SELECT = `
  SELECT
    tkm.*,
    t1.name AS "team1Name", t1.logo_url AS "team1Logo",
    t2.name AS "team2Name", t2.logo_url AS "team2Logo",
    tw.name AS "tossWinnerName",
    w.name  AS "winnerName",  w.logo_url AS "winnerLogo"
  FROM team_knockout_matches tkm
  LEFT JOIN teams t1 ON t1.id = tkm.team1_id
  LEFT JOIN teams t2 ON t2.id = tkm.team2_id
  LEFT JOIN teams tw ON tw.id = tkm.toss_winner_id
  LEFT JOIN teams w  ON w.id  = tkm.winner_id
`

// ── GET /api/team-knockout/current ───────────────────────────────────────────
router.get("/current", async (req, res, next) => {
  try {
    const seasonRes = await query("SELECT value FROM app_settings WHERE key = 'current_season'")
    const season = parseInt(seasonRes.rows[0]?.value || "1")

    const matches = await query(
      MATCH_SELECT + " WHERE tkm.season_number = $1 ORDER BY tkm.id ASC", [season]
    )
    const groups = await getGroupStandings(season).catch(() => ({ A: [], B: [] }))
    res.json({ season, matches: matches.rows, groups })
  } catch (err) { next(err) }
})

// ── POST /api/team-knockout/generate ─────────────────────────────────────────
router.post("/generate", authenticate, adminOnly, async (req, res, next) => {
  try {
    const seasonRes = await query("SELECT value FROM app_settings WHERE key = 'current_season'")
    const season = parseInt(seasonRes.rows[0]?.value || "1")

    const formatRes = await query("SELECT value FROM app_settings WHERE key = 'team_league_format'")
    if (formatRes.rows[0]?.value !== "group_knockout") {
      return res.status(400).json({ error: "Team League format must be 'group_knockout'" })
    }

    const existingRes = await query("SELECT COUNT(*) FROM team_knockout_matches WHERE season_number = $1", [season])
    if (parseInt(existingRes.rows[0].count) > 0) {
      return res.status(400).json({ error: "Knockout fixtures already generated. Delete them first." })
    }

    const pendingRes = await query("SELECT COUNT(*) FROM fixtures WHERE group_stage = true AND status != 'completed'")
    if (parseInt(pendingRes.rows[0].count) > 0) {
      return res.status(400).json({ error: `${pendingRes.rows[0].count} group stage fixtures still pending.` })
    }

    const groups = await getGroupStandings(season)
    const A = groups.A, B = groups.B
    if (A.length < 4 || B.length < 4) {
      return res.status(400).json({ error: "Each group must have at least 4 teams" })
    }

    // Champions: A1 vs B2, B1 vs A2 → Final
    // Europa:    A3 vs B4, B3 vs A4 → Final
    const matchesToCreate = [
      { match_type: "champions_sf1",   team1_id: A[0].team_id, team2_id: B[1].team_id },
      { match_type: "champions_sf2",   team1_id: B[0].team_id, team2_id: A[1].team_id },
      { match_type: "champions_final", team1_id: null,          team2_id: null          },
      { match_type: "champions_3rd",   team1_id: null,          team2_id: null          },
      { match_type: "europa_sf1",      team1_id: A[2].team_id, team2_id: B[3].team_id },
      { match_type: "europa_sf2",      team1_id: B[2].team_id, team2_id: A[3].team_id },
      { match_type: "europa_final",    team1_id: null,          team2_id: null          },
      { match_type: "europa_7th",      team1_id: null,          team2_id: null          },
    ]

    for (const m of matchesToCreate) {
      await query(
        `INSERT INTO team_knockout_matches (season_number, match_type, team1_id, team2_id, status)
         VALUES ($1, $2, $3, $4, 'pending')`,
        [season, m.match_type, m.team1_id, m.team2_id]
      )
    }

    const created = await query(MATCH_SELECT + " WHERE tkm.season_number = $1 ORDER BY tkm.id ASC", [season])
    res.status(201).json({ success: true, matches: created.rows })
  } catch (err) { next(err) }
})

// ── POST /api/team-knockout/matches/:matchId/toss ────────────────────────────
// Randomly picks the toss winner. Saved permanently — re-running is rejected.
router.post("/matches/:matchId/toss", authenticate, adminOnly, async (req, res, next) => {
  try {
    const matchRes = await query(
      MATCH_SELECT + " WHERE tkm.id = $1", [parseInt(req.params.matchId)]
    )
    const match = matchRes.rows[0]
    if (!match) return res.status(404).json({ error: "Match not found" })
    if (!match.team1_id || !match.team2_id) {
      return res.status(400).json({ error: "Both teams must be set before tossing" })
    }
    if (match.toss_done) {
      return res.status(400).json({ error: "Toss already done for this match" })
    }

    // Random winner — server-side so it can't be manipulated
    const winnerId = Math.random() < 0.5 ? match.team1_id : match.team2_id

    await query(
      `UPDATE team_knockout_matches SET toss_done = true, toss_winner_id = $1 WHERE id = $2`,
      [winnerId, match.id]
    )

    const fresh = (await query(MATCH_SELECT + " WHERE tkm.id = $1", [match.id])).rows[0]
    res.json({ success: true, match: fresh })
  } catch (err) { next(err) }
})

// ── POST /api/team-knockout/matches/:matchId/toss/choice ─────────────────────
// Admin picks home leg for the toss winner. Creates 2 fixture rows so team
// owners can log player results via the Team Dashboard.
router.post("/matches/:matchId/toss/choice", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { homeChoice } = z.object({
      homeChoice: z.enum(["leg1", "leg2"]),
    }).parse(req.body)

    const matchRes = await query(
      MATCH_SELECT + " WHERE tkm.id = $1", [parseInt(req.params.matchId)]
    )
    const match = matchRes.rows[0]
    if (!match)            return res.status(404).json({ error: "Match not found" })
    if (!match.toss_done)  return res.status(400).json({ error: "Run the toss first" })
    if (match.home_choice) return res.status(400).json({ error: "Home choice already set" })

    const tossWinner = match.toss_winner_id
    const otherTeam  = tossWinner === match.team1_id ? match.team2_id : match.team1_id

    // homeChoice = 'leg1' → toss winner plays home in Leg 1, away in Leg 2
    const leg1Home = homeChoice === "leg1" ? tossWinner : otherTeam
    const leg1Away = homeChoice === "leg1" ? otherTeam  : tossWinner
    const leg2Home = homeChoice === "leg1" ? otherTeam  : tossWinner
    const leg2Away = homeChoice === "leg1" ? tossWinner : otherTeam

    // Round numbers: SF = 7/8, Final/3rd = 9/10
    const isSF = match.match_type.includes("_sf")
    const leg1Round = isSF ? 7 : 9
    const leg2Round = isSF ? 8 : 10
    const today = new Date().toISOString().split("T")[0]

    await withTransaction(async ({ query: q }) => {
      const leg1 = await q(`
        INSERT INTO fixtures
          (home_team_id, away_team_id, round, status, scheduled_date,
           group_stage, is_knockout_leg, knockout_match_id, knockout_leg)
        VALUES ($1, $2, $3, 'upcoming', $4, false, true, $5, 1)
        RETURNING id
      `, [leg1Home, leg1Away, leg1Round, today, match.id])

      const leg2 = await q(`
        INSERT INTO fixtures
          (home_team_id, away_team_id, round, status, scheduled_date,
           group_stage, is_knockout_leg, knockout_match_id, knockout_leg)
        VALUES ($1, $2, $3, 'upcoming', $4, false, true, $5, 2)
        RETURNING id
      `, [leg2Home, leg2Away, leg2Round, today, match.id])

      await q(`
        UPDATE team_knockout_matches
        SET home_choice = $1, leg1_fixture_id = $2, leg2_fixture_id = $3
        WHERE id = $4
      `, [homeChoice, leg1.rows[0].id, leg2.rows[0].id, match.id])
    })

    const fresh = (await query(MATCH_SELECT + " WHERE tkm.id = $1", [match.id])).rows[0]
    res.json({ success: true, match: fresh })
  } catch (err) { next(err) }
})

// ── POST /api/team-knockout/matches/:matchId/force-winner ─────────────────────
// Manual tie-breaker: admin picks winner when GD is equal after both legs.
router.post("/matches/:matchId/force-winner", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { winnerId } = z.object({ winnerId: z.number().int().positive() }).parse(req.body)

    const matchRes = await query("SELECT * FROM team_knockout_matches WHERE id = $1", [parseInt(req.params.matchId)])
    const match = matchRes.rows[0]
    if (!match) return res.status(404).json({ error: "Match not found" })
    if (match.status === "completed") return res.status(400).json({ error: "Match already completed" })
    if (winnerId !== match.team1_id && winnerId !== match.team2_id) {
      return res.status(400).json({ error: "Winner must be one of the two teams in this match" })
    }

    await query(
      "UPDATE team_knockout_matches SET winner_id = $1, status = 'completed' WHERE id = $2",
      [winnerId, match.id]
    )
    await advanceKnockoutWinner(match, winnerId)

    const fresh = (await query(MATCH_SELECT + " WHERE tkm.id = $1", [match.id])).rows[0]
    res.json({ success: true, match: fresh })
  } catch (err) { next(err) }
})

// ── PATCH /api/team-knockout/matches/:matchId/leg ─────────────────────────────
// Legacy: kept for compatibility. Now scores are auto-set when admin closes
// the leg fixture from the Fixtures admin tab.
router.patch("/matches/:matchId/leg", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { leg, team1Score, team2Score } = z.object({
      leg:        z.number().int().min(1).max(2),
      team1Score: z.number().int().min(0),
      team2Score: z.number().int().min(0),
    }).parse(req.body)

    const matchRes = await query("SELECT * FROM team_knockout_matches WHERE id = $1", [req.params.matchId])
    const match = matchRes.rows[0]
    if (!match) return res.status(404).json({ error: "Match not found" })
    if (!match.team1_id || !match.team2_id) {
      return res.status(400).json({ error: "Both teams must be set before logging scores" })
    }

    const updateCol = leg === 1 ? "team1_leg1 = $1, team2_leg1 = $2" : "team1_leg2 = $1, team2_leg2 = $2"
    await query(`UPDATE team_knockout_matches SET ${updateCol} WHERE id = $3`, [team1Score, team2Score, match.id])

    const fresh = (await query("SELECT * FROM team_knockout_matches WHERE id = $1", [match.id])).rows[0]
    const bothLegsPlayed = fresh.team1_leg1 !== null && fresh.team1_leg2 !== null
    let winnerId = null

    if (bothLegsPlayed) {
      winnerId = determineKnockoutWinner(fresh)
      if (winnerId) {
        await query("UPDATE team_knockout_matches SET winner_id = $1, status = 'completed' WHERE id = $2", [winnerId, match.id])
        await advanceKnockoutWinner(fresh, winnerId)
      } else {
        await query("UPDATE team_knockout_matches SET status = 'needs_decision' WHERE id = $1", [match.id])
      }
    }

    res.json({ updated: true, winnerId, bothLegsPlayed })
  } catch (err) { next(err) }
})

// ── DELETE /api/team-knockout/current ────────────────────────────────────────
router.delete("/current", authenticate, adminOnly, async (req, res, next) => {
  try {
    const seasonRes = await query("SELECT value FROM app_settings WHERE key = 'current_season'")
    const season = parseInt(seasonRes.rows[0]?.value || "1")

    // Also delete the fixture rows created for knockout legs
    await query(`
      DELETE FROM fixtures
      WHERE is_knockout_leg = true
        AND knockout_match_id IN (
          SELECT id FROM team_knockout_matches WHERE season_number = $1
        )
    `, [season])

    await query("DELETE FROM team_knockout_matches WHERE season_number = $1", [season])
    res.json({ deleted: true })
  } catch (err) { next(err) }
})

export default router