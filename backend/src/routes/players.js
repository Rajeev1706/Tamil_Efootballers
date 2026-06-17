import { Router } from "express"
import { z } from "zod"
import { query } from "../db/pool.js"
import { authenticate, adminOnly } from "../middleware/auth.js"

const router = Router()

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
        mr.result,
        mr.match_type     AS "matchType",
        mr.opponent_grade AS "opponentGrade",
        mr.player_score   AS "playerScore",
        mr.opponent_score AS "opponentScore",
        mr.recorded_at    AS date,
        opp.id            AS "opponentId",
        opp.name          AS "opponentName",
        ot.name           AS "opponentTeam"
      FROM match_records mr
      JOIN players opp ON mr.opponent_id = opp.id
      LEFT JOIN teams ot ON opp.team_id = ot.id
      WHERE mr.player_id = $1
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

    // Captains have no auction price — stored as 0, MV starts at 300 (built up/down by matches/BDR after)
    const finalAuctionPrice = isCaptain ? 0 : auctionPrice
    const finalMarketValue  = isCaptain ? 300 : auctionPrice

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
}).refine(d => Object.values(d).some(v => v !== undefined), {
  message: "Provide at least one field to update",
})

router.patch("/:id", authenticate, adminOnly, async (req, res, next) => {
  try {
    const {
      name, alias, grade, bdrDelta, isCaptain, auctionPrice, teamId, imageUrl,
      trophy1Count, trophy2Count, trophy3Count, trophy4Count,
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
        team_id       = CASE WHEN $14 THEN $7 ELSE team_id END,
        image_url     = COALESCE($8, image_url),
        trophy1_count = COALESCE($9, trophy1_count),
        trophy2_count = COALESCE($10, trophy2_count),
        trophy3_count = COALESCE($11, trophy3_count),
        trophy4_count = COALESCE($12, trophy4_count)
      WHERE id = $13
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
                trophy4_count AS "trophy4Count"
    `, [
      name ?? null, alias ?? null, grade ?? null,
      bdrDelta ?? null, isCaptain ?? null, auctionPriceValue,
      teamIdValue ?? null,
      imageUrl ?? null,
      trophy1Count ?? null, trophy2Count ?? null, trophy3Count ?? null, trophy4Count ?? null,
      req.params.id,
      teamIdProvided,
    ])

    if (!result.rows[0]) return res.status(404).json({ error: "Player not found" })
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