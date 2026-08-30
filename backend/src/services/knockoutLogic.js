// services/knockoutLogic.js
// Shared knockout winner determination + team advancement logic.
// Used by both teamKnockout.js (manual leg entry) and fixtures.js (auto on close).

import { query } from "../db/pool.js"
import { reconcileTeamTrophy } from "./teamTrophyAwards.js"
import { updateSeasonRecord } from "./seasonRecord.js"
import { claimAward, addBdr, addLeagueBdr, addTeamChampionshipPts } from "./bdrAwards.js"

// Determine winner of a two-leg tie using aggregate GD (actual goals).
// Returns team1_id or team2_id, or null if tied (needs manual decision).
export function determineKnockoutWinner(match) {
  const { team1_id, team2_id, team1_leg1, team1_leg2, team2_leg1, team2_leg2 } = match
  if (team1_leg1 === null || team1_leg2 === null) return null

  const t1Total = (team1_leg1 || 0) + (team1_leg2 || 0)
  const t2Total = (team2_leg1 || 0) + (team2_leg2 || 0)
  const t1GD    = t1Total - t2Total

  if (t1GD > 0) return team1_id
  if (t1GD < 0) return team2_id
  // GD tied → more total goals → still tied in 2-team format → manual pick
  if (t1Total > t2Total) return team1_id
  if (t2Total > t1Total) return team2_id
  return null
}

// Advance winner to the next round and loser to 3rd/7th place.
// Also awards trophies if it's a final match.
export async function advanceKnockoutWinner(match, winnerId) {
  const loserId = winnerId === match.team1_id ? match.team2_id : match.team1_id
  const isSF1   = match.match_type.endsWith("_sf1")

  const sfToFinalMap = {
    champions_sf1: "champions_final",
    champions_sf2: "champions_final",
    europa_sf1:    "europa_final",
    europa_sf2:    "europa_final",
  }
  const sfTo3rdMap = {
    champions_sf1: "champions_3rd",
    champions_sf2: "champions_3rd",
    europa_sf1:    "europa_7th",
    europa_sf2:    "europa_7th",
  }

  const finalType = sfToFinalMap[match.match_type]
  const thirdType = sfTo3rdMap[match.match_type]

  if (finalType) {
    const winnerCol = isSF1 ? "team1_id" : "team2_id"
    const loserCol  = isSF1 ? "team1_id" : "team2_id"

    await query(
      `UPDATE team_knockout_matches SET ${winnerCol} = $1 WHERE season_number = $2 AND match_type = $3`,
      [winnerId, match.season_number, finalType]
    )
    if (thirdType) {
      await query(
        `UPDATE team_knockout_matches SET ${loserCol} = $1 WHERE season_number = $2 AND match_type = $3`,
        [loserId, match.season_number, thirdType]
      )
    }
  }

  // Award trophies if this is a final
  const season = match.season_number
  const finalMatches = ["champions_final", "champions_3rd", "europa_final", "europa_7th"]
  if (!finalMatches.includes(match.match_type)) return

  if (match.match_type === "champions_final") {
    await reconcileTeamTrophy({ tournament: "team_league", teamId: winnerId, seasonNumber: season })
    const nameRes = await query("SELECT name FROM teams WHERE id = $1", [winnerId])
    await updateSeasonRecord(season, { team_league_winner: nameRes.rows[0]?.name ?? null })

    const thirdMatch = await query(
      "SELECT winner_id, team1_id, team2_id FROM team_knockout_matches WHERE season_number=$1 AND match_type='champions_3rd'",
      [season]
    )
    const third = thirdMatch.rows[0]
    if (third?.winner_id && await claimAward("team_knockout_champion_bdr", season)) {
      const thirdId  = third.winner_id
      const fourthId = third.winner_id === third.team1_id ? third.team2_id : third.team1_id
      const placements = [
        { teamId: winnerId, bdr: 12, flatPts: 12 },
        { teamId: loserId,  bdr: 9,  flatPts: 9  },
        { teamId: thirdId,  bdr: 7,  flatPts: 7  },
        { teamId: fourthId, bdr: 5,  flatPts: 5  },
      ]
      for (const { teamId, bdr, flatPts } of placements) {
        const players = await query("SELECT id FROM players WHERE team_id = $1", [teamId])
        for (const p of players.rows) {
          await addBdr(p.id, bdr)
          await addLeagueBdr(p.id, bdr) // track league BDR separately
        }
        await addTeamChampionshipPts(teamId, flatPts) // flat team pts (not × squad size)
      }
    }

  } else if (match.match_type === "champions_3rd") {
    const cf = (await query(
      "SELECT winner_id, team1_id, team2_id FROM team_knockout_matches WHERE season_number=$1 AND match_type='champions_final'",
      [season]
    )).rows[0]
    if (cf?.winner_id && await claimAward("team_knockout_champion_bdr", season)) {
      const champWinnerId = cf.winner_id
      const champLoserId  = cf.winner_id === cf.team1_id ? cf.team2_id : cf.team1_id
      const placements = [
        { teamId: champWinnerId, bdr: 12, flatPts: 12 },
        { teamId: champLoserId,  bdr: 9,  flatPts: 9  },
        { teamId: winnerId,      bdr: 7,  flatPts: 7  },
        { teamId: loserId,       bdr: 5,  flatPts: 5  },
      ]
      for (const { teamId, bdr, flatPts } of placements) {
        const players = await query("SELECT id FROM players WHERE team_id = $1", [teamId])
        for (const p of players.rows) {
          await addBdr(p.id, bdr)
          await addLeagueBdr(p.id, bdr)
        }
        await addTeamChampionshipPts(teamId, flatPts)
      }
    }

  } else if (match.match_type === "europa_final") {
    await reconcileTeamTrophy({ tournament: "europa", teamId: winnerId, seasonNumber: season })
    if (await claimAward("team_knockout_europa_bdr", season)) {
      const players = await query("SELECT id FROM players WHERE team_id = $1", [winnerId])
      for (const p of players.rows) {
        await addBdr(p.id, 4)
        await addLeagueBdr(p.id, 4)
      }
      await addTeamChampionshipPts(winnerId, 4) // flat +4 for europa winner
    }
  }
}