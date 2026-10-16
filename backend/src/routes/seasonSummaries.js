/**
 * Season Summary routes
 *
 * GET  /api/season-summaries/player/:id?season=N   — fetch cached summary
 * GET  /api/season-summaries/team/:id?season=N     — fetch cached summary
 * POST /api/season-summaries/regenerate/player/:id?season=N  — admin: regenerate one player
 * POST /api/season-summaries/regenerate/team/:id?season=N    — admin: regenerate one team
 * GET  /api/season-summaries/status?season=N       — admin: generation progress
 */

import express from "express"
import { query } from "../db/pool.js"
import { authenticate, adminOnly } from "../middleware/auth.js"
import { generateWithFallback } from "../services/gemini.js"

const router = express.Router()

// ── Predefined templates for <50% win rate ────────────────────────────────────
const PLAYER_LOW_TEMPLATES = [
  "{name} battled hard across Season {season} — every match a learning experience, every defeat a step toward greatness. The grind continues.",
  "Season {season} was tough for {name}, but legends are forged through adversity. The pitch will remember the hunger that never faded.",
  "Not every season ends with a trophy, but {name} showed up for every battle. Season {season} planted seeds — the harvest is coming.",
  "{name} competed with everything they had this season. Season {season} tested their limits and built an unbreakable foundation for what's next.",
  "A challenging Season {season} for {name}, but champions aren't made in the good times. Every loss was a lesson written in the language of the pitch.",
]

const TEAM_LOW_TEMPLATES = [
  "{name} gave everything in Season {season} — a season of grit, resilience, and lessons that only the pitch can teach. The rebuild starts now.",
  "Season {season} tested {name} to their limits. But this squad showed heart every matchday, and that fire will light the way forward.",
  "Not the season {name} dreamed of, but the character shown on the pitch in Season {season} is the DNA of future champions.",
  "{name} weathered the storm of Season {season}. Every defeat, every hard match — all fuel for the fire that will ignite next season.",
  "Season {season} forged {name} through fire. The lessons are locked in. The squad is ready for what comes next.",
]

function pickTemplate(templates, name, season) {
  const tpl = templates[Math.floor(Math.random() * templates.length)]
  return tpl.replace(/{name}/g, name).replace(/{season}/g, `S${season}`)
}

// ── Helper: build player stats for prompt ─────────────────────────────────────
async function getPlayerSeasonStats(playerId, season) {
  const res = await query(`
    SELECT
      p.name,
      COUNT(*)::int                                        AS total,
      COUNT(*) FILTER (WHERE
        (mr.player_id = p.id AND mr.result = 'win') OR
        (mr.opponent_id = p.id AND mr.result = 'loss')
      )::int                                               AS wins,
      COUNT(*) FILTER (WHERE mr.result = 'draw')::int     AS draws,
      COUNT(*) FILTER (WHERE
        (mr.player_id = p.id AND mr.result = 'loss') OR
        (mr.opponent_id = p.id AND mr.result = 'win')
      )::int                                               AS losses,
      COALESCE(SUM(
        CASE WHEN mr.player_id = p.id THEN mr.player_score
             ELSE mr.opponent_score END
      ), 0)::int                                           AS goals_scored,
      COALESCE(SUM(
        CASE WHEN mr.player_id = p.id THEN mr.opponent_score
             ELSE mr.player_score END
      ), 0)::int                                           AS goals_conceded,
      p.bdr_points,
      p.grade
    FROM players p
    JOIN match_records mr
      ON (mr.player_id = p.id OR mr.opponent_id = p.id)
      AND mr.season_number = $2
    WHERE p.id = $1
    GROUP BY p.id, p.name, p.bdr_points, p.grade
  `, [playerId, season])

  return res.rows[0] || null
}

// ── Helper: build team stats for prompt ───────────────────────────────────────
async function getTeamSeasonStats(teamId, season) {
  const res = await query(`
    SELECT
      t.name,
      COUNT(DISTINCT mr.id)::int                           AS total,
      COUNT(DISTINCT mr.id) FILTER (WHERE
        (mr.player_id  = ANY(SELECT id FROM players WHERE team_id = $1) AND mr.result = 'win') OR
        (mr.opponent_id = ANY(SELECT id FROM players WHERE team_id = $1) AND mr.result = 'loss')
      )::int                                               AS wins,
      COUNT(DISTINCT mr.id) FILTER (WHERE mr.result = 'draw')::int AS draws
    FROM teams t
    JOIN players p2 ON p2.team_id = t.id
    JOIN match_records mr
      ON (mr.player_id = p2.id OR mr.opponent_id = p2.id)
      AND mr.season_number = $2
    WHERE t.id = $1
    GROUP BY t.id, t.name
  `, [teamId, season])

  const row = res.rows[0]
  if (!row) return null
  const losses = row.total - row.wins - row.draws
  return { ...row, losses }
}

// ── Helper: generate + save player summary ────────────────────────────────────
async function generatePlayerSummary(playerId, season) {
  const stats = await getPlayerSeasonStats(playerId, season)
  if (!stats) return null

  const winRate = stats.total > 0 ? (stats.wins / stats.total) * 100 : 0
  let summaryText, generatedBy

  if (winRate >= 50 && stats.total >= 5) {
    const goalDiff = stats.goals_scored - stats.goals_conceded
    const goalDiffStr = goalDiff >= 0 ? `+${goalDiff}` : `${goalDiff}`
    const prompt = `You are a sports journalist writing the official season review for a Tamil online eFootball esports league called "Dshann League" (Pes Park platform).

Player: ${stats.name}
Season: S${season}
Grade: ${stats.grade || "N/A"}
Record: ${stats.wins}W / ${stats.draws}D / ${stats.losses}L across ${stats.total} matches
Win rate: ${winRate.toFixed(1)}%
Goals scored: ${stats.goals_scored} | Goals conceded: ${stats.goals_conceded} | Goal difference: ${goalDiffStr}
BDR Points: ${stats.bdr_points || 0}

Write a detailed, engaging 4-6 sentence season overview for ${stats.name}'s S${season} campaign. Cover: how dominant or consistent the season was based on the win rate, what the goal numbers say about their attacking and defensive style, whether their BDR points reflect a top-tier performer, and end with a forward-looking or defining statement about their season legacy. Write like a real sports commentator doing a season wrap-up — specific, vivid, personal. Use strong esports/football language. DO NOT use asterisks, bullet points, or markdown. Plain text only. Do not exceed 160 words.`

    const result = await generateWithFallback(prompt)
    if (result.text) {
      summaryText = result.text
      generatedBy = result.model || "ai"
    } else {
      summaryText = pickTemplate(PLAYER_LOW_TEMPLATES, stats.name, season)
      generatedBy = "template"
    }
  } else {
    summaryText = pickTemplate(PLAYER_LOW_TEMPLATES, stats.name, season)
    generatedBy = "template"
  }

  await query(`
    INSERT INTO season_player_summaries (player_id, season_number, summary_text, win_rate, generated_by, generated_at)
    VALUES ($1, $2, $3, $4, $5, NOW())
    ON CONFLICT (player_id, season_number)
    DO UPDATE SET summary_text = $3, win_rate = $4, generated_by = $5, generated_at = NOW()
  `, [playerId, season, summaryText, winRate.toFixed(2), generatedBy])

  return { summaryText, generatedBy, winRate, stats }
}

// ── Helper: generate + save team summary ─────────────────────────────────────
async function generateTeamSummary(teamId, season) {
  const stats = await getTeamSeasonStats(teamId, season)
  if (!stats) return null

  const winRate = stats.total > 0 ? (stats.wins / stats.total) * 100 : 0
  let summaryText, generatedBy

  if (winRate >= 50 && stats.total >= 5) {
    const prompt = `You are a sports journalist writing the official season review for a Tamil online eFootball esports league called "Dshann League" (Pes Park platform).

Team: ${stats.name}
Season: S${season}
Record: ${stats.wins}W / ${stats.draws}D / ${stats.losses}L across ${stats.total} combined matches
Win rate: ${winRate.toFixed(1)}%

Write a detailed, engaging 4-6 sentence season overview for ${stats.name}'s S${season} campaign as a team. Cover: how dominant or consistent the squad was based on the win rate, what the record says about their collective strength, how the draws and losses factor into their overall story, and close with a defining statement about what this season meant for the franchise. Write like a real sports commentator doing a season wrap-up — specific, vivid, team-focused. Use strong esports/football language. DO NOT use asterisks, bullet points, or markdown. Plain text only. Do not exceed 160 words.`

    const result = await generateWithFallback(prompt)
    if (result.text) {
      summaryText = result.text
      generatedBy = result.model || "ai"
    } else {
      summaryText = pickTemplate(TEAM_LOW_TEMPLATES, stats.name, season)
      generatedBy = "template"
    }
  } else {
    summaryText = pickTemplate(TEAM_LOW_TEMPLATES, stats.name, season)
    generatedBy = "template"
  }

  await query(`
    INSERT INTO season_team_summaries (team_id, season_number, summary_text, win_rate, generated_by, generated_at)
    VALUES ($1, $2, $3, $4, $5, NOW())
    ON CONFLICT (team_id, season_number)
    DO UPDATE SET summary_text = $3, win_rate = $4, generated_by = $5, generated_at = NOW()
  `, [teamId, season, summaryText, winRate.toFixed(2), generatedBy])

  return { summaryText, generatedBy, winRate, stats }
}

// ── GET /player/:id ───────────────────────────────────────────────────────────
router.get("/player/:id", async (req, res, next) => {
  try {
    const { id } = req.params
    const seasonRaw = req.query.season
    let season = parseInt(seasonRaw)

    if (!season) {
      const s = await query("SELECT value FROM app_settings WHERE key = 'current_season'")
      season = parseInt(s.rows[0]?.value || "1")
    }

    const cached = await query(
      "SELECT * FROM season_player_summaries WHERE player_id = $1 AND season_number = $2",
      [id, season]
    )

    if (cached.rows[0]) return res.json(cached.rows[0])
    res.json(null)
  } catch (err) { next(err) }
})

// ── GET /team/:id ─────────────────────────────────────────────────────────────
router.get("/team/:id", async (req, res, next) => {
  try {
    const { id } = req.params
    const seasonRaw = req.query.season
    let season = parseInt(seasonRaw)

    if (!season) {
      const s = await query("SELECT value FROM app_settings WHERE key = 'current_season'")
      season = parseInt(s.rows[0]?.value || "1")
    }

    const cached = await query(
      "SELECT * FROM season_team_summaries WHERE team_id = $1 AND season_number = $2",
      [id, season]
    )

    if (cached.rows[0]) return res.json(cached.rows[0])
    res.json(null)
  } catch (err) { next(err) }
})

// ── POST /regenerate/player/:id (admin) ───────────────────────────────────────
router.post("/regenerate/player/:id", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { id } = req.params
    const seasonRaw = req.query.season
    let season = parseInt(seasonRaw)

    if (!season) {
      const s = await query("SELECT value FROM app_settings WHERE key = 'current_season'")
      season = parseInt(s.rows[0]?.value || "1")
    }

    const result = await generatePlayerSummary(parseInt(id), season)
    if (!result) return res.status(404).json({ error: "Player not found or no match data for this season" })
    res.json({ success: true, ...result })
  } catch (err) { next(err) }
})

// ── POST /regenerate/team/:id (admin) ─────────────────────────────────────────
router.post("/regenerate/team/:id", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { id } = req.params
    const seasonRaw = req.query.season
    let season = parseInt(seasonRaw)

    if (!season) {
      const s = await query("SELECT value FROM app_settings WHERE key = 'current_season'")
      season = parseInt(s.rows[0]?.value || "1")
    }

    const result = await generateTeamSummary(parseInt(id), season)
    if (!result) return res.status(404).json({ error: "Team not found or no match data for this season" })
    res.json({ success: true, ...result })
  } catch (err) { next(err) }
})

// ── GET /status (admin) ───────────────────────────────────────────────────────
router.get("/status", authenticate, adminOnly, async (req, res, next) => {
  try {
    const seasonRaw = req.query.season
    let season = parseInt(seasonRaw)
    if (!season) {
      const s = await query("SELECT value FROM app_settings WHERE key = 'current_season'")
      season = parseInt(s.rows[0]?.value || "1")
    }

    const [playerCount, teamCount, playerDone, teamDone] = await Promise.all([
      query("SELECT COUNT(*) FROM players"),
      query("SELECT COUNT(*) FROM teams"),
      query("SELECT COUNT(*) FROM season_player_summaries WHERE season_number = $1", [season]),
      query("SELECT COUNT(*) FROM season_team_summaries WHERE season_number = $1", [season]),
    ])

    res.json({
      season,
      players: { total: parseInt(playerCount.rows[0].count), done: parseInt(playerDone.rows[0].count) },
      teams:   { total: parseInt(teamCount.rows[0].count),  done: parseInt(teamDone.rows[0].count) },
    })
  } catch (err) { next(err) }
})

// ── Exported queue trigger (called by teams.js season-reset) ──────────────────
export async function triggerSeasonSummaryGeneration(season) {
  console.log(`[season-summary] Starting queue generation for Season ${season}`)

  // Fetch all player IDs and team IDs
  const [playersRes, teamsRes] = await Promise.all([
    query("SELECT id FROM players ORDER BY id"),
    query("SELECT id FROM teams ORDER BY id"),
  ])

  const playerIds = playersRes.rows.map(r => r.id)
  const teamIds   = teamsRes.rows.map(r => r.id)

  // Queue: process one by one with 1.5s delay to avoid RPM limits
  ;(async () => {
    console.log(`[season-summary] Processing ${playerIds.length} players, ${teamIds.length} teams for S${season}`)

    for (const playerId of playerIds) {
      try {
        await generatePlayerSummary(playerId, season)
        console.log(`[season-summary] ✓ player ${playerId}`)
      } catch (err) {
        console.error(`[season-summary] ✗ player ${playerId}: ${err.message}`)
      }
      await new Promise(r => setTimeout(r, 1500))
    }

    for (const teamId of teamIds) {
      try {
        await generateTeamSummary(teamId, season)
        console.log(`[season-summary] ✓ team ${teamId}`)
      } catch (err) {
        console.error(`[season-summary] ✗ team ${teamId}: ${err.message}`)
      }
      await new Promise(r => setTimeout(r, 1500))
    }

    console.log(`[season-summary] ✅ All summaries generated for S${season}`)
  })()
}

export default router