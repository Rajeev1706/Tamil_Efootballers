import { Router }    from "express"
import { query }     from "../db/pool.js"
import { authenticate } from "../middleware/auth.js"

const router = Router()

// ── GET /api/auction-intel/grade-matrix/:playerId ────────────────────────────
// Win/draw/loss record for a player broken down by opponent grade.
router.get("/grade-matrix/:playerId", async (req, res, next) => {
  try {
    const pid = parseInt(req.params.playerId)
    const r = await query(`
      SELECT
        opp_grade,
        COUNT(*)::int                                   AS total,
        SUM(is_win::int)::int                           AS wins,
        SUM(is_draw::int)::int                          AS draws,
        SUM((NOT is_win AND NOT is_draw)::int)::int     AS losses
      FROM (
        -- rows where this player is the player_id column
        SELECT
          op.grade                             AS opp_grade,
          mr.result = 'win'                    AS is_win,
          mr.result = 'draw'                   AS is_draw
        FROM match_records mr
        JOIN players op ON op.id = mr.opponent_id
        WHERE mr.player_id = $1

        UNION ALL

        -- rows where this player is the opponent_id column
        SELECT
          pp.grade                             AS opp_grade,
          mr.result = 'loss'                   AS is_win,   -- opp lost = we won
          mr.result = 'draw'                   AS is_draw
        FROM match_records mr
        JOIN players pp ON pp.id = mr.player_id
        WHERE mr.opponent_id = $1
      ) sub
      GROUP BY opp_grade
      ORDER BY opp_grade
    `, [pid])
    res.json(r.rows)
  } catch (err) { next(err) }
})

// ── GET /api/auction-intel/nemesis/:playerId ─────────────────────────────────
// Top opponents this player dominates and top opponents who beat them.
router.get("/nemesis/:playerId", async (req, res, next) => {
  try {
    const pid = parseInt(req.params.playerId)
    const r = await query(`
      SELECT
        opp_id,
        p.name,
        p.grade,
        p.market_value  AS "marketValue",
        p.team_id       AS "teamId",
        t.name          AS team,
        wins, draws, losses, total,
        ROUND(wins::numeric / NULLIF(total, 0) * 100)::int AS "winPct"
      FROM (
        SELECT
          opp_id,
          SUM(is_win::int)::int                         AS wins,
          SUM(is_draw::int)::int                        AS draws,
          SUM((NOT is_win AND NOT is_draw)::int)::int   AS losses,
          COUNT(*)::int                                 AS total
        FROM (
          SELECT opponent_id AS opp_id, result = 'win'  AS is_win, result = 'draw' AS is_draw
          FROM match_records WHERE player_id = $1
          UNION ALL
          SELECT player_id   AS opp_id, result = 'loss' AS is_win, result = 'draw' AS is_draw
          FROM match_records WHERE opponent_id = $1
        ) sub
        GROUP BY opp_id
        HAVING COUNT(*) >= 2
      ) agg
      JOIN players p ON p.id = agg.opp_id
      LEFT JOIN teams t ON t.id = p.team_id
      ORDER BY wins DESC, total DESC
    `, [pid])

    const dominates = r.rows.filter(x => x.wins > x.losses).slice(0, 4)
    const nemesis   = r.rows.filter(x => x.losses > x.wins).sort((a,b) => b.losses - a.losses).slice(0, 4)
    res.json({ dominates, nemesis })
  } catch (err) { next(err) }
})

// ── GET /api/auction-intel/h2h-vs-squad/:playerId?myTeamId=X ─────────────────
// For a target player, their H2H record vs each player on my squad.
router.get("/h2h-vs-squad/:playerId", authenticate, async (req, res, next) => {
  try {
    const pid    = parseInt(req.params.playerId)
    const teamId = parseInt(req.query.myTeamId || req.user?.teamId)
    const r = await query(`
      SELECT
        my_player_id                                      AS "myPlayerId",
        p.name                                            AS "myPlayerName",
        p.grade                                           AS "myPlayerGrade",
        SUM(is_win::int)::int                             AS wins,
        SUM(is_draw::int)::int                            AS draws,
        SUM((NOT is_win AND NOT is_draw)::int)::int       AS losses,
        COUNT(*)::int                                     AS total,
        ROUND(SUM(is_win::int)::numeric / NULLIF(COUNT(*), 0) * 100)::int AS "winPct"
      FROM (
        SELECT
          opponent_id AS my_player_id,
          result = 'win'  AS is_win,
          result = 'draw' AS is_draw
        FROM match_records
        WHERE player_id = $1

        UNION ALL

        SELECT
          player_id   AS my_player_id,
          result = 'loss' AS is_win,
          result = 'draw' AS is_draw
        FROM match_records
        WHERE opponent_id = $1
      ) sub
      JOIN players p ON p.id = sub.my_player_id
      WHERE p.team_id = $2
      GROUP BY my_player_id, p.name, p.grade
      HAVING COUNT(*) > 0
      ORDER BY "winPct" DESC
    `, [pid, teamId])
    res.json(r.rows)
  } catch (err) { next(err) }
})

// ── GET /api/auction-intel/auction-history ────────────────────────────────────
// Historical auction spend per team per grade across all completed sessions.
router.get("/auction-history", async (req, res, next) => {
  try {
    const r = await query(`
      SELECT
        t.id                                                    AS "teamId",
        t.name                                                  AS "teamName",
        t.logo_url                                              AS "logoUrl",
        p.grade,
        COUNT(*)::int                                           AS count,
        ROUND(AVG(s.price))::int                                AS "avgPrice",
        ROUND(AVG(p.market_value))::int                         AS "avgMV",
        ROUND(AVG(
          CASE WHEN s.price > p.market_value THEN 1.0 ELSE 0.0 END
        ) * 100)::int                                           AS "overpayPct",
        MAX(s.price)                                            AS "maxPaid",
        MIN(s.price)                                            AS "minPaid"
      FROM auction_sales s
      JOIN players  p ON p.id = s.player_id
      JOIN teams    t ON t.id = s.team_id
      JOIN auction_sessions sess ON sess.id = s.session_id
      WHERE sess.status = 'completed'
      GROUP BY t.id, t.name, t.logo_url, p.grade
      ORDER BY t.name, p.grade
    `)
    res.json(r.rows)
  } catch (err) { next(err) }
})

export default router

// ── Table: player_mv_history (created on startup) ────────────────────────────
;(async () => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS player_mv_history (
        id            SERIAL PRIMARY KEY,
        player_id     INT  NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        season_number INT  NOT NULL,
        market_value  INT  NOT NULL,
        recorded_at   TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(player_id, season_number)
      )
    `)
  } catch (err) {
    console.error("[auction-intel] mv_history table init:", err.message)
  }
})()

// ── GET /api/auction-intel/mv-trajectory/:playerId ───────────────────────────
// MV across seasons: combines auction_sales history + player_mv_history snapshots.
// Returns array ordered by season_number ASC.
router.get("/mv-trajectory/:playerId", async (req, res, next) => {
  try {
    const pid = parseInt(req.params.playerId)

    // Historical auction prices as season MV proxies
    const salesR = await query(`
      SELECT
        sess.season_number,
        s.price          AS market_value,
        'auction'        AS source
      FROM auction_sales s
      JOIN auction_sessions sess ON sess.id = s.session_id
      WHERE s.player_id = $1
        AND sess.status = 'completed'
    `, [pid])

    // Manual snapshots (if any)
    const snapR = await query(`
      SELECT season_number, market_value, 'snapshot' AS source
      FROM player_mv_history
      WHERE player_id = $1
    `, [pid])

    // Current MV + current season
    const curR = await query(`
      SELECT p.market_value, COALESCE(s.value::int, 1) AS season_number
      FROM players p
      CROSS JOIN (SELECT value FROM app_settings WHERE key = 'current_season') s
      WHERE p.id = $1
    `, [pid])

    const cur = curR.rows[0]

    // Merge and deduplicate by season (snapshot wins over auction for same season)
    const bySeasonMap = new Map()
    for (const r of salesR.rows)  bySeasonMap.set(r.season_number, r)
    for (const r of snapR.rows)   bySeasonMap.set(r.season_number, r) // snapshot wins
    if (cur) bySeasonMap.set(cur.season_number, { season_number: cur.season_number, market_value: cur.market_value, source: 'current' })

    const trajectory = [...bySeasonMap.values()].sort((a,b) => a.season_number - b.season_number)
    res.json(trajectory)
  } catch (err) { next(err) }
})

// ── POST /api/auction-intel/snapshot-mv (admin — records current MVs) ────────
router.post("/snapshot-mv", authenticate, async (req, res, next) => {
  try {
    const seasonR = await query(`SELECT value FROM app_settings WHERE key = 'current_season'`)
    const season  = parseInt(seasonR.rows[0]?.value || "1")

    const players = await query(`SELECT id, market_value FROM players`)
    let count = 0
    for (const p of players.rows) {
      await query(`
        INSERT INTO player_mv_history (player_id, season_number, market_value)
        VALUES ($1, $2, $3)
        ON CONFLICT (player_id, season_number) DO UPDATE SET market_value = EXCLUDED.market_value
      `, [p.id, season, p.market_value])
      count++
    }
    res.json({ ok: true, snapshotted: count, season })
  } catch (err) { next(err) }
})