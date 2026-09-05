import { Router } from "express"
import { query }  from "../db/pool.js"
import { authenticate, adminOnly } from "../middleware/auth.js"
import cron from "node-cron"

const router = Router()

// ── Window start: only resets when admin explicitly triggers ─────────────────
// Uses power_ranking_last_reset_at as the fixed window start.
// If admin has never triggered a reset, falls back to IST Monday of current week
// so the window is stable and doesn't shift every day automatically.
async function getWindowStart() {
  const resetRes = await query(
    "SELECT value FROM app_settings WHERE key = 'power_ranking_last_reset_at'"
  )
  const resetAt = resetRes.rows[0]?.value ? new Date(resetRes.rows[0].value) : null

  // If admin has triggered a reset, use that as the fixed start
  if (resetAt) return resetAt

  // Fallback: start of current IST week (Monday midnight IST)
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
  const nowIST        = new Date(Date.now() + IST_OFFSET_MS)
  const dayOfWeek     = nowIST.getUTCDay() // 0=Sun, 1=Mon...
  const daysToMonday  = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const mondayIST     = new Date(Date.UTC(
    nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate() - daysToMonday, 0, 0, 0, 0
  ) - IST_OFFSET_MS)

  return mondayIST
}

// ── Core live computation ─────────────────────────────────────────────────────
// Counts every match from BOTH sides of match_records so no match is missed.
// Window starts from the last admin reset (or 4 days ago if no reset yet).
async function computeLive() {
  const now         = new Date()
  const windowStart = await getWindowStart()

  const weekStartDate = windowStart.toISOString().slice(0, 10)
  const weekEndDate   = now.toISOString().slice(0, 10)

  const { rows } = await query(`
    WITH all_matches AS (
      SELECT mr.player_id AS pid, mr.result::text AS result
      FROM match_records mr
      WHERE mr.recorded_at >= $1 AND mr.recorded_at <= $2

      UNION ALL

      SELECT mr.opponent_id AS pid,
        CASE mr.result::text
          WHEN 'win'  THEN 'loss'
          WHEN 'loss' THEN 'win'
          ELSE 'draw'
        END AS result
      FROM match_records mr
      WHERE mr.recorded_at >= $1 AND mr.recorded_at <= $2
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
      s.pid        AS player_id,
      s.wins, s.draws, s.losses, s.matches, s.points,
      p.id, p.name, p.grade,
      p.avatar_id  AS "avatarId",
      p.avatar_url AS "avatarUrl",
      t.name       AS "teamName",
      t.logo_url   AS "teamLogo"
    FROM stats s
    JOIN players p    ON p.id  = s.pid
    LEFT JOIN teams t ON t.id  = p.team_id
    ORDER BY s.points DESC, s.wins DESC, s.matches DESC
  `, [windowStart.toISOString(), now.toISOString()])

  return { weekStartDate, weekEndDate, rows }
}

// ── GET /api/power-rankings/current — always live ────────────────────────────
router.get("/current", async (req, res, next) => {
  try {
    const { weekStartDate, weekEndDate, rows } = await computeLive()

    // Prev-week ranks from snapshot for rank-change badges
    const { rows: prevRanks } = await query(`
      SELECT player_id, rank
      FROM weekly_power_rankings
      WHERE week_start = (
        SELECT MAX(week_start) FROM weekly_power_rankings WHERE week_start < $1
      )
    `, [weekStartDate])
    const prevRankMap = Object.fromEntries(prevRanks.map(r => [r.player_id, r.rank]))

    const result = rows.slice(0, 15).map((r, i) => ({
      rank:      i + 1,
      prevRank:  prevRankMap[r.player_id] || null,
      points:    r.points,
      wins:      r.wins,
      draws:     r.draws,
      losses:    r.losses,
      matches:   r.matches,
      weekStart: weekStartDate,
      weekEnd:   weekEndDate,
      id:        r.id,
      name:      r.name,
      grade:     r.grade,
      avatarId:  r.avatarId,
      avatarUrl: r.avatarUrl,
      teamName:  r.teamName,
      teamLogo:  r.teamLogo,
    }))

    res.json(result)
  } catch (err) { next(err) }
})

// ── GET /api/power-rankings/history ──────────────────────────────────────────
router.get("/history", async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT DISTINCT week_start AS "weekStart", week_end AS "weekEnd"
      FROM weekly_power_rankings
      ORDER BY week_start DESC
      LIMIT 20
    `)
    res.json(rows)
  } catch (err) { next(err) }
})

// ── GET /api/power-rankings/week/:weekStart ───────────────────────────────────
router.get("/week/:weekStart", async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT
        wpr.rank, wpr.prev_rank AS "prevRank", wpr.points,
        wpr.wins, wpr.draws, wpr.losses, wpr.matches,
        wpr.week_start AS "weekStart", wpr.week_end AS "weekEnd",
        p.id, p.name, p.grade,
        p.avatar_id  AS "avatarId",
        p.avatar_url AS "avatarUrl",
        t.name AS "teamName", t.logo_url AS "teamLogo"
      FROM weekly_power_rankings wpr
      JOIN players p    ON p.id  = wpr.player_id
      LEFT JOIN teams t ON t.id  = p.team_id
      WHERE wpr.week_start = $1
      ORDER BY wpr.rank ASC
    `, [req.params.weekStart])
    res.json(rows)
  } catch (err) { next(err) }
})

// ── POST /api/power-rankings/generate — admin: archive a snapshot ─────────────
router.post("/generate", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { weekStartDate, weekEndDate, rows } = await computeLive()
    if (rows.length === 0)
      return res.json({ success: true, weekStart: weekStartDate, weekEnd: weekEndDate, count: 0 })

    const { rows: prevRanks } = await query(`
      SELECT player_id, rank FROM weekly_power_rankings
      WHERE week_start = (SELECT MAX(week_start) FROM weekly_power_rankings WHERE week_start < $1)
    `, [weekStartDate])
    const prevRankMap = Object.fromEntries(prevRanks.map(r => [r.player_id, r.rank]))

    await query("DELETE FROM weekly_power_rankings WHERE week_start = $1", [weekStartDate])
    for (let i = 0; i < Math.min(rows.length, 50); i++) {
      const r = rows[i], rank = i + 1
      await query(`
        INSERT INTO weekly_power_rankings
          (week_start, week_end, player_id, rank, prev_rank, points, wins, draws, losses, matches)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      `, [weekStartDate, weekEndDate, r.player_id, rank,
          prevRankMap[r.player_id] || null,
          r.points, r.wins, r.draws, r.losses, r.matches])
    }
    res.json({ success: true, weekStart: weekStartDate, weekEnd: weekEndDate, count: rows.length })
  } catch (err) { next(err) }
})

// ── Cron: every Sunday at 7am IST (1:30am UTC) ───────────────────────────────
cron.schedule("30 1 * * 0", async () => {
  console.log("[power-rankings] Sunday cron — archiving weekly rankings")
  try {
    const { weekStartDate, rows } = await computeLive()
    console.log(`[power-rankings] ${rows.length} players for ${weekStartDate}`)
  } catch (err) {
    console.error("[power-rankings] Cron error:", err.message)
  }
}, { timezone: "UTC" })

export default router