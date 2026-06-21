/**
 * marketValue.js — single source of truth for calculating a player's market value.
 *
 * This replaces reliance on the DB's compute_market_value() SQL function. That
 * function still exists and its trigger still fires automatically on
 * match_records changes, but every code path below explicitly overwrites
 * whatever the trigger set, so the SQL function's output is never the final
 * answer — this file's calculateMarketValue() is. This means changing the
 * formula (like adding BDR points below) only ever requires editing this file
 * — never a DB migration or manual SQL.
 *
 * Formula:
 *   1. Sum weighted "effective wins" (ewRaw) from the player's own match_records
 *      (as player_id), based on result + opponent grade.
 *   2. Cap ewRaw at 14 to get ew.
 *   3. pp = ew * 3, winPct = ew / 14
 *   4. matchValue = pp * 5 + winPct * 85
 *   5. BDR swing — up to 36 extra points, scaled by the player's current
 *      bdr_points (capped at 120) — only applies once the player has a
 *      positive effective-win score (ewRaw > 0), i.e. they've actually won or
 *      drawn at least something.
 *   6. mvRaw = matchValue + bdrSwing
 *   7. Final value = max(50, round to nearest 5) — but ONLY if the player has
 *      ANY match involvement at all (as player_id or opponent_id). A player
 *      with zero involvement on either side stays at 0 (their fresh,
 *      never-played state).
 */
import { query } from "../db/pool.js"

const WIN_WEIGHT  = { S: 1.5,  "A+": 1.2,  A: 0.9,  B: 0.7,  C: 0.6  }
const DRAW_WEIGHT = { S: 0.75, "A+": 0.60, A: 0.45, B: 0.35, C: 0.30 }
const LOSS_WEIGHT = { S: -0.5, "A+": -0.6, A: -0.7, B: -0.8, C: -1.0 }

const BDR_CAP   = 120
const BDR_SWING = 36

function resultWeight(result, grade) {
  if (result === "win")  return WIN_WEIGHT[grade]  ?? 0
  if (result === "draw") return DRAW_WEIGHT[grade] ?? 0
  if (result === "loss") return LOSS_WEIGHT[grade] ?? 0
  return 0
}

// Computes the market value a player SHOULD have right now, based on their
// own match_records (as player_id) and their current bdr_points. Does not
// check whether the player has any match involvement at all — call
// recalcMarketValue() below for that, which handles the zero-involvement case.
export async function calculateMarketValue(playerId) {
  const [matchesRes, playerRes] = await Promise.all([
    query(
      "SELECT result, opponent_grade AS grade FROM match_records WHERE player_id = $1",
      [playerId]
    ),
    query("SELECT bdr_points AS bdr FROM players WHERE id = $1", [playerId]),
  ])

  let ewRaw = 0
  for (const m of matchesRes.rows) {
    ewRaw += resultWeight(m.result, m.grade)
  }

  const ew     = Math.min(ewRaw, 14)
  const pp     = ew * 3
  const winPct = Math.max(ew / 14, 0)
  const matchValue = pp * 5 + winPct * 85

  const bdrPoints = playerRes.rows[0]?.bdr ?? 0
  const bdrSwing  = ewRaw > 0 ? (Math.min(bdrPoints, BDR_CAP) / BDR_CAP) * BDR_SWING : 0

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