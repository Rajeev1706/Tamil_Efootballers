import { Router } from "express"
import { query }  from "../db/pool.js"

const router = Router()

// POST /api/trending/view/:playerId — record a profile view (called when profile page loads)
router.post("/view/:playerId", async (req, res) => {
  try {
    const playerId = parseInt(req.params.playerId)
    if (!playerId || isNaN(playerId)) return res.json({ ok: true })
    await query(
      "INSERT INTO player_profile_views (player_id) VALUES ($1)",
      [playerId]
    )
    res.json({ ok: true })
  } catch { res.json({ ok: true }) }
})

// GET /api/trending/profiles — top 15 most viewed profiles in last 7 days
router.get("/profiles", async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT
        p.id, p.name, p.grade,
        p.avatar_id  AS "avatarId",
        p.avatar_url AS "avatarUrl",
        p.bdr_points AS "bdrPoints",
        p.market_value AS "marketValue",
        t.name AS "teamName",
        t.logo_url AS "teamLogo",
        COUNT(pv.id)::int AS views,
        COUNT(pv.id) FILTER (WHERE pv.viewed_at >= NOW() - INTERVAL '24 hours')::int AS "viewsToday"
      FROM player_profile_views pv
      JOIN players p ON p.id = pv.player_id
      LEFT JOIN teams t ON t.id = p.team_id
      WHERE pv.viewed_at >= NOW() - INTERVAL '7 days'
      GROUP BY p.id, p.name, p.grade, p.avatar_id, p.avatar_url,
               p.bdr_points, p.market_value, t.name, t.logo_url
      ORDER BY views DESC
      LIMIT 15
    `)
    res.json(rows)
  } catch (err) { next(err) }
})

// POST /api/trending/trigger-celebration — admin snapshots winners and clears both tables
router.post("/trigger-celebration", async (req, res, next) => {
  try {
    // Get top trending player
    const trendingRes = await query(`
      SELECT p.id, p.name, p.avatar_id AS "avatarId", p.avatar_url AS "avatarUrl",
             p.grade, t.name AS "teamName", COUNT(pv.id)::int AS views
      FROM player_profile_views pv
      JOIN players p ON p.id = pv.player_id
      LEFT JOIN teams t ON t.id = p.team_id
      WHERE pv.viewed_at >= NOW() - INTERVAL '7 days'
      GROUP BY p.id, p.name, p.avatar_id, p.avatar_url, p.grade, t.name
      ORDER BY views DESC LIMIT 1
    `)

    // Get top power ranking player
    const powerRes = await query(`
      SELECT p.id, p.name, p.avatar_id AS "avatarId", p.avatar_url AS "avatarUrl",
             p.grade, t.name AS "teamName",
             wpr.points, wpr.wins, wpr.matches
      FROM weekly_power_rankings wpr
      JOIN players p ON p.id = wpr.player_id
      LEFT JOIN teams t ON t.id = p.team_id
      WHERE wpr.week_start = (SELECT MAX(week_start) FROM weekly_power_rankings)
      ORDER BY wpr.rank ASC LIMIT 1
    `)

    const trending  = trendingRes.rows[0]
    const powerRank = powerRes.rows[0]

    if (!powerRank) {
      return res.status(400).json({ error: "No power ranking data — generate rankings first via Admin → Setup" })
    }

    // Save to app_settings
    const upsert = async (key, val) => query(
      "INSERT INTO app_settings (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2",
      [key, String(val)]
    )

    await upsert("weekly_celebration_triggered_at", new Date().toISOString())
    await upsert("active_celebration_type", "week_best_player")
    await upsert("active_celebration_triggered_at", new Date().toISOString())
    await upsert("active_celebration_data", JSON.stringify({
      name:   powerRank?.name,
      points: powerRank?.points,
      wins:   powerRank?.wins,
    }))
    // Trending data no longer used in celebration — only power ranking shown
    if (powerRank) {
      await upsert("weekly_celebration_power_id",      powerRank.id)
      await upsert("weekly_celebration_power_name",    powerRank.name)
      await upsert("weekly_celebration_power_points",  powerRank.points)
      await upsert("weekly_celebration_power_wins",    powerRank.wins)
      await upsert("weekly_celebration_power_team",    powerRank.teamName || "")
      await upsert("weekly_celebration_power_grade",   powerRank.grade || "")
    }

    // Clear power rankings table (reset for next period)
    await query("DELETE FROM weekly_power_rankings")
    // Save reset timestamp so rankings accumulate from this point
    await query(
      "INSERT INTO app_settings (key,value) VALUES ('power_ranking_last_reset_at',$1) ON CONFLICT (key) DO UPDATE SET value=$1",
      [new Date().toISOString()]
    )

    res.json({ success: true, trending, powerRank })
  } catch (err) { next(err) }
})

export default router