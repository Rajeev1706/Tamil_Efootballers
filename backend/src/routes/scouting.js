import { Router } from "express"
import { query } from "../db/pool.js"
import { authenticate } from "../middleware/auth.js"

const router = Router()

// GET /api/scouting/:myTeamId/:oppTeamId — full opponent scouting report
router.get("/:myTeamId/:oppTeamId", authenticate, async (req, res, next) => {
  try {
    const myTeamId  = parseInt(req.params.myTeamId)
    const oppTeamId = parseInt(req.params.oppTeamId)

    // ── 1. Team info ─────────────────────────────────────────────────────────
    const myTeamRes  = await query("SELECT * FROM teams WHERE id = $1", [myTeamId])
    const oppTeamRes = await query("SELECT * FROM teams WHERE id = $1", [oppTeamId])
    if (!oppTeamRes.rows[0]) return res.status(404).json({ error: "Team not found" })

    const oppTeam = oppTeamRes.rows[0]
    const myTeam  = myTeamRes.rows[0]

    // ── 2. All opponent players with stats (both sides of match_records) ──────
    // JOIN on player_id OR opponent_id so every match is counted regardless of
    // which side the player sat on when the result was logged.
    const oppPlayersRes = await query(`
      SELECT
        p.id, p.name, p.grade::text AS grade, p.market_value, p.form,
        p.image_url AS "imageUrl",
        p.avatar_id AS "avatarId", p.avatar_url AS "avatarUrl",
        COUNT(mr.id) AS total_matches,
        COUNT(mr.id) FILTER (WHERE
          (mr.player_id   = p.id AND mr.result = 'win') OR
          (mr.opponent_id = p.id AND mr.result = 'loss')
        ) AS wins,
        COUNT(mr.id) FILTER (WHERE mr.result = 'draw') AS draws,
        COUNT(mr.id) FILTER (WHERE
          (mr.player_id   = p.id AND mr.result = 'loss') OR
          (mr.opponent_id = p.id AND mr.result = 'win')
        ) AS losses,
        COALESCE(SUM(
          CASE
            WHEN mr.player_id   = p.id THEN COALESCE(mr.player_score,   0)
            WHEN mr.opponent_id = p.id THEN COALESCE(mr.opponent_score, 0)
            ELSE 0
          END
        ), 0) AS goals_scored,
        COALESCE(SUM(
          CASE
            WHEN mr.player_id   = p.id THEN COALESCE(mr.opponent_score, 0)
            WHEN mr.opponent_id = p.id THEN COALESCE(mr.player_score,   0)
            ELSE 0
          END
        ), 0) AS goals_conceded
      FROM players p
      LEFT JOIN match_records mr
        ON (mr.player_id = p.id OR mr.opponent_id = p.id)
      WHERE p.team_id = $1
      GROUP BY p.id
      ORDER BY p.market_value DESC
    `, [oppTeamId])

    // ── 3. All my players with stats (both sides of match_records) ────────────
    const myPlayersRes = await query(`
      SELECT
        p.id, p.name, p.grade::text AS grade, p.market_value, p.form,
        p.avatar_id AS "avatarId", p.avatar_url AS "avatarUrl",
        COUNT(mr.id) AS total_matches,
        COUNT(mr.id) FILTER (WHERE
          (mr.player_id   = p.id AND mr.result = 'win') OR
          (mr.opponent_id = p.id AND mr.result = 'loss')
        ) AS wins
      FROM players p
      LEFT JOIN match_records mr
        ON (mr.player_id = p.id OR mr.opponent_id = p.id)
      WHERE p.team_id = $1
      GROUP BY p.id
      ORDER BY p.market_value DESC
    `, [myTeamId])

    // ── 4. H2H matrix: my players vs their players ────────────────────────────
    const myIds  = myPlayersRes.rows.map(p => p.id)
    const oppIds = oppPlayersRes.rows.map(p => p.id)

    let h2hMatrix = []
    if (myIds.length > 0 && oppIds.length > 0) {
      const h2hRes = await query(`
        SELECT
          mr.player_id,
          mr.opponent_id,
          mr.result,
          mr.player_score,
          mr.opponent_score,
          mr.recorded_at
        FROM match_records mr
        WHERE (mr.player_id = ANY($1) AND mr.opponent_id = ANY($2))
           OR (mr.player_id = ANY($2) AND mr.opponent_id = ANY($1))
        ORDER BY mr.recorded_at DESC
      `, [myIds, oppIds])
      h2hMatrix = h2hRes.rows
    }

    // ── 5. Team vs Team fixture history ──────────────────────────────────────
    const teamH2hRes = await query(`
      SELECT f.round, f.home_score, f.away_score, f.scheduled_date AS date,
             ht.name AS home_team, at.name AS away_team,
             f.home_team_id, f.away_team_id
      FROM fixtures f
      JOIN teams ht ON f.home_team_id = ht.id
      JOIN teams at ON f.away_team_id = at.id
      WHERE ((f.home_team_id = $1 AND f.away_team_id = $2)
         OR  (f.home_team_id = $2 AND f.away_team_id = $1))
        AND f.status = 'completed'
      ORDER BY f.scheduled_date DESC, f.round DESC
      LIMIT 5
    `, [myTeamId, oppTeamId])

    // ── 6. Process opponent players: threat score + form ─────────────────────
    const GRADE_RANK = { S: 5, "A+": 4, A: 3, B: 2, C: 1 }

    const oppPlayers = oppPlayersRes.rows.map(p => {
      const total   = parseInt(p.total_matches) || 0
      const wins    = parseInt(p.wins)  || 0
      const winRate = total > 0 ? Math.round((wins / total) * 100) : 0

      const formArr = p.form || []
      let formScore = 0, formMax = 0
      formArr.slice(0, 5).forEach((f, i) => {
        const weight = 5 - i
        formMax  += weight
        formScore += (f === "W" ? 1 : f === "D" ? 0.5 : 0) * weight
      })
      const formPct = formMax > 0 ? Math.round((formScore / formMax) * 100) : 0

      const gradeScore  = ((GRADE_RANK[p.grade] || 1) / 5) * 100
      const threatScore = Math.round(winRate * 0.4 + formPct * 0.3 + gradeScore * 0.3)

      let streak = 0, streakType = null
      for (const f of formArr) {
        if (streakType === null) { streakType = f; streak = 1 }
        else if (f === streakType) streak++
        else break
      }

      return {
        ...p,
        totalMatches:  total,
        wins,
        draws:         parseInt(p.draws)  || 0,
        losses:        parseInt(p.losses) || 0,
        winRate,
        formPct,
        threatScore,
        threatLevel:   threatScore >= 70 ? "high" : threatScore >= 45 ? "medium" : "low",
        goalsScored:   parseInt(p.goals_scored)    || 0,
        goalsConceded: parseInt(p.goals_conceded)  || 0,
        goalsPerMatch: total > 0 ? (parseInt(p.goals_scored) / total).toFixed(1) : "0",
        streak:        streakType ? `${streak}${streakType}` : null,
      }
    })

    oppPlayers.sort((a, b) => b.threatScore - a.threatScore)

    // ── 7. Build H2H lookup: myPlayerId → oppPlayerId → { wins, losses, draws }
    const h2hLookup = {}
    for (const m of h2hMatrix) {
      const isMyPlayer = myIds.includes(m.player_id)
      const myPId  = isMyPlayer ? m.player_id  : m.opponent_id
      const oppPId = isMyPlayer ? m.opponent_id : m.player_id
      const result = isMyPlayer
        ? m.result
        : (m.result === "win" ? "loss" : m.result === "loss" ? "win" : "draw")

      if (!h2hLookup[myPId]) h2hLookup[myPId] = {}
      if (!h2hLookup[myPId][oppPId]) h2hLookup[myPId][oppPId] = { wins: 0, losses: 0, draws: 0 }

      if (result === "win")       h2hLookup[myPId][oppPId].wins++
      else if (result === "loss") h2hLookup[myPId][oppPId].losses++
      else                        h2hLookup[myPId][oppPId].draws++
    }

    // ── 8. Generate recommended matchups ──────────────────────────────────────
    const recommendations = []
    const usedMy  = new Set()
    const usedOpp = new Set()

    for (const opp of oppPlayers) {
      if (usedOpp.has(opp.id)) continue

      let bestMyPlayer = null, bestScore = -999

      for (const my of myPlayersRes.rows) {
        if (usedMy.has(my.id)) continue

        const h2h      = h2hLookup[my.id]?.[opp.id] || { wins: 0, losses: 0, draws: 0 }
        const totalH2h = h2h.wins + h2h.losses + h2h.draws

        let score = 0
        if (totalH2h > 0) score = ((h2h.wins - h2h.losses) / totalH2h) * 100
        score += ((GRADE_RANK[my.grade] || 1) - (GRADE_RANK[opp.grade] || 1)) * 10

        if (score > bestScore) { bestScore = score; bestMyPlayer = my }
      }

      if (bestMyPlayer) {
        const h2h = h2hLookup[bestMyPlayer.id]?.[opp.id] || { wins: 0, losses: 0, draws: 0 }
        recommendations.push({
          myPlayer:  { id: bestMyPlayer.id, name: bestMyPlayer.name, grade: bestMyPlayer.grade },
          oppPlayer: { id: opp.id, name: opp.name, grade: opp.grade, threatLevel: opp.threatLevel },
          h2h,
          reason: h2h.wins > h2h.losses               ? "Winning H2H record"
               : (h2h.wins === h2h.losses && (h2h.wins + h2h.losses) > 0) ? "Even H2H, grade advantage"
               : (GRADE_RANK[bestMyPlayer.grade] || 1) > (GRADE_RANK[opp.grade] || 1) ? "Grade advantage"
               : "Best available matchup",
        })
        usedMy.add(bestMyPlayer.id)
        usedOpp.add(opp.id)
      }
    }

    // ── 9. Generate warnings / tips ───────────────────────────────────────────
    const warnings = []

    for (const opp of oppPlayers) {
      if (opp.streak && opp.streak.startsWith("3") && opp.streak.endsWith("W"))
        warnings.push({ type: "danger", text: `${opp.name} is on a ${opp.streak.replace("W","")}+ match win streak` })
      else if (opp.streak && parseInt(opp.streak) >= 4 && opp.streak.endsWith("W"))
        warnings.push({ type: "danger", text: `${opp.name} is on a ${opp.streak.replace("W","")} match win streak — red hot form` })

      if (opp.streak && parseInt(opp.streak) >= 3 && opp.streak.endsWith("L"))
        warnings.push({ type: "opportunity", text: `${opp.name} has lost ${opp.streak.replace("L","")} in a row — exploit this` })

      if (opp.threatLevel === "high" && opp.winRate >= 65)
        warnings.push({ type: "danger", text: `${opp.name} has a ${opp.winRate}% win rate — their most dangerous player` })
    }

    const teamFixtures = teamH2hRes.rows
    if (teamFixtures.length >= 2) {
      let myWins = 0, oppWins = 0
      for (const f of teamFixtures) {
        const isHome  = f.home_team_id === myTeamId
        const myScore = isHome ? f.home_score : f.away_score
        const opScore = isHome ? f.away_score : f.home_score
        if (myScore > opScore) myWins++
        else if (opScore > myScore) oppWins++
      }
      if (myWins > oppWins)
        warnings.push({ type: "opportunity", text: `You've won ${myWins} of last ${teamFixtures.length} meetings against ${oppTeam.name}` })
      else if (oppWins > myWins)
        warnings.push({ type: "danger", text: `${oppTeam.name} has won ${oppWins} of last ${teamFixtures.length} meetings against you` })
    }

    // ── 10. Respond ───────────────────────────────────────────────────────────
    res.json({
      myTeam: { id: myTeam.id, name: myTeam.name, logoUrl: myTeam.logo_url },
      oppTeam: {
        id: oppTeam.id, name: oppTeam.name, logoUrl: oppTeam.logo_url,
        points: oppTeam.points || oppTeam.score_points || 0,
        gf: oppTeam.gf, ga: oppTeam.ga,
        wins: oppTeam.won || 0, draws: oppTeam.drawn || 0, losses: oppTeam.lost || 0,
      },
      oppPlayers,
      myPlayers: myPlayersRes.rows.map(p => ({
        ...p,
        totalMatches: parseInt(p.total_matches) || 0,
        wins:         parseInt(p.wins) || 0,
        winRate: parseInt(p.total_matches) > 0
          ? Math.round((parseInt(p.wins) / parseInt(p.total_matches)) * 100)
          : 0,
      })),
      h2hLookup,
      teamFixtures: teamH2hRes.rows.map(f => ({
        round:     f.round,
        date:      f.date,
        homeTeam:  f.home_team,
        awayTeam:  f.away_team,
        homeScore: f.home_score,
        awayScore: f.away_score,
        isHome:    f.home_team_id === myTeamId,
      })),
      recommendations,
      warnings,
    })
  } catch (err) { next(err) }
})

export default router