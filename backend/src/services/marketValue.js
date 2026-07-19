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
 * NOT updated to match this file's draw/loss matrix or trophy bonuses — it's
 * still on the older simple table. Since its output is always overwritten
 * before it's ever read, this has no user-visible effect, but flagging it in
 * case it ever needs to be brought back in sync.)
 *
 * Formula:
 *   1. WIN value depends only on the opponent's grade (unchanged — beating a
 *      tougher opponent is worth more, regardless of your own grade).
 *   2. DRAW and LOSS values depend on BOTH the player's own grade AND the
 *      opponent's grade (a full grade x grade matrix, see below).
 *   3. ew scales directly with the summed weighted total (ewRaw), uncapped.
 *   4. pp = ew * 3, winPct = ew / 14 (scaling reference only)
 *   5. matchValue = min(pp * 5 + winPct * 85, MATCH_VALUE_CEILING) — the
 *      match-performance component alone is capped at 450.
 *   6. BDR swing — scaled by the player's current bdr_points, uncapped, only
 *      applies once the player has a positive effective-win score (ewRaw > 0).
 *   7. mvRaw = matchValue + bdrSwing
 *   8. Base value = max(50, round to nearest 5) — but ONLY if the player has
 *      ANY match involvement at all. A player with zero involvement stays at 0.
 *   9. Trophy bonus — added ON TOP of the base value (after the floor/ceiling
 *      above), so a trophy always adds exactly its stated amount regardless
 *      of where the player's base value landed. One-time-per-trophy-count
 *      bonus, stacks additively across every trophy type and every trophy a
 *      player has won. See TROPHY_BONUS below for values per trophy type.
 *  10. Final value = base value + trophy bonus.
 */
import { query } from "../db/pool.js"

// Win value depends only on the opponent's grade — unchanged, same for every player.
const WIN_WEIGHT = { S: 1.5, A: 0.9, B: 0.7, C: 0.6 }

// Draw/loss value depends on BOTH the player's own grade (outer key) and the
// opponent's grade (inner key). Reading DRAW_MATRIX.S.C means "an S-grade
// player drawing against a C-grade opponent".
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

const BDR_SWING_RATE      = 18 / 120 // halved from the previous 36/120 rate, still uncapped
const MATCH_VALUE_CEILING = 450      // ceiling on match-performance only, not the final total

// One-time bonus per trophy a player has won, added after everything else.
// Column names match the players table's trophy1Count..trophy7Count fields
// (trophy1Count/Ballon d'Or intentionally excluded — already reflected via BDR).
const TROPHY_BONUS = {
  trophy2_count: 35, // Team League
  trophy4_count: 25, // UCL
  trophy3_count: 15, // Weekly
  trophy6_count: 15, // Team League Golden Boot
  trophy7_count: 10, // UCL Golden Boot
  trophy5_count: 5,  // Weekly Golden Boot
}

function resultWeight(result, ownGrade, opponentGrade) {
  if (result === "win")  return WIN_WEIGHT[opponentGrade] ?? 0
  if (result === "draw") return DRAW_MATRIX[ownGrade]?.[opponentGrade] ?? 0
  if (result === "loss") return LOSS_MATRIX[ownGrade]?.[opponentGrade] ?? 0
  return 0
}

// Computes the market value a player SHOULD have right now, based on their
// own match_records (as player_id), their current bdr_points, and their
// trophy counts. Does not check whether the player has any match involvement
// at all — call recalcMarketValue() below for that, which handles the
// zero-involvement case.
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
    query(
      `SELECT bdr_points AS bdr, grade,
              trophy2_count, trophy3_count, trophy4_count,
              trophy5_count, trophy6_count, trophy7_count
       FROM players WHERE id = $1`,
      [playerId]
    ),
  ])

  const player = playerRes.rows[0] ?? {}
  const ownGrade = player.grade ?? "C"

  let ewRaw = 0
  for (const m of matchesRes.rows) {
    ewRaw += resultWeight(m.result, ownGrade, m.opponent_grade)
  }

  const ew            = Math.max(ewRaw, 0)
  const pp             = ew * 3
  const winPct         = Math.max(ew / 14, 0)
  const matchValueRaw  = pp * 5 + winPct * 85
  const matchValue     = Math.min(matchValueRaw, MATCH_VALUE_CEILING) // ceiling here only

  const bdrPoints = player.bdr ?? 0
  const bdrSwing  = ewRaw > 0 ? bdrPoints * BDR_SWING_RATE : 0 // uncapped, added after the ceiling

  const mvRaw = matchValue + bdrSwing
  const baseValue = Math.max(50, Math.round(mvRaw / 5) * 5)

  let trophyBonus = 0
  for (const [column, bonus] of Object.entries(TROPHY_BONUS)) {
    trophyBonus += (player[column] ?? 0) * bonus
  }

  return baseValue + trophyBonus
}

// Recalculates and persists a player's market_value. If the player has zero
// match involvement at all (neither as player_id nor opponent_id), resets to
// 0 — their fresh/never-played state. Otherwise computes via
// calculateMarketValue() (which includes BDR swing and trophy bonuses) and
// saves it.
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