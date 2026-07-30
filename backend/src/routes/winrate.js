import { Router } from "express"
import { query }  from "../db/pool.js"

const router = Router()

// ── GET /api/winrate/seasons — list all available seasons ────────────────────
router.get("/seasons", async (req, res, next) => {
  try {
    const [seasonsRes, settingsRes] = await Promise.all([
      query(`SELECT DISTINCT season_number FROM match_records WHERE season_number IS NOT NULL ORDER BY season_number ASC`),
      query(`SELECT value FROM app_settings WHERE key = 'current_season'`),
    ])
    const currentSeason = parseInt(settingsRes.rows[0]?.value || "1")
    const seasons = seasonsRes.rows.map(r => r.season_number)
    res.json({ seasons, currentSeason })
  } catch (err) { next(err) }
})

// ── GET /api/winrate?type=overall|league|weekly|ucl&season=all|current|N ─────
// Returns players ranked by win rate with minimum 10 matches played.
// season param: "all" = all seasons combined
//               "current" = current season only
//               number = specific past season
router.get("/", async (req, res, next) => {
  try {
    const type   = req.query.type   || "overall"
    const season = req.query.season || "all"

    // Check if UCL group stage exists for current season
    // If yes and viewing current season OVERALL → threshold = 20
    let minMatches
    if (season !== "all") {
      if (season === "current" && type === "overall") {
        const uclRes = await query(`SELECT COUNT(*)::int AS cnt FROM ucl_groups`)
        const uclStarted = (uclRes.rows[0]?.cnt || 0) > 0
        minMatches = uclStarted ? 20 : 1
      } else {
        // League: 4, weekly/ucl: 1 regardless of UCL stage
        minMatches = type === "league" ? 4 : 1
      }
    } else {
      // All seasons — higher thresholds
      minMatches = type === "overall" ? 20
                 : type === "league"  ? 14
                 : type === "ucl"     ? 8
                 : 10  // weekly
    }

    // Match type filter
    const typeFilter = type === "overall" ? "" :
      `AND mr.match_type = '${
        type === "league" ? "league" : type === "weekly" ? "weekly" : "ucl"
      }'`

    // Season filter
    let seasonFilter = ""
    if (season !== "all") {
      if (season === "current") {
        const s = await query(`SELECT value FROM app_settings WHERE key = 'current_season'`)
        const cur = parseInt(s.rows[0]?.value || "1")
        seasonFilter = `AND mr.season_number = ${cur}`
      } else {
        const n = parseInt(season)
        if (!isNaN(n)) seasonFilter = `AND mr.season_number = ${n}`
      }
    }

    const r = await query(`
      SELECT
        p.id,
        p.name,
        p.alias,
        p.grade,
        p.market_value   AS "marketValue",
        p.bdr_points     AS "bdrPoints",
        p.avatar_url     AS "avatarUrl",
        p.avatar_id      AS "avatarId",
        p.team_id        AS "teamId",
        t.name           AS team,
        t.logo_url       AS "teamLogo",
        p.form,
        COUNT(*)::int                                              AS total,
        COUNT(*) FILTER (WHERE
          (mr.player_id   = p.id AND mr.result = 'win') OR
          (mr.opponent_id = p.id AND mr.result = 'loss')
        )::int                                                     AS wins,
        COUNT(*) FILTER (WHERE mr.result = 'draw')::int           AS draws,
        COUNT(*) FILTER (WHERE
          (mr.player_id   = p.id AND mr.result = 'loss') OR
          (mr.opponent_id = p.id AND mr.result = 'win')
        )::int                                                     AS losses,
        ROUND(
          COUNT(*) FILTER (WHERE
            (mr.player_id   = p.id AND mr.result = 'win') OR
            (mr.opponent_id = p.id AND mr.result = 'loss')
          )::numeric / NULLIF(COUNT(*), 0) * 100, 1
        )                                                          AS "winRate"
      FROM players p
      JOIN match_records mr
        ON mr.player_id = p.id OR mr.opponent_id = p.id
      LEFT JOIN teams t ON t.id = p.team_id
      WHERE 1=1
        ${typeFilter}
        ${seasonFilter}
      GROUP BY p.id, p.name, p.alias, p.grade, p.market_value,
               p.bdr_points, p.avatar_url, p.avatar_id, p.team_id,
               t.name, t.logo_url, p.form
      HAVING COUNT(*) >= ${minMatches}
      ORDER BY "winRate" DESC, total DESC, p.bdr_points DESC
    `)

    res.json(r.rows)
  } catch (err) { next(err) }
})

export default router