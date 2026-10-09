import { Router } from "express"
import { z } from "zod"
import { query, withTransaction } from "../db/pool.js"
import { authenticate, adminOnly } from "../middleware/auth.js"
import { recalcMarketValue } from "../services/marketValue.js"
import { recalcForm } from "../services/form.js"
import { claimAward, addBdr, addBdrWithLabel } from "../services/bdrAwards.js"
import { awardOrReassignTrophy } from "../services/trophyAwards.js"
import { updateSeasonRecord } from "../services/seasonRecord.js"
import { incrementHistory, roundLabel, saveActiveCelebration } from "../services/tournamentHistoryService.js"

const router = Router()

// Bracket size = the smallest power of 2 that fits the player count.
// This guarantees byeCount (slots - n) is always strictly less than half
// the slots, which is what makes it mathematically possible to guarantee
// no two byes ever land in the same round-1 match (see generateMatches).
function getBracketSize(n) {
  let size = 2
  while (size < n) size *= 2
  return size
}

// Helper: generate bracket matches after draw
function generateMatches(playerIds, tournamentId) {
  const n = playerIds.length
  const slots = getBracketSize(n)
  const totalRounds = Math.log2(slots)
  const matches = []

  const shuffled = [...playerIds].sort(() => Math.random() - 0.5)
  const r1Count  = slots / 2
  const byeCount = slots - n // always < r1Count, guaranteed by getBracketSize

  // Build each round-1 pair explicitly: the first `byeCount` matches each
  // get exactly one real player + one bye (never two byes); every remaining
  // match gets two real players. Since byeCount < r1Count is guaranteed,
  // there's always at least one all-real match, and a bye can never end up
  // paired with another bye.
  let playerIdx = 0
  const pairs = []
  for (let m = 0; m < r1Count; m++) {
    if (m < byeCount) {
      pairs.push([shuffled[playerIdx++], null])
    } else {
      pairs.push([shuffled[playerIdx++], shuffled[playerIdx++]])
    }
  }
  // Shuffle match order so the byes aren't all clustered at the start of the bracket
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
        wtm.is_walkover AS "isWalkover",
        p1.id AS "player1Id", p1.name AS "player1Name",
        p1.avatar_id AS "player1AvatarId", p1.avatar_url AS "player1AvatarUrl", p1.avatar_bg_url AS "player1AvatarBgUrl",
        p2.id AS "player2Id", p2.name AS "player2Name",
        p2.avatar_id AS "player2AvatarId", p2.avatar_url AS "player2AvatarUrl", p2.avatar_bg_url AS "player2AvatarBgUrl",
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
        p.id, p.name, t.name AS team, t.logo_url AS "teamLogo",
        p.avatar_id AS "avatarId", p.avatar_url AS "avatarUrl",
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
      GROUP BY p.id, p.name, t.name, t.logo_url, p.avatar_id, p.avatar_url
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
      SELECT wtp.seed, p.id, p.name, t.name AS team, t.logo_url AS "teamLogo", p.avatar_id AS "avatarId", p.avatar_url AS "avatarUrl"
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
        p1.avatar_id AS "player1AvatarId", p1.avatar_url AS "player1AvatarUrl", p1.avatar_bg_url AS "player1AvatarBgUrl",
        p2.name AS "player2Name",
        p2.avatar_id AS "player2AvatarId", p2.avatar_url AS "player2AvatarUrl", p2.avatar_bg_url AS "player2AvatarBgUrl",
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

// PATCH /api/weekly/matches/:matchId/players — update who plays in a match.
// If this leaves exactly one side filled and the other empty ("Bye"), the
// match is marked as a bye and that player is automatically advanced into
// the next round — mirroring the same propagation used when the initial
// draw creates byes for an odd player count.
router.patch("/matches/:matchId/players", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { player1Id, player2Id } = z.object({
      player1Id: z.number().int().positive().nullable().optional(),
      player2Id: z.number().int().positive().nullable().optional(),
    }).parse(req.body)

    const matchRes = await query(`
      SELECT wtm.*, wt.total_rounds
      FROM weekly_tournament_matches wtm
      JOIN weekly_tournaments wt ON wt.id = wtm.tournament_id
      WHERE wtm.id = $1
    `, [req.params.matchId])
    const match = matchRes.rows[0]
    if (!match) return res.status(404).json({ error: "Match not found" })

    // Explicit `null` really means null (Bye) here — only fall back to the
    // existing value when the field wasn't sent at all.
    const newP1 = player1Id !== undefined ? player1Id : match.player1_id
    const newP2 = player2Id !== undefined ? player2Id : match.player2_id
    const isBye = Boolean(newP1) !== Boolean(newP2) // exactly one side filled
    const winnerId = isBye ? (newP1 || newP2) : null

    await query(`
      UPDATE weekly_tournament_matches
      SET player1_id = $1, player2_id = $2,
          status = $3, winner_id = $4,
          player1_score = NULL, player2_score = NULL, match_record_id = NULL
      WHERE id = $5
    `, [newP1, newP2, isBye ? "bye" : "pending", winnerId, req.params.matchId])

    // Clean up the old match record and recalc stats for whoever was
    // previously in this match, since their result is being wiped out.
    if (match.match_record_id) {
      await query("DELETE FROM match_records WHERE id = $1", [match.match_record_id])
    }
    for (const oldId of [match.player1_id, match.player2_id]) {
      if (oldId) {
        await recalcMarketValue(oldId)
        await recalcForm(oldId)
      }
    }

    // Retract any previous propagation this match may have already made
    // to the next round (whether it was previously a bye, or a completed
    // real result — match.winner_id tells us what got advanced either
    // way), then propagate the new state if this edit results in a fresh
    // bye. Without the retraction step, editing a former bye's players
    // into a real match left the old bye-winner's name stuck in the next
    // round even though nothing has actually been decided yet.
    if (match.round < match.total_rounds) {
      const nextRound = match.round + 1
      const nextMatchNum = Math.ceil(match.match_number / 2)
      const col = match.match_number % 2 !== 0 ? "player1_id" : "player2_id"

      if (match.winner_id && match.winner_id !== winnerId) {
        // Only clear if the next-round match hasn't been played itself yet
        // and still actually holds this stale value — never overwrite
        // real progress that's already happened deeper in the bracket.
        await query(`
          UPDATE weekly_tournament_matches SET ${col} = NULL
          WHERE tournament_id = $1 AND round = $2 AND match_number = $3
            AND status = 'pending' AND ${col} = $4
        `, [match.tournament_id, nextRound, nextMatchNum, match.winner_id])
      }

      if (isBye) {
        await query(`
          UPDATE weekly_tournament_matches SET ${col} = $1
          WHERE tournament_id = $2 AND round = $3 AND match_number = $4
        `, [winnerId, match.tournament_id, nextRound, nextMatchNum])
      }
    }

    const fresh = await query(`
      SELECT wtm.*, p1.name AS "player1Name", p2.name AS "player2Name",
        p1.avatar_id AS "player1AvatarId", p1.avatar_url AS "player1AvatarUrl", p1.avatar_bg_url AS "player1AvatarBgUrl",
        p2.avatar_id AS "player2AvatarId", p2.avatar_url AS "player2AvatarUrl", p2.avatar_bg_url AS "player2AvatarBgUrl"
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
    const { player1Score, player2Score, tieWinnerId, isWalkover } = z.object({
      player1Score: z.number().int().min(0),
      player2Score: z.number().int().min(0),
      tieWinnerId:  z.number().int().positive().optional(),
      isWalkover:   z.boolean().optional().default(false),
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

    const winnerId = player1Score > player2Score ? match.player1_id
                   : player2Score > player1Score ? match.player2_id
                   : (tieWinnerId || match.player1_id)

    const result = winnerId === match.player1_id ? "win" : "loss"

    const seasonRes = await query("SELECT value FROM app_settings WHERE key = 'current_season'")
    const season = parseInt(seasonRes.rows[0]?.value || "6")

    const oppGradeRes = await query("SELECT grade FROM players WHERE id = $1", [match.player2_id])
    const oppGrade = oppGradeRes.rows[0]?.grade || "C"

    const oldMatchRecordId = match.match_record_id

    const mrRes = await query(`
      INSERT INTO match_records
        (player_id, opponent_id, result, opponent_grade, match_type, player_score, opponent_score, recorded_at, season_number, is_walkover)
      VALUES ($1,$2,$3,$4,'weekly',$5,$6,NOW(),$7,$8)
      RETURNING id
    `, [match.player1_id, match.player2_id, result, oppGrade, player1Score, player2Score, season, isWalkover])
    const mrId = mrRes.rows[0]?.id

    await query(`
      UPDATE weekly_tournament_matches
      SET player1_score=$1, player2_score=$2, winner_id=$3, status='completed', match_record_id=$4, is_walkover=$5
      WHERE id=$6
    `, [player1Score, player2Score, winnerId, mrId, isWalkover, req.params.matchId])

    // Now safe to delete the old match record, if this was an edit
    if (oldMatchRecordId) {
      await query("DELETE FROM match_records WHERE id = $1", [oldMatchRecordId])
    }

    // ── LIVE BDR — "reaching" based, diff-only, edit-safe ──────────────────
    // BDR is awarded for REACHING a round, not losing in it.
    // When advancing further, only the DIFFERENCE is added (never cumulative).
    //
    // Weekly BDR totals:  QF=3, SF=5, Final(runner-up)=8, Champion=10
    // So diffs:           reach QF=+3, reach SF=+2, reach Final=+3, win Final=+2
    //
    // On edit: reverse the diff that was awarded to the old winner, give it
    // to the new winner instead.

    const totalRounds = match.total_rounds
    const finalRound  = totalRounds
    const sfRound     = totalRounds - 1
    const qfRound     = totalRounds - 2

    // Total BDR a player should have for reaching a given round
    function bdrForReaching(round) {
      if (round >= finalRound) return 8   // reached Final = runner-up level
      if (round >= sfRound)    return 5   // reached SF
      if (round >= qfRound)    return 3   // reached QF
      return 0
    }

    // The diff to award when a player advances FROM currentRound TO the next
    function advancementDiff(currentRound) {
      if (currentRound >= totalRounds) return 0  // can't advance past final
      const oldBdr = bdrForReaching(currentRound)
      const newBdr = bdrForReaching(currentRound + 1)
      return newBdr - oldBdr
    }

    // Champion bonus: awarded on top of runner-up when winning the final
    const championBonus = match.round === finalRound ? (10 - 8) : 0

    // The diff this match's winner earns (either advancing or winning final)
    const winnerDiff = match.round === finalRound
      ? championBonus
      : advancementDiff(match.round)

    // If this is an edit, reverse the old winner's diff
    if (oldMatchRecordId && match.winner_id && winnerDiff > 0) {
      await addBdr(match.winner_id, -winnerDiff)
    }

    // Award new winner's diff
    if (winnerId && winnerDiff > 0) {
      const weeklyLabel = match.round === finalRound ? "Weekly Champion" : `Weekly Tournament Round ${match.round}`
      await addBdrWithLabel(winnerId, winnerDiff, weeklyLabel)
    }

    // Recalc MV for both (BDR affects MV)
    await recalcMarketValue(match.player1_id)
    await recalcMarketValue(match.player2_id)

    // ── Tournament history tracking ───────────────────────────────────────────
    if (winnerId && totalRounds) {
      const loserId = winnerId === match.player1_id ? match.player2_id : match.player1_id
      const label   = roundLabel(match.round, totalRounds)
      // Loser gets eliminated at this round
      if (loserId) await incrementHistory(loserId, "weekly", "knockout", label).catch(() => {})
      // Winner of the final gets "winner"
      if (match.round === totalRounds) {
        await incrementHistory(winnerId, "weekly", "knockout", "winner").catch(() => {})
        // Save for admin card download
        const wPlayer = (await query(`SELECT name, avatar_url AS "avatarUrl", avatar_id AS "avatarId" FROM players WHERE id=$1`,[winnerId])).rows[0]
        if (wPlayer) await saveActiveCelebration("weekly", { name: wPlayer.name, avatarUrl: wPlayer.avatarUrl, avatarId: wPlayer.avatarId })
      }
    }

    // Advance winner to next round
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
      await query("UPDATE weekly_tournaments SET status = 'completed', completed_at = NOW() WHERE id = $1", [match.tournament_id])

      // Golden Boot BDR — edit-safe: tracks current holder in app_settings
      // and reassigns whenever the top scorer changes (e.g. after a result edit).
      // Uses the same pattern as awardOrReassignTrophy so edits always correct it.
      const gbHolderKey = `weekly_gb_holder_${match.tournament_id}`
      const gbHolderRes = await query("SELECT value FROM app_settings WHERE key = $1", [gbHolderKey])
      const oldGbHolderId = gbHolderRes.rows[0]?.value ? parseInt(gbHolderRes.rows[0].value) : null

      const goldenBootRes = await query(`
        SELECT p.id,
          COALESCE(SUM(CASE WHEN mr.player_id=p.id THEN mr.player_score WHEN mr.opponent_id=p.id THEN mr.opponent_score ELSE 0 END),0) AS goals,
          COALESCE(SUM(CASE WHEN mr.player_id=p.id THEN mr.opponent_score WHEN mr.opponent_id=p.id THEN mr.player_score ELSE 0 END),0) AS conceded
        FROM players p
        JOIN match_records mr ON (mr.player_id=p.id OR mr.opponent_id=p.id) AND mr.match_type='weekly'
        JOIN weekly_tournament_matches wtm ON wtm.match_record_id = mr.id
        WHERE wtm.tournament_id = $1
        GROUP BY p.id
        ORDER BY goals DESC, conceded ASC
        LIMIT 1
      `, [match.tournament_id])
      const newGbHolder = goldenBootRes.rows[0]?.goals > 0 ? goldenBootRes.rows[0] : null

      if (oldGbHolderId !== (newGbHolder?.id ?? null)) {
        if (oldGbHolderId) await addBdr(oldGbHolderId, -4)
        if (newGbHolder)   await addBdrWithLabel(newGbHolder.id, 4, "Weekly Golden Boot")
        await query(
          `INSERT INTO app_settings (key, value) VALUES ($1, $2)
           ON CONFLICT (key) DO UPDATE SET value = $2`,
          [gbHolderKey, newGbHolder?.id?.toString() ?? ""]
        )
      }

      // Trophy awards — runs EVERY time completion is detected (unlike the
      // BDR block above), so correcting an earlier result later on will
      // automatically revert the wrong holder and reassign to whoever is
      // now actually correct. Champion trophy always looks at the Final
      // (the tournament's own last round) specifically, not whichever
      // match was just saved.
      const finalMatchRes = await query(
        "SELECT winner_id FROM weekly_tournament_matches WHERE tournament_id = $1 AND round = $2 AND status = 'completed'",
        [match.tournament_id, totalRounds]
      )
      await awardOrReassignTrophy({
        sourceKey: `weekly_champion_tournament_${match.tournament_id}`,
        trophyColumn: "trophy3_count",
        playerId: finalMatchRes.rows[0]?.winner_id ?? null,
        seasonNumber: season,
      })

      // Store completion timestamp for 48-hour celebration window
      if (finalMatchRes.rows[0]?.winner_id) {
        await query(`
          INSERT INTO app_settings (key, value) VALUES ($1, $2)
          ON CONFLICT (key) DO UPDATE SET value = $2
        `, [`weekly_champion_completed_at_${match.tournament_id}`, new Date().toISOString()])
      }

      const trophyGoldenBootRes = await query(`
        SELECT p.id,
          COALESCE(SUM(CASE WHEN mr.player_id=p.id THEN mr.player_score WHEN mr.opponent_id=p.id THEN mr.opponent_score ELSE 0 END),0) AS goals,
          COALESCE(SUM(CASE WHEN mr.player_id=p.id THEN mr.opponent_score WHEN mr.opponent_id=p.id THEN mr.player_score ELSE 0 END),0) AS conceded
        FROM players p
        JOIN match_records mr ON (mr.player_id=p.id OR mr.opponent_id=p.id) AND mr.match_type='weekly'
        JOIN weekly_tournament_matches wtm ON wtm.match_record_id = mr.id
        WHERE wtm.tournament_id = $1
        GROUP BY p.id
        ORDER BY goals DESC, conceded ASC
        LIMIT 1
      `, [match.tournament_id])
      const weeklyTopScorer = trophyGoldenBootRes.rows[0]
      await awardOrReassignTrophy({
        sourceKey: `weekly_golden_boot_tournament_${match.tournament_id}`,
        trophyColumn: "trophy5_count",
        playerId: weeklyTopScorer?.goals > 0 ? weeklyTopScorer.id : null,
        seasonNumber: season,
      })

      // ── Auto-fill season record — weekly winner field ──────────────────────
      if (finalMatchRes.rows[0]?.winner_id) {
        const winnerNameRes = await query(
          "SELECT name FROM players WHERE id = $1",
          [finalMatchRes.rows[0].winner_id]
        )
        const winnerName = winnerNameRes.rows[0]?.name
        if (winnerName) {
          await updateSeasonRecord(season, { weekly_winner: winnerName })
        }
      }
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