// services/leaguePlayoffLogic.js
// Winner determination + team advancement for league_knockout format playoffs
// (Qualifier 1 → Eliminator → Qualifier 2 → Final)

import { query } from "../db/pool.js"

// Advance winner to the next playoff round.
export async function advanceLeaguePlayoffWinner(match, winnerId) {
  const loserId = winnerId === match.team1_id ? match.team2_id : match.team1_id
  const season  = match.season_number

  if (match.match_type === "qualifier1") {
    await query("UPDATE team_league_playoffs SET team1_id = $1 WHERE season_number = $2 AND match_type = 'final'",      [winnerId, season])
    await query("UPDATE team_league_playoffs SET team1_id = $1 WHERE season_number = $2 AND match_type = 'qualifier2'", [loserId,  season])
  } else if (match.match_type === "eliminator") {
    await query("UPDATE team_league_playoffs SET team2_id = $1 WHERE season_number = $2 AND match_type = 'qualifier2'", [winnerId, season])
  } else if (match.match_type === "qualifier2") {
    await query("UPDATE team_league_playoffs SET team2_id = $1 WHERE season_number = $2 AND match_type = 'final'",      [winnerId, season])
  } else if (match.match_type === "final") {
    // Award trophies + BDR for league_knockout champion
    const { reconcileTeamTrophy } = await import("./teamTrophyAwards.js")
    const { reconcileTrophyRoster } = await import("./trophyAwards.js")
    const { claimAward, addBdr, addLeagueBdr, addTeamChampionshipPts } = await import("./bdrAwards.js")
    const { saveActiveCelebration } = await import("./tournamentHistoryService.js")
    const { updateSeasonRecord } = await import("./seasonRecord.js")

    await reconcileTeamTrophy({ tournament: "team_league", teamId: winnerId, seasonNumber: season })

    const champPlayersRes = await query("SELECT id, name FROM players WHERE team_id = $1", [winnerId])
    await reconcileTrophyRoster({
      sourceKey:    `league-knockout-final-s${season}`,
      trophyColumn: "trophy2_count",
      playerIds:    champPlayersRes.rows.map(p => p.id),
      seasonNumber: season,
    })
    const teamLogoRes = await query("SELECT name, logo_url FROM teams WHERE id = $1", [winnerId])
    const tl = teamLogoRes.rows[0]
    await saveActiveCelebration("dshann", {
      teamName: tl?.name,
      teamLogo: tl?.logo_url,
      players:  champPlayersRes.rows.map(p => p.name),
    })
    await updateSeasonRecord(season, {
      team_league_winner:  tl?.name ?? null,
      team_league_players: champPlayersRes.rows.map(p => p.name),
    })

    if (await claimAward("league_knockout_champion_bdr", season)) {
      const placements = [
        { teamId: winnerId, bdr: 12, pts: 12 },
        { teamId: loserId,  bdr: 9,  pts: 9  },
      ]
      for (const { teamId, bdr, pts } of placements) {
        const players = await query("SELECT id FROM players WHERE team_id = $1", [teamId])
        for (const p of players.rows) {
          await addBdr(p.id, bdr)
          await addLeagueBdr(p.id, bdr)
        }
        await addTeamChampionshipPts(teamId, pts)
      }
    }
  }
}