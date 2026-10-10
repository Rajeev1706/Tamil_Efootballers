import { Router } from "express"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { query } from "../db/pool.js"
import { authenticate, adminOnly } from "../middleware/auth.js"
import { claimAward, addBdr, addBdrWithLabel, addLeagueBdr, addTeamChampionshipPts } from "../services/bdrAwards.js"
import { generatePlayoffs } from "../services/playoffs.js"
import { reconcileTrophyRoster, awardOrReassignTrophy } from "../services/trophyAwards.js"
import { recalcMarketValue } from "../services/marketValue.js"
import { reconcileTeamTrophy } from "../services/teamTrophyAwards.js"
import { updateSeasonRecord } from "../services/seasonRecord.js"

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
      seasonNumber, seasonName, year,
      topScorer, topScorerGoals, highestMvPlayer, highestMv,
      longestStreakPlayer, longestStreak,
      ballondorWinner, teamLeagueWinner, teamLeaguePlayers, uclWinner, weeklyWinners,
      duoWinner, championshipWinner, championshipPlayers, notes
    } = req.body

    await query(`ALTER TABLE season_records ADD COLUMN IF NOT EXISTS duo_winner             TEXT`).catch(() => {})
    await query(`ALTER TABLE season_records ADD COLUMN IF NOT EXISTS championship_winner    TEXT`).catch(() => {})
    await query(`ALTER TABLE season_records ADD COLUMN IF NOT EXISTS championship_players   TEXT[] DEFAULT '{}'`).catch(() => {})

    const result = await query(`
      INSERT INTO season_records (
        season_number, season_name, year,
        top_scorer, top_scorer_goals, highest_mv_player, highest_mv,
        longest_streak_player, longest_streak,
        ballondor_winner, team_league_winner, team_league_players, ucl_winner, weekly_winners,
        duo_winner, championship_winner, championship_players, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      RETURNING *
    `, [
      seasonNumber, seasonName, year || new Date().getFullYear(),
      topScorer, topScorerGoals, highestMvPlayer, highestMv,
      longestStreakPlayer, longestStreak,
      ballondorWinner, teamLeagueWinner, teamLeaguePlayers || [],
      uclWinner, weeklyWinners || [],
      duoWinner || null, championshipWinner || null, championshipPlayers || [], notes
    ])
    res.status(201).json(result.rows[0])
  } catch (err) { next(err) }
})

// PATCH /api/teams/season-records/:id — admin edits a season record
router.patch("/season-records/:id", authenticate, adminOnly, async (req, res, next) => {
  try {
    const {
      seasonNumber, seasonName, year,
      topScorer, topScorerGoals, highestMvPlayer, highestMv,
      longestStreakPlayer, longestStreak,
      ballondorWinner, teamLeagueWinner, teamLeaguePlayers, uclWinner, weeklyWinners,
      duoWinner, championshipWinner, championshipPlayers, notes
    } = req.body

    await query(`ALTER TABLE season_records ADD COLUMN IF NOT EXISTS duo_winner             TEXT`).catch(() => {})
    await query(`ALTER TABLE season_records ADD COLUMN IF NOT EXISTS championship_winner    TEXT`).catch(() => {})
    await query(`ALTER TABLE season_records ADD COLUMN IF NOT EXISTS championship_players   TEXT[] DEFAULT '{}'`).catch(() => {})

    const result = await query(`
      UPDATE season_records SET
        season_number = $1, season_name = $2, year = $3,
        top_scorer = $4, top_scorer_goals = $5,
        highest_mv_player = $6, highest_mv = $7,
        longest_streak_player = $8, longest_streak = $9,
        ballondor_winner = $10, team_league_winner = $11,
        team_league_players = $12, ucl_winner = $13,
        weekly_winners = $14, duo_winner = $15,
        championship_winner = $16, championship_players = $17, notes = $18
      WHERE id = $19 RETURNING *
    `, [
      seasonNumber, seasonName, year || new Date().getFullYear(),
      topScorer, topScorerGoals, highestMvPlayer, highestMv,
      longestStreakPlayer, longestStreak,
      ballondorWinner, teamLeagueWinner, teamLeaguePlayers || [],
      uclWinner, weeklyWinners || [],
      duoWinner || null, championshipWinner || null, championshipPlayers || [], notes,
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
    const season = await getCurrentSeason()
    const result = await query(`
      SELECT
        p.id,
        p.name,
        t.name AS team,
        t.logo_url AS "teamLogo",
        p.avatar_id AS "avatarId",
        p.avatar_url AS "avatarUrl",
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
        AND mr.season_number = $1
      LEFT JOIN teams t ON p.team_id = t.id
      GROUP BY p.id, p.name, t.name, t.logo_url, p.avatar_id, p.avatar_url
      ORDER BY goals DESC, conceded ASC, p.name ASC
      LIMIT 10
    `, [season])
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
    const season = await getCurrentSeason()
    // League Table computed LIVE from match_records every time, rather than
    // from teams.played/won/drawn/lost (which only ever updated on
    // "Close Fixture"). Each fixture's running score is recomputed fresh
    // from every player result logged against it so far — even a partial,
    // still-in-progress fixture contributes its current standing
    // immediately, and naturally corrects itself as more results come in
    // or an existing one gets edited. Close Fixture still exists to mark a
    // fixture "completed" (which is what triggers the playoff bracket), but
    // no longer gates whether the table itself reflects a result.
    const result = await query(`
      WITH fixture_scores AS (
        SELECT
          f.id,
          f.home_team_id,
          f.away_team_id,
          CASE
            WHEN f.status = 'completed' THEN COALESCE(f.home_score, 0)
            ELSE SUM(CASE
              WHEN COALESCE(mr.team_id, p.team_id) = f.home_team_id THEN CASE mr.result WHEN 'win' THEN 3 WHEN 'draw' THEN 1 ELSE 0 END
              WHEN COALESCE(mr.team_id, p.team_id) = f.away_team_id THEN CASE mr.result WHEN 'loss' THEN 3 WHEN 'draw' THEN 1 ELSE 0 END
              ELSE 0 END)
          END AS home_pts,
          CASE
            WHEN f.status = 'completed' THEN COALESCE(f.away_score, 0)
            ELSE SUM(CASE
              WHEN COALESCE(mr.team_id, p.team_id) = f.away_team_id THEN CASE mr.result WHEN 'win' THEN 3 WHEN 'draw' THEN 1 ELSE 0 END
              WHEN COALESCE(mr.team_id, p.team_id) = f.home_team_id THEN CASE mr.result WHEN 'loss' THEN 3 WHEN 'draw' THEN 1 ELSE 0 END
              ELSE 0 END)
          END AS away_pts,
          CASE
            WHEN f.status = 'completed' THEN COALESCE(f.home_goals, 0)
            ELSE COALESCE(SUM(CASE WHEN COALESCE(mr.team_id, p.team_id) = f.home_team_id THEN mr.player_score WHEN COALESCE(mr.team_id, p.team_id) = f.away_team_id THEN mr.opponent_score ELSE 0 END), 0)
          END AS home_goals,
          CASE
            WHEN f.status = 'completed' THEN COALESCE(f.away_goals, 0)
            ELSE COALESCE(SUM(CASE WHEN COALESCE(mr.team_id, p.team_id) = f.away_team_id THEN mr.player_score WHEN COALESCE(mr.team_id, p.team_id) = f.home_team_id THEN mr.opponent_score ELSE 0 END), 0)
          END AS away_goals,
          CASE WHEN f.status = 'completed' THEN 1 ELSE COUNT(mr.id) END AS results_logged
        FROM fixtures f
        LEFT JOIN match_records mr ON mr.fixture_id = f.id AND mr.match_type = 'league' AND mr.season_number = $1
        LEFT JOIN players p ON p.id = mr.player_id
        GROUP BY f.id, f.home_team_id, f.away_team_id, f.status, f.home_score, f.away_score, f.home_goals, f.away_goals
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
        SELECT home_team_id AS team_id, home_goals AS gf, away_goals AS ga, home_pts AS pts, outcome,
          (outcome = 'home') AS won, (outcome = 'draw') AS drawn, (outcome = 'away') AS lost
        FROM fixture_outcomes WHERE outcome IS NOT NULL
        UNION ALL
        SELECT away_team_id AS team_id, away_goals AS gf, home_goals AS ga, away_pts AS pts, outcome,
          (outcome = 'away') AS won, (outcome = 'draw') AS drawn, (outcome = 'home') AS lost
        FROM fixture_outcomes WHERE outcome IS NOT NULL
      ),
      team_stats AS (
        SELECT team_id,
          COUNT(*) AS played,
          COUNT(*) FILTER (WHERE won)   AS won,
          COUNT(*) FILTER (WHERE drawn) AS drawn,
          COUNT(*) FILTER (WHERE lost)  AS lost,
          COALESCE(SUM(gf), 0)  AS gf,
          COALESCE(SUM(ga), 0)  AS ga,
          COALESCE(SUM(pts), 0) AS points
        FROM per_team
        GROUP BY team_id
      )
      SELECT
        t.id, t.name, t.logo_url AS "logoUrl", t.anthem_url AS "anthemUrl", t.score_points, t.created_at, t.budget, t.budget AS purse,
        t.predecessor_team_id AS "predecessorTeamId", t.successor_team_id AS "successorTeamId",
        COALESCE(ts.played, 0) AS played,
        COALESCE(ts.won, 0)    AS won,
        COALESCE(ts.drawn, 0)  AS drawn,
        COALESCE(ts.lost, 0)   AS lost,
        COALESCE(ts.gf, 0)     AS gf,
        COALESCE(ts.ga, 0)     AS ga,
        COALESCE(ts.gf, 0) - COALESCE(ts.ga, 0) AS gd,
        COALESCE(ts.points, 0) AS points,
        ROW_NUMBER() OVER (
          ORDER BY COALESCE(ts.points, 0) DESC,
                   COALESCE(ts.gf, 0) - COALESCE(ts.ga, 0) DESC,
                   COALESCE(ts.gf, 0) DESC
        ) AS position
      FROM teams t
      LEFT JOIN team_stats ts ON ts.team_id = t.id
      ${req.query.all === "true" ? "" : `WHERE t.id IN (
        SELECT DISTINCT home_team_id FROM fixtures
        UNION
        SELECT DISTINCT away_team_id FROM fixtures
      )`}
      ORDER BY position
    `, [season])
    res.json(result.rows)
  } catch (err) { next(err) }
})

// GET /api/teams/:id — single team with roster
// GET /api/teams/trophy-history — all-time trophy totals per player
// All-time = players table (current year) + SUM(player_trophy_history for past years)
router.get("/trophy-history", async (req, res, next) => {
  try {
    const r = await query(`
      SELECT
        p.id,
        p.name,
        p.grade,
        p.avatar_id      AS "avatarId",
        p.avatar_url     AS "avatarUrl",
        p.team_id        AS "teamId",
        t.name           AS team,
        t.logo_url       AS "teamLogo",
        (p.trophy1_count  + COALESCE(h.trophy1_total,  0))::int AS "trophy1Count",
        (p.trophy2_count  + COALESCE(h.trophy2_total,  0))::int AS "trophy2Count",
        (p.trophy3_count  + COALESCE(h.trophy3_total,  0))::int AS "trophy3Count",
        (p.trophy4_count  + COALESCE(h.trophy4_total,  0))::int AS "trophy4Count",
        (p.trophy5_count  + COALESCE(h.trophy5_total,  0))::int AS "trophy5Count",
        (p.trophy6_count  + COALESCE(h.trophy6_total,  0))::int AS "trophy6Count",
        (p.trophy7_count  + COALESCE(h.trophy7_total,  0))::int AS "trophy7Count",
        (p.trophy8_count  + COALESCE(h.trophy8_total,  0))::int AS "trophy8Count",
        (p.trophy9_count  + COALESCE(h.trophy9_total,  0))::int AS "trophy9Count",
        (p.trophy10_count + COALESCE(h.trophy10_total, 0))::int AS "trophy10Count",
        (p.trophy11_count + COALESCE(h.trophy11_total, 0))::int AS "trophy11Count",
        (COALESCE(p.trophy13_count, 0) + COALESCE(h.trophy13_total, 0))::int AS "trophy13Count"
      FROM players p
      LEFT JOIN teams t ON t.id = p.team_id
      LEFT JOIN (
        SELECT
          player_id,
          SUM(trophy1_count)  AS trophy1_total,
          SUM(trophy2_count)  AS trophy2_total,
          SUM(trophy3_count)  AS trophy3_total,
          SUM(trophy4_count)  AS trophy4_total,
          SUM(trophy5_count)  AS trophy5_total,
          SUM(trophy6_count)  AS trophy6_total,
          SUM(trophy7_count)  AS trophy7_total,
          SUM(trophy8_count)  AS trophy8_total,
          SUM(COALESCE(trophy9_count,  0)) AS trophy9_total,
          SUM(COALESCE(trophy10_count, 0)) AS trophy10_total,
          SUM(COALESCE(trophy11_count, 0)) AS trophy11_total,
          SUM(COALESCE(trophy13_count, 0)) AS trophy13_total
        FROM player_trophy_history
        GROUP BY player_id
      ) h ON h.player_id = p.id
      ORDER BY p.name
    `).catch(async () => {
      return await query(`
        SELECT p.id, p.name, p.grade,
          p.avatar_id AS "avatarId", p.avatar_url AS "avatarUrl",
          p.team_id AS "teamId", t.name AS team, t.logo_url AS "teamLogo",
          p.trophy1_count AS "trophy1Count", p.trophy2_count AS "trophy2Count",
          p.trophy3_count AS "trophy3Count", p.trophy4_count AS "trophy4Count",
          p.trophy5_count AS "trophy5Count", p.trophy6_count AS "trophy6Count",
          p.trophy7_count AS "trophy7Count", p.trophy8_count AS "trophy8Count",
          COALESCE(p.trophy9_count,  0) AS "trophy9Count",
          COALESCE(p.trophy10_count, 0) AS "trophy10Count",
          COALESCE(p.trophy11_count, 0) AS "trophy11Count",
          COALESCE(p.trophy13_count, 0) AS "trophy13Count"
        FROM players p LEFT JOIN teams t ON t.id = p.team_id ORDER BY p.name
      `)
    })
    res.json(r.rows)
  } catch (err) { next(err) }
})

// POST /api/teams/update-trophy-year — admin only
// Updates trophy counts for a specific player for a specific year
// If year = current year → also updates players table
router.post("/update-trophy-year", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { playerId, year, trophy1Count, trophy2Count, trophy3Count,
            trophy4Count, trophy5Count, trophy6Count, trophy7Count, trophy8Count,
            trophy9Count, trophy10Count, trophy11Count } = req.body

    if (!playerId || !year) return res.status(400).json({ error: "playerId and year required" })

    await query(`
      CREATE TABLE IF NOT EXISTS player_trophy_history (
        id SERIAL PRIMARY KEY,
        player_id INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        year INT NOT NULL,
        trophy1_count  INT DEFAULT 0,
        trophy2_count  INT DEFAULT 0,
        trophy3_count  INT DEFAULT 0,
        trophy4_count  INT DEFAULT 0,
        trophy5_count  INT DEFAULT 0,
        trophy6_count  INT DEFAULT 0,
        trophy7_count  INT DEFAULT 0,
        trophy8_count  INT DEFAULT 0,
        trophy9_count  INT DEFAULT 0,
        trophy10_count INT DEFAULT 0,
        trophy11_count INT DEFAULT 0,
        UNIQUE(player_id, year)
      )
    `).catch(() => {})
    // Add columns to existing history table if they don't exist yet
    await query(`ALTER TABLE player_trophy_history ADD COLUMN IF NOT EXISTS trophy9_count  INT DEFAULT 0`).catch(() => {})
    await query(`ALTER TABLE player_trophy_history ADD COLUMN IF NOT EXISTS trophy10_count INT DEFAULT 0`).catch(() => {})
    await query(`ALTER TABLE player_trophy_history ADD COLUMN IF NOT EXISTS trophy11_count INT DEFAULT 0`).catch(() => {})

    const settingsRes = await query(`SELECT value FROM app_settings WHERE key = 'current_year'`)
    const currentYear = parseInt(settingsRes.rows[0]?.value || new Date().getFullYear())
    const isCurrent   = parseInt(year) === currentYear

    if (isCurrent) {
      await query(`
        UPDATE players SET
          trophy1_count = $1,  trophy2_count = $2,  trophy3_count = $3,
          trophy4_count = $4,  trophy5_count = $5,  trophy6_count = $6,
          trophy7_count = $7,  trophy8_count = $8,  trophy9_count = $9,
          trophy10_count = $10, trophy11_count = $11
        WHERE id = $12
      `, [trophy1Count ?? 0, trophy2Count ?? 0, trophy3Count ?? 0,
          trophy4Count ?? 0, trophy5Count ?? 0, trophy6Count ?? 0,
          trophy7Count ?? 0, trophy8Count ?? 0, trophy9Count ?? 0,
          trophy10Count ?? 0, trophy11Count ?? 0, playerId])
    } else {
      await query(`
        INSERT INTO player_trophy_history
          (player_id, year, trophy1_count, trophy2_count, trophy3_count,
           trophy4_count, trophy5_count, trophy6_count, trophy7_count,
           trophy8_count, trophy9_count, trophy10_count, trophy11_count)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (player_id, year) DO UPDATE SET
          trophy1_count  = EXCLUDED.trophy1_count,
          trophy2_count  = EXCLUDED.trophy2_count,
          trophy3_count  = EXCLUDED.trophy3_count,
          trophy4_count  = EXCLUDED.trophy4_count,
          trophy5_count  = EXCLUDED.trophy5_count,
          trophy6_count  = EXCLUDED.trophy6_count,
          trophy7_count  = EXCLUDED.trophy7_count,
          trophy8_count  = EXCLUDED.trophy8_count,
          trophy9_count  = EXCLUDED.trophy9_count,
          trophy10_count = EXCLUDED.trophy10_count,
          trophy11_count = EXCLUDED.trophy11_count
      `, [playerId, year,
          trophy1Count ?? 0, trophy2Count ?? 0, trophy3Count ?? 0,
          trophy4Count ?? 0, trophy5Count ?? 0, trophy6Count ?? 0,
          trophy7Count ?? 0, trophy8Count ?? 0, trophy9Count ?? 0,
          trophy10Count ?? 0, trophy11Count ?? 0])
    }

    res.json({ ok: true, year, playerId, isCurrent: parseInt(year) === currentYear })
  } catch (err) { next(err) }
})

// GET /api/teams/trophy-history/:year — trophies for a specific year
router.get("/trophy-history/:year", async (req, res, next) => {
  try {
    const year = parseInt(req.params.year)
    const settingsRes = await query(`SELECT value FROM app_settings WHERE key = 'current_year'`)
    const currentYear = parseInt(settingsRes.rows[0]?.value || new Date().getFullYear())
    const isCurrent   = year === currentYear

    if (isCurrent) {
      // Current year — read from players table directly
      const r = await query(`
        SELECT p.id, p.name, p.grade,
          p.avatar_id AS "avatarId", p.avatar_url AS "avatarUrl",
          p.team_id AS "teamId", t.name AS team, t.logo_url AS "teamLogo",
          p.trophy1_count AS "trophy1Count", p.trophy2_count AS "trophy2Count",
          p.trophy3_count AS "trophy3Count", p.trophy4_count AS "trophy4Count",
          p.trophy5_count AS "trophy5Count", p.trophy6_count AS "trophy6Count",
          p.trophy7_count AS "trophy7Count",
          p.trophy8_count AS "trophy8Count",
          COALESCE(p.trophy9_count,  0) AS "trophy9Count",
          COALESCE(p.trophy10_count, 0) AS "trophy10Count",
          COALESCE(p.trophy11_count, 0) AS "trophy11Count",
          COALESCE(p.trophy13_count, 0) AS "trophy13Count"
        FROM players p
        LEFT JOIN teams t ON t.id = p.team_id
        ORDER BY p.name
      `)
      return res.json(r.rows)
    }

    // Past year — read from trophy history table (if exists)
    try {
      const r = await query(`
        SELECT p.id, p.name, p.grade,
          p.avatar_id AS "avatarId", p.avatar_url AS "avatarUrl",
          p.team_id AS "teamId", t.name AS team, t.logo_url AS "teamLogo",
          COALESCE(h.trophy1_count,0) AS "trophy1Count",
          COALESCE(h.trophy2_count,0) AS "trophy2Count",
          COALESCE(h.trophy3_count,0) AS "trophy3Count",
          COALESCE(h.trophy4_count,0) AS "trophy4Count",
          COALESCE(h.trophy5_count,0) AS "trophy5Count",
          COALESCE(h.trophy6_count,0) AS "trophy6Count",
          COALESCE(h.trophy7_count,0) AS "trophy7Count",
          COALESCE(h.trophy8_count,0) AS "trophy8Count",
          COALESCE(h.trophy9_count,0) AS "trophy9Count",
          COALESCE(h.trophy10_count,0) AS "trophy10Count",
          COALESCE(h.trophy11_count,0) AS "trophy11Count",
          COALESCE(h.trophy13_count,0) AS "trophy13Count"
        FROM players p
        LEFT JOIN teams t ON t.id = p.team_id
        LEFT JOIN player_trophy_history h ON h.player_id = p.id AND h.year = $1
        ORDER BY p.name
      `, [year])
      return res.json(r.rows)
    } catch {
      // History table doesn't exist yet — return empty
      return res.json([])
    }
  } catch (err) { next(err) }
})


// GET /api/teams/trophy-current — current year trophies only
// = players table directly (players now stores current year counts)
router.get("/trophy-current", async (req, res, next) => {
  try {
    const r = await query(`
      SELECT
        p.id,
        p.name,
        p.grade,
        p.avatar_id  AS "avatarId",
        p.avatar_url AS "avatarUrl",
        p.team_id    AS "teamId",
        t.name       AS team,
        t.logo_url   AS "teamLogo",
        p.trophy1_count AS "trophy1Count",
        p.trophy2_count AS "trophy2Count",
        p.trophy3_count AS "trophy3Count",
        p.trophy4_count AS "trophy4Count",
        p.trophy5_count AS "trophy5Count",
        p.trophy6_count AS "trophy6Count",
        p.trophy7_count AS "trophy7Count",
        p.trophy8_count AS "trophy8Count",
        COALESCE(p.trophy9_count,  0) AS "trophy9Count",
        COALESCE(p.trophy10_count, 0) AS "trophy10Count",
        COALESCE(p.trophy11_count, 0) AS "trophy11Count",
        COALESCE(p.trophy13_count, 0) AS "trophy13Count"
      FROM players p
      LEFT JOIN teams t ON t.id = p.team_id
      ORDER BY p.name
    `).catch(async () => {
      // History table doesn't exist yet — return players counts as-is
      return await query(`
        SELECT p.id, p.name, p.grade,
          p.avatar_id AS "avatarId", p.avatar_url AS "avatarUrl",
          p.team_id AS "teamId", t.name AS team, t.logo_url AS "teamLogo",
          p.trophy1_count AS "trophy1Count", p.trophy2_count AS "trophy2Count",
          p.trophy3_count AS "trophy3Count", p.trophy4_count AS "trophy4Count",
          p.trophy5_count AS "trophy5Count", p.trophy6_count AS "trophy6Count",
          p.trophy7_count AS "trophy7Count", p.trophy8_count AS "trophy8Count",
          COALESCE(p.trophy9_count,  0) AS "trophy9Count",
          COALESCE(p.trophy10_count, 0) AS "trophy10Count",
          COALESCE(p.trophy11_count, 0) AS "trophy11Count",
          COALESCE(p.trophy13_count, 0) AS "trophy13Count"
        FROM players p LEFT JOIN teams t ON t.id = p.team_id ORDER BY p.name
      `)
    })
    res.json(r.rows)
  } catch (err) { next(err) }
})


// GET /api/teams/trophy-years — returns current year + all past years with history data
router.get("/trophy-years", async (req, res, next) => {
  try {
    const settingsRes = await query(`SELECT value FROM app_settings WHERE key = 'current_year'`)
    const currentYear = parseInt(settingsRes.rows[0]?.value || new Date().getFullYear())

    // Get all years that have history data
    const historyRes = await query(`
      SELECT DISTINCT year FROM player_trophy_history ORDER BY year DESC
    `).catch(() => ({ rows: [] }))

    const pastYears = historyRes.rows.map(r => r.year).filter(y => y !== currentYear)

    res.json({ currentYear, pastYears })
  } catch (err) { next(err) }
})

router.get("/championship", async (_req, res, next) => {
  try {
    const result = await query(`
      SELECT
        t.id,
        t.name,
        t.logo_url       AS "logoUrl",
        -- championship_pts = flat team league points (not × squad size)
        -- SUM(bdr_points - league_bdr) = all non-league-format BDR (UCL, weekly, etc.)
        (t.championship_pts + COALESCE(t.revolution_pts, 0) + COALESCE(SUM(p.bdr_points - p.league_bdr), 0))::int AS "totalBdr",
        t.championship_pts::int AS "leaguePts",
        COALESCE(t.revolution_pts, 0)::int AS "revolutionPts",
        COUNT(p.id)::int AS "playerCount",
        -- Revolution winners/runners-up tracked per player in bdr_awards_log
        COALESCE((
          SELECT ARRAY_AGG(bal.reference_id)
          FROM bdr_awards_log bal
          WHERE bal.award_type LIKE 'rev_winner_player_%'
            AND bal.reference_id IN (SELECT id FROM players WHERE team_id = t.id)
        ), '{}') AS "revWinnerIds",
        COALESCE((
          SELECT ARRAY_AGG(bal.reference_id)
          FROM bdr_awards_log bal
          WHERE bal.award_type LIKE 'rev_runnerup_player_%'
            AND bal.reference_id IN (SELECT id FROM players WHERE team_id = t.id)
        ), '{}') AS "revRunnerUpIds",
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id',           p.id,
            'name',         p.name,
            'grade',        p.grade,
            'bdrPoints',    (p.bdr_points - COALESCE(p.league_bdr, 0)),
            'avatarId',     p.avatar_id,
            'avatarUrl',    p.avatar_url
          ) ORDER BY (p.bdr_points - COALESCE(p.league_bdr, 0)) DESC
        ) FILTER (WHERE p.id IS NOT NULL) AS players
      FROM teams t
      LEFT JOIN players p ON p.team_id = t.id
      GROUP BY t.id, t.name, t.logo_url, t.championship_pts
      ORDER BY "totalBdr" DESC
    `)
    res.json(result.rows)
  } catch (err) { next(err) }
})
// GET /api/teams/season-autofill — compute current season stats for admin season record auto-fill
router.get("/season-autofill", authenticate, adminOnly, async (req, res, next) => {
  try {
    const season = await getCurrentSeason()
    const safe = async (fn) => { try { return await fn() } catch { return null } }

    // Top scorer (all match types, current season)
    const topScorerRes = await safe(() => query(`
      SELECT p.name,
        COALESCE(SUM(
          CASE WHEN mr.player_id   = p.id THEN COALESCE(mr.player_score, 0)
               WHEN mr.opponent_id = p.id THEN COALESCE(mr.opponent_score, 0)
               ELSE 0 END
        ), 0) AS goals
      FROM players p
      LEFT JOIN match_records mr
        ON (mr.player_id = p.id OR mr.opponent_id = p.id) AND mr.season_number = $1
      GROUP BY p.id, p.name ORDER BY goals DESC LIMIT 1
    `, [season]))

    // Highest MV player
    const highestMvRes = await safe(() => query(
      `SELECT name, market_value FROM players ORDER BY market_value DESC LIMIT 1`
    ))

    // Longest win streak this season — counts BOTH sides of each match
    const streakRes = await safe(() => query(`
      WITH all_results AS (
        SELECT player_id AS pid, result::text AS res, recorded_at, id
        FROM match_records WHERE season_number = $1

        UNION ALL

        SELECT opponent_id AS pid,
          CASE result::text WHEN 'win' THEN 'loss' WHEN 'loss' THEN 'win' ELSE 'draw' END AS res,
          recorded_at, id
        FROM match_records WHERE season_number = $1
      ),
      ordered AS (
        SELECT pid,
          res,
          ROW_NUMBER() OVER (PARTITION BY pid ORDER BY recorded_at, id) -
          ROW_NUMBER() OVER (PARTITION BY pid, res ORDER BY recorded_at, id) AS grp
        FROM all_results
      ),
      streaks AS (
        SELECT pid, COUNT(*) AS streak
        FROM ordered WHERE res = 'win'
        GROUP BY pid, grp
      )
      SELECT p.name, MAX(s.streak) AS longest
      FROM streaks s JOIN players p ON p.id = s.pid
      GROUP BY p.id, p.name ORDER BY longest DESC LIMIT 1
    `, [season]))

    // Ballon d'Or — highest BDR
    const ballondorRes = await safe(() => query(
      `SELECT name FROM players ORDER BY bdr_points DESC LIMIT 1`
    ))

    // Team League winner (group_knockout format: champions_final)
    const champFinalRes = await safe(() => query(`
      SELECT t.name AS team_name, tkm.winner_id
      FROM team_knockout_matches tkm
      JOIN teams t ON t.id = tkm.winner_id
      WHERE tkm.match_type = 'champions_final' AND tkm.status = 'completed' AND tkm.season_number = $1
    `, [season]))

    let teamLeagueWinner = champFinalRes?.rows[0]?.team_name ?? null
    let teamLeaguePlayers = []
    if (champFinalRes?.rows[0]?.winner_id) {
      const pl = await safe(() => query(
        "SELECT name FROM players WHERE team_id = $1 ORDER BY name",
        [champFinalRes.rows[0].winner_id]
      ))
      teamLeaguePlayers = pl?.rows?.map(p => p.name) ?? []
    }

    // UCL knockout winner
    const uclRes = await safe(() => query(`
      SELECT p.name AS player_name
      FROM ucl_knockout_tournaments ukt
      JOIN ucl_knockout_matches ukm
        ON ukm.tournament_id = ukt.id AND ukm.round = ukt.total_rounds
        AND ukm.status = 'completed' AND ukm.winner_id IS NOT NULL
      JOIN players p ON p.id = ukm.winner_id
      WHERE ukt.status != 'setup' ORDER BY ukt.created_at DESC LIMIT 1
    `))

    // Duo winner (most recent final for this season)
    const duoRes = await safe(() => query(`
      SELECT dp.duo_name
      FROM duo_fixtures df
      JOIN duo_pairs dp ON dp.id = df.winner_pair_id
      WHERE df.knockout_round = 'final' AND df.status = 'completed' AND dp.season_number = $1
      LIMIT 1
    `, [season]))

    // Championship winner — UCL winner's team
    const champshipRes = await safe(() => query(`
      SELECT t.id, t.name
      FROM ucl_knockout_tournaments ukt
      JOIN ucl_knockout_matches ukm
        ON ukm.tournament_id = ukt.id
        AND ukm.status = 'completed' AND ukm.winner_id IS NOT NULL
      JOIN players p ON p.id = ukm.winner_id
      JOIN teams t ON t.id = p.team_id
      WHERE ukt.status = 'completed'
      ORDER BY ukt.created_at DESC, ukm.round DESC LIMIT 1
    `))
    let championshipPlayers = []
    if (champshipRes?.rows[0]?.id) {
      const cpRes = await safe(() => query(
        "SELECT name FROM players WHERE team_id = $1 ORDER BY name",
        [champshipRes.rows[0].id]
      ))
      championshipPlayers = cpRes?.rows?.map(p => p.name) ?? []
    }

    // Weekly winners from existing season record, padded to 4 slots
    const existingRes = await safe(() => query(
      `SELECT weekly_winners FROM season_records WHERE season_number = $1 ORDER BY id DESC LIMIT 1`,
      [season]
    ))
    const existingWeekly = existingRes?.rows[0]?.weekly_winners?.filter(Boolean) ?? []
    const weeklyWinners = [...existingWeekly, "", "", "", ""].slice(0, 4)

    res.json({
      topScorer:           topScorerRes?.rows[0]?.name ?? null,
      topScorerGoals:      topScorerRes?.rows[0]?.goals ? parseInt(topScorerRes.rows[0].goals) : null,
      highestMvPlayer:     highestMvRes?.rows[0]?.name ?? null,
      highestMv:           highestMvRes?.rows[0]?.market_value ?? null,
      longestStreakPlayer:  streakRes?.rows[0]?.name ?? null,
      longestStreak:       streakRes?.rows[0]?.longest ? parseInt(streakRes.rows[0].longest) : null,
      ballondorWinner:     ballondorRes?.rows[0]?.name ?? null,
      teamLeagueWinner,
      teamLeaguePlayers,
      uclWinner:           uclRes?.rows[0]?.player_name ?? null,
      duoWinner:           duoRes?.rows[0]?.duo_name ?? null,
      championshipWinner:  champshipRes?.rows[0]?.name ?? null,
      championshipPlayers,
      weeklyWinners,
      season,
    })
  } catch (err) { next(err) }
})


router.get("/:id", authenticate, async (req, res, next) => {
  try {
    const season = await getCurrentSeason()
    // Same live-computed standings logic as GET / (the dashboard list),
    // just filtered down to this one team, so this page can never again
    // drift out of sync with what the dashboard shows for the same team.
    const teamRes = await query(`
      WITH fixture_scores AS (
        SELECT
          f.id,
          f.home_team_id,
          f.away_team_id,
          CASE
            WHEN f.status = 'completed' THEN COALESCE(f.home_score, 0)
            ELSE SUM(CASE
              WHEN COALESCE(mr.team_id, p.team_id) = f.home_team_id THEN CASE mr.result WHEN 'win' THEN 3 WHEN 'draw' THEN 1 ELSE 0 END
              WHEN COALESCE(mr.team_id, p.team_id) = f.away_team_id THEN CASE mr.result WHEN 'loss' THEN 3 WHEN 'draw' THEN 1 ELSE 0 END
              ELSE 0 END)
          END AS home_pts,
          CASE
            WHEN f.status = 'completed' THEN COALESCE(f.away_score, 0)
            ELSE SUM(CASE
              WHEN COALESCE(mr.team_id, p.team_id) = f.away_team_id THEN CASE mr.result WHEN 'win' THEN 3 WHEN 'draw' THEN 1 ELSE 0 END
              WHEN COALESCE(mr.team_id, p.team_id) = f.home_team_id THEN CASE mr.result WHEN 'loss' THEN 3 WHEN 'draw' THEN 1 ELSE 0 END
              ELSE 0 END)
          END AS away_pts,
          CASE
            WHEN f.status = 'completed' THEN COALESCE(f.home_goals, 0)
            ELSE COALESCE(SUM(CASE WHEN COALESCE(mr.team_id, p.team_id) = f.home_team_id THEN mr.player_score WHEN COALESCE(mr.team_id, p.team_id) = f.away_team_id THEN mr.opponent_score ELSE 0 END), 0)
          END AS home_goals,
          CASE
            WHEN f.status = 'completed' THEN COALESCE(f.away_goals, 0)
            ELSE COALESCE(SUM(CASE WHEN COALESCE(mr.team_id, p.team_id) = f.away_team_id THEN mr.player_score WHEN COALESCE(mr.team_id, p.team_id) = f.home_team_id THEN mr.opponent_score ELSE 0 END), 0)
          END AS away_goals,
          CASE WHEN f.status = 'completed' THEN 1 ELSE COUNT(mr.id) END AS results_logged
        FROM fixtures f
        LEFT JOIN match_records mr ON mr.fixture_id = f.id AND mr.match_type = 'league' AND mr.season_number = $1
        LEFT JOIN players p ON p.id = mr.player_id
        GROUP BY f.id, f.home_team_id, f.away_team_id, f.status, f.home_score, f.away_score, f.home_goals, f.away_goals
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
        SELECT home_team_id AS team_id, home_goals AS gf, away_goals AS ga, home_pts AS pts, outcome,
          (outcome = 'home') AS won, (outcome = 'draw') AS drawn, (outcome = 'away') AS lost
        FROM fixture_outcomes WHERE outcome IS NOT NULL
        UNION ALL
        SELECT away_team_id AS team_id, away_goals AS gf, home_goals AS ga, away_pts AS pts, outcome,
          (outcome = 'away') AS won, (outcome = 'draw') AS drawn, (outcome = 'home') AS lost
        FROM fixture_outcomes WHERE outcome IS NOT NULL
      ),
      team_stats AS (
        SELECT team_id,
          COUNT(*) AS played,
          COUNT(*) FILTER (WHERE won)   AS won,
          COUNT(*) FILTER (WHERE drawn) AS drawn,
          COUNT(*) FILTER (WHERE lost)  AS lost,
          COALESCE(SUM(gf), 0)  AS gf,
          COALESCE(SUM(ga), 0)  AS ga,
          COALESCE(SUM(pts), 0) AS points
        FROM per_team
        GROUP BY team_id
      ),
      all_positions AS (
        SELECT t.id,
          ROW_NUMBER() OVER (
            ORDER BY COALESCE(ts.points, 0) DESC,
                     COALESCE(ts.gf, 0) - COALESCE(ts.ga, 0) DESC,
                     COALESCE(ts.gf, 0) DESC
          ) AS position
        FROM teams t
        LEFT JOIN team_stats ts ON ts.team_id = t.id
      )
      SELECT
        t.id, t.name, t.logo_url AS "logoUrl", t.anthem_url AS "anthemUrl", t.score_points, t.created_at, t.budget, t.budget AS purse,
        t.predecessor_team_id AS "predecessorTeamId", t.successor_team_id AS "successorTeamId",
        COALESCE(ts.played, 0) AS played,
        COALESCE(ts.won, 0)    AS won,
        COALESCE(ts.drawn, 0)  AS drawn,
        COALESCE(ts.lost, 0)   AS lost,
        COALESCE(ts.gf, 0)     AS gf,
        COALESCE(ts.ga, 0)     AS ga,
        COALESCE(ts.gf, 0) - COALESCE(ts.ga, 0) AS gd,
        COALESCE(ts.points, 0) AS points,
        ap.position
      FROM teams t
      LEFT JOIN team_stats ts ON ts.team_id = t.id
      LEFT JOIN all_positions ap ON ap.id = t.id
      WHERE t.id = $2
    `, [season, req.params.id])
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

    // Check for duplicate email or username BEFORE creating the team
    // so we don't leave an orphan team if the user insert fails
    const dupCheck = await query(
      "SELECT email, username FROM users WHERE email=$1 OR username=$2",
      [ownerEmail, ownerUsername]
    )
    if (dupCheck.rows.length > 0) {
      const dup = dupCheck.rows[0]
      if (dup.email === ownerEmail)    return res.status(400).json({ error: `Email "${ownerEmail}" is already in use.` })
      if (dup.username === ownerUsername) return res.status(400).json({ error: `Username "${ownerUsername}" is already taken.` })
    }

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
  } catch (err) {
    if (err.code === "23505") {
      return res.status(400).json({ error: "Email or username is already in use. Please choose different credentials." })
    }
    next(err)
  }
})

// PATCH /api/teams/:id — admin edits team name or stats
// PATCH /api/teams/bulk-budget — admin sets auction budget per team
// Updates the active/retention auction session's budget_per_team.
// Also updates teams.budget directly so it shows current value in admin.
router.patch("/bulk-budget", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { budget } = req.body
    if (!budget || isNaN(budget)) return res.status(400).json({ error: "budget required" })
    const b = Number(budget)

    // Update active auction session if one exists
    const sessionRes = await query(
      "SELECT id FROM auction_sessions WHERE status != 'completed' ORDER BY id DESC LIMIT 1"
    )
    if (sessionRes.rows[0]) {
      await query("UPDATE auction_sessions SET budget_per_team = $1 WHERE id = $2", [b, sessionRes.rows[0].id])
    }

    // Also update teams.budget so it reflects the new starting amount
    await query("UPDATE teams SET budget = $1", [b])
    res.json({ success: true, budget: b })
  } catch (err) { next(err) }
})

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

// PATCH /api/teams/:id/settings — team owner (own team only) or admin updates name/logo/anthem
const settingsSchema = z.object({
  name:      z.string().min(1).optional(),
  logoUrl:   z.string().optional().nullable(),
  anthemUrl: z.string().optional().nullable(),
}).refine(d => d.name !== undefined || d.logoUrl !== undefined || d.anthemUrl !== undefined, {
  message: "Provide at least name, logoUrl, or anthemUrl",
})

router.patch("/:id/settings", authenticate, async (req, res, next) => {
  try {
    const targetId = parseInt(req.params.id)
    const isOwner  = req.user.role === "team_owner" && req.user.teamId === targetId
    const isAdmin  = req.user.role === "admin"
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Not authorized to edit this team" })
    }

    const { name, logoUrl, anthemUrl } = settingsSchema.parse(req.body)
    const result = await query(`
      UPDATE teams SET
        name       = COALESCE($1, name),
        logo_url   = COALESCE($2, logo_url),
        anthem_url = COALESCE($3, anthem_url)
      WHERE id = $4
      RETURNING id, name, logo_url AS "logoUrl", anthem_url AS "anthemUrl"
    `, [name ?? null, logoUrl ?? null, anthemUrl ?? null, targetId])

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

// DELETE /api/teams/:id — admin deletes team. Players are NEVER deleted
// by this — the database already sets players.team_id to NULL
// automatically (they just become unassigned, remaining fully intact in
// the system), same for the team owner's user account. Fixtures,
// lineups, and trade requests involving this team cascade-delete
// automatically too. What this explicitly cleans up first is everything
// the database does NOT auto-handle for a team reference (auction bid
// history, retentions, sales, live bidder state, and playoff records) —
// without doing this first, the delete would fail outright.
router.delete("/:id", authenticate, adminOnly, async (req, res, next) => {
  try {
    const teamId = req.params.id

    await query("DELETE FROM auction_bid_log WHERE team_id = $1", [teamId])
    await query("UPDATE auction_pool SET prev_team_id = NULL WHERE prev_team_id = $1", [teamId])
    await query("DELETE FROM auction_retentions WHERE team_id = $1", [teamId])
    await query("DELETE FROM auction_sales WHERE team_id = $1", [teamId])
    await query("UPDATE auction_sessions SET current_bidder_team_id = NULL WHERE current_bidder_team_id = $1", [teamId])
    await query(
      "DELETE FROM team_league_playoffs WHERE team1_id = $1 OR team2_id = $1 OR winner_team_id = $1",
      [teamId]
    )

    const result = await query(
      "DELETE FROM teams WHERE id = $1 RETURNING id, name", [teamId]
    )
    if (!result.rows[0]) return res.status(404).json({ error: "Team not found" })
    res.json({ deleted: true, team: result.rows[0] })
  } catch (err) { next(err) }
})

// Shared by season-reset (advance) and season-delete (undo) — clears
// everything tied to the CURRENT season's fixtures/UCL/team-stats/BDR,
// without ever touching match_records or trophy counts, since those are
// meant to persist as permanent history regardless of season resets.
async function clearCurrentSeasonData(q) {
  await q(`UPDATE teams SET played = 0, won = 0, drawn = 0, lost = 0, gf = 0, ga = 0, score_points = 0, championship_pts = 0`)

  // ── Migrate auction results: move next_team_id → team_id for all players ──
  // Players sold in the auction have next_team_id set. On new season start,
  // they officially move to their new team. Players not sold keep their team.
  await q(`UPDATE players SET team_id = next_team_id WHERE next_team_id IS NOT NULL`)
  await q(`UPDATE players SET next_team_id = NULL`)

  await q(`UPDATE players SET market_value = 0, form = '{}', bdr_points = 0, league_bdr = 0`)
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


// POST /api/teams/recalc-grades — admin only
// Runs ONLY the grade auto-update logic from season-reset, without
// clearing any season data or advancing the season number.
// Useful for previewing/applying grade changes mid-season or on demand.
router.post("/recalc-grades", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { season } = req.body
    const seasonRes = await query("SELECT value FROM app_settings WHERE key = 'current_season'")
    const targetSeason = season || parseInt(seasonRes.rows[0]?.value || "1")

    const gradeUpdateLog = []

    // Use two separate queries (player_id side + opponent_id side) instead of OR
    // OR conditions on large tables cause seq scans and timeouts
    const eligibleRes = await query(`
      WITH player_stats AS (
        SELECT
          player_id AS pid,
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE result = 'win')::int AS wins
        FROM match_records
        WHERE season_number = $1
        GROUP BY player_id
      ),
      opp_stats AS (
        SELECT
          opponent_id AS pid,
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE result = 'loss')::int AS wins
        FROM match_records
        WHERE season_number = $1
        GROUP BY opponent_id
      ),
      combined AS (
        SELECT pid,
          COALESCE(ps.total,0) + COALESCE(os.total,0) AS matches,
          COALESCE(ps.wins,0)  + COALESCE(os.wins,0)  AS wins
        FROM (SELECT DISTINCT pid FROM (
          SELECT player_id AS pid FROM match_records WHERE season_number = $1
          UNION
          SELECT opponent_id FROM match_records WHERE season_number = $1
        ) x) ids
        LEFT JOIN player_stats ps USING (pid)
        LEFT JOIN opp_stats os USING (pid)
      )
      SELECT
        p.id, p.name,
        p.grade::text AS current_grade, p.grade_floor::text AS grade_floor, p.grade_ceiling::text AS grade_ceiling,
        c.matches, c.wins,
        ROUND(c.wins::numeric / NULLIF(c.matches,0) * 100, 2) AS win_rate
      FROM combined c
      JOIN players p ON p.id = c.pid
      WHERE c.matches >= 20
      ORDER BY win_rate DESC, wins DESC
    `, [targetSeason])

    const eligible = eligibleRes.rows

    const rankToGrade = (rank) => {
      if (rank <= 10) return "S"
      if (rank <= 20) return "A"
      if (rank <= 40) return "B"
      return "C"
    }
    const GRADE_NUM = { S: 4, A: 3, B: 2, C: 1 }

    // Compute final grades for all eligible players
    const updates = []
    for (let i = 0; i < eligible.length; i++) {
      const player      = eligible[i]
      const rank        = i + 1
      const targetGrade = rankToGrade(rank)
      const current     = player.current_grade
      const floor       = player.grade_floor
      const tgtNum      = GRADE_NUM[targetGrade] || 1
      let finalGrade    = current
      const ceiling     = player.grade_ceiling

      if (floor && ceiling) {
        const floorNum   = GRADE_NUM[floor]   || 1
        const ceilingNum = GRADE_NUM[ceiling] || 4
        finalGrade = Math.min(ceilingNum, Math.max(floorNum, tgtNum)) === tgtNum ? targetGrade : (tgtNum > ceilingNum ? ceiling : floor)
      } else if (floor) {
        const floorNum = GRADE_NUM[floor] || 1
        finalGrade = tgtNum >= floorNum ? targetGrade : floor
      } else if (ceiling) {
        const ceilingNum = GRADE_NUM[ceiling] || 4
        finalGrade = tgtNum <= ceilingNum ? targetGrade : ceiling
      } else {
        finalGrade = targetGrade
      }

      if (finalGrade !== current) {
        updates.push({ id: player.id, grade: finalGrade, name: player.name, from: current, rank, winRate: player.win_rate, matches: player.matches, floor: floor || null })
        gradeUpdateLog.push({ name: player.name, from: current, to: finalGrade, rank, winRate: player.win_rate, matches: player.matches, floor: floor || null })
      }
    }

    // Bulk UPDATE in one query instead of N individual queries
    if (updates.length > 0) {
      const cases    = updates.map((u, i) => `WHEN id = $${i * 2 + 1} THEN $${i * 2 + 2}::player_grade`).join(" ")
      const ids      = updates.map(u => u.id)
      const params   = updates.flatMap(u => [u.id, u.grade])
      await query(
        `UPDATE players SET grade = CASE ${cases} ELSE grade END WHERE id = ANY($${params.length + 1}::int[])`,
        [...params, ids]
      )
    }

    // ── Second pass: apply floor/ceiling to players with < 20 matches ────────
    // These players are skipped by the main loop (not enough data to rank),
    // but their floor/ceiling constraints must still be honoured.
    // e.g. a player with floor=A and grade=C should be bumped to A even if
    // they've only played 5 games this season.
    const ineligibleRes = await query(`
      SELECT p.id, p.name, p.grade AS current_grade, p.grade_floor, p.grade_ceiling
      FROM players p
      WHERE (p.grade_floor IS NOT NULL OR p.grade_ceiling IS NOT NULL)
        AND p.id NOT IN (${eligible.length > 0 ? eligible.map(e => e.id).join(",") : "0"})
    `)

    for (const player of ineligibleRes.rows) {
      const current     = player.current_grade
      const floor       = player.grade_floor
      const ceiling     = player.grade_ceiling
      const currentNum  = GRADE_NUM[current] || 1
      const floorNum    = floor   ? (GRADE_NUM[floor]   || 1) : null
      const ceilingNum  = ceiling ? (GRADE_NUM[ceiling] || 4) : null

      let finalGrade = current
      if (floorNum   !== null && currentNum < floorNum)   finalGrade = floor
      if (ceilingNum !== null && currentNum > ceilingNum) finalGrade = ceiling

      if (finalGrade !== current) {
        await query(`UPDATE players SET grade = $1 WHERE id = $2`, [finalGrade, player.id])
        gradeUpdateLog.push({
          name:    player.name,
          from:    current,
          to:      finalGrade,
          rank:    null,
          winRate: null,
          matches: null,
          floor:   floor || null,
        })
      }
    }

    // ── Recalculate market value for ALL players ──────────────────────────────
    // Grades just changed — MV uses current grade in its matrices so every
    // player's MV must be refreshed, not just those whose grade changed.
    // Run this after both grade update passes so the new grades are committed.
    const allPlayersRes = await query("SELECT id FROM players")
    let mvRecalcCount = 0
    for (const p of allPlayersRes.rows) {
      try {
        await recalcMarketValue(p.id)
        mvRecalcCount++
      } catch (e) {
        console.error(`[recalcGrades] MV recalc failed for player ${p.id}:`, e.message)
      }
    }

    res.json({
      success: true,
      season: targetSeason,
      eligible: eligible.length,
      updated: gradeUpdateLog.length,
      changes: gradeUpdateLog,
      mvRecalculated: mvRecalcCount,
    })
  } catch (err) { next(err) }
})

// Archives current season by clearing its fixtures/UCL/team-stats, then
// ADVANCES the season number by one.
// Also auto-updates player grades based on completed season win rates.
router.post("/season-reset", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { withTransaction: tx } = await import("../db/pool.js")

    // ── Step 1: Get the season that is ending ───────────────────────────────
    const seasonRes = await query("SELECT value FROM app_settings WHERE key = 'current_season'")
    const endingSeason = parseInt(seasonRes.rows[0]?.value || "1")

    // ── Step 2: Auto-update player grades ───────────────────────────────────
    // Only players with 20+ matches in the ending season are eligible.
    // Rank by season win rate. Apply grade rules with protection.
    const gradeUpdateLog = []

    const eligibleRes = await query(`
      SELECT
        p.id,
        p.name,
        p.grade                                                      AS current_grade,
        p.grade_floor,
        p.grade_ceiling,
        COUNT(*)::int                                                AS matches,
        COUNT(*) FILTER (WHERE
          (mr.player_id   = p.id AND mr.result = 'win') OR
          (mr.opponent_id = p.id AND mr.result = 'loss')
        )::int                                                       AS wins,
        ROUND(
          COUNT(*) FILTER (WHERE
            (mr.player_id   = p.id AND mr.result = 'win') OR
            (mr.opponent_id = p.id AND mr.result = 'loss')
          )::numeric / NULLIF(COUNT(*), 0) * 100, 2
        )                                                            AS win_rate
      FROM players p
      JOIN match_records mr
        ON (mr.player_id = p.id OR mr.opponent_id = p.id)
        AND mr.season_number = $1
      GROUP BY p.id, p.name, p.grade, p.grade_floor, p.grade_ceiling
      HAVING COUNT(*) >= 20
      ORDER BY win_rate DESC, wins DESC
    `, [endingSeason])

    const eligible = eligibleRes.rows

    // Assign target grade by rank position
    const rankToGrade = (rank) => {
      if (rank <= 10) return "S"
      if (rank <= 20) return "A"
      if (rank <= 50) return "B"
      return "C"
    }

    const GRADE_NUM = { S: 4, A: 3, B: 2, C: 1 }

    for (let i = 0; i < eligible.length; i++) {
      const player      = eligible[i]
      const rank        = i + 1
      const targetGrade = rankToGrade(rank)
      const current     = player.current_grade
      const tgtNum      = GRADE_NUM[targetGrade] || 1
      const floor       = player.grade_floor
      const ceiling     = player.grade_ceiling

      let finalGrade = current
      if (floor && ceiling) {
        const floorNum   = GRADE_NUM[floor]   || 1
        const ceilingNum = GRADE_NUM[ceiling] || 4
        finalGrade = Math.min(ceilingNum, Math.max(floorNum, tgtNum)) === tgtNum ? targetGrade : (tgtNum > ceilingNum ? ceiling : floor)
      } else if (floor) {
        const floorNum = GRADE_NUM[floor] || 1
        finalGrade = tgtNum >= floorNum ? targetGrade : floor
      } else if (ceiling) {
        const ceilingNum = GRADE_NUM[ceiling] || 4
        finalGrade = tgtNum <= ceilingNum ? targetGrade : ceiling
      } else {
        finalGrade = targetGrade
      }

      if (finalGrade !== current) {
        await query(
          `UPDATE players SET grade = $1::player_grade WHERE id = $2`,
          [finalGrade, player.id]
        )
        const tag = floor ? ` [floor: ${floor}]` : ceiling ? ` [ceiling: ${ceiling}]` : ' [auto]'
        gradeUpdateLog.push(`${player.name}: ${current} → ${finalGrade} (rank #${rank}, ${player.win_rate}% WR)${tag}`)
      }
    }

    // ── Second pass: apply floor/ceiling to players with < 20 matches ────────
    // Skipped by the main loop but their floor/ceiling must still be honoured.
    const ineligibleRes2 = await query(`
      SELECT p.id, p.name, p.grade AS current_grade, p.grade_floor, p.grade_ceiling
      FROM players p
      WHERE (p.grade_floor IS NOT NULL OR p.grade_ceiling IS NOT NULL)
        AND p.id NOT IN (${eligible.length > 0 ? eligible.map(e => e.id).join(",") : "0"})
    `)

    for (const player of ineligibleRes2.rows) {
      const current     = player.current_grade
      const floor       = player.grade_floor
      const ceiling     = player.grade_ceiling
      const currentNum  = GRADE_NUM[current] || 1
      const floorNum    = floor   ? (GRADE_NUM[floor]   || 1) : null
      const ceilingNum  = ceiling ? (GRADE_NUM[ceiling] || 4) : null

      let finalGrade = current
      if (floorNum   !== null && currentNum < floorNum)   finalGrade = floor
      if (ceilingNum !== null && currentNum > ceilingNum) finalGrade = ceiling

      if (finalGrade !== current) {
        await query(`UPDATE players SET grade = $1 WHERE id = $2`, [finalGrade, player.id])
        gradeUpdateLog.push(`${player.name}: ${current} → ${finalGrade} [floor/ceiling enforced, <20 matches]`)
      }
    }

    // ── Step 3: Snapshot team standings into team_season_history ────────────
    // Capture each team's final league position, championship position, and
    // relegation status BEFORE the season data is wiped in Step 4.
    const currentYear = new Date().getFullYear()
    const standingsRes = await query(`
      SELECT
        t.id                                       AS team_id,
        t.won, t.drawn, t.lost,
        t.points,
        ROW_NUMBER() OVER (ORDER BY t.points DESC, t.won DESC, (t.won - t.lost) DESC) AS league_pos
      FROM teams t
      WHERE t.points > 0 OR t.won > 0 OR t.drawn > 0 OR t.lost > 0
    `)

    // Get championship positions — ranked by total team BDR points
    const champRes = await query(`
      SELECT
        t.id AS team_id,
        ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(p.bdr_points), 0) DESC) AS champ_pos
      FROM teams t
      LEFT JOIN players p ON p.team_id = t.id
      GROUP BY t.id
    `).catch(() => ({ rows: [] }))

    const champMap = {}
    for (const row of champRes.rows) champMap[row.team_id] = row.champ_pos

    // Determine relegated team — use the result of the seventh_place TLG
    // knockout match (stored in app_settings) rather than blindly relegating
    // the bottom 2 by league position. The 7th/8th place playoff loser is the
    // true relegated team; the winner survives regardless of league finish.
    const playedTeams = standingsRes.rows
    const relegationCutoff = playedTeams.length >= 8 ? playedTeams.length - 1 : null

    const relegatedRes = await query(
      "SELECT value FROM app_settings WHERE key = 'tlg_relegated_team_id'"
    )
    const relegatedTeamId = relegatedRes.rows[0]?.value
      ? parseInt(relegatedRes.rows[0].value)
      : null

    for (const team of playedTeams) {
      // If a relegation playoff was played, only the actual loser is relegated.
      // Fall back to bottom-2-by-position only when no playoff result exists.
      const relegated = relegatedTeamId
        ? team.team_id === relegatedTeamId
        : (relegationCutoff ? team.league_pos >= relegationCutoff : false)
      await query(`
        INSERT INTO team_season_history
          (team_id, season_number, year, team_league_pos, championship_pos, relegated)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (team_id, season_number) DO UPDATE SET
          year             = EXCLUDED.year,
          team_league_pos  = EXCLUDED.team_league_pos,
          championship_pos = EXCLUDED.championship_pos,
          relegated        = EXCLUDED.relegated
      `, [
        team.team_id,
        endingSeason,
        currentYear,
        team.league_pos,
        champMap[team.team_id] || null,
        relegated,
      ])
    }

    // ── Step 4: Reset season data and advance season number ─────────────────
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

    // ── Recalculate MV for ALL players after grade changes ───────────────────
    const allPRes = await query("SELECT id FROM players")
    let mvCount = 0
    for (const p of allPRes.rows) {
      try { await recalcMarketValue(p.id); mvCount++ } catch (e) {
        console.error(`[season-reset] MV recalc failed for player ${p.id}:`, e.message)
      }
    }

    res.json({
      success: true,
      message: "Season reset complete. Team stats, fixtures, trades, the entire UCL competition, and everyone's BDR points were cleared. Match history and trophies are preserved.",
      gradeUpdates: {
        eligible: eligible.length,
        changed: gradeUpdateLog.length,
        log: gradeUpdateLog,
      },
      mvRecalculated: mvCount,
    })
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

// ============================================================================
// Team League Playoffs — IPL-style: Qualifier 1 (1st v 2nd), Eliminator
// (3rd v 4th), Qualifier 2 (Q1 loser v Eliminator winner), Final (Q1
// winner v Q2 winner). Champion/Runner-up/3rd/4th are derived from this
// bracket, not raw group-stage standings, and that's what the BDR season
// awards now use.
// ============================================================================

const PLAYOFF_SELECT = `
  SELECT
    p.id, p.season_number AS "seasonNumber", p.match_type AS "matchType",
    p.team1_score AS "team1Score", p.team2_score AS "team2Score", p.status,
    p.winner_team_id AS "winnerTeamId",
    t1.id AS "team1Id", t1.name AS "team1Name", t1.logo_url AS "team1Logo",
    t2.id AS "team2Id", t2.name AS "team2Name", t2.logo_url AS "team2Logo"
  FROM team_league_playoffs p
  LEFT JOIN teams t1 ON p.team1_id = t1.id
  LEFT JOIN teams t2 ON p.team2_id = t2.id
`

async function getCurrentSeason(q = query) {
  const r = await q("SELECT value FROM app_settings WHERE key = 'current_season'")
  return parseInt(r.rows[0]?.value || "1")
}

// GET /api/teams/playoffs/current — read-only bracket for the current season
router.get("/playoffs/current", async (req, res, next) => {
  try {
    const season = await getCurrentSeason()
    const result = await query(PLAYOFF_SELECT + " WHERE p.season_number = $1 ORDER BY p.id", [season])
    res.json({ seasonNumber: season, matches: result.rows })
  } catch (err) { next(err) }
})

// POST /api/teams/playoffs/generate — create Qualifier 1 + Eliminator from
// the current top 4 group-stage standings. Requires every group-stage
// fixture to be completed first, and only ever generates once per season.
// This same logic also fires automatically the instant the last group-
// stage fixture is closed (see routes/fixtures.js) — this manual endpoint
// exists as a fallback/retry in case that ever needs re-running.
router.post("/playoffs/generate", authenticate, adminOnly, async (req, res, next) => {
  try {
    const remainingRes = await query(`SELECT COUNT(*) FROM fixtures WHERE status != 'completed'`)
    if (parseInt(remainingRes.rows[0].count) > 0) {
      return res.status(400).json({ error: "Group stage isn't fully complete yet — every fixture needs a result before playoffs can be generated." })
    }

    const season = await getCurrentSeason()
    const generated = await generatePlayoffs(season)
    if (!generated) {
      return res.status(400).json({ error: "Playoffs already generated for this season, or fewer than 4 teams exist." })
    }

    const result = await query(PLAYOFF_SELECT + " WHERE p.season_number = $1 ORDER BY p.id", [season])
    res.json({ seasonNumber: season, matches: result.rows })
  } catch (err) { next(err) }
})

// PATCH /api/teams/playoffs/:id/result — save a match's score, determine
// the winner, and propagate winner/loser into whichever match is next.
router.patch("/playoffs/:id/result", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { team1Score, team2Score } = z.object({
      team1Score: z.number().int().min(0),
      team2Score: z.number().int().min(0),
    }).parse(req.body)
    if (team1Score === team2Score) {
      return res.status(400).json({ error: "Playoff matches can't end in a draw — enter a decisive score." })
    }

    const matchRes = await query("SELECT * FROM team_league_playoffs WHERE id = $1", [req.params.id])
    const match = matchRes.rows[0]
    if (!match) return res.status(404).json({ error: "Match not found" })
    if (!match.team1_id || !match.team2_id) return res.status(400).json({ error: "Both teams aren't set for this match yet." })

    const winnerId = team1Score > team2Score ? match.team1_id : match.team2_id
    const loserId  = team1Score > team2Score ? match.team2_id : match.team1_id

    await query(
      "UPDATE team_league_playoffs SET team1_score=$1, team2_score=$2, winner_team_id=$3, status='completed' WHERE id=$4",
      [team1Score, team2Score, winnerId, match.id]
    )

    if (match.match_type === "qualifier1") {
      // Winner → Final (team1 slot), loser → Qualifier 2 (team1 slot)
      await query("UPDATE team_league_playoffs SET team1_id=$1 WHERE season_number=$2 AND match_type='final'", [winnerId, match.season_number])
      await query("UPDATE team_league_playoffs SET team1_id=$1 WHERE season_number=$2 AND match_type='qualifier2'", [loserId, match.season_number])
    } else if (match.match_type === "eliminator") {
      // Winner → Qualifier 2 (team2 slot), loser eliminated (4th place)
      await query("UPDATE team_league_playoffs SET team2_id=$1 WHERE season_number=$2 AND match_type='qualifier2'", [winnerId, match.season_number])
    } else if (match.match_type === "qualifier2") {
      // Winner → Final (team2 slot), loser eliminated (3rd place)
      await query("UPDATE team_league_playoffs SET team2_id=$1 WHERE season_number=$2 AND match_type='final'", [winnerId, match.season_number])
    } else if (match.match_type === "final") {
      // Champion decided — award season BDR based on the PLAYOFF result,
      // not raw group-stage standings. Only ever fires once per season.
      if (await claimAward("team_league_season", match.season_number)) {
        const eliminatorRes = await query(
          "SELECT winner_team_id, team1_id, team2_id FROM team_league_playoffs WHERE season_number=$1 AND match_type='eliminator'",
          [match.season_number]
        )
        const elim = eliminatorRes.rows[0]
        const fourthPlaceId = elim.winner_team_id === elim.team1_id ? elim.team2_id : elim.team1_id

        const qualifier2Res = await query(
          "SELECT winner_team_id, team1_id, team2_id FROM team_league_playoffs WHERE season_number=$1 AND match_type='qualifier2'",
          [match.season_number]
        )
        const q2 = qualifier2Res.rows[0]
        const thirdPlaceId = q2.winner_team_id === q2.team1_id ? q2.team2_id : q2.team1_id

        const placements = [
          { teamId: winnerId,      bdr: 12, flatPts: 12, label: "Team League Champion"  },
          { teamId: loserId,       bdr: 9,  flatPts: 9,  label: "Team League Runner-up" },
          { teamId: thirdPlaceId,  bdr: 7,  flatPts: 7,  label: "Team League 3rd Place" },
          { teamId: fourthPlaceId, bdr: 5,  flatPts: 5,  label: "Team League 4th Place" },
        ]
        for (const { teamId, bdr, flatPts, label } of placements) {
          const playersRes = await query("SELECT id FROM players WHERE team_id = $1", [teamId])
          for (const p of playersRes.rows) {
            await addBdrWithLabel(p.id, bdr, label)
            await addLeagueBdr(p.id, bdr) // track league BDR separately
          }
          await addTeamChampionshipPts(teamId, flatPts) // flat team pts
        }
      }

      // Trophy awards — re-checked EVERY time the Final's result is saved
      // (not gated by claimAward above), so correcting a wrong Final result
      // later automatically reverts the wrong team's roster and reassigns
      // the trophy to the actual correct champion's current roster.
      const rosterRes = await query("SELECT id FROM players WHERE team_id = $1", [winnerId])
      await reconcileTrophyRoster({
        sourceKey: `team_league_champion_season_${match.season_number}`,
        trophyColumn: "trophy2_count",
        playerIds: rosterRes.rows.map(r => r.id),
        seasonNumber: match.season_number,
      })

      const topScorerRes = await query(`
        SELECT p.id,
          COALESCE(SUM(CASE WHEN mr.player_id=p.id THEN mr.player_score WHEN mr.opponent_id=p.id THEN mr.opponent_score ELSE 0 END),0) AS goals,
          COALESCE(SUM(CASE WHEN mr.player_id=p.id THEN mr.opponent_score WHEN mr.opponent_id=p.id THEN mr.player_score ELSE 0 END),0) AS conceded
        FROM players p
        LEFT JOIN match_records mr ON (mr.player_id=p.id OR mr.opponent_id=p.id) AND mr.match_type='league'
        GROUP BY p.id
        ORDER BY goals DESC, conceded ASC
        LIMIT 1
      `)
      const topScorer = topScorerRes.rows[0]
      await awardOrReassignTrophy({
        sourceKey: `team_league_golden_boot_season_${match.season_number}`,
        trophyColumn: "trophy6_count",
        playerId: topScorer?.goals > 0 ? topScorer.id : null,
        seasonNumber: match.season_number,
      })

      // ── Auto-award Team League trophy to winning team (league+knockout format) ──
      await reconcileTeamTrophy({
        tournament:   "team_league",
        teamId:       winnerId,
        seasonNumber: match.season_number,
      })

      // ── Auto-fill season record — team league winner (playoff format) ──────
      const winnerTeamRes = await query("SELECT name FROM teams WHERE id = $1", [winnerId])
      const winnerPlayerNames = rosterRes.rows.length > 0
        ? (await query("SELECT name FROM players WHERE team_id = $1", [winnerId])).rows.map(r => r.name)
        : []
      await updateSeasonRecord(match.season_number, {
        team_league_winner:  winnerTeamRes.rows[0]?.name ?? null,
        team_league_players: winnerPlayerNames,
      })
    }

    const fresh = await query(PLAYOFF_SELECT + " WHERE p.id = $1", [match.id])
    res.json(fresh.rows[0])
  } catch (err) { next(err) }
})

// POST /api/teams/playoffs/reset — delete the current season's playoff
// bracket entirely, for redoing a mistake. Does NOT reverse any BDR
// already awarded if the Final had already completed — that's a manual
// correction if it happens.
router.post("/playoffs/reset", authenticate, adminOnly, async (req, res, next) => {
  try {
    const season = await getCurrentSeason()
    await query("DELETE FROM team_league_playoffs WHERE season_number = $1", [season])
    res.json({ success: true })
  } catch (err) { next(err) }
})

// GET /api/teams/championship — team BDR standings (sum of all player BDR)

// POST /api/teams/increment-year — admin only
// Increments the current year:
//  1. Saves current trophy counts to player_trophy_history (for trophy cabinet)
//  2. Resets trophy2–7 on players table (player profile shows current-year only)
//     trophy1 (Ballon d'Or / BDR) is KEPT on players table
//  3. Clears team standings + fixtures
//  Match records and player list untouched.
router.post("/increment-year", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { withTransaction: tx } = await import("../db/pool.js")

    // Ensure history table exists
    await query(`
      CREATE TABLE IF NOT EXISTS player_trophy_history (
        id            SERIAL PRIMARY KEY,
        player_id     INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        year          INT NOT NULL,
        trophy1_count INT DEFAULT 0,
        trophy2_count INT DEFAULT 0,
        trophy3_count INT DEFAULT 0,
        trophy4_count INT DEFAULT 0,
        trophy5_count INT DEFAULT 0,
        trophy6_count INT DEFAULT 0,
        trophy7_count INT DEFAULT 0,
        UNIQUE(player_id, year)
      )
    `)

    const yearRes = await query(`SELECT value FROM app_settings WHERE key = 'current_year'`)
    const currentYear = parseInt(yearRes.rows[0]?.value || new Date().getFullYear())
    const newYear = currentYear + 1

    await tx(async ({ query: q }) => {
      // 1. Save current trophy counts to history BEFORE resetting
      //    ON CONFLICT: accumulate (add) to existing history for that year
      await q(`
        INSERT INTO player_trophy_history
          (player_id, year, trophy1_count, trophy2_count, trophy3_count,
           trophy4_count, trophy5_count, trophy6_count, trophy7_count)
        SELECT id, $1,
          trophy1_count, trophy2_count, trophy3_count,
          trophy4_count, trophy5_count, trophy6_count, trophy7_count
        FROM players
        ON CONFLICT (player_id, year) DO UPDATE SET
          trophy1_count = player_trophy_history.trophy1_count + EXCLUDED.trophy1_count,
          trophy2_count = player_trophy_history.trophy2_count + EXCLUDED.trophy2_count,
          trophy3_count = player_trophy_history.trophy3_count + EXCLUDED.trophy3_count,
          trophy4_count = player_trophy_history.trophy4_count + EXCLUDED.trophy4_count,
          trophy5_count = player_trophy_history.trophy5_count + EXCLUDED.trophy5_count,
          trophy6_count = player_trophy_history.trophy6_count + EXCLUDED.trophy6_count,
          trophy7_count = player_trophy_history.trophy7_count + EXCLUDED.trophy7_count
      `, [currentYear])

      // 2. Reset trophy2–7 on players table (current year resets)
      //    trophy1 (Ballon d'Or) is KEPT on players table
      await q(`
        UPDATE players SET
          trophy2_count = 0,
          trophy3_count = 0,
          trophy4_count = 0,
          trophy5_count = 0,
          trophy6_count = 0,
          trophy7_count = 0
      `)

      // 3. Increment year in app_settings
      await q(`
        INSERT INTO app_settings (key, value) VALUES ('current_year', $1)
        ON CONFLICT (key) DO UPDATE SET value = $1
      `, [String(newYear)])

      // 4. Clear team standings and fixtures
      await clearCurrentSeasonData(q)
    })

    res.json({
      success: true,
      previousYear: currentYear,
      newYear,
      message: `Year incremented to ${newYear}. Trophy history saved. Current-year trophy counts (except Ballon d'Or) reset. Team standings and fixtures cleared.`
    })
  } catch (err) { next(err) }
})

export default router