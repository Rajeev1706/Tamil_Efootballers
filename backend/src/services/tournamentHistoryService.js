import { query } from "../db/pool.js"

/**
 * Increment a player's tournament history counter by 1.
 * Uses upsert so it's safe to call multiple times (idempotent per tournament entry
 * is handled at the call site by only calling once per event).
 *
 * @param {number}  playerId        - players.id
 * @param {string}  tournamentType  - 'weekly' | 'revolution' | 'ucl' | 'duo'
 * @param {string}  category        - 'knockout' | 'group'
 * @param {string}  key             - round label or position string
 *                                    knockout: 'winner'|'final'|'sf'|'qf'|'r16'|'r32'|'r64'
 *                                    group:    '1'|'2'|'3'|...'8'
 */
export async function incrementHistory(playerId, tournamentType, category, key) {
  await query(`
    INSERT INTO player_tournament_history (player_id, tournament_type, category, key, count)
    VALUES ($1, $2, $3, $4, 1)
    ON CONFLICT (player_id, tournament_type, category, key)
    DO UPDATE SET count = player_tournament_history.count + 1
  `, [playerId, tournamentType, category, String(key)])
}

/**
 * Convert a numeric round number to a round label.
 * Used for Weekly, Revolution and UCL KO (all use integer round numbers).
 */
export function roundLabel(round, totalRounds) {
  const diff = totalRounds - round
  if (diff === 0) return "final"
  if (diff === 1) return "sf"
  if (diff === 2) return "qf"
  if (diff === 3) return "r16"
  if (diff === 4) return "r32"
  return "r64"
}

/**
 * Build the structured response object from raw player_tournament_history rows.
 */
export function buildHistoryResponse(rows) {
  const result = {
    weekly:     { winner: 0, final: 0, sf: 0, qf: 0, r16: 0, r32: 0, r64: 0 },
    revolution: { winner: 0, final: 0, sf: 0, qf: 0, r16: 0, r32: 0, r64: 0 },
    ucl: {
      group:    { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 },
      knockout: { winner: 0, final: 0, sf: 0, qf: 0, r16: 0, r32: 0, r64: 0 },
    },
    duo: {
      group:    { 1: 0, 2: 0, 3: 0, 4: 0 },
      knockout: { winner: 0, final: 0, sf: 0, qf: 0, r16: 0 },
    },
  }

  for (const row of rows) {
    const { tournament_type: tt, category, key, count } = row
    if (category === "knockout") {
      if (result[tt]?.knockout !== undefined) {
        result[tt].knockout[key] = (result[tt].knockout[key] || 0) + count
      } else if (result[tt]) {
        result[tt][key] = (result[tt][key] || 0) + count
      }
    } else if (category === "group") {
      const pos = parseInt(key)
      if (result[tt]?.group?.[pos] !== undefined) {
        result[tt].group[pos] = (result[tt].group[pos] || 0) + count
      }
    }
  }

  return result
}

/**
 * Save celebration data per tournament type.
 * Stored permanently — always downloadable as the latest card for that tournament.
 * key: celebration_<type>_data  e.g. celebration_weekly_data
 */
export async function saveActiveCelebration(type, data) {
  try {
    await query(
      "INSERT INTO app_settings (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2",
      [`celebration_${type}_data`, JSON.stringify({ ...data, triggeredAt: new Date().toISOString() })]
    )
  } catch (e) { console.error("[celebration] save error:", e.message) }
}