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
      seasonNumber, seasonName, championTeam, championPts,
      topScorer, topScorerGoals, highestMvPlayer, highestMv,
      longestStreakPlayer, longestStreak,
      ballondorWinner, teamLeagueWinner, teamLeaguePlayers, uclWinner, weeklyWinners, notes
    } = req.body

    const result = await query(`
      INSERT INTO season_records (
        season_number, season_name, champion_team, champion_pts,
        top_scorer, top_scorer_goals, highest_mv_player, highest_mv,
        longest_streak_player, longest_streak,
        ballondor_winner, team_league_winner, team_league_players, ucl_winner, weekly_winners, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING *
    `, [
      seasonNumber, seasonName, championTeam, championPts,
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
      seasonNumber, seasonName, championTeam, championPts,
      topScorer, topScorerGoals, highestMvPlayer, highestMv,
      longestStreakPlayer, longestStreak,
      ballondorWinner, teamLeagueWinner, teamLeaguePlayers, uclWinner, weeklyWinners, notes
    } = req.body

    const result = await query(`
      UPDATE season_records SET
        season_number = $1, season_name = $2,
        champion_team = $3, champion_pts = $4,
        top_scorer = $5, top_scorer_goals = $6,
        highest_mv_player = $7, highest_mv = $8,
        longest_streak_player = $9, longest_streak = $10,
        ballondor_winner = $11, team_league_winner = $12,
        team_league_players = $13, ucl_winner = $14,
        weekly_winners = $15, notes = $16
      WHERE id = $17 RETURNING *
    `, [
      seasonNumber, seasonName, championTeam, championPts,
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
        ), 0) AS goals
      FROM players p
      LEFT JOIN match_records mr
        ON (mr.player_id = p.id OR mr.opponent_id = p.id)
        AND mr.match_type = 'league'
      LEFT JOIN teams t ON p.team_id = t.id
      GROUP BY p.id, p.name, t.name
      ORDER BY goals DESC, p.name ASC
      LIMIT 10
    `)
    res.json(result.rows)
  } catch (err) { next(err) }
})

// GET /api/teams — public
router.get("/", async (req, res, next) => {
  try {
    const result = await query("SELECT * FROM league_standings ORDER BY position")
    res.json(result.rows)
  } catch (err) { next(err) }
})

// GET /api/teams/:id — single team with roster
router.get("/:id", authenticate, async (req, res, next) => {
  try {
    const teamRes = await query("SELECT * FROM league_standings WHERE id = $1", [req.params.id])
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
    const { name, played, won, drawn, lost, gf, ga } = req.body
    const result = await query(`
      UPDATE teams SET
        name   = COALESCE($1, name),
        played = COALESCE($2, played), won   = COALESCE($3, won),
        drawn  = COALESCE($4, drawn),  lost  = COALESCE($5, lost),
        gf     = COALESCE($6, gf),     ga    = COALESCE($7, ga)
      WHERE id = $8 RETURNING *
    `, [name ?? null, played, won, drawn, lost, gf, ga, req.params.id])
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

// POST /api/teams/season-reset — admin only
// Archives current season by resetting team stats, player MVs, fixtures
// but KEEPS all player records, trophies, match history intact
router.post("/season-reset", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { withTransaction: tx } = await import("../db/pool.js")
    await tx(async ({ query: q }) => {
      // Reset all team season stats
      await q(`
        UPDATE teams SET
          played = 0, won = 0, drawn = 0, lost = 0,
          gf = 0, ga = 0, score_points = 0
      `)
      // Reset all player market values to 0 (fresh start)
      await q(`UPDATE players SET market_value = 0, form = '{}'`)
      // Delete all fixtures (admin re-creates for new season)
      await q(`DELETE FROM fixtures`)
      // Delete all fixture lineups
      await q(`DELETE FROM fixture_lineups`)
      // Delete all trade requests
      await q(`DELETE FROM trade_requests`)
    })
    res.json({ success: true, message: "Season reset complete. Team stats, fixtures and trades cleared. Player records and trophies preserved." })
  } catch (err) { next(err) }
})

export default router