// services/playoffs.js
import { query } from "../db/pool.js"

// Generates the Team League playoff bracket (Qualifier 1 + Eliminator,
// with Qualifier 2 and Final starting empty) from the current top-4
// standings. Returns true if it actually generated something, false if
// playoffs already exist for this season or there aren't 4 teams yet.
// Shared between the manual admin endpoint and the automatic trigger that
// fires the instant the group stage finishes, so both stay identical.
export async function generatePlayoffs(season) {
  const existing = await query("SELECT id FROM team_league_playoffs WHERE season_number = $1 LIMIT 1", [season])
  if (existing.rows.length > 0) return false

  const standings = await query("SELECT id FROM teams ORDER BY score_points DESC LIMIT 4")
  if (standings.rows.length < 4) return false

  const [first, second, third, fourth] = standings.rows.map(r => r.id)

  await query(
    "INSERT INTO team_league_playoffs (season_number, match_type, team1_id, team2_id) VALUES ($1,'qualifier1',$2,$3)",
    [season, first, second]
  )
  await query(
    "INSERT INTO team_league_playoffs (season_number, match_type, team1_id, team2_id) VALUES ($1,'eliminator',$2,$3)",
    [season, third, fourth]
  )
  await query("INSERT INTO team_league_playoffs (season_number, match_type) VALUES ($1,'qualifier2')", [season])
  await query("INSERT INTO team_league_playoffs (season_number, match_type) VALUES ($1,'final')", [season])
  return true
}