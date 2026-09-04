import { Router } from "express"
import { query }  from "../db/pool.js"
import { authenticate, adminOnly } from "../middleware/auth.js"
import cron from "node-cron"

const router = Router()

// ── Shared helper: compute the live 4-day rolling window ─────────────────────
// Returns { weekStart, weekEnd, rows } where rows are already ranked 1…N.
// Pulls player + team details in a single JOIN so callers don't need a
// second round-trip.
async function computeLive() {
  const now = new Date()

  const windowStart = new Date(now)
  windowStart.setDate(windowStart.getDate() - 3)
  windowStart.setHours(0, 0, 0, 0)

  const weekStartDate = windowStart.toISOString().slice(0, 10)
  const weekEndDate   = now.toISOString().slice(0, 10)

  const { rows } = await query(`
    SELECT
      mr.player_id,
      COUNT(*) FILTER (WHERE mr.result = 'win')::int  AS wins,
      COUNT(*) FILTER (WHERE mr.result = 'draw')::int AS draws,
      COUNT(*) FILTER (WHERE mr.result = 'loss')::int AS losses,
      COUNT(*)::int                                    AS matches,
      (COUNT(*) FILTER (WHERE mr.result = 'win')  * 3 +
       COUNT(*) FILTER (WHERE mr.result = 'draw') * 1)::int AS points,
      p.id, p.name, p.grade,
      p.avatar_id  AS "avatarId",
      p.avatar_url AS "avatarUrl",
      t.name       AS "teamName",
      t.logo_url   AS "teamLogo"
    FROM match_records mr
    JOIN players p   ON p.id  = mr.player_id
    LEFT JOIN teams t ON t.id = p.team_id
    WHERE mr.recorded_at >= $1
      AND mr.recorded_at <= $2
    GROUP BY
      mr.player_id, p.id, p.name, p.grade,
      p.avatar_id, p.avatar_url, t.name, t.logo_url
    HAVING COUNT(*) >= 1
    ORDER BY points DESC, wins DESC, matches DESC
  `, [windowStart.toISOString(), now.toISOString()])

  return { weekStartDate, weekEndDate, rows }
}

// ── Core computation + snapshot (used by cron & manual trigger) ───────────────
export async function computeAndSnapshotRankings() {
  const { weekStartDate, weekEndDate, rows } = await computeLive()

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

  // Delete existing snapshot for this window and re-insert (top 50 archived)
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

// ── Cron: every Sunday at 7:00am IST (1:30am UTC) — archive current standings ─
cron.schedule("30 1 * * 0", async () => {
  console.log("[power-rankings] Sunday cron triggered — archiving weekly rankings")
  try {
    const result = await computeAndSnapshotRankings()
    console.log(`[power-rankings] Snapshot saved — ${result.count} players ranked for ${result.weekStart}`)
  } catch (err) {
    console.error("[power-rankings] Cron error:", err.message)
  }
}, { timezone: "UTC" })

// ── GET /api/power-rankings/current — LIVE ranking from match_records ─────────
// Always computed fresh from the last 4 days so new results appear instantly.
// Prev-rank comes from the last archived snapshot (not the live window) so the
// change indicator shows movement vs the previous week, not vs 5 minutes ago.
router.get("/current", async (req, res, next) => {
  try {
    const { weekStartDate, weekEndDate, rows } = await computeLive()

    // Fetch prev-week ranks from the snapshot table for rank-change badges
    const { rows: prevRanks } = await query(`
      SELECT player_id, rank
      FROM weekly_power_rankings
      WHERE week_start = (
        SELECT MAX(week_start) FROM weekly_power_rankings WHERE week_start < $1
      )
    `, [weekStartDate])
    const prevRankMap = Object.fromEntries(prevRanks.map(r => [r.player_id, r.rank]))

    const result = rows.slice(0, 15).map((r, i) => ({
      rank:     i + 1,
      prevRank: prevRankMap[r.player_id] || null,
      points:   r.points,
      wins:     r.wins,
      draws:    r.draws,
      losses:   r.losses,
      matches:  r.matches,
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

// ── GET /api/power-rankings/history — past archived snapshots list ────────────
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

// ── GET /api/power-rankings/week/:weekStart — archived snapshot for a past week
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
      JOIN players p   ON p.id  = wpr.player_id
      LEFT JOIN teams t ON t.id = p.team_id
      WHERE wpr.week_start = $1
      ORDER BY wpr.rank ASC
    `, [req.params.weekStart])
    res.json(rows)
  } catch (err) { next(err) }
})

// ── POST /api/power-rankings/generate — admin: archive a snapshot right now ───
router.post("/generate", authenticate, adminOnly, async (req, res, next) => {
  try {
    const result = await computeAndSnapshotRankings()
    res.json({ success: true, ...result })
  } catch (err) { next(err) }
})

export default router