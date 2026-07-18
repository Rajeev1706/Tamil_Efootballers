/**
 * marketValue.js — single source of truth for calculating a player's market value.
 *
 * This replaces reliance on the DB's compute_market_value() SQL function. That
 * function still exists and its trigger still fires automatically on
 * match_records changes, but every code path below explicitly overwrites
 * whatever the trigger set, so the SQL function's output is never the final
 * answer — this file's calculateMarketValue() is. This means changing the
 * formula only ever requires editing this file — never a DB migration or
 * manual SQL. (NOTE: as of this version, the SQL trigger's own formula was
 * NOT updated to match this file's new draw/loss matrix — it's still on the
 * older simple table. Since its output is always overwritten before it's
 * ever read, this has no user-visible effect, but flagging it in case it
 * ever needs to be brought back in sync.)
 *
 * Formula:
 *   1. WIN value depends only on the opponent's grade (unchanged from before —
 *      beating a tougher opponent is worth more, regardless of your own grade).
 *   2. DRAW and LOSS values now depend on BOTH the player's own grade AND
 *      the opponent's grade (a full grade x grade matrix, see below) —
 *      losing/drawing against a tougher-or-equal opponent is treated much
 *      more leniently (often even a small bonus for a draw) than
 *      losing/drawing against a weaker opponent, which is penalized more
 *      heavily the weaker that opponent is.
 *   3. ew scales directly with the summed weighted total (ewRaw), uncapped.
 *   4. pp = ew * 3, winPct = ew / 14 (scaling reference only)
 *   5. matchValue = min(pp * 5 + winPct * 85, MATCH_VALUE_CEILING) — the
 *      match-performance component alone is capped at 450, so pure win
 *      grinding tops out there.
 *   6. BDR swing — scaled by the player's current bdr_points, uncapped —
 *      only applies once the player has a positive effective-win score
 *      (ewRaw > 0), i.e. they've actually won or drawn at least something.
 *      This is added AFTER the match-value cap, so a player with enough BDR
 *      points can legitimately push their total market value past 450.
 *   7. mvRaw = matchValue + bdrSwing
 *   8. Final value = max(50, round to nearest 5) — but ONLY if the player has
 *      ANY match involvement at all (as player_id or opponent_id). A player
 *      with zero involvement on either side stays at 0 (their fresh,
 *      never-played state).
 */
import { query } from "../db/pool.js"

// Win value depends only on the opponent's grade — unchanged, same for every player.
const WIN_WEIGHT = { S: 1.5, A: 0.9, B: 0.7, C: 0.6 }

// Draw/loss value now depends on BOTH the player's own grade (outer key)
// and the opponent's grade (inner key). Reading DRAW_MATRIX.S.C means
// "an S-grade player drawing against a C-grade opponent".
const DRAW_MATRIX = {
  S: { S: 0.2, A: 0.2, B: -0.5, C: -0.8 },
  A: { S: 0.5, A: 0.4, B: -0.3, C: -0.4 },
  B: { S: 0.7, A: 0.6, B: 0.4,  C: -0.2 },
  C: { S: 0.9, A: 0.8, B: 0.6,  C: 0.3  },
}

const LOSS_MATRIX = {
  S: { S: -0.5, A: -0.7,  B: -1.0, C: -1.5 },
  A: { S: -0.4, A: -0.75, B: -0.7, C: -1.0 },
  B: { S: -0.4, A: -0.6,  B: -0.4, C: -0.7 },
  C: { S: -0.3, A: -0.4,  B: -0.3, C: -0.7 },
}

const BDR_SWING_RATE      = 36 / 120 // same per-point rate as before, uncapped
const MATCH_VALUE_CEILING = 450      // ceiling on match-performance only, not the final total

function resultWeight(result, ownGrade, opponentGrade) {
  if (result === "win")  return WIN_WEIGHT[opponentGrade] ?? 0
  if (result === "draw") return DRAW_MATRIX[ownGrade]?.[opponentGrade] ?? 0
  if (result === "loss") return LOSS_MATRIX[ownGrade]?.[opponentGrade] ?? 0
  return 0
}

// Computes the market value a player SHOULD have right now, based on their
// own match_records (as player_id) and their current bdr_points. Does not
// check whether the player has any match involvement at all — call
// recalcMarketValue() below for that, which handles the zero-involvement case.
export async function calculateMarketValue(playerId) {
  const [matchesRes, playerRes] = await Promise.all([
    query(
      `SELECT
         CASE
           WHEN player_id = $1 THEN result
           WHEN result = 'win'  THEN 'loss'
           WHEN result = 'loss' THEN 'win'
           ELSE 'draw'
         END AS result,
         CASE
           WHEN player_id = $1 THEN opponent_grade
           ELSE (SELECT grade FROM players WHERE id = player_id)
         END AS opponent_grade
       FROM match_records
       WHERE player_id = $1 OR opponent_id = $1`,
      [playerId]
    ),
    query("SELECT bdr_points AS bdr, grade FROM players WHERE id = $1", [playerId]),
  ])

  const ownGrade = playerRes.rows[0]?.grade ?? "C"

  let ewRaw = 0
  for (const m of matchesRes.rows) {
    ewRaw += resultWeight(m.result, ownGrade, m.opponent_grade)
  }

  const ew            = Math.max(ewRaw, 0)
  const pp             = ew * 3
  const winPct         = Math.max(ew / 14, 0)
  const matchValueRaw  = pp * 5 + winPct * 85
  const matchValue     = Math.min(matchValueRaw, MATCH_VALUE_CEILING) // ceiling here only

  const bdrPoints = playerRes.rows[0]?.bdr ?? 0
  const bdrSwing  = ewRaw > 0 ? bdrPoints * BDR_SWING_RATE : 0 // uncapped, added after the ceiling

  const mvRaw = matchValue + bdrSwing
  return Math.max(50, Math.round(mvRaw / 5) * 5)
}

// Recalculates and persists a player's market_value. If the player has zero
// match involvement at all (neither as player_id nor opponent_id), resets to
// 0 — their fresh/never-played state. Otherwise computes via
// calculateMarketValue() (which includes the BDR swing) and saves it.
export async function recalcMarketValue(playerId) {
  const countRes = await query(
    "SELECT COUNT(*)::int AS count FROM match_records WHERE player_id = $1 OR opponent_id = $1",
    [playerId]
  )

  if (countRes.rows[0].count === 0) {
    await query("UPDATE players SET market_value = 0 WHERE id = $1", [playerId])
    return
  }

  const mv = await calculateMarketValue(playerId)
  await query("UPDATE players SET market_value = $1 WHERE id = $2", [mv, playerId])
}