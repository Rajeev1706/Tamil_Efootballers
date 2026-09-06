// services/bdrAwards.js
import { query } from "../db/pool.js"

// Auto-create tables
;(async () => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS bdr_awards_log (
        id           SERIAL PRIMARY KEY,
        award_type   TEXT NOT NULL,
        reference_id INT  NOT NULL,
        awarded_at   TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(award_type, reference_id)
      )
    `)
  } catch (e) { console.error("[bdrAwards] migration:", e.message) }

  try {
    await query(`
      CREATE TABLE IF NOT EXISTS player_bdr_breakdown (
        id          SERIAL PRIMARY KEY,
        player_id   INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        amount      INT NOT NULL,
        label       TEXT NOT NULL,
        awarded_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    await query(`CREATE INDEX IF NOT EXISTS idx_bdr_breakdown_player ON player_bdr_breakdown(player_id)`)
  } catch (e) { console.error("[bdrAwards] breakdown migration:", e.message) }
})()

export async function claimAward(awardType, referenceId) {
  const result = await query(
    `INSERT INTO bdr_awards_log (award_type, reference_id) VALUES ($1, $2)
     ON CONFLICT (award_type, reference_id) DO NOTHING
     RETURNING id`,
    [awardType, referenceId]
  )
  return result.rows.length > 0
}

export async function addLeagueBdr(playerId, amount) {
  if (!playerId || !amount) return
  await query("UPDATE players SET league_bdr = league_bdr + $1 WHERE id = $2", [amount, playerId])
}

export async function addTeamChampionshipPts(teamId, pts) {
  if (!teamId || !pts) return
  await query("UPDATE teams SET championship_pts = championship_pts + $1 WHERE id = $2", [pts, teamId])
}

// Plain add — used for corrections/reversals (not logged to breakdown)
export async function addBdr(playerId, delta) {
  if (!playerId || !delta) return
  await query(
    `UPDATE players SET bdr_points = GREATEST(0, bdr_points + $1) WHERE id = $2`,
    [delta, playerId]
  )
}

// Labeled add — used for first-time awards (logged to breakdown for display)
export async function addBdrWithLabel(playerId, delta, label) {
  if (!playerId || !delta || !label) return
  await query(
    `UPDATE players SET bdr_points = GREATEST(0, bdr_points + $1) WHERE id = $2`,
    [delta, playerId]
  )
  if (delta > 0) {
    await query(
      `INSERT INTO player_bdr_breakdown (player_id, amount, label) VALUES ($1, $2, $3)`,
      [playerId, delta, label]
    )
  }
}