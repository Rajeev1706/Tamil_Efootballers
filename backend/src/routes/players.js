import { Router } from "express"
import { z } from "zod"
import { query } from "../db/pool.js"
import { authenticate, adminOnly } from "../middleware/auth.js"
import { recalcMarketValue } from "../services/marketValue.js"

const router = Router()

// POST /api/players/reset-mv — admin resets all player market values and form to 0
router.post("/reset-mv", authenticate, adminOnly, async (req, res, next) => {
  try {
    const result = await query("UPDATE players SET market_value = 0, form = '{}'")
    res.json({ success: true, message: "All player market values reset to 0" })
  } catch (err) { next(err) }
})

// GET /api/players — public
router.get("/", async (req, res, next) => {
  try {
    const { teamId, grade } = req.query
    const conditions = []
    const params = []
    if (teamId) { conditions.push(`"teamId" = $${params.length+1}`); params.push(teamId) }
    if (grade)  { conditions.push(`grade = $${params.length+1}`);    params.push(grade)  }
    const where  = conditions.length ? " WHERE " + conditions.join(" AND ") : ""
    const result = await query(
      `SELECT * FROM players_full${where} ORDER BY "bdrPoints" DESC`, params
    )
    res.json(result.rows)
  } catch (err) { next(err) }
})

// GET /api/players/:id — public
router.get("/:id", async (req, res, next) => {
  try {
    const playerRes = await query(
      "SELECT * FROM players_full WHERE id = $1", [req.params.id]
    )
    if (!playerRes.rows[0]) return res.status(404).json({ error: "Player not found" })
    const player = playerRes.rows[0]

    const historyRes = await query(`
      SELECT
        mr.id,
        -- When this player is the opponent, flip the result to show from their perspective
        CASE
          WHEN mr.player_id = $1 THEN mr.result
          WHEN mr.result = 'win'  THEN 'loss'
          WHEN mr.result = 'loss' THEN 'win'
          ELSE 'draw'
        END AS result,
        mr.match_type AS "matchType",
        -- Grade of whoever they played against
        CASE
          WHEN mr.player_id = $1 THEN mr.opponent_grade
          ELSE p2.grade
        END AS "opponentGrade",
        -- Scores from this player's perspective
        CASE WHEN mr.player_id = $1 THEN mr.player_score   ELSE mr.opponent_score END AS "playerScore",
        CASE WHEN mr.player_id = $1 THEN mr.opponent_score ELSE mr.player_score   END AS "opponentScore",
        mr.recorded_at AS date,
        CASE WHEN mr.player_id = $1 THEN opp.id   ELSE p2.id   END AS "opponentId",
        CASE WHEN mr.player_id = $1 THEN opp.name ELSE p2.name END AS "opponentName",
        CASE WHEN mr.player_id = $1 THEN ot.name  ELSE pt.name END AS "opponentTeam"
      FROM match_records mr
      JOIN players opp ON mr.opponent_id = opp.id
      LEFT JOIN teams ot ON opp.team_id = ot.id
      JOIN players p2 ON mr.player_id = p2.id
      LEFT JOIN teams pt ON p2.team_id = pt.id
      WHERE mr.player_id = $1 OR mr.opponent_id = $1
      ORDER BY mr.recorded_at DESC, mr.id DESC
    `, [req.params.id])

    const grades = ["S","A","B","C"]
    const record = {
      wins:   Object.fromEntries(grades.map(g => [g, 0])),
      draws:  Object.fromEntries(grades.map(g => [g, 0])),
      losses: Object.fromEntries(grades.map(g => [g, 0])),
    }
    historyRes.rows.forEach(m => {
      const bucket = m.result === "win" ? "wins" : m.result === "draw" ? "draws" : "losses"
      if (record[bucket][m.opponentGrade] !== undefined) record[bucket][m.opponentGrade]++
    })

    res.json({ ...player, record, matchHistory: historyRes.rows })
  } catch (err) { next(err) }
})

// POST /api/players — admin creates player
const createSchema = z.object({
  name:          z.string().min(1),
  alias:         z.string().optional(),
  teamId:        z.number().int().positive().optional(),
  grade:         z.enum(["S","A","B","C"]),
  isCaptain:     z.boolean().optional().default(false),
  auctionPrice:  z.number().int().min(0).optional(),
  trophy1Count:  z.number().int().min(0).optional().default(0),
  trophy2Count:  z.number().int().min(0).optional().default(0),
  trophy3Count:  z.number().int().min(0).optional().default(0),
  trophy4Count:  z.number().int().min(0).optional().default(0),
  trophy5Count:  z.number().int().min(0).optional().default(0),
  trophy6Count:  z.number().int().min(0).optional().default(0),
  trophy7Count:  z.number().int().min(0).optional().default(0),
}).refine(d => d.isCaptain || d.auctionPrice !== undefined, {
  message: "Auction price is required unless the player is a captain",
  path: ["auctionPrice"],
})

router.post("/", authenticate, adminOnly, async (req, res, next) => {
  try {
    const {
      name, alias, teamId, grade, isCaptain, auctionPrice,
      trophy1Count, trophy2Count, trophy3Count, trophy4Count,
    } = createSchema.parse(req.body)

    // Captains have no auction price — stored as 0.
    // Market value always starts at 0 for every player (captain or not) and is
    // only set once the first match result is logged (via the DB trigger).
    const finalAuctionPrice = isCaptain ? 0 : auctionPrice
    const finalMarketValue  = 0

    const result = await query(`
      INSERT INTO players (
        name, alias, team_id, grade, is_captain, auction_price, market_value,
        trophy1_count, trophy2_count, trophy3_count, trophy4_count
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, name, alias, grade,
                image_url     AS "imageUrl",
                is_captain    AS "isCaptain",
                auction_price AS "auctionPrice",
                market_value  AS "marketValue",
                bdr_points    AS "bdrPoints",
                team_id       AS "teamId",
                trophy1_count AS "trophy1Count",
                trophy2_count AS "trophy2Count",
                trophy3_count AS "trophy3Count",
                trophy4_count AS "trophy4Count"
    `, [
      name, alias || null, teamId ?? null, grade, isCaptain,
      finalAuctionPrice, finalMarketValue,
      trophy1Count, trophy2Count, trophy3Count, trophy4Count,
    ])
    res.status(201).json(result.rows[0])
  } catch (err) { next(err) }
})

// PATCH /api/players/:id — admin updates any field
const updateSchema = z.object({
  name:          z.string().min(1).optional(),
  alias:         z.string().optional(),
  grade:         z.enum(["S","A","B","C"]).optional(),
  bdrDelta:      z.number().int().optional(),
  isCaptain:     z.boolean().optional(),
  auctionPrice:  z.number().int().min(0).optional(),
  teamId:        z.number().int().positive().optional().nullable(),
  imageUrl:      z.string().url().optional().nullable(),
  trophy1Count:  z.number().int().min(0).optional(),
  trophy2Count:  z.number().int().min(0).optional(),
  trophy3Count:  z.number().int().min(0).optional(),
  trophy4Count:  z.number().int().min(0).optional(),
  trophy5Count:  z.number().int().min(0).optional(),
  trophy6Count:  z.number().int().min(0).optional(),
  trophy7Count:  z.number().int().min(0).optional(),
}).refine(d => Object.values(d).some(v => v !== undefined), {
  message: "Provide at least one field to update",
})

// PATCH /api/players/:id/avatar — public, no auth. Anyone on the Player
// Profile page can set/clear a player's avatar — either a preset character
// (avatarId, looked up from the bundled images/ folder) or a custom
// upload (avatarUrl / avatarBgUrl, stored in Supabase). The two are
// mutually exclusive: choosing a preset clears any custom upload, and
// uploading a custom image clears the preset selection, so the hero
// background is never ambiguous about which one to show.
router.patch("/:id/avatar", async (req, res, next) => {
  try {
    const schema = z.object({
      avatarId:    z.string().max(64).regex(/^[a-zA-Z0-9_-]+$/).nullable().optional(),
      avatarUrl:   z.string().url().nullable().optional(),
      avatarBgUrl: z.string().url().nullable().optional(),
    })
    const body = schema.parse(req.body)

    const avatarIdProvided    = "avatarId" in req.body
    const avatarUrlProvided   = "avatarUrl" in req.body
    const avatarBgUrlProvided = "avatarBgUrl" in req.body

    if (!avatarIdProvided && !avatarUrlProvided && !avatarBgUrlProvided) {
      return res.status(400).json({ error: "Nothing to update" })
    }

    // Uploading either custom image switches this player into "custom"
    // mode (clears the preset). Setting avatarId switches back into
    // "preset" mode (clears both custom fields).
    const switchingToCustom = avatarUrlProvided || avatarBgUrlProvided

    const result = await query(`
      UPDATE players SET
        avatar_id     = CASE WHEN $1 THEN $2 WHEN $3 THEN NULL ELSE avatar_id END,
        avatar_url    = CASE WHEN $4 THEN $5 WHEN $1 THEN NULL ELSE avatar_url END,
        avatar_bg_url = CASE WHEN $6 THEN $7 WHEN $1 THEN NULL ELSE avatar_bg_url END
      WHERE id = $8
      RETURNING id, avatar_id AS "avatarId", avatar_url AS "avatarUrl", avatar_bg_url AS "avatarBgUrl"
    `, [
      avatarIdProvided, body.avatarId ?? null,
      switchingToCustom,
      avatarUrlProvided, body.avatarUrl ?? null,
      avatarBgUrlProvided, body.avatarBgUrl ?? null,
      req.params.id,
    ])
    if (!result.rows[0]) return res.status(404).json({ error: "Player not found" })
    res.json(result.rows[0])
  } catch (err) { next(err) }
})

router.patch("/:id", authenticate, adminOnly, async (req, res, next) => {
  try {
    const {
      name, alias, grade, bdrDelta, isCaptain, auctionPrice, teamId, imageUrl,
      trophy1Count, trophy2Count, trophy3Count, trophy4Count, trophy5Count, trophy6Count, trophy7Count,
    } = updateSchema.parse(req.body)

    // teamId needs special handling: undefined = don't change, null = remove team
    const teamIdProvided = "teamId" in req.body
    const teamIdValue    = teamIdProvided ? (teamId ?? null) : undefined

    // If becoming captain, auction price resets to 0
    const isCaptainProvided  = "isCaptain" in req.body
    const auctionPriceValue  = isCaptainProvided && isCaptain ? 0 : (auctionPrice ?? null)

    const result = await query(`
      UPDATE players SET
        name          = COALESCE($1, name),
        alias         = COALESCE($2, alias),
        grade         = COALESCE($3, grade),
        bdr_points    = GREATEST(0, bdr_points + COALESCE($4, 0)),
        is_captain    = COALESCE($5, is_captain),
        auction_price = COALESCE($6, auction_price),
        team_id       = CASE WHEN $17 THEN $7 ELSE team_id END,
        image_url     = COALESCE($8, image_url),
        trophy1_count = COALESCE($9,  trophy1_count),
        trophy2_count = COALESCE($10, trophy2_count),
        trophy3_count = COALESCE($11, trophy3_count),
        trophy4_count = COALESCE($12, trophy4_count),
        trophy5_count = COALESCE($13, trophy5_count),
        trophy6_count = COALESCE($14, trophy6_count),
        trophy7_count = COALESCE($15, trophy7_count)
      WHERE id = $16
      RETURNING id, name, alias, grade,
                image_url     AS "imageUrl",
                is_captain    AS "isCaptain",
                bdr_points    AS "bdrPoints",
                market_value  AS "marketValue",
                auction_price AS "auctionPrice",
                team_id       AS "teamId",
                trophy1_count AS "trophy1Count",
                trophy2_count AS "trophy2Count",
                trophy3_count AS "trophy3Count",
                trophy4_count AS "trophy4Count",
                trophy5_count AS "trophy5Count",
                trophy6_count AS "trophy6Count",
                trophy7_count AS "trophy7Count"
    `, [
      name ?? null, alias ?? null, grade ?? null,
      bdrDelta ?? null, isCaptain ?? null, auctionPriceValue,
      teamIdValue ?? null, imageUrl ?? null,
      trophy1Count ?? null, trophy2Count ?? null, trophy3Count ?? null,
      trophy4Count ?? null, trophy5Count ?? null,
      trophy6Count ?? null, trophy7Count ?? null,
      req.params.id, teamIdProvided,
    ])

    if (!result.rows[0]) return res.status(404).json({ error: "Player not found" })

    // bdr_points just changed (or could have, via bdrDelta), and market_value
    // now factors BDR points into its calculation — recalc so the two stay
    // in sync. Skip the work entirely if bdrDelta wasn't actually provided.
    if (bdrDelta != null && bdrDelta !== 0) {
      await recalcMarketValue(req.params.id)
      const fresh = await query(
        `SELECT market_value AS "marketValue" FROM players WHERE id = $1`,
        [req.params.id]
      )
      result.rows[0].marketValue = fresh.rows[0].marketValue
    }

    res.json(result.rows[0])
  } catch (err) { next(err) }
})

// DELETE /api/players/:id
router.delete("/:id", authenticate, adminOnly, async (req, res, next) => {
  try {
    const result = await query(
      "DELETE FROM players WHERE id = $1 RETURNING id, name", [req.params.id]
    )
    if (!result.rows[0]) return res.status(404).json({ error: "Player not found" })
    res.json({ deleted: true, player: result.rows[0] })
  } catch (err) { next(err) }
})

// GET /api/players/:id/compare-stats — rich stats for player comparison tool
// Market Value, BDR Points, Auction Price = current DB values (current season)
// All match stats (W/D/L, goals, wins per competition) = ALL-TIME combined
router.get("/:id/compare-stats", async (req, res, next) => {
  try {
    const [playerRes, matchRes, trophyRes] = await Promise.all([
      query(`
        SELECT p.id, p.name, p.alias, p.grade, p.auction_price AS "auctionPrice",
               p.market_value AS "marketValue", p.bdr_points AS "bdrPoints",
               p.is_captain AS "isCaptain",
               p.avatar_id AS "avatarId", p.avatar_url AS "avatarUrl",
               p.avatar_bg_url AS "avatarBgUrl",
               t.name AS team
        FROM players p LEFT JOIN teams t ON p.team_id = t.id WHERE p.id = $1
      `, [req.params.id]),
      // ALL-TIME match history — no season filter
      query(`
        SELECT
          CASE
            WHEN player_id = $1 THEN result
            WHEN result = 'win'  THEN 'loss'
            WHEN result = 'loss' THEN 'win'
            ELSE 'draw'
          END AS result,
          match_type::text AS match_type,
          CASE WHEN player_id = $1 THEN player_score ELSE opponent_score END AS goals_scored,
          CASE WHEN player_id = $1 THEN opponent_score ELSE player_score END AS goals_conceded
        FROM match_records
        WHERE player_id = $1 OR opponent_id = $1
      `, [req.params.id]),
      query(`
        SELECT trophy1_count, trophy2_count, trophy3_count, trophy4_count,
               trophy5_count, trophy6_count, trophy7_count
        FROM players WHERE id = $1
      `, [req.params.id]),
    ])

    if (!playerRes.rows[0]) return res.status(404).json({ error: "Player not found" })

    const matches = matchRes.rows
    const total   = matches.length
    const wins    = matches.filter(m => m.result === "win").length
    const draws   = matches.filter(m => m.result === "draw").length
    const losses  = matches.filter(m => m.result === "loss").length
    const goals   = matches.reduce((s, m) => s + (m.goals_scored  ?? 0), 0)
    const conceded= matches.reduce((s, m) => s + (m.goals_conceded ?? 0), 0)
    const leagueMatches = matches.filter(m => m.match_type === "league")
    const uclMatches    = matches.filter(m => m.match_type === "ucl")
    const weeklyMatches = matches.filter(m => m.match_type === "weekly")

    const trophyRow = trophyRes.rows[0] ?? {}
    const trophies = {
      trophy1_count: trophyRow.trophy1_count ?? 0,
      trophy2_count: trophyRow.trophy2_count ?? 0,
      trophy3_count: trophyRow.trophy3_count ?? 0,
      trophy4_count: trophyRow.trophy4_count ?? 0,
      trophy5_count: trophyRow.trophy5_count ?? 0,
      trophy6_count: trophyRow.trophy6_count ?? 0,
      trophy7_count: trophyRow.trophy7_count ?? 0,
    }

    res.json({
      player: playerRes.rows[0],
      stats: {
        total, wins, draws, losses,
        goals, conceded,
        winRate:   total > 0 ? Math.round((wins / total) * 100) : 0,
        avgGoals:  total > 0 ? (goals / total).toFixed(1) : "0.0",
        leagueMatches: leagueMatches.length,
        leagueWins:    leagueMatches.filter(m => m.result === "win").length,
        leagueDraws:   leagueMatches.filter(m => m.result === "draw").length,
        leagueLosses:  leagueMatches.filter(m => m.result === "loss").length,
        leagueGoals:   leagueMatches.reduce((s, m) => s + (m.goals_scored ?? 0), 0),
        uclMatches:    uclMatches.length,
        uclWins:       uclMatches.filter(m => m.result === "win").length,
        uclDraws:      uclMatches.filter(m => m.result === "draw").length,
        uclLosses:     uclMatches.filter(m => m.result === "loss").length,
        uclGoals:      uclMatches.reduce((s, m) => s + (m.goals_scored ?? 0), 0),
        weeklyMatches: weeklyMatches.length,
        weeklyWins:    weeklyMatches.filter(m => m.result === "win").length,
        weeklyDraws:   weeklyMatches.filter(m => m.result === "draw").length,
        weeklyLosses:  weeklyMatches.filter(m => m.result === "loss").length,
        weeklyGoals:   weeklyMatches.reduce((s, m) => s + (m.goals_scored ?? 0), 0),
        trophies,
      },
    })
  } catch (err) { next(err) }
})
// GET /api/players/:id/performance-zones
// ?season=current (default), ?season=all, or ?season=N
router.get("/:id/performance-zones", async (req, res, next) => {
  try {
    const seasonRes = await query("SELECT value FROM app_settings WHERE key = 'current_season'")
    const currentSeason = parseInt(seasonRes.rows[0]?.value || "6")
    const seasonParam   = req.query.season ?? "current"

    // All seasons this player has ever played in — for the dropdown
    const seasonsRes = await query(`
      SELECT DISTINCT season_number
      FROM match_records
      WHERE player_id=$1 OR opponent_id=$1
      ORDER BY season_number DESC
    `, [req.params.id])
    const availableSeasons = seasonsRes.rows.map(r => r.season_number)

    // Helper: fetch all matches for a given season_number and build cumulative sequence
    async function fetchSeasonMatches(seasonNum) {
      const r = await query(`
        SELECT
          CASE
            WHEN mr.player_id = $1 THEN mr.result
            WHEN mr.result = 'win'  THEN 'loss'
            WHEN mr.result = 'loss' THEN 'win'
            ELSE 'draw'
          END AS result,
          mr.match_type::text AS competition,
          CASE WHEN mr.player_id=$1 THEN mr.player_score  ELSE mr.opponent_score END AS goals_scored,
          CASE WHEN mr.player_id=$1 THEN mr.opponent_score ELSE mr.player_score  END AS goals_conceded,
          mr.recorded_at,
          CASE mr.match_type::text
            WHEN 'league' THEN CONCAT('TL R', COALESCE(f.round::text, '?'))
            WHEN 'ucl'    THEN 'UCL'
            WHEN 'weekly' THEN COALESCE(wt.name, 'Weekly')
            ELSE mr.match_type::text
          END AS label
        FROM match_records mr
        LEFT JOIN fixtures f ON f.id = mr.fixture_id AND mr.match_type::text = 'league'
        LEFT JOIN weekly_tournament_matches wtm ON wtm.match_record_id = mr.id
        LEFT JOIN weekly_tournaments wt ON wt.id = wtm.tournament_id
        WHERE (mr.player_id=$1 OR mr.opponent_id=$1) AND mr.season_number=$2
        ORDER BY mr.recorded_at ASC
      `, [req.params.id, seasonNum])

      let cumulative = 0
      return r.rows.map((m, i) => {
        const delta = m.result === "win" ? 3 : m.result === "draw" ? 1 : -2
        cumulative += delta
        return {
          index: i + 1, result: m.result, competition: m.competition,
          label: m.label, delta, cumulative,
          goalsScored: m.goals_scored ?? 0, goalsConceded: m.goals_conceded ?? 0,
          date: m.recorded_at, season: seasonNum, isCurrent: seasonNum === currentSeason,
        }
      })
    }

    if (seasonParam === "all") {
      // Build the current season line (fresh from M1)
      const currentMatches = await fetchSeasonMatches(currentSeason)

      // Build per-previous-season sequences, then average across positions
      const prevSeasons = availableSeasons.filter(s => s !== currentSeason)
      const prevSequences = await Promise.all(prevSeasons.map(s => fetchSeasonMatches(s)))

      // For each match position (1, 2, 3...), average the cumulative across all
      // previous seasons that had at least that many matches
      const maxLen = prevSequences.reduce((m, s) => Math.max(m, s.length), 0)
      const prevAvg = []
      for (let i = 0; i < maxLen; i++) {
        const values = prevSequences.filter(s => s[i] != null).map(s => s[i].cumulative)
        if (values.length > 0) {
          prevAvg.push({
            index: i + 1,
            cumulative: Math.round(values.reduce((a, b) => a + b, 0) / values.length * 10) / 10,
          })
        }
      }

      return res.json({ mode: "all", currentMatches, prevAvg, currentSeason, availableSeasons })
    }

    // Single season mode (current or specific past season)
    let seasonNum = seasonParam === "current" ? currentSeason : parseInt(seasonParam)
    const matches = await fetchSeasonMatches(seasonNum)
    res.json({ mode: "single", matches, currentSeason, availableSeasons })

  } catch (err) { next(err) }
})

export default router