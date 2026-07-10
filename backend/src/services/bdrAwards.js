// services/bdrAwards.js
import { query } from "../db/pool.js"

// Attempts to claim a one-time award slot for a specific season/tournament/
// group. Returns true the FIRST time this is called for that exact
// (awardType, referenceId) pair — caller should then actually hand out the
// BDR. Returns false every time after — caller does nothing, since it's
// already been paid out. Uses a UNIQUE constraint + ON CONFLICT so this is
// safe even if called concurrently.
export async function claimAward(awardType, referenceId) {
  const result = await query(
    `INSERT INTO bdr_awards_log (award_type, reference_id) VALUES ($1, $2)
     ON CONFLICT (award_type, reference_id) DO NOTHING
     RETURNING id`,
    [awardType, referenceId]
  )
  return result.rows.length > 0
}

// Adds (or subtracts) BDR points for a single player, floored at 0.
export async function addBdr(playerId, delta) {
  if (!playerId || !delta) return
  await query(
    `UPDATE players SET bdr_points = GREATEST(0, bdr_points + $1) WHERE id = $2`,
    [delta, playerId]
  )
}