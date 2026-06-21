import { Router } from "express"
import { z } from "zod"
import { query } from "../db/pool.js"
import { authenticate, adminOnly } from "../middleware/auth.js"
import { recalcMarketValue } from "../services/marketValue.js"

const router = Router()

// GET /api/records — all records (admin)
router.get("/", authenticate, adminOnly, async (req, res, next) => {
  try {
    const result = await query(`
      SELECT
        mr.id,
        mr.result,
        mr.match_type     AS "matchType",
        mr.opponent_grade AS "opponentGrade",
        mr.player_score   AS "playerScore",
        mr.opponent_score AS "opponentScore",
        mr.recorded_at    AS date,
        p.id              AS "playerId",
        p.name            AS "playerName",
        opp.id            AS "opponentId",
        opp.name          AS "opponentName"
      FROM match_records mr
      JOIN players p   ON mr.player_id   = p.id
      JOIN players opp ON mr.opponent_id = opp.id
      ORDER BY mr.recorded_at DESC, mr.id DESC
    `)
    res.json(result.rows)
  } catch (err) { next(err) }
})

// POST /api/records — admin logs a match result
const createSchema = z.object({
  playerId:      z.number().int().positive(),
  opponentId:    z.number().int().positive(),
  result:        z.enum(["win", "draw", "loss"]),
  matchType:     z.enum(["league", "ucl", "weekly"]).default("league"),
  playerScore:   z.number().int().min(0).optional(),
  opponentScore: z.number().int().min(0).optional(),
  date:          z.string().optional(),
})

router.post("/", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { playerId, opponentId, result, matchType, playerScore, opponentScore, date } =
      createSchema.parse(req.body)

    if (playerId === opponentId) {
      return res.status(400).json({ error: "Player cannot play against themselves" })
    }

    const oppRes = await query("SELECT grade FROM players WHERE id = $1", [opponentId])
    if (!oppRes.rows[0]) return res.status(404).json({ error: "Opponent not found" })
    const opponentGrade = oppRes.rows[0].grade

    const ins = await query(`
      INSERT INTO match_records
        (player_id, opponent_id, result, opponent_grade, match_type, player_score, opponent_score, recorded_at, recorded_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      playerId, opponentId, result, opponentGrade, matchType,
      playerScore ?? null, opponentScore ?? null,
      date || new Date().toISOString().slice(0, 10),
      req.user.id,
    ])

    const letter = result === "win" ? "W" : result === "draw" ? "D" : "L"
    await query(`
      UPDATE players
      SET form = (SELECT ARRAY(SELECT unnest(ARRAY[$1::char(1)] || form) LIMIT 5))
      WHERE id = $2
    `, [letter, playerId])

    // market_value now factors in BDR points (see services/marketValue.js), so
    // we can't rely on the DB trigger anymore — it only runs the old, BDR-blind
    // SQL formula. Recalculate both sides explicitly here with the real logic.
    await recalcMarketValue(playerId)
    await recalcMarketValue(opponentId)

    const fresh = await query(
      `SELECT id, name, grade,
              market_value AS "marketValue",
              bdr_points   AS "bdrPoints",
              form
       FROM players WHERE id = $1`,
      [playerId]
    )

    res.status(201).json({
      record: {
        ...ins.rows[0],
        matchType,
        playerScore: playerScore ?? null,
        opponentScore: opponentScore ?? null,
      },
      player: fresh.rows[0],
    })
  } catch (err) { next(err) }
})

// DELETE /api/records/:id
router.delete("/:id", authenticate, adminOnly, async (req, res, next) => {
  try {
    const result = await query(
      "DELETE FROM match_records WHERE id = $1 RETURNING player_id, opponent_id",
      [req.params.id]
    )
    if (!result.rows[0]) return res.status(404).json({ error: "Record not found" })

    // Recalculate both sides with the BDR-aware logic — can't rely on the DB
    // trigger's old SQL formula anymore, same reasoning as in POST above.
    await recalcMarketValue(result.rows[0].player_id)
    await recalcMarketValue(result.rows[0].opponent_id)

    const fresh = await query(
      `SELECT id, market_value AS "marketValue" FROM players WHERE id = $1`,
      [result.rows[0].player_id]
    )
    res.json({ deleted: true, player: fresh.rows[0] })
  } catch (err) { next(err) }
})

export default router