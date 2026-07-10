import { Router } from "express"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { query } from "../db/pool.js"
import { authenticate, adminOnly } from "../middleware/auth.js"

const router = Router()

// GET /api/teams/season-records — all past season records (public)
router.get("/season-records", async (req, res, next) => {
  try {
    const result = await query(
      "SELECT * FROM season_records ORDER BY season_number DESC"
    )
    res.json(result.rows)
  } catch (err) { next(err) }
})

// POST /api/teams/season-records — admin saves a season record
router.post("/season-records", authenticate, adminOnly, async (req, res, next) => {
  try {
    const {
      seasonNumber, seasonName, year, championTeam, championPts,
      topScorer, topScorerGoals, highestMvPlayer, highestMv,
      longestStreakPlayer, longestStreak,
      ballondorWinner, teamLeagueWinner, teamLeaguePlayers, uclWinner, weeklyWinners, notes
    } = req.body

    const result = await query(`
      INSERT INTO season_records (
        season_number, season_name, year, champion_team, champion_pts,
        top_scorer, top_scorer_goals, highest_mv_player, highest_mv,
        longest_streak_player, longest_streak,
        ballondor_winner, team_league_winner, team_league_players, ucl_winner, weekly_winners, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      RETURNING *
    `, [
      seasonNumber, seasonName, year || new Date().getFullYear(),
      championTeam, championPts,
      topScorer, topScorerGoals, highestMvPlayer, highestMv,
      longestStreakPlayer, longestStreak,
      ballondorWinner, teamLeagueWinner, teamLeaguePlayers || [],
      uclWinner, weeklyWinners || [], notes
    ])
    res.status(201).json(result.rows[0])
  } catch (err) { next(err) }
})

// PATCH /api/teams/season-records/:id — admin edits a season record
router.patch("/season-records/:id", authenticate, adminOnly, async (req, res, next) => {
  try {
    const {
      seasonNumber, seasonName, year, championTeam, championPts,
      topScorer, topScorerGoals, highestMvPlayer, highestMv,
      longestStreakPlayer, longestStreak,
      ballondorWinner, teamLeagueWinner, teamLeaguePlayers, uclWinner, weeklyWinners, notes
    } = req.body

    const result = await query(`
      UPDATE season_records SET
        season_number = $1, season_name = $2, year = $3,
        champion_team = $4, champion_pts = $5,
        top_scorer = $6, top_scorer_goals = $7,
        highest_mv_player = $8, highest_mv = $9,
        longest_streak_player = $10, longest_streak = $11,
        ballondor_winner = $12, team_league_winner = $13,
        team_league_players = $14, ucl_winner = $15,
        weekly_winners = $16, notes = $17
      WHERE id = $18 RETURNING *
    `, [
      seasonNumber, seasonName, year || new Date().getFullYear(),
      championTeam, championPts,
      topScorer, topScorerGoals, highestMvPlayer, highestMv,
      longestStreakPlayer, longestStreak,
      ballondorWinner, teamLeagueWinner, teamLeaguePlayers || [],
      uclWinner, weeklyWinners || [], notes,
      req.params.id
    ])
    if (!result.rows[0]) return res.status(404).json({ error: "Record not found" })
    res.json(result.rows[0])
  } catch (err) { next(err) }
})

// DELETE /api/teams/season-records/:id — admin deletes a season record
router.delete("/season-records/:id", authenticate, adminOnly, async (req, res, next) => {
  try {
    await query("DELETE FROM season_records WHERE id = $1", [req.params.id])
    res.json({ deleted: true })
  } catch (err) { next(err) }
})

// GET /api/teams/hall-of-fame — season records and award winners
router.get("/hall-of-fame", async (req, res, next) => {
  try {
    // Highest ever MV achieved by any player
    const highestMV = await query(`
      SELECT p.id, p.name, t.name AS team, p.market_value AS "marketValue"
      FROM players p LEFT JOIN teams t ON p.team_id = t.id
      ORDER BY p.market_value DESC LIMIT 1
    `)

    // Most goals scored (both sides)
    const topScorer = await query(`
      SELECT p.id, p.name, t.name AS team,
        COALESCE(SUM(
          CASE WHEN mr.player_id = p.id THEN COALESCE(mr.player_score, 0)
               WHEN mr.opponent_id = p.id THEN COALESCE(mr.opponent_score, 0)
               ELSE 0 END
        ), 0) AS goals
      FROM players p
      LEFT JOIN match_records mr ON mr.player_id = p.id OR mr.opponent_id = p.id
      LEFT JOIN teams t ON p.team_id = t.id
      GROUP BY p.id, p.name, t.name
      ORDER BY goals DESC LIMIT 1
    `)

    // Longest win streak (consecutive wins as player_id)
    const winStreaks = await query(`
      SELECT p.id, p.name, t.name AS team,
        MAX(streak) AS "longestStreak"
      FROM (
        SELECT player_id,
          COUNT(*) AS streak
        FROM (
          SELECT player_id, result,
            ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY recorded_at, id) -
            ROW_NUMBER() OVER (PARTITION BY player_id, result ORDER BY recorded_at, id) AS grp
          FROM match_records
          WHERE result = 'win'
        ) grouped
        GROUP BY player_id, grp
      ) streaks
      JOIN players p ON p.id = streaks.player_id
      LEFT JOIN teams t ON p.team_id = t.id
      GROUP BY p.id, p.name, t.name
      ORDER BY "longestStreak" DESC LIMIT 1
    `)

    // Trophy winners
    const ballondor = await query(`
      SELECT p.id, p.name, t.name AS team, p.trophy1_count AS count
      FROM players p LEFT JOIN teams t ON p.team_id = t.id
      WHERE p.trophy1_count > 0 ORDER BY p.trophy1_count DESC LIMIT 3
    `)
    const teamLeague = await query(`
      SELECT p.id, p.name, t.name AS team, p.trophy2_count AS count
      FROM players p LEFT JOIN teams t ON p.team_id = t.id
      WHERE p.trophy2_count > 0 ORDER BY p.trophy2_count DESC LIMIT 3
    `)
    const weekly = await query(`
      SELECT p.id, p.name, t.name AS team, p.trophy3_count AS count
      FROM players p LEFT JOIN teams t ON p.team_id = t.id
      WHERE p.trophy3_count > 0 ORDER BY p.trophy3_count DESC LIMIT 3
    `)
    const ucl = await query(`
      SELECT p.id, p.name, t.name AS team, p.trophy4_count AS count
      FROM players p LEFT JOIN teams t ON p.team_id = t.id
      WHERE p.trophy4_count > 0 ORDER BY p.trophy4_count DESC LIMIT 3
    `)

    // League champion (top team)
    const champion = await query(`
      SELECT id, name, score_points AS points, won, played FROM teams
      ORDER BY score_points DESC, gd DESC LIMIT 1
    `)

    // Most matches played
    const mostActive = await query(`
      SELECT p.id, p.name, t.name AS team, COUNT(*) AS matches
      FROM players p
      JOIN match_records mr ON mr.player_id = p.id OR mr.opponent_id = p.id
      LEFT JOIN teams t ON p.team_id = t.id
      GROUP BY p.id, p.name, t.name
      ORDER BY matches DESC LIMIT 1
    `)

    res.json({
      highestMV:   highestMV.rows[0]  || null,
      topScorer:   topScorer.rows[0]  || null,
      longestStreak: winStreaks.rows[0] || null,
      mostActive:  mostActive.rows[0] || null,
      champion:    champion.rows[0]   || null,
      trophies: {
        ballondor:  ballondor.rows,
        teamLeague: teamLeague.rows,
        weekly:     weekly.rows,
        ucl:        ucl.rows,
      }
    })
  } catch (err) { next(err) }
})

// GET /api/teams/top-scorers — top 10 players by goals in team league
router.get("/top-scorers", async (req, res, next) => {
  try {
    const result = await query(`
      SELECT
        p.id,
        p.name,
        t.name AS team,
        COALESCE(SUM(
          CASE
            WHEN mr.player_id   = p.id THEN COALESCE(mr.player_score, 0)
            WHEN mr.opponent_id = p.id THEN COALESCE(mr.opponent_score, 0)
            ELSE 0
          END
        ), 0) AS goals,
        COALESCE(SUM(
          CASE
            WHEN mr.player_id   = p.id THEN COALESCE(mr.opponent_score, 0)
            WHEN mr.opponent_id = p.id THEN COALESCE(mr.player_score, 0)
            ELSE 0
          END
        ), 0) AS conceded
      FROM players p
      LEFT JOIN match_records mr
        ON (mr.player_id = p.id OR mr.opponent_id = p.id)
        AND mr.match_type = 'league'
      LEFT JOIN teams t ON p.team_id = t.id
      GROUP BY p.id, p.name, t.name
      ORDER BY goals DESC, conceded ASC, p.name ASC
      LIMIT 10
    `)
    res.json(result.rows)
  } catch (err) { next(err) }
})

// GET /api/teams/:id/best-league-performer — public. Ranks a team's
// players by THIS season's Team League performance only (points earned
// from match_type='league' results this season, tiebreak by goals) — not
// their all-time BDR points, which mixes in Weekly/UCL/past seasons too.
router.get("/:id/best-league-performer", async (req, res, next) => {
  try {
    const seasonRes = await query("SELECT value FROM app_settings WHERE key = 'current_season'")
    const season = parseInt(seasonRes.rows[0]?.value || "1")

    const result = await query(`
      SELECT
        p.id, p.name,
        COALESCE(SUM(
          CASE
            WHEN mr.player_id   = p.id THEN (CASE mr.result WHEN 'win' THEN 3 WHEN 'draw' THEN 1 ELSE 0 END)
            WHEN mr.opponent_id = p.id THEN (CASE mr.result WHEN 'win' THEN 0 WHEN 'loss' THEN 3 ELSE 1 END)
            ELSE 0
          END
        ), 0) AS points,
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
        AND mr.match_type = 'league'
        AND mr.season_number = $2
      WHERE p.team_id = $1
      GROUP BY p.id, p.name
      ORDER BY points DESC, goals DESC, p.name ASC
      LIMIT 1
    `, [req.params.id, season])

    res.json(result.rows[0] || null)
  } catch (err) { next(err) }
})

// GET /api/teams — public
router.get("/", async (req, res, next) => {
  try {
    const result = await query(`
      SELECT t.*, t.logo_url AS "logoUrl", ls.points, ls.position
      FROM teams t
      LEFT JOIN league_standings ls ON ls.id = t.id
      ORDER BY ls.position
    `)
    res.json(result.rows)
  } catch (err) { next(err) }
})

// GET /api/teams/:id — single team with roster
router.get("/:id", authenticate, async (req, res, next) => {
  try {
    const teamRes = await query(`
      SELECT t.*, t.logo_url AS "logoUrl", ls.points, ls.position
      FROM teams t
      LEFT JOIN league_standings ls ON ls.id = t.id
      WHERE t.id = $1
    `, [req.params.id])
    if (!teamRes.rows[0]) return res.status(404).json({ error: "Team not found" })
    const playersRes = await query(
      `SELECT * FROM players_full WHERE "teamId" = $1 ORDER BY "bdrPoints" DESC`,
      [req.params.id]
    )
    res.json({ ...teamRes.rows[0], players: playersRes.rows })
  } catch (err) { next(err) }
})

// POST /api/teams — admin creates team + owner account
const createTeamSchema = z.object({
  name:          z.string().min(1),
  ownerUsername: z.string().min(2),
  ownerEmail:    z.string().email(),
  ownerPassword: z.string().min(6),
})

router.post("/", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { name, ownerUsername, ownerEmail, ownerPassword } = createTeamSchema.parse(req.body)
    const teamRes = await query(
      "INSERT INTO teams (name) VALUES ($1) RETURNING id, name", [name]
    )
    const team = teamRes.rows[0]
    const hash = await bcrypt.hash(ownerPassword, 12)
    await query(
      `INSERT INTO users (username, email, password_hash, role, team_id) VALUES ($1,$2,$3,'team_owner',$4)`,
      [ownerUsername, ownerEmail, hash, team.id]
    )
    res.status(201).json({ team, owner: { username: ownerUsername, email: ownerEmail } })
  } catch (err) { next(err) }
})

// PATCH /api/teams/:id — admin edits team name or stats
router.patch("/:id", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { name, played, won, drawn, lost, gf, ga, budget } = req.body
    const result = await query(`
      UPDATE teams SET
        name   = COALESCE($1, name),
        played = COALESCE($2, played), won   = COALESCE($3, won),
        drawn  = COALESCE($4, drawn),  lost  = COALESCE($5, lost),
        gf     = COALESCE($6, gf),     ga    = COALESCE($7, ga),
        budget = COALESCE($8, budget)
      WHERE id = $9 RETURNING *
    `, [name ?? null, played, won, drawn, lost, gf, ga, budget ?? null, req.params.id])
    if (!result.rows[0]) return res.status(404).json({ error: "Team not found" })
    res.json(result.rows[0])
  } catch (err) { next(err) }
})

// PATCH /api/teams/:id/settings — team owner (own team only) or admin updates name/logo
const settingsSchema = z.object({
  name:    z.string().min(1).optional(),
  logoUrl: z.string().url().optional().nullable(),
}).refine(d => d.name !== undefined || d.logoUrl !== undefined, {
  message: "Provide at least name or logoUrl",
})

router.patch("/:id/settings", authenticate, async (req, res, next) => {
  try {
    const targetId = parseInt(req.params.id)
    const isOwner  = req.user.role === "team_owner" && req.user.teamId === targetId
    const isAdmin  = req.user.role === "admin"
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Not authorized to edit this team" })
    }

    const { name, logoUrl } = settingsSchema.parse(req.body)
    const result = await query(`
      UPDATE teams SET
        name     = COALESCE($1, name),
        logo_url = COALESCE($2, logo_url)
      WHERE id = $3
      RETURNING id, name, logo_url AS "logoUrl"
    `, [name ?? null, logoUrl ?? null, targetId])

    if (!result.rows[0]) return res.status(404).json({ error: "Team not found" })
    res.json(result.rows[0])
  } catch (err) { next(err) }
})

// PATCH /api/teams/:id/password — admin resets the team owner's password
const changePasswordSchema = z.object({
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
})

router.patch("/:id/password", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { newPassword } = changePasswordSchema.parse(req.body)

    // Find the team_owner user linked to this team
    const userRes = await query(
      "SELECT id FROM users WHERE team_id = $1 AND role = 'team_owner'",
      [req.params.id]
    )
    if (!userRes.rows[0]) {
      return res.status(404).json({ error: "No team owner account found for this team" })
    }

    const hash = await bcrypt.hash(newPassword, 12)
    await query(
      "UPDATE users SET password_hash = $1 WHERE id = $2",
      [hash, userRes.rows[0].id]
    )

    res.json({ success: true })
  } catch (err) { next(err) }
})

// DELETE /api/teams/:id — admin deletes team
router.delete("/:id", authenticate, adminOnly, async (req, res, next) => {
  try {
    const result = await query(
      "DELETE FROM teams WHERE id = $1 RETURNING id, name", [req.params.id]
    )
    if (!result.rows[0]) return res.status(404).json({ error: "Team not found" })
    res.json({ deleted: true, team: result.rows[0] })
  } catch (err) { next(err) }
})

// Shared by season-reset (advance) and season-delete (undo) — clears
// everything tied to the CURRENT season's fixtures/UCL/team-stats, without
// ever touching match_records (trophies, BDR points, match history stay
// intact either way, since those tables are only ever referenced BY
// ucl_fixtures/ucl_knockout_matches, never the reverse).
async function clearCurrentSeasonData(q) {
  await q(`UPDATE teams SET played = 0, won = 0, drawn = 0, lost = 0, gf = 0, ga = 0, score_points = 0`)
  await q(`UPDATE players SET market_value = 0, form = '{}'`)
  await q(`DELETE FROM fixtures`)
  await q(`DELETE FROM fixture_lineups`)
  await q(`DELETE FROM trade_requests`)

  // Clear the entire UCL competition — child tables first to respect FKs
  await q(`DELETE FROM ucl_knockout_matches`)
  await q(`DELETE FROM ucl_knockout_players`)
  await q(`DELETE FROM ucl_knockout_tournaments`)
  await q(`UPDATE players SET ucl_group_id = NULL`) // before deleting ucl_groups, since players reference it
  await q(`DELETE FROM ucl_fixtures`)
  await q(`DELETE FROM ucl_groups`)
}

// POST /api/teams/season-reset — admin only
// Archives current season by clearing its fixtures/UCL/team-stats, then
// ADVANCES the season number by one.
router.post("/season-reset", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { withTransaction: tx } = await import("../db/pool.js")
    await tx(async ({ query: q }) => {
      await clearCurrentSeasonData(q)
      await q(`
        INSERT INTO app_settings (key, value)
        VALUES ('current_season', (
          SELECT (COALESCE(value::int, 6) + 1)::text FROM app_settings WHERE key = 'current_season'
        ))
        ON CONFLICT (key) DO UPDATE SET value = (
          SELECT (COALESCE(value::int, 6) + 1)::text FROM app_settings WHERE key = 'current_season'
        )
      `)
    })
    res.json({ success: true, message: "Season reset complete. Team stats, fixtures, trades, and the entire UCL competition were cleared. Player records and trophies are preserved." })
  } catch (err) { next(err) }
})

// POST /api/teams/season-delete — admin only
// Undoes "Start New Season": clears whatever fixtures/UCL/team-stats exist
// in the CURRENT season (there's no way to restore the previous season's
// actual data — it was already permanently deleted when that season was
// advanced past), then DECREMENTS the season number by one, floored at 1.
router.post("/season-delete", authenticate, adminOnly, async (req, res, next) => {
  try {
    const seasonRes = await query("SELECT value FROM app_settings WHERE key = 'current_season'")
    const current = parseInt(seasonRes.rows[0]?.value || "6")
    if (current <= 1) {
      return res.status(400).json({ error: "Already at Season 1 — nothing to go back to" })
    }

    const { withTransaction: tx } = await import("../db/pool.js")
    await tx(async ({ query: q }) => {
      await clearCurrentSeasonData(q)
      await q(`
        UPDATE app_settings SET value = $1 WHERE key = 'current_season'
      `, [String(current - 1)])
    })
    res.json({
      success: true,
      message: `Season ${current} deleted. Now back on Season ${current - 1} — its fixtures, team stats, and UCL data were already cleared when Season ${current} started, so Season ${current - 1} begins fresh, not restored.`,
    })
  } catch (err) { next(err) }
})

export default router