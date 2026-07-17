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

export default router