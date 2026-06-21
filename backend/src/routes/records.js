import { Router } from "express"
import { z } from "zod"
import { query } from "../db/pool.js"
import { authenticate, adminOnly } from "../middleware/auth.js"

const router = Router()

// Recalculates a player's market_value correctly for the "zero matches" edge case.
// compute_market_value() always floors at 50 — even for a player with NO match
// records — because the floor is meant for "played but did poorly", not "never
// played". So here we check first: if the player has no match_records of their
// own (as player_id) left, set market_value straight to 0 (their fresh/never-
// played state). Otherwise let compute_market_value() do its normal floored
// calculation. Used after both creating and deleting match records, for
// whichever player(s) are affected.
async function recalcMarketValue(playerId) {
  const countRes = await query(
    "SELECT COUNT(*)::int AS count FROM match_records WHERE player_id = $1",
    [playerId]
  )
  if (countRes.rows[0].count === 0) {
    await query("UPDATE players SET market_value = 0 WHERE id = $1", [playerId])
  } else {
    await query(
      "UPDATE players SET market_value = compute_market_value($1) WHERE id = $1",
      [playerId]
    )
  }
}

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

    // The DB trigger on match_records only recalculates market_value for the
    // player the result was logged FROM (player_id). The opponent never gets
    // touched by it, so we explicitly recompute their market_value here too.
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

    // The DB trigger already recomputed player_id via compute_market_value(),
    // which floors at 50 even when zero matches remain — that's exactly the
    // "still shows 50 after deleting the only match" issue. Override both
    // sides here with the zero-aware helper instead.
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