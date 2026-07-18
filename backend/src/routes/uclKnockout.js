import { Router } from "express"
import { z } from "zod"
import { query } from "../db/pool.js"
import { authenticate, adminOnly } from "../middleware/auth.js"
import { recalcMarketValue } from "../services/marketValue.js"
import { recalcForm } from "../services/form.js"
import { claimAward, addBdr } from "../services/bdrAwards.js"

const router = Router()
const TOTAL_ROUNDS = 5   // R32 → R16 → QF → SF → Final
const BRACKET_SIZE = 32  // fixed

// GET /api/ucl-knockout/public/current — latest non-setup tournament, for
// the public dashboard's champion celebration (mirrors weekly's equivalent).
router.get("/public/current", async (req, res, next) => {
  try {
    const t = await query(
      "SELECT * FROM ucl_knockout_tournaments WHERE status != 'setup' ORDER BY created_at DESC LIMIT 1"
    )
    if (!t.rows[0]) return res.json(null)

    const matches = await query(`
      SELECT
        km.round, km.match_number AS "matchNumber", km.status,
        km.player1_id AS "player1Id", km.player2_id AS "player2Id", km.winner_id AS "winnerId",
        p1.name AS "player1Name", p1.avatar_id AS "player1AvatarId", p1.avatar_url AS "player1AvatarUrl", p1.avatar_bg_url AS "player1AvatarBgUrl",
        p2.name AS "player2Name", p2.avatar_id AS "player2AvatarId", p2.avatar_url AS "player2AvatarUrl", p2.avatar_bg_url AS "player2AvatarBgUrl"
      FROM ucl_knockout_matches km
      LEFT JOIN players p1 ON km.player1_id = p1.id
      LEFT JOIN players p2 ON km.player2_id = p2.id
      WHERE km.tournament_id = $1
      ORDER BY km.round ASC, km.match_number ASC
    `, [t.rows[0].id])

    res.json({ ...t.rows[0], totalRounds: TOTAL_ROUNDS, matches: matches.rows })
  } catch (err) { next(err) }
})

// Helper: get top 4 from each active UCL group by standings
async function getGroupStandings() {
  const result = await query(`
    SELECT
      p.id, p.name, p.ucl_group_id AS "groupId",
      g.name AS "groupName",
      COALESCE(SUM(CASE
        WHEN (mr.player_id = p.id AND mr.result = 'win') OR (mr.opponent_id = p.id AND mr.result = 'loss') THEN 3
        WHEN mr.result = 'draw' THEN 1
        ELSE 0 END), 0) AS points,
      COALESCE(SUM(CASE WHEN mr.player_id = p.id THEN COALESCE(mr.player_score,0) ELSE COALESCE(mr.opponent_score,0) END)
        - SUM(CASE WHEN mr.player_id = p.id THEN COALESCE(mr.opponent_score,0) ELSE COALESCE(mr.player_score,0) END), 0) AS gd,
      COALESCE(SUM(CASE WHEN mr.player_id = p.id THEN COALESCE(mr.player_score,0) ELSE COALESCE(mr.opponent_score,0) END), 0) AS gf
    FROM players p
    JOIN ucl_groups g ON p.ucl_group_id = g.id AND g.status = 'active'
    LEFT JOIN match_records mr
      ON (mr.player_id = p.id OR mr.opponent_id = p.id) AND mr.match_type = 'ucl'
    GROUP BY p.id, p.name, p.ucl_group_id, g.name
    ORDER BY g.name ASC, points DESC, gd DESC, gf DESC
  `)

  // Group by groupId, take top 4
  const byGroup = {}
  for (const row of result.rows) {
    if (!byGroup[row.groupId]) byGroup[row.groupId] = []
    if (byGroup[row.groupId].length < 4) {
      byGroup[row.groupId].push(row)
    }
  }
  return Object.values(byGroup) // array of groups, each with up to 4 players
}

// Helper: shuffle array
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Helper: check no adjacent pair is from the same group
function hasNoSameGroupPairs(players) {
  for (let i = 0; i < players.length - 1; i += 2) {
    if (players[i].groupId === players[i + 1].groupId) return false
  }
  return true
}

// Helper: random draw — guaranteed no same-group R32 matchup
// Seeded Round of 32 pairing: within the qualifiers, group-1st-place
// finishers face group-4th-place finishers, and 2nd-place finishers face
// 3rd-place finishers — but always against a player from a DIFFERENT
// group, never their own group's 4th (or 3rd) place finisher.
// `groups` is an array of groups, each already ranked [1st, 2nd, 3rd, 4th]
// by getGroupStandings().
function generateSeededMatches(groups) {
  // Only groups with a full 4 qualifiers participate in seeded pairing —
  // a group short on registered players can't cleanly fill all four pots.
  const fullGroups = groups.filter(g => g.length === 4)

  const pot1 = fullGroups.map(g => g[0]) // every group's 1st place
  const pot2 = fullGroups.map(g => g[1]) // every group's 2nd place
  const pot3 = fullGroups.map(g => g[2]) // every group's 3rd place
  const pot4 = fullGroups.map(g => g[3]) // every group's 4th place

  // Randomly pairs potA[i] with a shuffled potB, fixing any pairing where
  // both players share a group by swapping within potB — same technique
  // as the existing same-group-avoidance logic, just applied per-pot.
  function pairPots(potA, potB) {
    let shuffledB = shuffle(potB)
    const MAX_PASSES = 100
    for (let pass = 0; pass < MAX_PASSES; pass++) {
      let hasConflict = false
      for (let i = 0; i < potA.length; i++) {
        if (potA[i].groupId === shuffledB[i].groupId) {
          hasConflict = true
          for (let j = 0; j < shuffledB.length; j++) {
            if (j === i) continue
            const swapSafe =
              shuffledB[j].groupId !== potA[i].groupId &&
              potA[j].groupId !== shuffledB[i].groupId
            if (swapSafe) {
              ;[shuffledB[i], shuffledB[j]] = [shuffledB[j], shuffledB[i]]
              break
            }
          }
        }
      }
      if (!hasConflict) break
    }
    return potA.map((p, i) => ({ p1Id: p.id, p2Id: shuffledB[i].id }))
  }

  const pairs1v4 = pairPots(pot1, pot4)
  const pairs2v3 = pairPots(pot2, pot3)

  // Randomize which bracket slot each pairing lands in, so 1-vs-4 and
  // 2-vs-3 matches are mixed throughout the draw rather than grouped.
  const allPairs = shuffle([...pairs1v4, ...pairs2v3])

  return allPairs.map((pair, i) => ({ matchNumber: i + 1, p1Id: pair.p1Id, p2Id: pair.p2Id }))
}


// GET /api/ucl-knockout — list all tournaments
router.get("/", authenticate, adminOnly, async (req, res, next) => {
  try {
    const result = await query("SELECT * FROM ucl_knockout_tournaments ORDER BY created_at DESC")
    res.json(result.rows)
  } catch (err) { next(err) }
})

// GET /api/ucl-knockout/:id — tournament detail
router.get("/:id", async (req, res, next) => {
  try {
    const t = await query("SELECT * FROM ucl_knockout_tournaments WHERE id = $1", [req.params.id])
    if (!t.rows[0]) return res.status(404).json({ error: "Tournament not found" })

    const players = await query(`
      SELECT kp.seed, kp.group_position AS "groupPosition",
             p.id, p.name, g.name AS "groupName"
      FROM ucl_knockout_players kp
      JOIN players p ON p.id = kp.player_id
      LEFT JOIN ucl_groups g ON kp.group_id = g.id
      WHERE kp.tournament_id = $1
      ORDER BY kp.seed ASC
    `, [req.params.id])

    const matches = await query(`
      SELECT
        km.*,
        p1.name AS "player1Name", p1.avatar_id AS "player1AvatarId", p1.avatar_url AS "player1AvatarUrl", p1.avatar_bg_url AS "player1AvatarBgUrl", p1g.name AS "player1Group",
        p2.name AS "player2Name", p2.avatar_id AS "player2AvatarId", p2.avatar_url AS "player2AvatarUrl", p2.avatar_bg_url AS "player2AvatarBgUrl", p2g.name AS "player2Group",
        w.name  AS "winnerName"
      FROM ucl_knockout_matches km
      LEFT JOIN players p1 ON km.player1_id = p1.id
      LEFT JOIN players p2 ON km.player2_id = p2.id
      LEFT JOIN players w  ON km.winner_id  = w.id
      LEFT JOIN ucl_knockout_players kp1 ON kp1.tournament_id = km.tournament_id AND kp1.player_id = km.player1_id
      LEFT JOIN ucl_knockout_players kp2 ON kp2.tournament_id = km.tournament_id AND kp2.player_id = km.player2_id
      LEFT JOIN ucl_groups p1g ON kp1.group_id = p1g.id
      LEFT JOIN ucl_groups p2g ON kp2.group_id = p2g.id
      WHERE km.tournament_id = $1
      ORDER BY km.round ASC, km.match_number ASC
    `, [req.params.id])

    res.json({ ...t.rows[0], players: players.rows, matches: matches.rows })
  } catch (err) { next(err) }
})

// POST /api/ucl-knockout — create tournament from UCL group standings
router.post("/", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { name } = z.object({ name: z.string().min(1) }).parse(req.body)

    const groups = await getGroupStandings()
    if (groups.length < 2) return res.status(400).json({ error: "Not enough UCL groups with players" })

    // Flatten all players across groups
    const allPlayers = groups.flat()
    if (allPlayers.length < 2) return res.status(400).json({ error: "Not enough players in UCL groups" })

    // Create tournament
    const tRes = await query(
      "INSERT INTO ucl_knockout_tournaments (name, status) VALUES ($1, 'draw') RETURNING *",
      [name]
    )
    const tournamentId = tRes.rows[0].id

    // Insert players with seeds
    let seed = 1
    for (const group of groups) {
      for (let pos = 0; pos < group.length; pos++) {
        const player = group[pos]
        await query(
          "INSERT INTO ucl_knockout_players (tournament_id, player_id, seed, group_id, group_position) VALUES ($1,$2,$3,$4,$5)",
          [tournamentId, player.id, seed++, player.groupId, pos + 1]
        )
      }
    }

    // Generate random R32 matches (no same-group pairs)
    const r32Matches = generateSeededMatches(groups)

    // Insert R32 matches
    for (const m of r32Matches) {
      await query(
        "INSERT INTO ucl_knockout_matches (tournament_id, round, match_number, player1_id, player2_id, status) VALUES ($1,1,$2,$3,$4,'pending')",
        [tournamentId, m.matchNumber, m.p1Id, m.p2Id]
      )
    }

    // Insert empty future round slots
    const slotsPerRound = [8, 4, 2, 1] // R16, QF, SF, Final
    for (let r = 0; r < slotsPerRound.length; r++) {
      for (let m = 1; m <= slotsPerRound[r]; m++) {
        await query(
          "INSERT INTO ucl_knockout_matches (tournament_id, round, match_number, status) VALUES ($1,$2,$3,'pending')",
          [tournamentId, r + 2, m]
        )
      }
    }

    res.status(201).json(tRes.rows[0])
  } catch (err) { next(err) }
})

// POST /api/ucl-knockout/:id/start — mark as active
router.post("/:id/start", authenticate, adminOnly, async (req, res, next) => {
  try {
    await query("UPDATE ucl_knockout_tournaments SET status = 'active' WHERE id = $1", [req.params.id])
    res.json({ started: true })
  } catch (err) { next(err) }
})

// PATCH /api/ucl-knockout/matches/:matchId/result — save result + advance winner
router.patch("/matches/:matchId/result", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { player1Score, player2Score, tieWinnerId } = z.object({
      player1Score: z.number().int().min(0),
      player2Score: z.number().int().min(0),
      tieWinnerId:  z.number().int().positive().optional(),
    }).parse(req.body)

    const matchRes = await query(
      "SELECT km.*, kt.total_rounds FROM ucl_knockout_matches km JOIN ucl_knockout_tournaments kt ON kt.id = km.tournament_id WHERE km.id = $1",
      [req.params.matchId]
    )
    const match = matchRes.rows[0]
    if (!match) return res.status(404).json({ error: "Match not found" })
    if (!match.player1_id || !match.player2_id) return res.status(400).json({ error: "Both players required" })

    const winnerId = player1Score > player2Score ? match.player1_id
                   : player2Score > player1Score ? match.player2_id
                   : (tieWinnerId || match.player1_id)

    // Result for match_records/player-profile must reflect who actually
    // advanced (winnerId), not just the raw score — otherwise a tie broken
    // in one player's favor still logs as a "draw" on both profiles.
    const result = winnerId === match.player1_id ? "win" : "loss"

    const oldMatchRecordId = match.match_record_id

    const seasonRes = await query("SELECT value FROM app_settings WHERE key = 'current_season'")
    const season = parseInt(seasonRes.rows[0]?.value || "6")
    const oppGradeRes = await query("SELECT grade FROM players WHERE id = $1", [match.player2_id])
    const oppGrade = oppGradeRes.rows[0]?.grade || "C"

    const mrRes = await query(`
      INSERT INTO match_records
        (player_id, opponent_id, result, opponent_grade, match_type, player_score, opponent_score, recorded_at, season_number)
      VALUES ($1,$2,$3,$4,'ucl',$5,$6,NOW(),$7)
      RETURNING id
    `, [match.player1_id, match.player2_id, result, oppGrade, player1Score, player2Score, season])

    // Re-point the match at the new record BEFORE deleting the old one —
    // deleting first would violate the match_record_id foreign key while
    // ucl_knockout_matches still referenced that row.
    await query(`
      UPDATE ucl_knockout_matches
      SET player1_score=$1, player2_score=$2, winner_id=$3, status='completed', match_record_id=$4
      WHERE id=$5
    `, [player1Score, player2Score, winnerId, mrRes.rows[0].id, req.params.matchId])

    // Now safe to delete the old match record, if this was an edit
    if (oldMatchRecordId) {
      await query("DELETE FROM match_records WHERE id = $1", [oldMatchRecordId])
    }

    // Recalc market value for both players — the DB trigger alone only
    // handles the player_id side and skips the BDR swing (see marketValue.js).
    await recalcMarketValue(match.player1_id)
    await recalcMarketValue(match.player2_id)
    await recalcForm(match.player1_id)
    await recalcForm(match.player2_id)

    // Advance winner to next round
    if (winnerId && match.round < TOTAL_ROUNDS) {
      const nextRound = match.round + 1
      const nextMatchNum = Math.ceil(match.match_number / 2)
      const col = match.match_number % 2 !== 0 ? "player1_id" : "player2_id"
      await query(
        `UPDATE ucl_knockout_matches SET ${col} = $1 WHERE tournament_id = $2 AND round = $3 AND match_number = $4`,
        [winnerId, match.tournament_id, nextRound, nextMatchNum]
      )
    }

    // Check if completed
    const remaining = await query(`
      SELECT COUNT(*) FROM ucl_knockout_matches
      WHERE tournament_id=$1 AND status='pending' AND player1_id IS NOT NULL AND player2_id IS NOT NULL
    `, [match.tournament_id])
    if (parseInt(remaining.rows[0].count) === 0) {
      await query("UPDATE ucl_knockout_tournaments SET status='completed' WHERE id=$1", [match.tournament_id])

      // BDR awards — winner/runner-up/semi-finalist/quarter-finalist, plus
      // this specific knockout run's golden boot. Fixed round structure
      // (R32→R16→QF→SF→Final = rounds 1-5), so QF=3, SF=4, Final=5 always.
      // Only ever fires once per tournament (claimAward guards it).
      if (await claimAward("ucl_knockout", match.tournament_id)) {
        const allMatches = await query(`
          SELECT round, player1_id, player2_id, winner_id
          FROM ucl_knockout_matches
          WHERE tournament_id = $1 AND status = 'completed'
        `, [match.tournament_id])

        for (const m of allMatches.rows) {
          const loserId = m.winner_id === m.player1_id ? m.player2_id : m.player1_id
          if (m.round === 5) {
            if (m.winner_id) await addBdr(m.winner_id, 15)
            if (loserId)      await addBdr(loserId, 12)
          } else if (m.round === 4 && loserId) {
            await addBdr(loserId, 8)
          } else if (m.round === 3 && loserId) {
            await addBdr(loserId, 4)
          }
        }

        const goldenBootRes = await query(`
          SELECT p.id,
            COALESCE(SUM(CASE WHEN mr.player_id=p.id THEN mr.player_score WHEN mr.opponent_id=p.id THEN mr.opponent_score ELSE 0 END),0) AS goals,
            COALESCE(SUM(CASE WHEN mr.player_id=p.id THEN mr.opponent_score WHEN mr.opponent_id=p.id THEN mr.player_score ELSE 0 END),0) AS conceded
          FROM players p
          JOIN match_records mr ON (mr.player_id=p.id OR mr.opponent_id=p.id) AND mr.match_type='ucl'
          JOIN ucl_knockout_matches km ON km.match_record_id = mr.id
          WHERE km.tournament_id = $1
          GROUP BY p.id
          ORDER BY goals DESC, conceded ASC
          LIMIT 1
        `, [match.tournament_id])
        if (goldenBootRes.rows[0]?.goals > 0) await addBdr(goldenBootRes.rows[0].id, 6)
      }
    }

    res.json({ updated: true, winnerId })
  } catch (err) { next(err) }
})

// PATCH /api/ucl-knockout/matches/:matchId/players — edit players in a match
router.patch("/matches/:matchId/players", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { player1Id, player2Id } = z.object({
      player1Id: z.number().int().positive().nullable().optional(),
      player2Id: z.number().int().positive().nullable().optional(),
    }).parse(req.body)

    await query(`
      UPDATE ucl_knockout_matches
      SET player1_id = COALESCE($1, player1_id),
          player2_id = COALESCE($2, player2_id),
          status = 'pending', winner_id = NULL, player1_score = NULL, player2_score = NULL
      WHERE id = $3
    `, [player1Id ?? null, player2Id ?? null, req.params.matchId])

    res.json({ updated: true })
  } catch (err) { next(err) }
})

// POST /api/ucl-knockout/:id/reset — clear matches, go back to setup
router.post("/:id/reset", authenticate, adminOnly, async (req, res, next) => {
  try {
    await query("DELETE FROM ucl_knockout_players WHERE tournament_id=$1", [req.params.id])
    await query("DELETE FROM ucl_knockout_matches WHERE tournament_id=$1", [req.params.id])
    await query("UPDATE ucl_knockout_tournaments SET status='setup' WHERE id=$1", [req.params.id])
    res.json({ reset: true })
  } catch (err) { next(err) }
})

// DELETE /api/ucl-knockout/:id
router.delete("/:id", authenticate, adminOnly, async (req, res, next) => {
  try {
    await query("DELETE FROM ucl_knockout_tournaments WHERE id=$1", [req.params.id])
    res.json({ deleted: true })
  } catch (err) { next(err) }
})

export default router