import { Router } from "express"
import { z } from "zod"
import { query } from "../db/pool.js"
import { authenticate, adminOnly } from "../middleware/auth.js"
import { recalcMarketValue } from "../services/marketValue.js"
import { recalcForm } from "../services/form.js"

const router = Router()

// Get current season number from app_settings
async function getCurrentSeason() {
  try {
    const res = await query("SELECT value FROM app_settings WHERE key = 'current_season'")
    return parseInt(res.rows[0]?.value || "6")
  } catch { return 6 }
}


// GET /api/records/season/:season — all records for a specific season (public)
router.get("/season/:season", async (req, res, next) => {
  try {
    const result = await query(`
      SELECT
        mr.id, mr.result,
        mr.match_type     AS "matchType",
        mr.player_score   AS "playerScore",
        mr.opponent_score AS "opponentScore",
        mr.recorded_at    AS date,
        mr.season_number  AS "seasonNumber",
        p.id   AS "playerId",   p.name AS "playerName",
        pt.name AS "playerTeam",
        opp.id AS "opponentId", opp.name AS "opponentName",
        ot.name AS "opponentTeam"
      FROM match_records mr
      JOIN players p   ON mr.player_id   = p.id
      JOIN players opp ON mr.opponent_id = opp.id
      LEFT JOIN teams pt ON p.team_id   = pt.id
      LEFT JOIN teams ot ON opp.team_id = ot.id
      WHERE mr.season_number = $1
      ORDER BY mr.recorded_at DESC, mr.id DESC
    `, [req.params.season])
    res.json(result.rows)
  } catch (err) { next(err) }
})

// GET /api/records — admin only
router.get("/", authenticate, adminOnly, async (req, res, next) => {
  try {
    const result = await query(`
      SELECT
        mr.id,
        mr.result,
        mr.match_type     AS "matchType",
        mr.opponent_grade AS "opponentGrade",
        mr.player_score   AS "playerScore",
        mr.opponent_score AS "opponentScore",
        mr.recorded_at    AS date,
        p.id              AS "playerId",
        p.name            AS "playerName",
        opp.id            AS "opponentId",
        opp.name          AS "opponentName"
      FROM match_records mr
      JOIN players p   ON mr.player_id   = p.id
      JOIN players opp ON mr.opponent_id = opp.id
      ORDER BY mr.recorded_at DESC, mr.id DESC
    `)
    res.json(result.rows)
  } catch (err) { next(err) }
})

// GET /api/records/fixture/:fixtureId — team owner fetches already-logged results for a fixture
router.get("/fixture/:fixtureId", authenticate, async (req, res, next) => {
  try {
    const result = await query(`
      SELECT
        mr.id,
        mr.result,
        mr.player_score   AS "playerScore",
        mr.opponent_score AS "opponentScore",
        mr.recorded_at    AS date,
        p.id              AS "playerId",
        p.name            AS "playerName",
        p.team_id         AS "playerTeamId",
        opp.id            AS "opponentId",
        opp.name          AS "opponentName",
        opp.team_id       AS "opponentTeamId"
      FROM match_records mr
      JOIN players p   ON mr.player_id   = p.id
      JOIN players opp ON mr.opponent_id = opp.id
      JOIN fixtures f  ON f.id = $1
      WHERE mr.match_type = 'league'
        AND p.team_id   IN (f.home_team_id, f.away_team_id)
        AND opp.team_id IN (f.home_team_id, f.away_team_id)
        AND mr.recorded_at::date >= f.scheduled_date::date
      ORDER BY mr.recorded_at DESC, mr.id DESC
    `, [req.params.fixtureId])
    res.json(result.rows)
  } catch (err) { next(err) }
})

const createSchema = z.object({
  playerId:      z.number().int().positive(),
  opponentId:    z.number().int().positive(),
  result:        z.enum(["win", "draw", "loss"]),
  matchType:     z.enum(["league", "ucl", "weekly"]).default("league"),
  playerScore:   z.number().int().min(0).optional(),
  opponentScore: z.number().int().min(0).optional(),
  date:          z.string().optional(),
})

// POST /api/records/team — team owner logs a Team League result
router.post("/team", authenticate, async (req, res, next) => {
  try {
    if (!req.user.teamId) {
      return res.status(403).json({ error: "No team associated with your account" })
    }

    const { playerId, opponentId, result, playerScore, opponentScore, fixtureId } = z.object({
      playerId:      z.number().int().positive(),
      opponentId:    z.number().int().positive(),
      result:        z.enum(["win", "draw", "loss"]),
      playerScore:   z.number().int().min(0).optional(),
      opponentScore: z.number().int().min(0).optional(),
      fixtureId:     z.number().int().positive(),
    }).parse(req.body)

    if (playerId === opponentId) {
      return res.status(400).json({ error: "Player cannot play against themselves" })
    }

    // Verify player belongs to logged-in user's team
    const playerCheck = await query("SELECT team_id FROM players WHERE id = $1", [playerId])
    if (!playerCheck.rows[0]) return res.status(404).json({ error: "Player not found" })
    if (playerCheck.rows[0].team_id !== req.user.teamId) {
      return res.status(403).json({ error: "You can only log results for your own team's players" })
    }

    // Verify fixture involves this team and is still upcoming
    const fixRes = await query("SELECT home_team_id, away_team_id, status FROM fixtures WHERE id = $1", [fixtureId])
    if (!fixRes.rows[0]) return res.status(404).json({ error: "Fixture not found" })
    const fix = fixRes.rows[0]
    if (fix.status !== "upcoming") {
      return res.status(400).json({ error: "Results can only be logged for upcoming fixtures" })
    }
    const isInvolved = fix.home_team_id === req.user.teamId || fix.away_team_id === req.user.teamId
    if (!isInvolved) {
      return res.status(403).json({ error: "Your team is not part of this fixture" })
    }

    // Verify opponent belongs to the other team in this fixture
    const oppTeamId = fix.home_team_id === req.user.teamId ? fix.away_team_id : fix.home_team_id
    const oppCheck = await query("SELECT team_id, grade FROM players WHERE id = $1", [opponentId])
    if (!oppCheck.rows[0]) return res.status(404).json({ error: "Opponent not found" })
    if (oppCheck.rows[0].team_id !== oppTeamId) {
      return res.status(403).json({ error: "Opponent must be from the opposing team in this fixture" })
    }

    const seasonNumber = await getCurrentSeason()
    const ins = await query(`
      INSERT INTO match_records
        (player_id, opponent_id, result, opponent_grade, match_type, player_score, opponent_score, recorded_at, recorded_by, season_number)
      VALUES ($1,$2,$3,$4,'league',$5,$6,$7,$8,$9)
      RETURNING *
    `, [
      playerId, opponentId, result, oppCheck.rows[0].grade,
      playerScore ?? null, opponentScore ?? null,
      new Date().toISOString().slice(0, 10),
      req.user.id, seasonNumber,
    ])

    const letter    = result === "win" ? "W" : result === "draw" ? "D" : "L"
    const oppLetter = result === "win" ? "L" : result === "loss" ? "W" : "D"
    await query(`UPDATE players SET form = (SELECT ARRAY(SELECT unnest(ARRAY[$1::char(1)] || form) LIMIT 5)) WHERE id = $2`, [letter, playerId])
    await query(`UPDATE players SET form = (SELECT ARRAY(SELECT unnest(ARRAY[$1::char(1)] || form) LIMIT 5)) WHERE id = $2`, [oppLetter, opponentId])
    await recalcMarketValue(playerId)
    await recalcMarketValue(opponentId)

    const fresh = await query(
      `SELECT id, name, grade, market_value AS "marketValue", bdr_points AS "bdrPoints", form FROM players WHERE id = $1`,
      [playerId]
    )
    res.status(201).json({ record: ins.rows[0], player: fresh.rows[0] })
  } catch (err) { next(err) }
})

// POST /api/records — admin logs any result
router.post("/", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { playerId, opponentId, result, matchType, playerScore, opponentScore, date } =
      createSchema.parse(req.body)

    if (playerId === opponentId) {
      return res.status(400).json({ error: "Player cannot play against themselves" })
    }

    const oppRes = await query("SELECT grade FROM players WHERE id = $1", [opponentId])
    if (!oppRes.rows[0]) return res.status(404).json({ error: "Opponent not found" })
    const opponentGrade = oppRes.rows[0].grade

    const seasonNumber = await getCurrentSeason()
    const ins = await query(`
      INSERT INTO match_records
        (player_id, opponent_id, result, opponent_grade, match_type, player_score, opponent_score, recorded_at, recorded_by, season_number)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      playerId, opponentId, result, opponentGrade, matchType,
      playerScore ?? null, opponentScore ?? null,
      date || new Date().toISOString().slice(0, 10),
      req.user.id, seasonNumber,
    ])

    const letter = result === "win" ? "W" : result === "draw" ? "D" : "L"
    await query(`UPDATE players SET form = (SELECT ARRAY(SELECT unnest(ARRAY[$1::char(1)] || form) LIMIT 5)) WHERE id = $2`, [letter, playerId])

    const oppLetter = result === "win" ? "L" : result === "loss" ? "W" : "D"
    await query(`UPDATE players SET form = (SELECT ARRAY(SELECT unnest(ARRAY[$1::char(1)] || form) LIMIT 5)) WHERE id = $2`, [oppLetter, opponentId])

    await recalcMarketValue(playerId)
    await recalcMarketValue(opponentId)

    const fresh = await query(
      `SELECT id, name, grade, market_value AS "marketValue", bdr_points AS "bdrPoints", form FROM players WHERE id = $1`,
      [playerId]
    )

    res.status(201).json({
      record: { ...ins.rows[0], matchType, playerScore: playerScore ?? null, opponentScore: opponentScore ?? null },
      player: fresh.rows[0],
    })
  } catch (err) { next(err) }
})

// PATCH /api/records/:id — admin edits an existing match record
router.patch("/:id", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { result, playerScore, opponentScore } = z.object({
      result:        z.enum(["win", "draw", "loss"]),
      playerScore:   z.number().int().min(0).optional(),
      opponentScore: z.number().int().min(0).optional(),
    }).parse(req.body)

    // Fetch existing record to get player/opponent IDs
    const existing = await query(
      "SELECT player_id, opponent_id FROM match_records WHERE id = $1",
      [req.params.id]
    )
    if (!existing.rows[0]) return res.status(404).json({ error: "Record not found" })
    const { player_id: playerId, opponent_id: opponentId } = existing.rows[0]

    await query(`
      UPDATE match_records
      SET result = $1, player_score = $2, opponent_score = $3
      WHERE id = $4
    `, [result, playerScore ?? null, opponentScore ?? null, req.params.id])

    // Rebuild form and MV for both players since result may have changed
    const letter    = result === "win" ? "W" : result === "draw" ? "D" : "L"
    const oppLetter = result === "win" ? "L" : result === "loss" ? "W" : "D"
    await query(`UPDATE players SET form = (SELECT ARRAY(SELECT unnest(ARRAY[$1::char(1)] || form) LIMIT 5)) WHERE id = $2`, [letter, playerId])
    await query(`UPDATE players SET form = (SELECT ARRAY(SELECT unnest(ARRAY[$1::char(1)] || form) LIMIT 5)) WHERE id = $2`, [oppLetter, opponentId])
    await recalcMarketValue(playerId)
    await recalcMarketValue(opponentId)
    await recalcForm(playerId)
    await recalcForm(opponentId)

    const fresh = await query(
      `SELECT id, name, grade, market_value AS "marketValue", bdr_points AS "bdrPoints", form FROM players WHERE id = $1`,
      [playerId]
    )
    res.json({ updated: true, player: fresh.rows[0] })
  } catch (err) { next(err) }
})

// DELETE /api/records/:id — admin only
router.delete("/:id", authenticate, adminOnly, async (req, res, next) => {
  try {
    const mrId = req.params.id

    // This match_records row may be referenced by a UCL fixture, UCL
    // knockout match, or Weekly tournament match — Postgres blocks deleting
    // it while any of those still point to it via match_record_id. Reset
    // the referencing row back to "pending" (no score/winner) first, so the
    // delete succeeds and that fixture just goes back to awaiting a result,
    // the same state as using "Edit result" > clearing it would leave it in.
    await query(`UPDATE ucl_fixtures SET match_record_id = NULL, status = 'pending', player1_score = NULL, player2_score = NULL WHERE match_record_id = $1`, [mrId])
    await query(`UPDATE ucl_knockout_matches SET match_record_id = NULL, status = 'pending', winner_id = NULL, player1_score = NULL, player2_score = NULL WHERE match_record_id = $1`, [mrId])
    await query(`UPDATE weekly_tournament_matches SET match_record_id = NULL, status = 'pending', winner_id = NULL, player1_score = NULL, player2_score = NULL WHERE match_record_id = $1`, [mrId])

    const result = await query(
      "DELETE FROM match_records WHERE id = $1 RETURNING player_id, opponent_id",
      [mrId]
    )
    if (!result.rows[0]) return res.status(404).json({ error: "Record not found" })

    await recalcMarketValue(result.rows[0].player_id)
    await recalcMarketValue(result.rows[0].opponent_id)
    await recalcForm(result.rows[0].player_id)
    await recalcForm(result.rows[0].opponent_id)

    const fresh = await query(
      `SELECT id, market_value AS "marketValue" FROM players WHERE id = $1`,
      [result.rows[0].player_id]
    )
    res.json({ deleted: true, player: fresh.rows[0] })
  } catch (err) { next(err) }
})

export default router