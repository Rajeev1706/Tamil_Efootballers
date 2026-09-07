import { Router } from "express"
import { z } from "zod"
import { query } from "../db/pool.js"
import { authenticate, adminOnly } from "../middleware/auth.js"
import { recalcMarketValue } from "../services/marketValue.js"
import { recalcForm }        from "../services/form.js"
import { incrementHistory, roundLabel, buildHistoryResponse } from "../services/tournamentHistoryService.js"

const router = Router()

// POST /api/players/reset-mv — admin resets all player market values and form to 0
router.post("/reset-mv", authenticate, adminOnly, async (req, res, next) => {
  try {
    const result = await query("UPDATE players SET market_value = 0, form = '{}'")
    res.json({ success: true, message: "All player market values reset to 0" })
  } catch (err) { next(err) }
})

// Ensure grade_floor column exists
;(async () => {
  try {
    await query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS grade_floor VARCHAR(2) DEFAULT NULL`)
  } catch (e) { console.error("[players] grade_floor migration:", e.message) }
})()
router.get("/", async (req, res, next) => {
  try {
    const { teamId, grade } = req.query
    const conditions = []
    const params = []
    if (teamId) { conditions.push(`"teamId" = $${params.length+1}`); params.push(teamId) }
    if (grade)  { conditions.push(`grade = $${params.length+1}`);    params.push(grade)  }
    const where  = conditions.length ? " WHERE " + conditions.join(" AND ") : ""
    // Fix WHERE to use pf. prefix to avoid ambiguity
    const whereFixed = where
      .replace('"teamId"', 'pf."teamId"')
      .replace('grade', 'pf.grade')
    const result = await query(
      `SELECT
        pf.id, pf.name, pf.alias, pf.grade, pf."auctionPrice", pf."marketValue", pf."bdrPoints",
        pf.form, pf."trophy1Count", pf."trophy2Count", pf."trophy3Count", pf."trophy4Count",
        pf."trophy5Count", pf."trophy6Count", pf."trophy7Count", pf."trophy8Count",
        pf."trophy9Count", pf."trophy10Count", pf."trophy11Count", pf."trophy13Count",
        pf."isCaptain", pf."gradeFloor", pf."gradeCeiling",
        pf.team, pf."teamId", pf."teamLogo",
        pf."avatarId", pf."avatarUrl", pf."imageUrl",
        p.next_team_id AS "nextTeamId",
        nt.name AS "nextTeamName"
      FROM players_full pf
      JOIN players p ON p.id = pf.id
      LEFT JOIN teams nt ON nt.id = p.next_team_id${whereFixed} ORDER BY pf."bdrPoints" DESC`, params
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
        mr.season_number AS "seasonNumber",
        mr.is_walkover AS "isWalkover",
        -- isWalkoverGiven: true when THIS player gave the walkover (they lost in a WO)
        CASE
          WHEN mr.is_walkover = true AND mr.player_id = $1   AND mr.result = 'loss' THEN true
          WHEN mr.is_walkover = true AND mr.opponent_id = $1 AND mr.result = 'win'  THEN true
          ELSE false
        END AS "isWalkoverGiven",
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
      walkoversGiven: 0,
    }
    historyRes.rows.forEach(m => {
      const bucket = m.result === "win" ? "wins" : m.result === "draw" ? "draws" : "losses"
      if (record[bucket][m.opponentGrade] !== undefined) record[bucket][m.opponentGrade]++
      if (m.isWalkoverGiven) record.walkoversGiven++
    })

    const currentSeasonRes = await query("SELECT value FROM app_settings WHERE key = 'current_season'")
    const currentSeason = parseInt(currentSeasonRes.rows[0]?.value || "1")

    const allSeasonsRes = await query(`
      SELECT DISTINCT season_number FROM match_records
      WHERE player_id=$1 OR opponent_id=$1
      ORDER BY season_number DESC
    `, [req.params.id])
    const availableSeasons = allSeasonsRes.rows.map(r => r.season_number)

    res.json({ ...player, record, matchHistory: historyRes.rows, currentSeason, availableSeasons })
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

    // Duplicate name check (case-insensitive)
    const dupCheck = await query(
      "SELECT id FROM players WHERE LOWER(name) = LOWER($1)", [name]
    )
    if (dupCheck.rows.length > 0) {
      return res.status(409).json({ error: `Player "${name}" already exists` })
    }

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
  imageUrl:      z.string().optional().nullable(),
  gradeFloor:    z.string().optional().nullable(),
  gradeCeiling:  z.string().optional().nullable(),
  trophy1Count:  z.number().int().min(0).optional(),
  trophy2Count:  z.number().int().min(0).optional(),
  trophy3Count:  z.number().int().min(0).optional(),
  trophy4Count:  z.number().int().min(0).optional(),
  trophy5Count:  z.number().int().min(0).optional(),
  trophy6Count:  z.number().int().min(0).optional(),
  trophy7Count:  z.number().int().min(0).optional(),
  trophy13Count: z.number().int().min(0).optional(),
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
      avatarUrl:   z.string().nullable().optional(),
      avatarBgUrl: z.string().nullable().optional(),
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
      name, alias, grade, gradeFloor, gradeCeiling, bdrDelta, isCaptain, auctionPrice, teamId, imageUrl,
      trophy1Count, trophy2Count, trophy3Count, trophy4Count, trophy5Count, trophy6Count, trophy7Count,
      trophy13Count,
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
        grade         = COALESCE($3::player_grade, grade),

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
        trophy7_count  = COALESCE($15, trophy7_count),
        trophy13_count = COALESCE($18, trophy13_count)
      WHERE id = $16
      RETURNING id, name, alias, grade, grade_floor AS "gradeFloor", grade_ceiling AS "gradeCeiling",
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
                trophy7_count  AS "trophy7Count",
                trophy13_count AS "trophy13Count"
    `, [
      name ?? null, alias ?? null, grade ?? null,
      bdrDelta ?? null, isCaptain ?? null, auctionPriceValue,
      teamIdValue ?? null, imageUrl ?? null,
      trophy1Count ?? null, trophy2Count ?? null, trophy3Count ?? null,
      trophy4Count ?? null, trophy5Count ?? null,
      trophy6Count ?? null, trophy7Count ?? null,
      req.params.id, teamIdProvided,
      trophy13Count ?? null,

    ])

    if (!result.rows[0]) return res.status(404).json({ error: "Player not found" })

    // Update grade_floor and grade_ceiling separately to avoid null type issues
    if (gradeFloor !== undefined) {
      await query(
        `UPDATE players SET grade_floor = $1 WHERE id = $2`,
        [gradeFloor || null, req.params.id]
      )
      result.rows[0].gradeFloor = gradeFloor || null
    }
    if (gradeCeiling !== undefined) {
      await query(
        `UPDATE players SET grade_ceiling = $1 WHERE id = $2`,
        [gradeCeiling || null, req.params.id]
      )
      result.rows[0].gradeCeiling = gradeCeiling || null
    }

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
        ORDER BY mr.recorded_at ASC, mr.id ASC
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

// GET /api/players/:id/percentiles — calculates where this player ranks
// across 8 stat dimensions compared to every other player in the league.
router.get("/:id/percentiles", async (req, res, next) => {
  try {
    const targetId = parseInt(req.params.id)

    // Pull every player's match data in one query — both sides of match_records
    const allMatchesRes = await query(`
      SELECT
        sub.pid,
        sub.result,
        sub.opponent_grade,
        sub.match_type,
        sub.recorded_at
      FROM (
        SELECT mr.player_id AS pid,
               mr.result::text AS result,
               mr.opponent_grade::text AS opponent_grade,
               mr.match_type::text AS match_type,
               mr.recorded_at
        FROM match_records mr
        UNION ALL
        SELECT mr.opponent_id AS pid,
               CASE mr.result::text
                 WHEN 'win' THEN 'loss'
                 WHEN 'loss' THEN 'win'
                 ELSE 'draw'
               END AS result,
               p.grade::text AS opponent_grade,
               mr.match_type::text AS match_type,
               mr.recorded_at
        FROM match_records mr
        JOIN players p ON p.id = mr.player_id
      ) sub
      ORDER BY sub.pid, sub.recorded_at DESC
    `)

    // Pull player metadata (grade, MV, auction price, trophies, BDR)
    const playersRes = await query(`
      SELECT id, grade::text AS grade, market_value, auction_price, bdr_points, is_captain,
             COALESCE(trophy1_count,0)+COALESCE(trophy2_count,0)+COALESCE(trophy3_count,0)+
             COALESCE(trophy4_count,0)+COALESCE(trophy5_count,0)+COALESCE(trophy6_count,0)+
             COALESCE(trophy7_count,0) AS total_trophies
      FROM players
    `)

    // Group matches by player
    const matchesByPlayer = {}
    for (const m of allMatchesRes.rows) {
      if (!matchesByPlayer[m.pid]) matchesByPlayer[m.pid] = []
      matchesByPlayer[m.pid].push(m)
    }

    const GRADE_RANK = { S: 5, "A+": 4, A: 3, B: 2, C: 1 }

    // Calculate stats for each player
    const playerStats = playersRes.rows
      .filter(p => (matchesByPlayer[p.id]?.length || 0) >= 3) // minimum 3 matches
      .map(p => {
        const matches = matchesByPlayer[p.id] || []
        const total = matches.length
        const wins = matches.filter(m => m.result === "win").length
        const draws = matches.filter(m => m.result === "draw").length
        const losses = matches.filter(m => m.result === "loss").length

        // 1. Win Rate
        const winRate = total > 0 ? wins / total : 0

        // 2. Consistency (inverse of std deviation of results)
        const resultValues = matches.map(m =>
          m.result === "win" ? 1 : m.result === "draw" ? 0.5 : 0
        )
        const mean = resultValues.reduce((a, b) => a + b, 0) / (resultValues.length || 1)
        const variance = resultValues.reduce((s, v) => s + (v - mean) ** 2, 0) / (resultValues.length || 1)
        const stdDev = Math.sqrt(variance)
        const consistency = 1 - stdDev // higher = more consistent

        // 3. Clutch — win rate in UCL knockout + weekly (tournament matches)
        const tourneyMatches = matches.filter(m => m.match_type === "ucl" || m.match_type === "weekly")
        const clutch = tourneyMatches.length >= 2
          ? tourneyMatches.filter(m => m.result === "win").length / tourneyMatches.length
          : null

        // 4. Giant Killing — win rate vs higher-graded opponents
        //    S-grade: vs S and A+ opponents (toughest tier)
        //    A+: vs S opponents
        //    Others: vs anyone graded higher
        const myGradeRank = GRADE_RANK[p.grade] || 0
        const vsTough = myGradeRank >= 5
          ? matches.filter(m => (GRADE_RANK[m.opponent_grade] || 0) >= 4)  // S-grade: vs S & A+
          : matches.filter(m => (GRADE_RANK[m.opponent_grade] || 0) > myGradeRank)
        const giantKillingMin = myGradeRank >= 5 ? 1 : 2
        const giantKilling = vsTough.length >= giantKillingMin
          ? vsTough.filter(m => m.result === "win").length / vsTough.length
          : null

        // 5. Form Score — weighted last 5 matches (most recent = 5x)
        const last5 = matches.slice(0, 5)
        let formScore = 0
        let formMax = 0
        last5.forEach((m, i) => {
          const weight = 5 - i
          formMax += weight
          formScore += (m.result === "win" ? 1 : m.result === "draw" ? 0.5 : 0) * weight
        })
        const form = formMax > 0 ? formScore / formMax : 0

        // 6. Loss Avoidance — (wins + draws) / total
        const lossAvoidance = total > 0 ? (wins + draws) / total : 0

        // 7. Trophies
        const trophies = p.total_trophies || 0

        // 8. Value Growth (ROI)
        const auctionPrice = p.is_captain ? null : (p.auction_price || 0)
        const valueGrowth = auctionPrice && auctionPrice > 0
          ? (p.market_value - auctionPrice) / auctionPrice
          : null

        return {
          id: p.id, winRate, consistency, clutch, giantKilling,
          form, lossAvoidance, trophies, valueGrowth,
        }
      })

    // Calculate percentile for a given stat
    function percentile(statKey, playerId) {
      const validPlayers = playerStats.filter(p => p[statKey] !== null && p[statKey] !== undefined)
      const target = validPlayers.find(p => p.id === playerId)
      if (!target || validPlayers.length < 2) return null

      const below = validPlayers.filter(p => p[statKey] < target[statKey]).length
      return Math.round((below / (validPlayers.length - 1)) * 100)
    }

    // Find target player
    const targetPlayer = playerStats.find(p => p.id === targetId)
    if (!targetPlayer) {
      return res.json({
        percentiles: null,
        message: "Not enough match data to calculate percentiles",
      })
    }

    // Check if target player is a captain
    const targetMeta = playersRes.rows.find(p => p.id === targetId)
    const isCaptain = targetMeta?.is_captain || false

    const stats = [
      "winRate", "consistency", "clutch", "giantKilling",
      "form", "lossAvoidance", "trophies", "valueGrowth",
    ]

    const percentiles = {}
    const rawValues = {}
    for (const stat of stats) {
      const pct = percentile(stat, targetId)
      // Captains have no auction price — Value Growth is not applicable
      if (stat === "valueGrowth" && isCaptain) {
        percentiles[stat] = null
      } else {
        percentiles[stat] = pct !== null ? pct : 0
      }
      rawValues[stat] = targetPlayer[stat]
    }

    // Find best and worst stat for headline
    const validPercentiles = Object.entries(percentiles).filter(([, v]) => v !== null)
    const best = validPercentiles.sort((a, b) => b[1] - a[1])[0]
    const worst = validPercentiles.sort((a, b) => a[1] - b[1])[0]

    res.json({
      percentiles,
      rawValues,
      totalPlayers: playerStats.length,
      best: best ? { stat: best[0], percentile: best[1] } : null,
      worst: worst ? { stat: worst[0], percentile: worst[1] } : null,
    })
  } catch (err) {
    console.error("[percentiles] Error:", err.message)
    next(err)
  }
})

// GET /api/players/:id/mv-debug — full market value calculation breakdown
// Shows exactly what goes into the MV so you can verify correctness.
router.get("/:id/mv-debug", authenticate, adminOnly, async (req, res, next) => {
  try {
    const playerId = parseInt(req.params.id)
    const seasonRes = await query("SELECT value FROM app_settings WHERE key = 'current_season'")
    const season = parseInt(seasonRes.rows[0]?.value || "1")

    const playerRes = await query(
      "SELECT id, name, grade, bdr_points, market_value FROM players WHERE id = $1", [playerId]
    )
    const player = playerRes.rows[0]
    if (!player) return res.status(404).json({ error: "Player not found" })

    const matchesRes = await query(`
      SELECT
        mr.id,
        mr.recorded_at,
        mr.match_type,
        CASE
          WHEN mr.player_id = $1 THEN mr.result
          WHEN mr.result = 'win'  THEN 'loss'
          WHEN mr.result = 'loss' THEN 'win'
          ELSE 'draw'
        END AS result,
        CASE
          WHEN mr.player_id = $1 THEN mr.opponent_grade
          ELSE (SELECT grade FROM players WHERE id = mr.player_id)
        END AS opponent_grade,
        CASE WHEN mr.player_id = $1 THEN opp.name ELSE own.name END AS opponent_name
      FROM match_records mr
      LEFT JOIN players own ON own.id = mr.player_id
      LEFT JOIN players opp ON opp.id = mr.opponent_id
      WHERE (mr.player_id = $1 OR mr.opponent_id = $1)
        AND mr.season_number = $2
      ORDER BY mr.recorded_at DESC
    `, [playerId, season])

    // WIN_WEIGHT / DRAW / LOSS matrices
    const WIN_WEIGHT   = { S: 1.5, A: 0.9, B: 0.7, C: 0.6 }
    const DRAW_MATRIX  = {
      S: { S: 0.2,  A: 0.2,  B: -0.5, C: -0.8 },
      A: { S: 0.5,  A: 0.4,  B: -0.3, C: -0.4 },
      B: { S: 0.7,  A: 0.6,  B: 0.4,  C: -0.2 },
      C: { S: 0.9,  A: 0.8,  B: 0.6,  C: 0.3  },
    }
    const LOSS_MATRIX  = {
      S: { S: -0.5, A: -0.7,  B: -1.0, C: -1.5 },
      A: { S: -0.4, A: -0.75, B: -0.7, C: -1.0 },
      B: { S: -0.4, A: -0.6,  B: -0.4, C: -0.7 },
      C: { S: -0.3, A: -0.4,  B: -0.3, C: -0.7 },
    }
    const BDR_SWING_RATE = 18 / 120
    const MATCH_CEILING  = 450

    const ownGrade = player.grade ?? "C"
    let ewRaw = 0
    const matchBreakdown = []

    for (const m of matchesRes.rows) {
      let weight = 0
      if (m.result === "win")  weight = WIN_WEIGHT[m.opponent_grade] ?? 0
      if (m.result === "draw") weight = DRAW_MATRIX[ownGrade]?.[m.opponent_grade] ?? 0
      if (m.result === "loss") weight = LOSS_MATRIX[ownGrade]?.[m.opponent_grade] ?? 0
      ewRaw += weight
      matchBreakdown.push({
        opponent: m.opponent_name,
        opponentGrade: m.opponent_grade,
        result: m.result,
        weight: weight,
        runningEw: parseFloat(ewRaw.toFixed(3)),
        matchType: m.match_type,
        date: m.recorded_at,
      })
    }

    const ew           = Math.max(ewRaw, 0)
    const pp           = ew * 3
    const winPct       = Math.max(ew / 14, 0)
    const matchValue   = Math.min(pp * 5 + winPct * 85, MATCH_CEILING)
    const bdrPoints    = player.bdr_points ?? 0
    const bdrSwing     = ewRaw > 0 ? bdrPoints * BDR_SWING_RATE : 0
    const mvRaw        = matchValue + bdrSwing
    const baseValue    = Math.max(50, Math.round(mvRaw / 5) * 5)

    const trophiesRes = await query(
      "SELECT trophy_column, COUNT(*)::int AS count FROM player_trophies WHERE player_id=$1 AND season_number=$2 GROUP BY trophy_column",
      [playerId, season]
    )
    const TROPHY_BONUS = { trophy2_count: 25, trophy4_count: 20, trophy3_count: 15, trophy6_count: 15, trophy7_count: 10, trophy5_count: 5, trophy8_count: 15, trophy9_count: 10, trophy10_count: 15, trophy11_count: 8 }
    let trophyBonus = 0
    const trophyBreakdown = []
    for (const row of trophiesRes.rows) {
      const bonus = TROPHY_BONUS[row.trophy_column] ?? 0
      trophyBonus += row.count * bonus
      trophyBreakdown.push({ column: row.trophy_column, count: row.count, bonus, total: row.count * bonus })
    }

    const expectedMV = baseValue + trophyBonus

    res.json({
      player: { id: player.id, name: player.name, grade: ownGrade, bdrPoints, storedMV: player.market_value },
      season,
      totalMatchesThisSeason: matchesRes.rows.length,
      calculation: {
        ewRaw: parseFloat(ewRaw.toFixed(3)),
        ew:    parseFloat(ew.toFixed(3)),
        pp:    parseFloat(pp.toFixed(3)),
        winPct: parseFloat(winPct.toFixed(3)),
        matchValue: parseFloat(matchValue.toFixed(2)),
        bdrSwing:   parseFloat(bdrSwing.toFixed(2)),
        mvRaw:      parseFloat(mvRaw.toFixed(2)),
        baseValue,
        trophyBonus,
        expectedMV,
      },
      verdict: expectedMV === player.market_value ? "✅ CORRECT" : `❌ STALE — should be ${expectedMV}, stored is ${player.market_value}`,
      matchBreakdown,
      trophyBreakdown,
    })
  } catch (err) { next(err) }
})

// POST /api/players/recalc-all-mv — admin: recalculate MV for all players in current season
// Runs in parallel batches of 10 to avoid request timeout on large rosters
router.post("/recalc-all-mv", authenticate, adminOnly, async (req, res, next) => {
  try {
    const allPlayers = await query("SELECT id FROM players ORDER BY id")
    const ids = allPlayers.rows.map(p => p.id)
    const BATCH = 10
    for (let i = 0; i < ids.length; i += BATCH) {
      await Promise.all(ids.slice(i, i + BATCH).map(id => recalcMarketValue(id)))
      await Promise.all(ids.slice(i, i + BATCH).map(id => recalcForm(id)))
    }
    res.json({ success: true, updated: ids.length })
  } catch (err) { next(err) }
})

// ── GET /api/players/:id/tournament-history — fast read from DB ───────────────
router.get("/:id/tournament-history", async (req, res, next) => {
  try {
    const playerId = parseInt(req.params.id)
    const { rows } = await query(
      "SELECT tournament_type, category, key, count FROM player_tournament_history WHERE player_id = $1",
      [playerId]
    )
    res.json(buildHistoryResponse(rows))
  } catch (err) { next(err) }
})

// ── POST /api/players/recalc-tournament-history — admin backfill ──────────────
// Scans all existing tournament data and (re-)builds player_tournament_history.
// Safe to run multiple times — clears all rows for the player first.
router.post("/recalc-tournament-history", authenticate, adminOnly, async (req, res, next) => {
  try {
    let total = 0

    // Clear existing history
    await query("TRUNCATE player_tournament_history RESTART IDENTITY")

    // ── Weekly ──────────────────────────────────────────────────────────────
    const weeklyMatches = await query(`
      SELECT wtm.round, wt.total_rounds, wtm.winner_id,
             wtm.player1_id, wtm.player2_id
      FROM weekly_tournament_matches wtm
      JOIN weekly_tournaments wt ON wt.id = wtm.tournament_id
      WHERE wtm.status = 'completed' AND wtm.winner_id IS NOT NULL
    `)
    for (const m of weeklyMatches.rows) {
      if (!m.total_rounds) continue
      const loserId = m.winner_id === m.player1_id ? m.player2_id : m.player1_id
      const label   = roundLabel(m.round, m.total_rounds)
      if (loserId) { await incrementHistory(loserId, "weekly", "knockout", label); total++ }
      if (m.round === m.total_rounds && m.winner_id) {
        await incrementHistory(m.winner_id, "weekly", "knockout", "winner"); total++
      }
    }

    // ── Revolution ──────────────────────────────────────────────────────────
    const revMatches = await query(`
      SELECT rm.round, rt.total_rounds, rm.winner_id, rm.player1_id, rm.player2_id
      FROM revolution_matches rm
      JOIN revolution_tournaments rt ON rt.id = rm.tournament_id
      WHERE rm.status = 'completed' AND rm.winner_id IS NOT NULL
    `)
    for (const m of revMatches.rows) {
      if (!m.total_rounds) continue
      const loserId = m.winner_id === m.player1_id ? m.player2_id : m.player1_id
      const label   = roundLabel(m.round, m.total_rounds)
      if (loserId) { await incrementHistory(loserId, "revolution", "knockout", label); total++ }
      if (m.round === m.total_rounds && m.winner_id) {
        await incrementHistory(m.winner_id, "revolution", "knockout", "winner"); total++
      }
    }

    // ── UCL Knockout ────────────────────────────────────────────────────────
    const uclKoMatches = await query(`
      SELECT ukm.round, ukt.total_rounds, ukm.winner_id, ukm.player1_id, ukm.player2_id
      FROM ucl_knockout_matches ukm
      JOIN ucl_knockout_tournaments ukt ON ukt.id = ukm.tournament_id
      WHERE ukm.status = 'completed' AND ukm.winner_id IS NOT NULL
    `)
    for (const m of uclKoMatches.rows) {
      if (!m.total_rounds) continue
      const loserId = m.winner_id === m.player1_id ? m.player2_id : m.player1_id
      const label   = roundLabel(m.round, m.total_rounds)
      if (loserId) { await incrementHistory(loserId, "ucl", "knockout", label); total++ }
      if (m.round === m.total_rounds && m.winner_id) {
        await incrementHistory(m.winner_id, "ucl", "knockout", "winner"); total++
      }
    }

    // ── Duo Knockout ────────────────────────────────────────────────────────
    const duoKoFix = await query(`
      SELECT df.knockout_round, df.winner_pair_id, df.home_pair_id, df.away_pair_id
      FROM duo_fixtures df
      WHERE df.knockout_round IS NOT NULL AND df.status = 'completed' AND df.winner_pair_id IS NOT NULL
    `)
    for (const f of duoKoFix.rows) {
      const loserPairId  = f.winner_pair_id === f.home_pair_id ? f.away_pair_id : f.home_pair_id
      const [loserPair, winnerPair] = await Promise.all([
        query("SELECT set1_player_id, set2_player_id FROM duo_pairs WHERE id = $1", [loserPairId]),
        f.knockout_round === "final"
          ? query("SELECT set1_player_id, set2_player_id FROM duo_pairs WHERE id = $1", [f.winner_pair_id])
          : Promise.resolve({ rows: [] }),
      ])
      for (const pid of [loserPair.rows[0]?.set1_player_id, loserPair.rows[0]?.set2_player_id].filter(Boolean)) {
        await incrementHistory(pid, "duo", "knockout", f.knockout_round); total++
      }
      if (f.knockout_round === "final") {
        for (const pid of [winnerPair.rows[0]?.set1_player_id, winnerPair.rows[0]?.set2_player_id].filter(Boolean)) {
          await incrementHistory(pid, "duo", "knockout", "winner"); total++
        }
      }
    }

    // ── Duo Group Stage ─────────────────────────────────────────────────────
    const duoGroupStandings = await query(`
      SELECT dgm.duo_pair_id AS "duoPairId",
        RANK() OVER (PARTITION BY dgm.group_id ORDER BY dgm.points DESC, dgm.gf - dgm.ga DESC, dgm.gf DESC) AS rnk
      FROM duo_group_members dgm
    `)
    for (const row of duoGroupStandings.rows) {
      const pairRes = await query("SELECT set1_player_id, set2_player_id FROM duo_pairs WHERE id = $1", [row.duoPairId])
      const pair = pairRes.rows[0]
      if (pair) {
        for (const pid of [pair.set1_player_id, pair.set2_player_id].filter(Boolean)) {
          await incrementHistory(pid, "duo", "group", String(parseInt(row.rnk))); total++
        }
      }
    }

    res.json({ success: true, total })
  } catch (err) { next(err) }
})



// ── GET /api/players/:id/bdr-breakdown — BDR points breakdown by source ──────
router.get("/:id/bdr-breakdown", async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT label, SUM(amount)::int AS total
      FROM player_bdr_breakdown
      WHERE player_id = $1 AND amount > 0
      GROUP BY label
      ORDER BY total DESC
    `, [req.params.id])
    res.json(rows)
  } catch (err) { next(err) }
})

export default router
// ── GET /api/players/:id/tournament-history ───────────────────────────────────
// Returns per-player tournament history across Weekly, Revolution, UCL, Duo.
// Aggregates counts of how many times they reached/were eliminated at each round.
router.get("/:id/tournament-history", async (req, res, next) => {
  try {
    const playerId = parseInt(req.params.id)
    const safe = async (fn) => { try { return await fn() } catch { return [] } }

    // ── Helper: convert numeric round → label based on total_rounds ──────────
    function roundLabel(round, totalRounds) {
      const diff = totalRounds - round
      if (diff === 0) return "final"
      if (diff === 1) return "sf"
      if (diff === 2) return "qf"
      if (diff === 3) return "r16"
      if (diff === 4) return "r32"
      return "r64"
    }

    function aggregateRounds(entries) {
      const counts = { winner: 0, final: 0, sf: 0, qf: 0, r16: 0, r32: 0, r64: 0 }
      for (const e of entries) counts[e] = (counts[e] || 0) + 1
      return counts
    }

    // ── Weekly ────────────────────────────────────────────────────────────────
    const weeklyRows = await safe(() => query(`
      SELECT wt.total_rounds,
             wtm.round,
             CASE WHEN wtm.winner_id = $1 THEN true ELSE false END AS won
      FROM weekly_tournament_matches wtm
      JOIN weekly_tournaments wt ON wt.id = wtm.tournament_id
      WHERE (wtm.player1_id = $1 OR wtm.player2_id = $1)
        AND wtm.status = 'completed'
        AND (wtm.winner_id IS NOT NULL)
    `, [playerId]))

    // For each tournament the player entered, find their best round
    const weeklyByTournament = {}
    for (const r of weeklyRows) {
      const key = `${r.total_rounds}-${r.round}`
      if (!weeklyByTournament[r.total_rounds]) weeklyByTournament[r.total_rounds] = {}
      if (r.won) {
        if (r.round === r.total_rounds) weeklyByTournament[`winner-${r.round}`] = "winner"
      } else {
        weeklyByTournament[key] = roundLabel(r.round, r.total_rounds)
      }
    }
    const weeklyEntries = []
    for (const r of weeklyRows) {
      if (r.won && r.round === r.total_rounds) weeklyEntries.push("winner")
      else if (!r.won) weeklyEntries.push(roundLabel(r.round, r.total_rounds))
    }
    const weekly = aggregateRounds(weeklyEntries)

    // ── Revolution ────────────────────────────────────────────────────────────
    const revRows = await safe(() => query(`
      SELECT rt.total_rounds,
             rtm.round,
             CASE WHEN rtm.winner_id = $1 THEN true ELSE false END AS won
      FROM revolution_tournament_matches rtm
      JOIN revolution_tournaments rt ON rt.id = rtm.tournament_id
      WHERE (rtm.player1_id = $1 OR rtm.player2_id = $1)
        AND rtm.status = 'completed'
        AND rtm.winner_id IS NOT NULL
    `, [playerId]))

    const revEntries = []
    for (const r of revRows) {
      if (r.won && r.round === r.total_rounds) revEntries.push("winner")
      else if (!r.won) revEntries.push(roundLabel(r.round, r.total_rounds))
    }
    const revolution = aggregateRounds(revEntries)

    // ── UCL Knockout ──────────────────────────────────────────────────────────
    const uclKoRows = await safe(() => query(`
      SELECT ukt.total_rounds,
             ukm.round,
             CASE WHEN ukm.winner_id = $1 THEN true ELSE false END AS won
      FROM ucl_knockout_matches ukm
      JOIN ucl_knockout_tournaments ukt ON ukt.id = ukm.tournament_id
      WHERE (ukm.player1_id = $1 OR ukm.player2_id = $1)
        AND ukm.status = 'completed'
        AND ukm.winner_id IS NOT NULL
    `, [playerId]))

    const uclKoEntries = []
    for (const r of uclKoRows) {
      if (r.won && r.round === r.total_rounds) uclKoEntries.push("winner")
      else if (!r.won) uclKoEntries.push(roundLabel(r.round, r.total_rounds))
    }
    const uclKnockout = aggregateRounds(uclKoEntries)

    // ── UCL Group Stage ───────────────────────────────────────────────────────
    // Rank each player within their group by points → gd → gf
    const uclGroupRows = await safe(() => query(`
      SELECT
        ugp.grp,
        ugp.season_number,
        p2.id AS player_id,
        COALESCE(SUM(CASE
          WHEN um.player1_id = p2.id AND um.winner_id = p2.id THEN 3
          WHEN um.player2_id = p2.id AND um.winner_id = p2.id THEN 3
          WHEN um.winner_id IS NULL AND um.status = 'completed' THEN 1
          ELSE 0
        END), 0) AS pts,
        COALESCE(SUM(CASE WHEN um.player1_id = p2.id THEN um.player1_score
                         WHEN um.player2_id = p2.id THEN um.player2_score ELSE 0 END), 0) AS gf,
        COALESCE(SUM(CASE WHEN um.player1_id = p2.id THEN um.player2_score
                         WHEN um.player2_id = p2.id THEN um.player1_score ELSE 0 END), 0) AS ga
      FROM ucl_group_players ugp
      JOIN players p2 ON p2.id = ugp.player_id
      LEFT JOIN ucl_matches um
        ON um.season_number = ugp.season_number
        AND um.grp = ugp.grp
        AND (um.player1_id = p2.id OR um.player2_id = p2.id)
        AND um.status = 'completed'
      GROUP BY ugp.grp, ugp.season_number, p2.id
    `))

    // Group by season+group, rank within each group, find target player's positions
    const uclGroupMap = {}
    for (const r of uclGroupRows) {
      const key = `${r.season_number}-${r.grp}`
      if (!uclGroupMap[key]) uclGroupMap[key] = []
      uclGroupMap[key].push(r)
    }
    const uclGroupPositions = []
    for (const [, members] of Object.entries(uclGroupMap)) {
      members.sort((a, b) => (b.pts - a.pts) || ((b.gf - b.ga) - (a.gf - a.ga)) || (b.gf - a.gf))
      const idx = members.findIndex(m => m.player_id === playerId)
      if (idx !== -1) uclGroupPositions.push(idx + 1)
    }
    const uclGroup = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 }
    for (const pos of uclGroupPositions) {
      if (uclGroup[pos] !== undefined) uclGroup[pos]++
    }

    // ── Duo Group Stage ───────────────────────────────────────────────────────
    // Find all duo pairs this player was in, then rank within their group
    const duoGroupRows = await safe(() => query(`
      SELECT
        dgm.group_id,
        dp.season_number,
        dp2.id AS pair_id,
        dp2.set1_player_id,
        dp2.set2_player_id,
        dgm.points,
        dgm.gf - dgm.ga AS gd,
        dgm.gf
      FROM duo_pairs dp
      JOIN duo_group_members dgm2 ON dgm2.duo_pair_id = dp.id
      JOIN duo_group_members dgm  ON dgm.group_id = dgm2.group_id
      JOIN duo_pairs dp2          ON dp2.id = dgm.duo_pair_id
      WHERE (dp.set1_player_id = $1 OR dp.set2_player_id = $1)
        AND dp.season_number = dp2.season_number
      ORDER BY dgm.group_id, dgm.points DESC, (dgm.gf - dgm.ga) DESC, dgm.gf DESC
    `, [playerId]))

    // Group by group_id, find target player's pair's rank
    const duoGroupByGid = {}
    for (const r of duoGroupRows) {
      if (!duoGroupByGid[r.group_id]) duoGroupByGid[r.group_id] = []
      duoGroupByGid[r.group_id].push(r)
    }
    const duoGroupPositions = []
    for (const [, members] of Object.entries(duoGroupByGid)) {
      const idx = members.findIndex(m =>
        m.set1_player_id === playerId || m.set2_player_id === playerId
      )
      if (idx !== -1) duoGroupPositions.push(idx + 1)
    }
    const duoGroup = { 1: 0, 2: 0, 3: 0, 4: 0 }
    for (const pos of duoGroupPositions) {
      if (duoGroup[pos] !== undefined) duoGroup[pos]++
    }

    // ── Duo Knockout ──────────────────────────────────────────────────────────
    const ROUND_ORDER = ["r16", "qf", "sf", "final"]
    const duoKoRows = await safe(() => query(`
      SELECT df.knockout_round, df.winner_pair_id,
             dp.set1_player_id, dp.set2_player_id
      FROM duo_fixtures df
      JOIN duo_pairs dp ON dp.id = df.home_pair_id OR dp.id = df.away_pair_id
      WHERE df.knockout_round IS NOT NULL
        AND df.status = 'completed'
        AND df.winner_pair_id IS NOT NULL
        AND (dp.set1_player_id = $1 OR dp.set2_player_id = $1)
    `, [playerId]))

    const duoKoEntries = []
    for (const r of duoKoRows) {
      const playerPairId = r.set1_player_id === playerId || r.set2_player_id === playerId
        ? (r.home_pair_id === r.pair_id ? r.home_pair_id : r.away_pair_id)
        : null
      const isWinner = r.winner_pair_id && (r.set1_player_id === playerId || r.set2_player_id === playerId)
        && r.knockout_round === 'final'
      if (r.knockout_round === 'final' && isWinner) duoKoEntries.push("winner")
      else if (r.set1_player_id === playerId || r.set2_player_id === playerId) {
        // Check if player's pair lost this match
        duoKoEntries.push(r.knockout_round)
      }
    }
    const duoKnockout = { winner: 0, final: 0, sf: 0, qf: 0, r16: 0 }
    for (const e of duoKoEntries) {
      if (duoKnockout[e] !== undefined) duoKnockout[e]++
    }

    res.json({
      weekly,
      revolution,
      ucl:  { group: uclGroup, knockout: uclKnockout },
      duo:  { group: duoGroup, knockout: duoKnockout },
    })
  } catch (err) { next(err) }
})


// ── GET /api/players/:id/form-heatmap — match results grouped by date ─────────
router.get("/:id/form-heatmap", async (req, res, next) => {
  try {
    const playerId = parseInt(req.params.id)
    const season   = req.query.season ? parseInt(req.query.season) : null

    const { rows } = await query(`
      SELECT
        DATE(mr.recorded_at AT TIME ZONE 'Asia/Kolkata') AS date,
        mr.result
      FROM match_records mr
      WHERE mr.player_id = $1
        ${season ? "AND mr.season_number = $2" : ""}
      ORDER BY date ASC
    `, season ? [playerId, season] : [playerId])

    res.json(rows)
  } catch (err) { next(err) }
})