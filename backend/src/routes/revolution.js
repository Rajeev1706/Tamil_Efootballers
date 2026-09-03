import { Router } from "express"
import { z } from "zod"
import { query, withTransaction } from "../db/pool.js"
import { authenticate, adminOnly } from "../middleware/auth.js"
import { recalcMarketValue } from "../services/marketValue.js"
import { recalcForm } from "../services/form.js"
import { awardOrReassignTrophy } from "../services/trophyAwards.js"
import { incrementHistory, roundLabel, saveActiveCelebration } from "../services/tournamentHistoryService.js"

const router = Router()

// ── Bracket helpers (same as weekly) ─────────────────────────────────────────
function getBracketSize(n) {
  let size = 2
  while (size < n) size *= 2
  return size
}

function generateMatches(playerIds, tournamentId) {
  const n = playerIds.length
  const slots = getBracketSize(n)
  const totalRounds = Math.log2(slots)
  const matches = []

  const shuffled = [...playerIds].sort(() => Math.random() - 0.5)
  const r1Count  = slots / 2
  const byeCount = slots - n

  let playerIdx = 0
  const pairs = []
  for (let m = 0; m < r1Count; m++) {
    if (m < byeCount) {
      pairs.push([shuffled[playerIdx++], null])
    } else {
      pairs.push([shuffled[playerIdx++], shuffled[playerIdx++]])
    }
  }
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pairs[i], pairs[j]] = [pairs[j], pairs[i]]
  }

  pairs.forEach(([p1, p2], idx) => {
    const m = idx + 1
    const isBye = !p1 || !p2
    matches.push({
      tournamentId, round: 1, matchNumber: m,
      player1Id: p1, player2Id: p2,
      winnerId:  isBye ? (p1 || p2) : null,
      status:    isBye ? "bye" : "pending",
    })
  })

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

// ── Public endpoints ─────────────────────────────────────────────────────────

// GET /api/revolution/public/current
router.get("/public/current", async (req, res, next) => {
  try {
    const t = await query(
      "SELECT * FROM revolution_tournaments WHERE status != 'setup' ORDER BY created_at DESC LIMIT 1"
    )
    if (!t.rows[0]) return res.json(null)

    const matches = await query(`
      SELECT
        rm.round, rm.match_order AS "matchNumber", rm.status, rm.is_walkover AS "isWalkover",
        rm.player1_score AS "player1Score", rm.player2_score AS "player2Score",
        p1.id AS "player1Id", p1.name AS "player1Name",
        p1.avatar_id AS "player1AvatarId", p1.avatar_url AS "player1AvatarUrl", p1.avatar_bg_url AS "player1AvatarBgUrl",
        p2.id AS "player2Id", p2.name AS "player2Name",
        p2.avatar_id AS "player2AvatarId", p2.avatar_url AS "player2AvatarUrl", p2.avatar_bg_url AS "player2AvatarBgUrl",
        w.id  AS "winnerId"
      FROM revolution_matches rm
      LEFT JOIN players p1 ON rm.player1_id = p1.id
      LEFT JOIN players p2 ON rm.player2_id = p2.id
      LEFT JOIN players w  ON rm.winner_id  = w.id
      WHERE rm.tournament_id = $1
      ORDER BY rm.round ASC, rm.match_order ASC
    `, [t.rows[0].id])

    res.json({ ...t.rows[0], matches: matches.rows })
  } catch (err) { next(err) }
})

// GET /api/revolution/public/top-scorers
router.get("/public/top-scorers", async (req, res, next) => {
  try {
    const t = await query(
      "SELECT id FROM revolution_tournaments WHERE status != 'setup' ORDER BY created_at DESC LIMIT 1"
    )
    if (!t.rows[0]) return res.json([])

    // Top scorers from revolution_matches only (no match_records)
    const result = await query(`
      SELECT p.id, p.name, t.name AS team, t.logo_url AS "teamLogo",
        p.avatar_id AS "avatarId", p.avatar_url AS "avatarUrl",
        COALESCE(SUM(CASE
          WHEN rm.player1_id = p.id THEN COALESCE(rm.player1_score, 0)
          WHEN rm.player2_id = p.id THEN COALESCE(rm.player2_score, 0)
          ELSE 0
        END), 0) AS goals,
        COALESCE(SUM(CASE
          WHEN rm.player1_id = p.id THEN COALESCE(rm.player2_score, 0)
          WHEN rm.player2_id = p.id THEN COALESCE(rm.player1_score, 0)
          ELSE 0
        END), 0) AS conceded
      FROM players p
      JOIN revolution_matches rm ON (rm.player1_id = p.id OR rm.player2_id = p.id)
        AND rm.status = 'completed'
      LEFT JOIN teams t ON p.team_id = t.id
      WHERE rm.tournament_id = $1
      GROUP BY p.id, p.name, t.name, t.logo_url, p.avatar_id, p.avatar_url
      ORDER BY goals DESC, conceded ASC, p.name ASC
      LIMIT 10
    `, [t.rows[0].id])
    res.json(result.rows)
  } catch (err) { next(err) }
})

// ── Admin endpoints ──────────────────────────────────────────────────────────

// GET /api/revolution — list all
router.get("/", authenticate, adminOnly, async (req, res, next) => {
  try {
    const result = await query("SELECT * FROM revolution_tournaments ORDER BY created_at DESC")
    res.json(result.rows)
  } catch (err) { next(err) }
})

// GET /api/revolution/:id — detail
router.get("/:id", async (req, res, next) => {
  try {
    const t = await query("SELECT * FROM revolution_tournaments WHERE id = $1", [parseInt(req.params.id)])
    if (!t.rows[0]) return res.status(404).json({ error: "Tournament not found" })

    const players = await query(`
      SELECT rp.seed, p.id, p.name, t.name AS team, t.logo_url AS "teamLogo",
        p.avatar_id AS "avatarId", p.avatar_url AS "avatarUrl"
      FROM revolution_players rp
      JOIN players p ON p.id = rp.player_id
      LEFT JOIN teams t ON p.team_id = t.id
      WHERE rp.tournament_id = $1
      ORDER BY rp.seed ASC
    `, [parseInt(req.params.id)])

    const matches = await query(`
      SELECT rm.*,
        p1.name AS "player1Name",
        p1.avatar_id AS "player1AvatarId", p1.avatar_url AS "player1AvatarUrl", p1.avatar_bg_url AS "player1AvatarBgUrl",
        p2.name AS "player2Name",
        p2.avatar_id AS "player2AvatarId", p2.avatar_url AS "player2AvatarUrl", p2.avatar_bg_url AS "player2AvatarBgUrl",
        w.name  AS "winnerName"
      FROM revolution_matches rm
      LEFT JOIN players p1 ON rm.player1_id = p1.id
      LEFT JOIN players p2 ON rm.player2_id = p2.id
      LEFT JOIN players w  ON rm.winner_id  = w.id
      WHERE rm.tournament_id = $1
      ORDER BY rm.round ASC, rm.match_order ASC
    `, [parseInt(req.params.id)])

    res.json({ ...t.rows[0], players: players.rows, matches: matches.rows })
  } catch (err) { next(err) }
})

// POST /api/revolution — create
router.post("/", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { name } = z.object({ name: z.string().min(1) }).parse(req.body)
    const result = await query(
      "INSERT INTO revolution_tournaments (name) VALUES ($1) RETURNING *", [name]
    )
    res.status(201).json(result.rows[0])
  } catch (err) { next(err) }
})

// POST /api/revolution/:id/players — set players and generate draw
router.post("/:id/players", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { playerIds } = z.object({ playerIds: z.array(z.number().int().positive()).min(2) }).parse(req.body)

    const tournamentId = parseInt(req.params.id)
    const shuffled = [...playerIds].sort(() => Math.random() - 0.5)
    const { matches, totalRounds } = generateMatches(shuffled, tournamentId)

    await withTransaction(async ({ query: q }) => {
      await q("DELETE FROM revolution_players WHERE tournament_id = $1", [tournamentId])
      await q("DELETE FROM revolution_matches WHERE tournament_id = $1", [tournamentId])

      for (let i = 0; i < shuffled.length; i++) {
        await q(
          "INSERT INTO revolution_players (tournament_id, player_id, seed) VALUES ($1,$2,$3)",
          [tournamentId, shuffled[i], i + 1]
        )
      }

      for (const m of matches) {
        await q(`
          INSERT INTO revolution_matches
            (tournament_id, round, match_order, player1_id, player2_id, winner_id, status)
          VALUES ($1,$2,$3,$4,$5,$6,$7)
        `, [m.tournamentId, m.round, m.matchNumber, m.player1Id, m.player2Id, m.winnerId, m.status])
      }

      // Propagate byes to round 2
      const byeMatches = matches.filter(m => m.status === "bye")
      for (const bye of byeMatches) {
        const col = bye.matchNumber % 2 !== 0 ? "player1_id" : "player2_id"
        await q(`
          UPDATE revolution_matches SET ${col} = $1
          WHERE tournament_id = $2 AND round = 2 AND match_order = $3
        `, [bye.winnerId, tournamentId, Math.ceil(bye.matchNumber / 2)])
      }

      await q(
        "UPDATE revolution_tournaments SET status = $1, total_rounds = $2, player_count = $3 WHERE id = $4",
        ["draw", totalRounds, shuffled.length, tournamentId]
      )
    })

    const fresh = await query("SELECT * FROM revolution_tournaments WHERE id = $1", [parseInt(req.params.id)])
    res.json(fresh.rows[0])
  } catch (err) { next(err) }
})

// POST /api/revolution/:id/start
router.post("/:id/start", authenticate, adminOnly, async (req, res, next) => {
  try {
    await query("UPDATE revolution_tournaments SET status = 'active' WHERE id = $1", [parseInt(req.params.id)])
    res.json({ started: true })
  } catch (err) { next(err) }
})

// PATCH /api/revolution/matches/:matchId/players — update match players
router.patch("/matches/:matchId/players", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { player1Id, player2Id } = z.object({
      player1Id: z.number().int().positive().nullable().optional(),
      player2Id: z.number().int().positive().nullable().optional(),
    }).parse(req.body)

    const matchRes = await query(`
      SELECT rm.*, rt.total_rounds
      FROM revolution_matches rm
      JOIN revolution_tournaments rt ON rt.id = rm.tournament_id
      WHERE rm.id = $1
    `, [req.params.matchId])
    const match = matchRes.rows[0]
    if (!match) return res.status(404).json({ error: "Match not found" })

    const newP1 = player1Id !== undefined ? player1Id : match.player1_id
    const newP2 = player2Id !== undefined ? player2Id : match.player2_id
    const isBye = Boolean(newP1) !== Boolean(newP2)
    const winnerId = isBye ? (newP1 || newP2) : null

    await query(`
      UPDATE revolution_matches
      SET player1_id = $1, player2_id = $2,
          status = $3, winner_id = $4,
          player1_score = NULL, player2_score = NULL, match_record_id = NULL
      WHERE id = $5
    `, [newP1, newP2, isBye ? "bye" : "pending", winnerId, req.params.matchId])

    // If this match had a result, delete the old match_record and
    // recalc MV + form for both old players — their stats must reflect
    // that the result is now wiped, same as weekly does.
    if (match.match_record_id) {
      await query("DELETE FROM match_records WHERE id = $1", [match.match_record_id])
    }
    for (const oldId of [match.player1_id, match.player2_id]) {
      if (oldId) {
        await recalcMarketValue(oldId)
        await recalcForm(oldId)
      }
    }

    // Retract old propagation, propagate new bye
    if (match.round < match.total_rounds) {
      const nextRound = match.round + 1
      const nextMatchNum = Math.ceil(match.match_order / 2)
      const col = match.match_order % 2 !== 0 ? "player1_id" : "player2_id"

      if (match.winner_id && match.winner_id !== winnerId) {
        await query(`
          UPDATE revolution_matches SET ${col} = NULL
          WHERE tournament_id = $1 AND round = $2 AND match_order = $3
            AND status = 'pending' AND ${col} = $4
        `, [match.tournament_id, nextRound, nextMatchNum, match.winner_id])
      }

      if (isBye) {
        await query(`
          UPDATE revolution_matches SET ${col} = $1
          WHERE tournament_id = $2 AND round = $3 AND match_order = $4
        `, [winnerId, match.tournament_id, nextRound, nextMatchNum])
      }
    }

    const fresh = await query(`
      SELECT rm.*, p1.name AS "player1Name", p2.name AS "player2Name",
        p1.avatar_id AS "player1AvatarId", p1.avatar_url AS "player1AvatarUrl", p1.avatar_bg_url AS "player1AvatarBgUrl",
        p2.avatar_id AS "player2AvatarId", p2.avatar_url AS "player2AvatarUrl", p2.avatar_bg_url AS "player2AvatarBgUrl"
      FROM revolution_matches rm
      LEFT JOIN players p1 ON rm.player1_id = p1.id
      LEFT JOIN players p2 ON rm.player2_id = p2.id
      WHERE rm.id = $1
    `, [req.params.matchId])
    res.json(fresh.rows[0])
  } catch (err) { next(err) }
})

// PATCH /api/revolution/matches/:matchId/result — save result
// Creates match_records (match_type='revolution'), recalcs MV + form for both players.
// No BDR awarded for Revolution — trophy8 awarded to champion only.
router.patch("/matches/:matchId/result", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { player1Score, player2Score, tieWinnerId, isWalkover } = z.object({
      player1Score: z.number().int().min(0),
      player2Score: z.number().int().min(0),
      tieWinnerId:  z.number().int().positive().optional(),
      isWalkover:   z.boolean().optional().default(false),
    }).parse(req.body)

    const matchRes = await query(`
      SELECT rm.*, rt.total_rounds
      FROM revolution_matches rm
      JOIN revolution_tournaments rt ON rt.id = rm.tournament_id
      WHERE rm.id = $1
    `, [req.params.matchId])
    const match = matchRes.rows[0]
    if (!match) return res.status(404).json({ error: "Match not found" })
    if (!match.player1_id || !match.player2_id) return res.status(400).json({ error: "Both players required" })

    const winnerId = player1Score > player2Score ? match.player1_id
                   : player2Score > player1Score ? match.player2_id
                   : (tieWinnerId || match.player1_id)
    const loserId  = winnerId === match.player1_id ? match.player2_id : match.player1_id

    // ── Match record ────────────────────────────────────────────────────────
    const seasonRes = await query("SELECT value FROM app_settings WHERE key = 'current_season'")
    const season    = parseInt(seasonRes.rows[0]?.value || "1")

    const oppGradeRes = await query("SELECT grade FROM players WHERE id = $1", [match.player2_id])
    const oppGrade    = oppGradeRes.rows[0]?.grade || "C"

    const oldMrId = match.match_record_id

    const mrRes = await query(`
      INSERT INTO match_records
        (player_id, opponent_id, result, opponent_grade, match_type, player_score, opponent_score, recorded_at, season_number, is_walkover)
      VALUES ($1,$2,$3,$4,'revolution',$5,$6,NOW(),$7,$8)
      RETURNING id
    `, [match.player1_id, match.player2_id,
        winnerId === match.player1_id ? "win" : "loss",
        oppGrade, player1Score, player2Score, season, isWalkover])
    const mrId = mrRes.rows[0]?.id

    await query(`
      UPDATE revolution_matches
      SET player1_score=$1, player2_score=$2, winner_id=$3, status='completed', match_record_id=$4, is_walkover=$5
      WHERE id=$6
    `, [player1Score, player2Score, winnerId, mrId, isWalkover, req.params.matchId])

    // Delete old match record if this is an edit
    if (oldMrId) await query("DELETE FROM match_records WHERE id = $1", [oldMrId])

    // If final — award trophy8 only (no BDR for Revolution)
    if (match.round === match.total_rounds) {
      await awardOrReassignTrophy({
        sourceKey:    `revolution-champion-${match.tournament_id}`,
        trophyColumn: "trophy8_count",
        playerId:     winnerId,
        seasonNumber: season,
      })
    }

    // ── Advance winner to next round ────────────────────────────────────────
    if (winnerId && match.round < match.total_rounds) {
      const nextRound    = match.round + 1
      const nextMatchNum = Math.ceil(match.match_order / 2)
      const col          = match.match_order % 2 !== 0 ? "player1_id" : "player2_id"
      await query(`
        UPDATE revolution_matches SET ${col} = $1
        WHERE tournament_id = $2 AND round = $3 AND match_order = $4
      `, [winnerId, match.tournament_id, nextRound, nextMatchNum])
    }

    // ── Check if tournament complete ────────────────────────────────────────
    const remaining = await query(`
      SELECT COUNT(*) FROM revolution_matches
      WHERE tournament_id = $1 AND status = 'pending'
        AND player1_id IS NOT NULL AND player2_id IS NOT NULL
    `, [match.tournament_id])
    if (parseInt(remaining.rows[0].count) === 0) {
      await query("UPDATE revolution_tournaments SET status = 'completed' WHERE id = $1", [match.tournament_id])
      // Store completion timestamp in app_settings for celebration window
      await query(`
        INSERT INTO app_settings (key, value) VALUES ($1, $2)
        ON CONFLICT (key) DO UPDATE SET value = $2
      `, [`revolution_champion_completed_at_${match.tournament_id}`, new Date().toISOString()])
    }

    // ── Recalc MV + form for both players ──────────────────────────────────
    await recalcMarketValue(match.player1_id)
    await recalcMarketValue(match.player2_id)
    await recalcForm(match.player1_id)
    await recalcForm(match.player2_id)

    // ── Tournament history tracking ──────────────────────────────────────────
    if (winnerId && match.total_rounds) {
      const loserId = winnerId === match.player1_id ? match.player2_id : match.player1_id
      const label   = roundLabel(match.round, match.total_rounds)
      if (loserId) await incrementHistory(loserId, "revolution", "knockout", label).catch(() => {})
      if (match.round === match.total_rounds) {
        await incrementHistory(winnerId, "revolution", "knockout", "winner").catch(() => {})
        const rPlayer = (await query(`SELECT name, avatar_url AS "avatarUrl", avatar_id AS "avatarId" FROM players WHERE id=$1`,[winnerId])).rows[0]
        if (rPlayer) await saveActiveCelebration("revolution", { name: rPlayer.name, avatarUrl: rPlayer.avatarUrl, avatarId: rPlayer.avatarId })
      }
    }

    res.json({ updated: true, winnerId, nextRound: match.round + 1 })
  } catch (err) { next(err) }
})

// POST /api/revolution/:id/reset
router.post("/:id/reset", authenticate, adminOnly, async (req, res, next) => {
  try {
    const tournamentId = parseInt(req.params.id)

    // Collect all match_record_ids and player ids BEFORE deleting matches
    const matchesRes = await query(`
      SELECT match_record_id, player1_id, player2_id
      FROM revolution_matches
      WHERE tournament_id = $1 AND match_record_id IS NOT NULL
    `, [tournamentId])

    const affectedPlayerIds = new Set()
    const matchRecordIds    = []
    for (const m of matchesRes.rows) {
      if (m.match_record_id) matchRecordIds.push(m.match_record_id)
      if (m.player1_id) affectedPlayerIds.add(m.player1_id)
      if (m.player2_id) affectedPlayerIds.add(m.player2_id)
    }

    await withTransaction(async ({ query: q }) => {
      // Delete linked match_records first so player stats are wiped
      if (matchRecordIds.length > 0) {
        await q(
          `DELETE FROM match_records WHERE id = ANY($1::int[])`,
          [matchRecordIds]
        )
      }
      await q("DELETE FROM revolution_players WHERE tournament_id = $1", [tournamentId])
      await q("DELETE FROM revolution_matches WHERE tournament_id = $1", [tournamentId])
      await q("UPDATE revolution_tournaments SET status = 'setup', total_rounds = NULL, player_count = NULL WHERE id = $1", [tournamentId])
    })

    // Recalc MV + form for every player whose results were wiped
    for (const playerId of affectedPlayerIds) {
      await recalcMarketValue(playerId)
      await recalcForm(playerId)
    }

    res.json({ reset: true })
  } catch (err) { next(err) }
})

// DELETE /api/revolution/:id
router.delete("/:id", authenticate, adminOnly, async (req, res, next) => {
  try {
    const tournamentId = parseInt(req.params.id)

    // Collect linked match_records and affected players BEFORE cascade-delete
    const matchesRes = await query(`
      SELECT match_record_id, player1_id, player2_id
      FROM revolution_matches
      WHERE tournament_id = $1 AND match_record_id IS NOT NULL
    `, [tournamentId])

    const affectedPlayerIds = new Set()
    const matchRecordIds    = []
    for (const m of matchesRes.rows) {
      if (m.match_record_id) matchRecordIds.push(m.match_record_id)
      if (m.player1_id) affectedPlayerIds.add(m.player1_id)
      if (m.player2_id) affectedPlayerIds.add(m.player2_id)
    }

    // Delete linked match_records first, then the tournament (cascades matches)
    if (matchRecordIds.length > 0) {
      await query(`DELETE FROM match_records WHERE id = ANY($1::int[])`, [matchRecordIds])
    }
    await query("DELETE FROM revolution_tournaments WHERE id = $1", [tournamentId])

    // Recalc MV + form for every player whose results were wiped
    for (const playerId of affectedPlayerIds) {
      await recalcMarketValue(playerId)
      await recalcForm(playerId)
    }

    res.json({ deleted: true })
  } catch (err) { next(err) }
})

export default router