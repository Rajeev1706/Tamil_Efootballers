import { Router } from "express"
import { z } from "zod"
import { query, withTransaction } from "../db/pool.js"
import { authenticate, adminOnly } from "../middleware/auth.js"
import { recalcMarketValue } from "../services/marketValue.js"

const router = Router()

// Tiered bracket sizes: ≤32 → 32, 33-64 → 64, 65-128 → 128
function getBracketSize(n) {
  if (n <= 32)  return 32
  if (n <= 64)  return 64
  return 128
}

// Helper: generate bracket matches after draw
function generateMatches(playerIds, tournamentId) {
  const n = playerIds.length
  const slots = getBracketSize(n)
  const totalRounds = Math.log2(slots)
  const matches = []

  // Distribute players into slots so byes are spread out and never face each other.
  // Strategy: alternate filling from top and bottom of the slot array.
  // e.g. for 6 players in 8 slots: positions 0,7,2,5,4,3 get players, 1,6 are byes.
  // This guarantees each bye is always paired with a real player.
  const slotPositions = new Array(slots).fill(null)
  let lo = 0, hi = slots - 1
  for (let i = 0; i < playerIds.length; i++) {
    if (i % 2 === 0) slotPositions[lo++] = playerIds[i]
    else             slotPositions[hi--] = playerIds[i]
  }

  // Round 1: pair adjacent slots (0&1, 2&3, ...)
  const r1Count = slots / 2
  for (let m = 1; m <= r1Count; m++) {
    const p1 = slotPositions[(m - 1) * 2]
    const p2 = slotPositions[(m - 1) * 2 + 1]
    // Skip if both null (bye vs bye — should never happen with above distribution)
    if (!p1 && !p2) continue
    const isBye = !p1 || !p2
    matches.push({
      tournamentId, round: 1, matchNumber: m,
      player1Id: p1, player2Id: p2,
      winnerId:  isBye ? (p1 || p2) : null,
      status:    isBye ? "bye" : "pending",
    })
  }

  // Future rounds — empty slots filled as results come in
  for (let r = 2; r <= totalRounds; r++) {
    const count = slots / Math.pow(2, r)
    for (let m = 1; m <= count; m++) {
      matches.push({
        tournamentId, round: r, matchNumber: m,
        player1Id: null, player2Id: null, winnerId: null, status: "pending",
      })
    }
  }
  return { matches, totalRounds }
}

// GET /api/weekly/public/current — latest non-setup tournament, for the public
// dashboard (fixtures grouped by round, not the bracket visualization)
router.get("/public/current", async (req, res, next) => {
  try {
    const t = await query(
      "SELECT * FROM weekly_tournaments WHERE status != 'setup' ORDER BY created_at DESC LIMIT 1"
    )
    if (!t.rows[0]) return res.json(null)

    const matches = await query(`
      SELECT
        wtm.round, wtm.match_number AS "matchNumber", wtm.status,
        wtm.player1_score AS "player1Score", wtm.player2_score AS "player2Score",
        p1.id AS "player1Id", p1.name AS "player1Name",
        p2.id AS "player2Id", p2.name AS "player2Name",
        w.id  AS "winnerId"
      FROM weekly_tournament_matches wtm
      LEFT JOIN players p1 ON wtm.player1_id = p1.id
      LEFT JOIN players p2 ON wtm.player2_id = p2.id
      LEFT JOIN players w  ON wtm.winner_id  = w.id
      WHERE wtm.tournament_id = $1
      ORDER BY wtm.round ASC, wtm.match_number ASC
    `, [t.rows[0].id])

    res.json({ ...t.rows[0], matches: matches.rows })
  } catch (err) { next(err) }
})

// GET /api/weekly/public/top-scorers — top 10 by goals in the CURRENT Weekly
// tournament only (not cumulative across past tournaments).
router.get("/public/top-scorers", async (req, res, next) => {
  try {
    const t = await query(
      "SELECT id FROM weekly_tournaments WHERE status != 'setup' ORDER BY created_at DESC LIMIT 1"
    )
    if (!t.rows[0]) return res.json([])

    const result = await query(`
      SELECT
        p.id, p.name, t.name AS team,
        COALESCE(SUM(
          CASE
            WHEN mr.player_id   = p.id THEN COALESCE(mr.player_score, 0)
            WHEN mr.opponent_id = p.id THEN COALESCE(mr.opponent_score, 0)
            ELSE 0
          END
        ), 0) AS goals,
        COALESCE(SUM(
          CASE
            WHEN mr.player_id   = p.id THEN COALESCE(mr.opponent_score, 0)
            WHEN mr.opponent_id = p.id THEN COALESCE(mr.player_score, 0)
            ELSE 0
          END
        ), 0) AS conceded
      FROM players p
      JOIN match_records mr
        ON (mr.player_id = p.id OR mr.opponent_id = p.id) AND mr.match_type = 'weekly'
      JOIN weekly_tournament_matches wtm ON wtm.match_record_id = mr.id
      LEFT JOIN teams t ON p.team_id = t.id
      WHERE wtm.tournament_id = $1
      GROUP BY p.id, p.name, t.name
      ORDER BY goals DESC, conceded ASC, p.name ASC
      LIMIT 10
    `, [t.rows[0].id])
    res.json(result.rows)
  } catch (err) { next(err) }
})

// GET /api/weekly — list all tournaments
router.get("/", authenticate, adminOnly, async (req, res, next) => {
  try {
    const result = await query("SELECT * FROM weekly_tournaments ORDER BY created_at DESC")
    res.json(result.rows)
  } catch (err) { next(err) }
})

// GET /api/weekly/:id — tournament detail with players and matches
router.get("/:id", async (req, res, next) => {
  try {
    const t = await query("SELECT * FROM weekly_tournaments WHERE id = $1", [req.params.id])
    if (!t.rows[0]) return res.status(404).json({ error: "Tournament not found" })

    const players = await query(`
      SELECT wtp.seed, p.id, p.name, t.name AS team
      FROM weekly_tournament_players wtp
      JOIN players p ON p.id = wtp.player_id
      LEFT JOIN teams t ON p.team_id = t.id
      WHERE wtp.tournament_id = $1
      ORDER BY wtp.seed ASC
    `, [req.params.id])

    const matches = await query(`
      SELECT
        wtm.*,
        p1.name AS "player1Name",
        p2.name AS "player2Name",
        w.name  AS "winnerName"
      FROM weekly_tournament_matches wtm
      LEFT JOIN players p1 ON wtm.player1_id = p1.id
      LEFT JOIN players p2 ON wtm.player2_id = p2.id
      LEFT JOIN players w  ON wtm.winner_id  = w.id
      WHERE wtm.tournament_id = $1
      ORDER BY wtm.round ASC, wtm.match_number ASC
    `, [req.params.id])

    res.json({ ...t.rows[0], players: players.rows, matches: matches.rows })
  } catch (err) { next(err) }
})

// POST /api/weekly — create tournament
router.post("/", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { name } = z.object({ name: z.string().min(1) }).parse(req.body)
    const result = await query(
      "INSERT INTO weekly_tournaments (name) VALUES ($1) RETURNING *", [name]
    )
    res.status(201).json(result.rows[0])
  } catch (err) { next(err) }
})

// POST /api/weekly/:id/players — set players and generate draw
router.post("/:id/players", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { playerIds } = z.object({ playerIds: z.array(z.number().int().positive()).min(2) }).parse(req.body)

    // Shuffle players randomly
    const shuffled = [...playerIds].sort(() => Math.random() - 0.5)
    const { matches, totalRounds } = generateMatches(shuffled, parseInt(req.params.id))

    await withTransaction(async ({ query: q }) => {
      // Clear existing players/matches
      await q("DELETE FROM weekly_tournament_players WHERE tournament_id = $1", [req.params.id])
      await q("DELETE FROM weekly_tournament_matches WHERE tournament_id = $1", [req.params.id])

      // Insert players with seeds
      for (let i = 0; i < shuffled.length; i++) {
        await q(
          "INSERT INTO weekly_tournament_players (tournament_id, player_id, seed) VALUES ($1,$2,$3)",
          [req.params.id, shuffled[i], i + 1]
        )
      }

      // Insert all match slots
      for (const m of matches) {
        await q(`
          INSERT INTO weekly_tournament_matches
            (tournament_id, round, match_number, player1_id, player2_id, winner_id, status)
          VALUES ($1,$2,$3,$4,$5,$6,$7)
        `, [m.tournamentId, m.round, m.matchNumber, m.player1Id, m.player2Id, m.winnerId, m.status])
      }

      // Propagate bye winners into round 2
      const byeMatches = matches.filter(m => m.status === "bye")
      for (const bye of byeMatches) {
        const nextRound = 2
        const nextMatchNum = Math.ceil(bye.matchNumber / 2)
        const isP1 = bye.matchNumber % 2 !== 0
        const col = isP1 ? "player1_id" : "player2_id"
        await q(`
          UPDATE weekly_tournament_matches SET ${col} = $1
          WHERE tournament_id = $2 AND round = $3 AND match_number = $4
        `, [bye.winnerId, req.params.id, nextRound, nextMatchNum])
      }

      await q(
        "UPDATE weekly_tournaments SET status = $1, total_rounds = $2, player_count = $3 WHERE id = $4",
        ["draw", totalRounds, shuffled.length, req.params.id]
      )
    })

    const fresh = await query("SELECT * FROM weekly_tournaments WHERE id = $1", [req.params.id])
    res.json(fresh.rows[0])
  } catch (err) { next(err) }
})

// POST /api/weekly/:id/start — mark tournament as active (after draw)
router.post("/:id/start", authenticate, adminOnly, async (req, res, next) => {
  try {
    await query("UPDATE weekly_tournaments SET status = 'active' WHERE id = $1", [req.params.id])
    res.json({ started: true })
  } catch (err) { next(err) }
})

// PATCH /api/weekly/matches/:matchId/players — update who plays in a match
router.patch("/matches/:matchId/players", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { player1Id, player2Id } = z.object({
      player1Id: z.number().int().positive().nullable().optional(),
      player2Id: z.number().int().positive().nullable().optional(),
    }).parse(req.body)

    const matchRes = await query("SELECT * FROM weekly_tournament_matches WHERE id = $1", [req.params.matchId])
    if (!matchRes.rows[0]) return res.status(404).json({ error: "Match not found" })

    // Reset match status if it was completed (since players changed)
    await query(`
      UPDATE weekly_tournament_matches
      SET player1_id = COALESCE($1, player1_id),
          player2_id = COALESCE($2, player2_id),
          status = CASE WHEN $3 THEN 'pending' ELSE status END,
          winner_id = CASE WHEN $3 THEN NULL ELSE winner_id END,
          player1_score = CASE WHEN $3 THEN NULL ELSE player1_score END,
          player2_score = CASE WHEN $3 THEN NULL ELSE player2_score END
      WHERE id = $4
    `, [player1Id ?? null, player2Id ?? null, (player1Id !== undefined || player2Id !== undefined), req.params.matchId])

    const fresh = await query(`
      SELECT wtm.*, p1.name AS "player1Name", p2.name AS "player2Name"
      FROM weekly_tournament_matches wtm
      LEFT JOIN players p1 ON wtm.player1_id = p1.id
      LEFT JOIN players p2 ON wtm.player2_id = p2.id
      WHERE wtm.id = $1
    `, [req.params.matchId])
    res.json(fresh.rows[0])
  } catch (err) { next(err) }
})

// PATCH /api/weekly/matches/:matchId/result — save match result
router.patch("/matches/:matchId/result", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { player1Score, player2Score, tieWinnerId } = z.object({
      player1Score: z.number().int().min(0),
      player2Score: z.number().int().min(0),
      tieWinnerId:  z.number().int().positive().optional(),
    }).parse(req.body)

    const matchRes = await query(`
      SELECT wtm.*, wt.season_number, wt.total_rounds, wt.id AS "tournamentId"
      FROM weekly_tournament_matches wtm
      JOIN weekly_tournaments wt ON wt.id = wtm.tournament_id
      WHERE wtm.id = $1
    `, [req.params.matchId])
    const match = matchRes.rows[0]
    if (!match) return res.status(404).json({ error: "Match not found" })
    if (!match.player1_id || !match.player2_id) return res.status(400).json({ error: "Both players required" })

    // Determine winner — if tied, use admin-selected tieWinnerId
    const winnerId = player1Score > player2Score ? match.player1_id
                   : player2Score > player1Score ? match.player2_id
                   : (tieWinnerId || match.player1_id) // tied: use admin pick or default p1

    const result = player1Score > player2Score ? "win"
                 : player2Score > player1Score ? "loss"
                 : "draw" // draw in record but one advances

    // Get current season
    const seasonRes = await query("SELECT value FROM app_settings WHERE key = 'current_season'")
    const season = parseInt(seasonRes.rows[0]?.value || "6")

    const oppGradeRes = await query("SELECT grade FROM players WHERE id = $1", [match.player2_id])
    const oppGrade = oppGradeRes.rows[0]?.grade || "C"

    // If match was already completed, delete the old match record first
    if (match.match_record_id) {
      await query("DELETE FROM match_records WHERE id = $1", [match.match_record_id])
    }

    // Log new match record
    const mrRes = await query(`
      INSERT INTO match_records
        (player_id, opponent_id, result, opponent_grade, match_type, player_score, opponent_score, recorded_at, season_number)
      VALUES ($1,$2,$3,$4,'weekly',$5,$6,NOW(),$7)
      RETURNING id
    `, [match.player1_id, match.player2_id, result, oppGrade, player1Score, player2Score, season])
    const mrId = mrRes.rows[0]?.id

    // Update the match result
    await query(`
      UPDATE weekly_tournament_matches
      SET player1_score=$1, player2_score=$2, winner_id=$3, status='completed', match_record_id=$4
      WHERE id=$5
    `, [player1Score, player2Score, winnerId, mrId, req.params.matchId])

    // Recalc market value for both players — the DB trigger alone only
    // handles the player_id side and skips the BDR swing (see marketValue.js).
    await recalcMarketValue(match.player1_id)
    await recalcMarketValue(match.player2_id)

    // Advance winner to next round
    const totalRounds = match.total_rounds
    if (winnerId && totalRounds && match.round < totalRounds) {
      const nextRound    = match.round + 1
      const nextMatchNum = Math.ceil(match.match_number / 2)
      const col          = match.match_number % 2 !== 0 ? "player1_id" : "player2_id"

      await query(`
        UPDATE weekly_tournament_matches
        SET ${col} = $1
        WHERE tournament_id = $2 AND round = $3 AND match_number = $4
      `, [winnerId, match.tournament_id, nextRound, nextMatchNum])
    }

    // Mark tournament complete if no more pending matches with both players
    const remaining = await query(`
      SELECT COUNT(*) FROM weekly_tournament_matches
      WHERE tournament_id = $1 AND status = 'pending'
        AND player1_id IS NOT NULL AND player2_id IS NOT NULL
    `, [match.tournament_id])
    if (parseInt(remaining.rows[0].count) === 0) {
      await query("UPDATE weekly_tournaments SET status = 'completed' WHERE id = $1", [match.tournament_id])
    }

    res.json({ updated: true, winnerId, nextRound: match.round + 1 })
  } catch (err) { next(err) }
})

// POST /api/weekly/:id/reset — clear draw and go back to setup
router.post("/:id/reset", authenticate, adminOnly, async (req, res, next) => {
  try {
    await withTransaction(async ({ query: q }) => {
      await q("DELETE FROM weekly_tournament_players WHERE tournament_id = $1", [req.params.id])
      await q("DELETE FROM weekly_tournament_matches WHERE tournament_id = $1", [req.params.id])
      await q("UPDATE weekly_tournaments SET status = 'setup', total_rounds = NULL, player_count = NULL WHERE id = $1", [req.params.id])
    })
    res.json({ reset: true })
  } catch (err) { next(err) }
})

// DELETE /api/weekly/:id — delete tournament
router.delete("/:id", authenticate, adminOnly, async (req, res, next) => {
  try {
    await query("DELETE FROM weekly_tournaments WHERE id = $1", [req.params.id])
    res.json({ deleted: true })
  } catch (err) { next(err) }
})

export default router