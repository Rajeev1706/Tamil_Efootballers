import { Router } from "express"
import { query }  from "../db/pool.js"
import { authenticate, adminOnly } from "../middleware/auth.js"
import cron from "node-cron"

const router = Router()

// ── Core computation ──────────────────────────────────────────────────────────
export async function computeAndSnapshotRankings() {
  const now = new Date()

  // Use last reset date as start — accumulate since last trigger
  const lastResetRes = await query(
    "SELECT value FROM app_settings WHERE key = 'power_ranking_last_reset_at'"
  )
  const lastReset = lastResetRes.rows[0]?.value
    ? new Date(lastResetRes.rows[0].value)
    : new Date(0)  // epoch = all time if never triggered

  const weekStartDate = lastReset.toISOString().slice(0, 10)
  const weekEndDate   = now.toISOString().slice(0, 10)
  const weekStart     = lastReset
  const weekEnd       = now

  // Get all match_records from this week
  const { rows } = await query(`
    SELECT
      mr.player_id,
      COUNT(*) FILTER (WHERE mr.result = 'win')::int  AS wins,
      COUNT(*) FILTER (WHERE mr.result = 'draw')::int AS draws,
      COUNT(*) FILTER (WHERE mr.result = 'loss')::int AS losses,
      COUNT(*)::int                                    AS matches,
      (COUNT(*) FILTER (WHERE mr.result = 'win')  * 3 +
       COUNT(*) FILTER (WHERE mr.result = 'draw') * 1)::int AS points
    FROM match_records mr
    WHERE mr.recorded_at >= $1 AND mr.recorded_at <= $2
    GROUP BY mr.player_id
    HAVING COUNT(*) >= 1
    ORDER BY points DESC, wins DESC, matches DESC
  `, [weekStart.toISOString(), weekEnd.toISOString()])

  if (rows.length === 0) return { weekStart: weekStartDate, weekEnd: weekEndDate, count: 0 }

  // Get previous week's ranks for change indicator
  const { rows: prevRanks } = await query(`
    SELECT player_id, rank
    FROM weekly_power_rankings
    WHERE week_start = (
      SELECT MAX(week_start) FROM weekly_power_rankings WHERE week_start < $1
    )
  `, [weekStartDate])
  const prevRankMap = Object.fromEntries(prevRanks.map(r => [r.player_id, r.rank]))

  // Delete existing snapshot for this week and re-insert
  await query("DELETE FROM weekly_power_rankings WHERE week_start = $1", [weekStartDate])

  for (let i = 0; i < Math.min(rows.length, 50); i++) {
    const r    = rows[i]
    const rank = i + 1
    await query(`
      INSERT INTO weekly_power_rankings
        (week_start, week_end, player_id, rank, prev_rank, points, wins, draws, losses, matches)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [weekStartDate, weekEndDate, r.player_id, rank,
        prevRankMap[r.player_id] || null,
        r.points, r.wins, r.draws, r.losses, r.matches])
  }

  return { weekStart: weekStartDate, weekEnd: weekEndDate, count: rows.length }
}

// ── Cron: every Sunday at 7:00am IST (1:30am UTC) — auto-snapshot current standings ──
// This just refreshes the snapshot; actual reset only happens via admin trigger
cron.schedule("30 1 * * 0", async () => {
  console.log("[power-rankings] Sunday cron triggered — computing weekly rankings")
  try {
    const result = await computeAndSnapshotRankings()
    console.log(`[power-rankings] Snapshot saved — ${result.count} players ranked for ${result.weekStart}`)
  } catch (err) {
    console.error("[power-rankings] Cron error:", err.message)
  }
}, { timezone: "UTC" })

// ── GET /api/power-rankings/current — latest snapshot ────────────────────────
router.get("/current", async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT
        wpr.rank, wpr.prev_rank AS "prevRank", wpr.points,
        wpr.wins, wpr.draws, wpr.losses, wpr.matches,
        wpr.week_start AS "weekStart", wpr.week_end AS "weekEnd",
        p.id, p.name, p.grade,
        p.avatar_id  AS "avatarId",
        p.avatar_url AS "avatarUrl",
        t.name AS "teamName",
        t.logo_url AS "teamLogo"
      FROM weekly_power_rankings wpr
      JOIN players p ON p.id = wpr.player_id
      LEFT JOIN teams t ON t.id = p.team_id
      WHERE wpr.week_start = (SELECT MAX(week_start) FROM weekly_power_rankings)
      ORDER BY wpr.rank ASC
      LIMIT 15
    `)
    res.json(rows)
  } catch (err) { next(err) }
})

// ── GET /api/power-rankings/history — past snapshots list ────────────────────
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

// ── GET /api/power-rankings/week/:weekStart — snapshot for a specific week ───
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
      JOIN players p ON p.id = wpr.player_id
      LEFT JOIN teams t ON t.id = p.team_id
      WHERE wpr.week_start = $1
      ORDER BY wpr.rank ASC
    `, [req.params.weekStart])
    res.json(rows)
  } catch (err) { next(err) }
})

// ── POST /api/power-rankings/generate — admin manual trigger ─────────────────
router.post("/generate", authenticate, adminOnly, async (req, res, next) => {
  try {
    const result = await computeAndSnapshotRankings()
    res.json({ success: true, ...result })
  } catch (err) { next(err) }
})

export default router