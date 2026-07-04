import { query } from "../db/pool.js"

// Rebuilds a player's "Recent Form" (last 5 results) directly from
// match_records — across ALL match types (league, ucl, weekly), not just
// one. When the player was the opponent_id, the result is flipped
// (win -> loss, loss -> win) since match_records is stored from the
// player_id side.
//
// This is the single source of truth for the `players.form` column —
// every route that writes a match_records row (records.js, ucl.js,
// uclKnockout.js, weekly.js) should call this for both players involved
// right after saving/editing/deleting a result, the same way they call
// recalcMarketValue().
export async function recalcForm(playerId) {
  const res = await query(`
    SELECT
      CASE
        WHEN player_id = $1 THEN result
        WHEN result = 'win'  THEN 'loss'
        WHEN result = 'loss' THEN 'win'
        ELSE 'draw'
      END AS result
    FROM match_records
    WHERE player_id = $1 OR opponent_id = $1
    ORDER BY recorded_at DESC, id DESC
    LIMIT 5
  `, [playerId])
  const form = res.rows.map(r => r.result === "win" ? "W" : r.result === "draw" ? "D" : "L")
  await query("UPDATE players SET form = $1 WHERE id = $2", [form, playerId])
}