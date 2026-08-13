// services/teamTrophyAwards.js
//
// Correction-safe team trophy awarding — mirrors the player reconcileTrophyRoster
// pattern exactly. Called every time a competition final result is saved (or
// corrected), so fixing a wrong result automatically reverts the old winner
// and awards the correct one.
//
// team_trophies table: (team_id, season_number, tournament) UNIQUE
// Supported tournament values:
//   'team_league'  — Team League champion (all 3 formats)
//   'europa'       — Europa (TLG groups+knockout format, bottom-bracket winner)
//   'championship' — UCL / overall championship trophy
//
import { query } from "../db/pool.js"

export async function reconcileTeamTrophy({ tournament, teamId, seasonNumber }) {
  if (!tournament) throw new Error("reconcileTeamTrophy: tournament is required")

  // teamId=null means "no winner right now" (e.g. result was cleared)
  const desiredTeamId = teamId ?? null

  // What's currently recorded for this tournament+season?
  const existing = await query(
    "SELECT id, team_id FROM team_trophies WHERE tournament=$1 AND season_number=$2",
    [tournament, seasonNumber]
  )

  for (const row of existing.rows) {
    if (row.team_id !== desiredTeamId) {
      // This team was previously awarded but is no longer correct — remove it
      await query("DELETE FROM team_trophies WHERE id=$1", [row.id])
    }
  }

  const alreadyCorrect = existing.rows.some(r => r.team_id === desiredTeamId)

  if (desiredTeamId && !alreadyCorrect) {
    // Award the correct team
    await query(
      `INSERT INTO team_trophies (team_id, season_number, tournament)
       VALUES ($1,$2,$3)
       ON CONFLICT (team_id, season_number, tournament) DO NOTHING`,
      [desiredTeamId, seasonNumber, tournament]
    )
  }
}