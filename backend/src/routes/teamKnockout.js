// backend/src/routes/teamKnockout.js
// Team Knockout — Champions + Europa brackets generated from Team League
// group stage final standings (group_knockout format only).
//
// Table structure (auto-created on startup):
//   fixture_groups      — maps team_id → group ('A'|'B') for a season
//   team_knockout_matches — the SF + Final matches for both competitions
//
// Match types:
//   champions_sf1, champions_sf2, champions_final, champions_3rd
//   europa_sf1,    europa_sf2,    europa_final,    europa_7th

import { Router } from "express"
import { z } from "zod"
import { query } from "../db/pool.js"
import { authenticate, adminOnly } from "../middleware/auth.js"
import { reconcileTeamTrophy } from "../services/teamTrophyAwards.js"
import { updateSeasonRecord } from "../services/seasonRecord.js"

const router = Router()

// ── Auto-create tables ────────────────────────────────────────────────────────
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
        id            SERIAL PRIMARY KEY,
        season_number INT NOT NULL,
        match_type    TEXT NOT NULL,
        team1_id      INT REFERENCES teams(id) ON DELETE SET NULL,
        team2_id      INT REFERENCES teams(id) ON DELETE SET NULL,
        team1_leg1    INT,
        team1_leg2    INT,
        team2_leg1    INT,
        team2_leg2    INT,
        winner_id     INT REFERENCES teams(id) ON DELETE SET NULL,
        status        TEXT NOT NULL DEFAULT 'pending',
        created_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `)
  } catch (e) { console.error("[teamKnockout] migration:", e.message) }
})()

// ── Helper: get final group standings ────────────────────────────────────────
// Reads fixture_groups + fixtures for the current season and ranks teams
// within each group by: points → GD → GF
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
  for (const row of result.rows) {
    groups[row.grp].push(row)
  }
  return groups
}

// ── Helper: determine winner of a two-leg tie ─────────────────────────────────
// Total points → GD → GF across both legs
function determineWinner(match) {
  const { team1_id, team2_id, team1_leg1, team1_leg2, team2_leg1, team2_leg2 } = match
  if (team1_leg1 === null || team1_leg2 === null) return null

  // leg1: team1 is home, team2 is away
  // leg2: team2 is home, team1 is away
  const t1Goals = (team1_leg1 || 0) + (team1_leg2 || 0)
  const t2Goals = (team2_leg1 || 0) + (team2_leg2 || 0)

  // wins in each leg
  const t1Wins = (team1_leg1 > team2_leg1 ? 1 : 0) + (team1_leg2 > team2_leg2 ? 1 : 0)
  const t2Wins = (team2_leg1 > team1_leg1 ? 1 : 0) + (team2_leg2 > team1_leg2 ? 1 : 0)
  const t1Pts = t1Wins * 3
  const t2Pts = t2Wins * 3

  if (t1Pts > t2Pts) return team1_id
  if (t2Pts > t1Pts) return team2_id
  // same points → GD
  const t1GD = t1Goals - t2Goals
  const t2GD = t2Goals - t1Goals
  if (t1GD > t2GD) return team1_id
  if (t2GD > t1GD) return team2_id
  // same GD → GF
  if (t1Goals > t2Goals) return team1_id
  if (t2Goals > t1Goals) return team2_id
  return null // still tied — admin must decide
}

// ── GET /api/team-knockout/current ───────────────────────────────────────────
// Current season's knockout state (public + admin)
router.get("/current", async (req, res, next) => {
  try {
    const seasonRes = await query("SELECT value FROM app_settings WHERE key = 'current_season'")
    const season = parseInt(seasonRes.rows[0]?.value || "1")

    const matches = await query(`
      SELECT
        tkm.*,
        t1.name AS "team1Name", t1.logo_url AS "team1Logo",
        t2.name AS "team2Name", t2.logo_url AS "team2Logo",
        w.name  AS "winnerName", w.logo_url  AS "winnerLogo"
      FROM team_knockout_matches tkm
      LEFT JOIN teams t1 ON t1.id = tkm.team1_id
      LEFT JOIN teams t2 ON t2.id = tkm.team2_id
      LEFT JOIN teams w  ON w.id  = tkm.winner_id
      WHERE tkm.season_number = $1
      ORDER BY tkm.id ASC
    `, [season])

    // Group standings for display
    const groups = await getGroupStandings(season).catch(() => ({ A: [], B: [] }))

    res.json({ season, matches: matches.rows, groups })
  } catch (err) { next(err) }
})

// ── POST /api/team-knockout/generate ─────────────────────────────────────────
// Reads final group standings and generates SF + Final fixtures for both
// Champions and Europa competitions.
router.post("/generate", authenticate, adminOnly, async (req, res, next) => {
  try {
    const seasonRes = await query("SELECT value FROM app_settings WHERE key = 'current_season'")
    const season = parseInt(seasonRes.rows[0]?.value || "1")

    // Check format is group_knockout
    const formatRes = await query("SELECT value FROM app_settings WHERE key = 'team_league_format'")
    const format = formatRes.rows[0]?.value
    if (format !== "group_knockout") {
      return res.status(400).json({ error: "Team League format must be 'group_knockout' to generate knockouts" })
    }

    // Check no knockouts already exist for this season
    const existingRes = await query(
      "SELECT COUNT(*) FROM team_knockout_matches WHERE season_number = $1", [season]
    )
    if (parseInt(existingRes.rows[0].count) > 0) {
      return res.status(400).json({ error: "Knockout fixtures already generated for this season. Delete them first." })
    }

    // Check all group stage fixtures are completed
    const pendingRes = await query(
      "SELECT COUNT(*) FROM fixtures WHERE group_stage = true AND status != 'completed'"
    )
    if (parseInt(pendingRes.rows[0].count) > 0) {
      return res.status(400).json({ error: `${pendingRes.rows[0].count} group stage fixtures still pending. Complete all group matches first.` })
    }

    // Get final standings
    const groups = await getGroupStandings(season)
    const A = groups.A  // [1st, 2nd, 3rd, 4th]
    const B = groups.B  // [1st, 2nd, 3rd, 4th]

    if (A.length < 4 || B.length < 4) {
      return res.status(400).json({ error: "Each group must have at least 4 teams in the standings" })
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
      await query(`
        INSERT INTO team_knockout_matches (season_number, match_type, team1_id, team2_id, status)
        VALUES ($1, $2, $3, $4, 'pending')
      `, [season, m.match_type, m.team1_id, m.team2_id])
    }

    const created = await query(`
      SELECT tkm.*,
        t1.name AS "team1Name", t1.logo_url AS "team1Logo",
        t2.name AS "team2Name", t2.logo_url AS "team2Logo"
      FROM team_knockout_matches tkm
      LEFT JOIN teams t1 ON t1.id = tkm.team1_id
      LEFT JOIN teams t2 ON t2.id = tkm.team2_id
      WHERE tkm.season_number = $1
      ORDER BY tkm.id ASC
    `, [season])

    res.status(201).json({ success: true, matches: created.rows })
  } catch (err) { next(err) }
})

// ── PATCH /api/team-knockout/matches/:matchId/leg ─────────────────────────────
// Save a single leg score (leg=1 or leg=2) and auto-determine winner
// when both legs are complete.
router.patch("/matches/:matchId/leg", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { leg, team1Score, team2Score } = z.object({
      leg:        z.number().int().min(1).max(2),
      team1Score: z.number().int().min(0),
      team2Score: z.number().int().min(0),
    }).parse(req.body)

    const matchRes = await query(
      "SELECT * FROM team_knockout_matches WHERE id = $1", [req.params.matchId]
    )
    const match = matchRes.rows[0]
    if (!match) return res.status(404).json({ error: "Match not found" })
    if (!match.team1_id || !match.team2_id) {
      return res.status(400).json({ error: "Both teams must be set before logging scores" })
    }

    // Update the correct leg columns
    const updateCol = leg === 1
      ? "team1_leg1 = $1, team2_leg1 = $2"
      : "team1_leg2 = $1, team2_leg2 = $2"

    await query(
      `UPDATE team_knockout_matches SET ${updateCol} WHERE id = $3`,
      [team1Score, team2Score, match.id]
    )

    // Refetch to get both legs
    const freshRes = await query("SELECT * FROM team_knockout_matches WHERE id = $1", [match.id])
    const fresh = freshRes.rows[0]

    // Check if both legs are complete
    const bothLegsPlayed = fresh.team1_leg1 !== null && fresh.team1_leg2 !== null

    let winnerId = null
    if (bothLegsPlayed) {
      winnerId = determineWinner(fresh)
      if (winnerId) {
        await query(
          "UPDATE team_knockout_matches SET winner_id = $1, status = 'completed' WHERE id = $2",
          [winnerId, match.id]
        )

        // Advance winner to Final, loser to 3rd/4th or 7th/8th place match
        const sfToFinalMap = {
          champions_sf1:  "champions_final",
          champions_sf2:  "champions_final",
          europa_sf1:     "europa_final",
          europa_sf2:     "europa_final",
        }
        const sfTo3rdMap = {
          champions_sf1:  "champions_3rd",
          champions_sf2:  "champions_3rd",
          europa_sf1:     "europa_7th",
          europa_sf2:     "europa_7th",
        }
        const finalType = sfToFinalMap[match.match_type]
        const thirdType = sfTo3rdMap[match.match_type]

        if (finalType) {
          const seasonNumber = match.season_number
          const isSF1 = match.match_type.endsWith("_sf1")
          const winnerCol = isSF1 ? "team1_id" : "team2_id"
          const loserCol  = isSF1 ? "team1_id" : "team2_id"

          // Loser = the other team
          const loserId = winnerId === fresh.team1_id ? fresh.team2_id : fresh.team1_id

          // Advance winner to Final
          await query(
            `UPDATE team_knockout_matches SET ${winnerCol} = $1 WHERE season_number = $2 AND match_type = $3`,
            [winnerId, seasonNumber, finalType]
          )
          // Advance loser to 3rd/4th or 7th/8th
          if (thirdType) {
            await query(
              `UPDATE team_knockout_matches SET ${loserCol} = $1 WHERE season_number = $2 AND match_type = $3`,
              [loserId, seasonNumber, thirdType]
            )
          }
        }

        // Check if this is a Final — award trophies
        const finalMatches = ["champions_final", "champions_3rd", "europa_final", "europa_7th"]
        if (finalMatches.includes(match.match_type)) {
          const seasonRes = await query("SELECT value FROM app_settings WHERE key = 'current_season'")
          const season = parseInt(seasonRes.rows[0]?.value || "1")

          if (match.match_type === "champions_final") {
            await reconcileTeamTrophy({ tournament: "team_league", teamId: winnerId, seasonNumber: season })
            const winnerNameRes = await query("SELECT name FROM teams WHERE id = $1", [winnerId])
            await updateSeasonRecord(season, { team_league_winner: winnerNameRes.rows[0]?.name ?? null })
          } else if (match.match_type === "europa_final") {
            await reconcileTeamTrophy({ tournament: "europa", teamId: winnerId, seasonNumber: season })
          }
          // 3rd/4th and 7th/8th place — no trophy, just completion
        }
      }
    }

    res.json({ updated: true, winnerId, bothLegsPlayed })
  } catch (err) { next(err) }
})

// ── DELETE /api/team-knockout/current ────────────────────────────────────────
// Delete all knockout matches for the current season (reset)
router.delete("/current", authenticate, adminOnly, async (req, res, next) => {
  try {
    const seasonRes = await query("SELECT value FROM app_settings WHERE key = 'current_season'")
    const season = parseInt(seasonRes.rows[0]?.value || "1")
    await query("DELETE FROM team_knockout_matches WHERE season_number = $1", [season])
    res.json({ deleted: true })
  } catch (err) { next(err) }
})

export default router