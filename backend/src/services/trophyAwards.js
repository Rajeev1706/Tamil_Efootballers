// services/trophyAwards.js
//
// Correction-safe trophy awarding. Unlike bdrAwards.js's claimAward() (which
// fires once and never again — so it can't fix a wrong result after the
// fact), this is designed to be called EVERY time a competition completes,
// including when an admin corrects an earlier result. It always converges
// to the currently-correct set of holders for a given event:
//
//   - First call for a sourceKey       -> awards everyone in playerIds
//   - Same set called again            -> no-op, already correct
//   - Different set (partial or total) -> reverts whoever should no longer
//                                          hold it, awards whoever newly
//                                          should, leaves unchanged anyone
//                                          correct on both sides
//
// A single "winner" (UCL/Weekly champion or golden boot) is just a roster
// of size one — pass playerIds: [winnerId] (or [] for "no valid winner").
// A team trophy (Team League) passes the whole winning roster's player IDs.
//
// sourceKey must uniquely identify the real-world event (e.g.
// "ucl_champion_tournament_5"), NOT the trophy type alone — that's what
// makes one specific Final/season/tournament individually correctable
// without touching any other award.
import { query } from "../db/pool.js"
import { recalcMarketValue } from "./marketValue.js"

const VALID_TROPHY_COLUMNS = new Set([
  "trophy2_count", // Team League
  "trophy3_count", // Weekly
  "trophy4_count", // UCL
  "trophy5_count", // Weekly Golden Boot
  "trophy6_count", // Team League Golden Boot
  "trophy7_count", // UCL Golden Boot
])

function assertValidColumn(col) {
  if (!VALID_TROPHY_COLUMNS.has(col)) {
    throw new Error(`trophyAwards: invalid trophy column "${col}"`)
  }
}

export async function reconcileTrophyRoster({ sourceKey, trophyColumn, playerIds, seasonNumber }) {
  assertValidColumn(trophyColumn)
  const correctSet  = new Set((playerIds || []).filter(Boolean))

  const existing = await query(
    "SELECT player_id FROM player_trophies WHERE source_key = $1",
    [sourceKey]
  )
  const previousSet = new Set(existing.rows.map(r => r.player_id))

  // Revert anyone who WAS awarded for this event but is no longer correct
  for (const playerId of previousSet) {
    if (!correctSet.has(playerId)) {
      await query(
        `UPDATE players SET ${trophyColumn} = GREATEST(0, ${trophyColumn} - 1) WHERE id = $1`,
        [playerId]
      )
      await recalcMarketValue(playerId)
      await query(
        "DELETE FROM player_trophies WHERE source_key = $1 AND player_id = $2",
        [sourceKey, playerId]
      )
    }
  }

  // Award anyone who's correct now but wasn't before
  for (const playerId of correctSet) {
    if (!previousSet.has(playerId)) {
      await query(
        `UPDATE players SET ${trophyColumn} = ${trophyColumn} + 1 WHERE id = $1`,
        [playerId]
      )
      await recalcMarketValue(playerId)
      await query(
        `INSERT INTO player_trophies (player_id, trophy_column, season_number, source_key)
         VALUES ($1, $2, $3, $4)`,
        [playerId, trophyColumn, seasonNumber, sourceKey]
      )
    }
  }
  // Anyone in BOTH sets is already correctly awarded — no-op, satisfies idempotency.
}

// Convenience wrapper for the common single-winner case (UCL/Weekly champion
// or golden boot) — pass playerId=null to mean "no valid winner right now".
export async function awardOrReassignTrophy({ sourceKey, trophyColumn, playerId, seasonNumber }) {
  await reconcileTrophyRoster({
    sourceKey,
    trophyColumn,
    playerIds: playerId ? [playerId] : [],
    seasonNumber,
  })
}