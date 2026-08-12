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
 */
export async function updateSeasonRecord(season, fields) {
  try {
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
        // Append to existing array
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
          ballondor_winner
        ) VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [
        season,
        new Date().getFullYear(),
        fields.team_league_winner ?? null,
        fields.team_league_players ?? [],
        weekly,
        fields.ucl_winner ?? null,
        fields.ballondor_winner ?? null,
      ])
    }
  } catch (err) {
    // Non-fatal — season record is informational, never block result saving
    console.error("[seasonRecord] update failed:", err.message)
  }
}