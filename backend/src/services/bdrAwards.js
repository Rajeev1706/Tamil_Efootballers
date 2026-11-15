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
        id            SERIAL PRIMARY KEY,
        player_id     INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        amount        INT NOT NULL,
        label         TEXT NOT NULL,
        season_number INT,
        awarded_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    await query(`CREATE INDEX IF NOT EXISTS idx_bdr_breakdown_player ON player_bdr_breakdown(player_id)`)
    // Add season_number column if upgrading from older schema
    await query(`ALTER TABLE player_bdr_breakdown ADD COLUMN IF NOT EXISTS season_number INT`)
    // source_key: unique token that identifies the award source (e.g. weekly_bdr_26_15).
    // Allows upsert-accumulation so that all BDR earned within the same tournament
    // is stored as a SINGLE breakdown row rather than one row per round.
    await query(`ALTER TABLE player_bdr_breakdown ADD COLUMN IF NOT EXISTS source_key TEXT`)
    await query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_bdr_breakdown_source_key
      ON player_bdr_breakdown(source_key)
      WHERE source_key IS NOT NULL
    `)
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
// seasonNumber should be passed from the caller (read from app_settings 'current_season')
export async function addBdrWithLabel(playerId, delta, label, seasonNumber) {
  if (!playerId || !delta || !label) return
  await query(
    `UPDATE players SET bdr_points = GREATEST(0, bdr_points + $1) WHERE id = $2`,
    [delta, playerId]
  )
  if (delta > 0) {
    await query(
      `INSERT INTO player_bdr_breakdown (player_id, amount, label, season_number) VALUES ($1, $2, $3, $4)`,
      [playerId, delta, label, seasonNumber ?? null]
    )
  }
}

// Upsert-accumulate — used when multiple incremental awards belong to the same
// source (e.g. all BDR earned within one weekly tournament).  Instead of
// inserting a new row per round, a single row is kept per (player, sourceKey)
// and the amount field grows with each advancement.  Reversals (negative delta)
// are also handled so edit-safety is preserved.
//
// sourceKey must be a stable identifier such as "weekly_bdr_26_15"
// (tournament_id + player_id).  Rows with no source_key are unaffected.
export async function upsertBdrForSource(playerId, delta, label, seasonNumber, sourceKey) {
  if (!playerId || !delta || !label || !sourceKey) return
  // Always update the player's running total
  await query(
    `UPDATE players SET bdr_points = GREATEST(0, bdr_points + $1) WHERE id = $2`,
    [delta, playerId]
  )
  if (delta > 0) {
    // Add to existing row for this source, or create it
    await query(`
      INSERT INTO player_bdr_breakdown (player_id, amount, label, season_number, source_key)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (source_key) WHERE source_key IS NOT NULL
      DO UPDATE SET amount = GREATEST(0, player_bdr_breakdown.amount + $2)
    `, [playerId, delta, label, seasonNumber ?? null, sourceKey])
  } else {
    // Reversal: subtract from the existing row (clamp to 0)
    await query(`
      UPDATE player_bdr_breakdown
      SET amount = GREATEST(0, amount + $1)
      WHERE source_key = $2
    `, [delta, sourceKey])
  }
}