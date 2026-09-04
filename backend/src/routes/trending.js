import { Router } from "express"
import { query }  from "../db/pool.js"

const router = Router()

// ── Shared live power-ranking query ──────────────────────────────────────────
// Mirrors computeLive() in powerRankings.js — counts BOTH sides of match_records
// and respects power_ranking_last_reset_at so the window starts from the last
// admin reset, not just a fixed rolling window.
async function getLivePowerRank1() {
  // Find window start: the later of (reset timestamp) and (IST midnight 4 days ago)
  const resetRes = await query(
    "SELECT value FROM app_settings WHERE key = 'power_ranking_last_reset_at'"
  )
  const resetAt = resetRes.rows[0]?.value ? new Date(resetRes.rows[0].value) : null

  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
  const nowIST        = new Date(Date.now() + IST_OFFSET_MS)
  const rollingStart  = new Date(Date.UTC(
    nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate() - 3, 0, 0, 0, 0
  ) - IST_OFFSET_MS)

  const windowStart = resetAt && resetAt > rollingStart ? resetAt : rollingStart

  const { rows } = await query(`
    WITH all_matches AS (
      SELECT mr.player_id AS pid, mr.result::text AS result
      FROM match_records mr
      WHERE mr.recorded_at >= $1

      UNION ALL

      SELECT mr.opponent_id AS pid,
        CASE mr.result::text
          WHEN 'win'  THEN 'loss'
          WHEN 'loss' THEN 'win'
          ELSE 'draw'
        END AS result
      FROM match_records mr
      WHERE mr.recorded_at >= $1
    ),
    stats AS (
      SELECT
        pid,
        COUNT(*) FILTER (WHERE result = 'win')::int  AS wins,
        COUNT(*) FILTER (WHERE result = 'draw')::int AS draws,
        COUNT(*) FILTER (WHERE result = 'loss')::int AS losses,
        COUNT(*)::int AS matches,
        (COUNT(*) FILTER (WHERE result = 'win') * 3 +
         COUNT(*) FILTER (WHERE result = 'draw') * 1)::int AS points
      FROM all_matches
      GROUP BY pid
      HAVING COUNT(*) >= 1
    )
    SELECT
      s.pid AS id, p.name, p.grade,
      p.avatar_id  AS "avatarId",
      p.avatar_url AS "avatarUrl",
      t.name AS "teamName",
      s.wins, s.draws, s.losses, s.matches, s.points
    FROM stats s
    JOIN players p    ON p.id  = s.pid
    LEFT JOIN teams t ON t.id  = p.team_id
    ORDER BY s.points DESC, s.wins DESC, s.matches DESC
    LIMIT 1
  `, [windowStart.toISOString()])

  return rows[0] || null
}

// ── POST /api/trending/view/:playerId — record a profile view ────────────────
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

// ── GET /api/trending/profiles — top 15 most viewed profiles in last 7 days ──
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

// ── POST /api/trending/trigger-celebration ────────────────────────────────────
// Admin triggers this to:
//   1. Snapshot the current #1 power ranking player (computed live)
//   2. Save their data to app_settings (feeds WeeklyCelebrationOverlay)
//   3. Set weekly_celebration_triggered_at = NOW() (starts 8h celebration window)
//   4. Reset the power rankings window (power_ranking_last_reset_at = NOW())
router.post("/trigger-celebration", async (req, res, next) => {
  try {
    // ── Get top trending player (for admin feedback only) ───────────────────
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
    const trending = trendingRes.rows[0]

    // ── Get #1 power ranking player — computed LIVE from match_records ───────
    const powerRank = await getLivePowerRank1()

    if (!powerRank) {
      return res.status(400).json({
        error: "No match data in the current window — no matches have been played since the last reset."
      })
    }

    // ── Save winner to app_settings ──────────────────────────────────────────
    const upsert = async (key, val) => query(
      "INSERT INTO app_settings (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2",
      [key, String(val)]
    )

    const now = new Date().toISOString()

    await upsert("weekly_celebration_triggered_at",  now)
    await upsert("active_celebration_type",          "week_best_player")
    await upsert("active_celebration_triggered_at",  now)
    await upsert("active_celebration_data", JSON.stringify({
      name:   powerRank.name,
      points: powerRank.points,
      wins:   powerRank.wins,
    }))
    await upsert("weekly_celebration_power_id",      powerRank.id)
    await upsert("weekly_celebration_power_name",    powerRank.name)
    await upsert("weekly_celebration_power_points",  powerRank.points)
    await upsert("weekly_celebration_power_wins",    powerRank.wins)
    await upsert("weekly_celebration_power_team",    powerRank.teamName || "")
    await upsert("weekly_celebration_power_grade",   powerRank.grade || "")

    // ── Reset: new window starts from NOW() ──────────────────────────────────
    // powerRankings.js reads this value and uses it as the window start,
    // so all match_records before this moment are excluded from rankings.
    await upsert("power_ranking_last_reset_at", now)

    res.json({ success: true, trending, powerRank })
  } catch (err) { next(err) }
})

export default router