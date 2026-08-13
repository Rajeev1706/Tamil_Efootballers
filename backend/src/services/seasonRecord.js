/**
 * seasonRecord.js — shared helper to progressively build the season record.
 *
 * Each tournament calls updateSeasonRecord() with only its own fields when
 * it completes. The record accumulates automatically:
 *   - Team League  → team_league_winner, team_league_players
 *   - Weekly       → weekly_winners (appended each Final)
 *   - UCL Final    → ucl_winner, ballondor_winner (top BDR player)
 *
 * Admin only needs to add season_name and notes manually.
 */
import { query } from "../db/pool.js"

/**
 * updateSeasonRecord(season, fields)
 * fields can include any subset of:
 *   team_league_winner   — string (team name)
 *   team_league_players  — string[] (player names)
 *   weekly_winner        — string (one weekly winner to APPEND to the array)
 *   ucl_winner           — string (player name)
 *   ballondor_winner     — string (player name)
 *   duo_winner           — string (duo pair label, e.g. "Sidhu & Sathyan")
 *   championship_winner  — string (team name — UCL winner's team)
 */
export async function updateSeasonRecord(season, fields) {
  try {
    // Ensure new columns exist (safe to call repeatedly — ADD COLUMN IF NOT EXISTS is idempotent)
    await query(`ALTER TABLE season_records ADD COLUMN IF NOT EXISTS duo_winner          TEXT`).catch(() => {})
    await query(`ALTER TABLE season_records ADD COLUMN IF NOT EXISTS championship_winner TEXT`).catch(() => {})

    const existing = await query(
      "SELECT id, weekly_winners FROM season_records WHERE season_number = $1 ORDER BY id DESC LIMIT 1",
      [season]
    )

    if (existing.rows[0]) {
      const id = existing.rows[0].id
      const sets = []
      const vals = []
      let i = 1

      if (fields.team_league_winner !== undefined) {
        sets.push(`team_league_winner = $${i++}`); vals.push(fields.team_league_winner)
      }
      if (fields.team_league_players !== undefined) {
        sets.push(`team_league_players = $${i++}`); vals.push(fields.team_league_players)
      }
      if (fields.weekly_winner !== undefined) {
        const existing_winners = existing.rows[0].weekly_winners || []
        const updated = [...existing_winners, fields.weekly_winner]
        sets.push(`weekly_winners = $${i++}`); vals.push(updated)
      }
      if (fields.ucl_winner !== undefined) {
        sets.push(`ucl_winner = $${i++}`); vals.push(fields.ucl_winner)
      }
      if (fields.ballondor_winner !== undefined) {
        sets.push(`ballondor_winner = $${i++}`); vals.push(fields.ballondor_winner)
      }
      if (fields.duo_winner !== undefined) {
        sets.push(`duo_winner = $${i++}`); vals.push(fields.duo_winner)
      }
      if (fields.championship_winner !== undefined) {
        sets.push(`championship_winner = $${i++}`); vals.push(fields.championship_winner)
      }

      if (sets.length > 0) {
        vals.push(id)
        await query(
          `UPDATE season_records SET ${sets.join(", ")} WHERE id = $${i}`,
          vals
        )
      }
    } else {
      // Create new record with whatever fields we have
      const weekly = fields.weekly_winner ? [fields.weekly_winner] : []
      await query(`
        INSERT INTO season_records (
          season_number, year,
          team_league_winner, team_league_players,
          weekly_winners,
          ucl_winner,
          ballondor_winner,
          duo_winner,
          championship_winner
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `, [
        season,
        new Date().getFullYear(),
        fields.team_league_winner    ?? null,
        fields.team_league_players   ?? [],
        weekly,
        fields.ucl_winner            ?? null,
        fields.ballondor_winner      ?? null,
        fields.duo_winner            ?? null,
        fields.championship_winner   ?? null,
      ])
    }
  } catch (err) {
    console.error("[seasonRecord] update failed:", err.message)
  }
}