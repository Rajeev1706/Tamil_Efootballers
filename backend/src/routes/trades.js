import { Router } from "express"
import { z } from "zod"
import { query, withTransaction } from "../db/pool.js"
import { authenticate, adminOnly } from "../middleware/auth.js"

const router = Router()

const TRADE_SELECT = `
  SELECT
    tr.id,
    tr.status,
    tr.trade_type      AS "tradeType",
    tr.offered_amount   AS "offeredAmount",
    tr.rejection_reason AS "rejectionReason",
    tr.created_at        AS "requestedOn",
    tr.team_resolved_at  AS "teamResolvedAt",
    tr.resolved_at        AS "resolvedAt",
    p.id    AS "playerId",
    p.name  AS "playerName",
    p.grade AS "playerGrade",
    p.market_value AS "playerMV",
    op.id    AS "offeredPlayerId",
    op.name  AS "offeredPlayerName",
    op.grade AS "offeredPlayerGrade",
    op.market_value AS "offeredPlayerMV",
    ft.id   AS "fromTeamId",
    ft.name AS "fromTeam",
    tt.id   AS "toTeamId",
    tt.name AS "toTeam"
  FROM trade_requests tr
  JOIN players p   ON tr.player_id         = p.id
  JOIN teams   ft  ON tr.from_team_id      = ft.id
  LEFT JOIN teams   tt ON tr.to_team_id    = tt.id
  LEFT JOIN players op ON tr.offered_player_id = op.id
`

// GET /api/trades  — all trades (admin) or trades for my team (owner)
router.get("/", authenticate, async (req, res, next) => {
  try {
    let sql = TRADE_SELECT
    const params = []
    const { status } = req.query

    if (req.user.role !== "admin" && req.user.teamId) {
      sql += ` WHERE (tr.from_team_id = $1 OR tr.to_team_id = $1)`
      params.push(req.user.teamId)
      if (status) {
        sql += ` AND tr.status = $2`
        params.push(status)
      }
    } else if (status) {
      sql += ` WHERE tr.status = $1`
      params.push(status)
    }

    sql += " ORDER BY tr.created_at DESC"
    const result = await query(sql, params)

    const myTeamId = req.user.teamId
    const rows = result.rows.map(r => ({
      ...r,
      direction: r.fromTeamId === myTeamId ? "sent" : "received",
    }))

    res.json(rows)
  } catch (err) { next(err) }
})

// POST /api/trades  — team owner requests a trade or signs a free agent
const createSchema = z.object({
  playerId:         z.number().int().positive(),     // target player wanted
  tradeType:         z.enum(["player_swap", "player_plus_amount", "full_amount", "signing"]),
  offeredPlayerId:   z.number().int().positive().optional(),
  offeredAmount:     z.number().int().min(0).optional(),
})

router.post("/", authenticate, async (req, res, next) => {
  try {
    if (!req.user.teamId) {
      return res.status(403).json({ error: "You are not associated with a team" })
    }
    const { playerId, tradeType, offeredPlayerId, offeredAmount } = createSchema.parse(req.body)
    const fromTeamId = req.user.teamId

    // Target player info
    const targetRes = await query(
      "SELECT id, team_id, name, market_value FROM players WHERE id = $1", [playerId]
    )
    if (!targetRes.rows[0]) return res.status(404).json({ error: "Player not found" })
    const target = targetRes.rows[0]

    // My team's purse = budget minus auction price of current squad
    const myTeamRes = await query(`
      SELECT t.budget - COALESCE((SELECT SUM(p.auction_price) FROM players p WHERE p.team_id = t.id), 0) AS purse
      FROM teams t WHERE t.id = $1
    `, [fromTeamId])
    const myBudget = myTeamRes.rows[0]?.purse ?? 0

    let toTeamId = null
    let finalAmount = offeredAmount ?? null
    let initialStatus = "pending_team"

    if (target.team_id) {
      // ─── Player belongs to another team ───
      if (target.team_id === fromTeamId) {
        return res.status(400).json({ error: "This player is already on your team" })
      }
      if (!["player_swap", "player_plus_amount", "full_amount"].includes(tradeType)) {
        return res.status(400).json({ error: "Invalid trade type for a player with a team" })
      }
      toTeamId = target.team_id

      if (tradeType === "player_swap") {
        if (!offeredPlayerId) return res.status(400).json({ error: "Select a player to offer in the swap" })
      }
      if (tradeType === "player_plus_amount") {
        if (!offeredPlayerId) return res.status(400).json({ error: "Select a player to offer" })
        if (!offeredAmount || offeredAmount <= 0) return res.status(400).json({ error: "Enter an amount to offer" })
      }
      if (tradeType === "full_amount") {
        if (!offeredAmount || offeredAmount < target.market_value) {
          return res.status(400).json({ error: `Amount must be at least the player's market value (${target.market_value})` })
        }
      }
      if (offeredPlayerId) {
        const opRes = await query("SELECT team_id FROM players WHERE id = $1", [offeredPlayerId])
        if (!opRes.rows[0] || opRes.rows[0].team_id !== fromTeamId) {
          return res.status(400).json({ error: "Offered player must belong to your team" })
        }
      }
      if (finalAmount && finalAmount > myBudget) {
        return res.status(400).json({ error: `Insufficient purse. Your remaining purse is ${myBudget}` })
      }

      // Duplicate pending check
      const dupRes = await query(`
        SELECT id FROM trade_requests
        WHERE player_id = $1 AND from_team_id = $2 AND status IN ('pending_team','pending_admin')
      `, [playerId, fromTeamId])
      if (dupRes.rows[0]) {
        return res.status(409).json({ error: "A pending request for this player already exists" })
      }
      initialStatus = "pending_team"

    } else {
      // ─── Free agent signing ───
      finalAmount = target.market_value
      if (finalAmount > myBudget) {
        return res.status(400).json({ error: `Insufficient purse. Signing requires ${finalAmount}, your purse is ${myBudget}` })
      }
      const dupRes = await query(`
        SELECT id FROM trade_requests
        WHERE player_id = $1 AND from_team_id = $2 AND status IN ('pending_team','pending_admin')
      `, [playerId, fromTeamId])
      if (dupRes.rows[0]) {
        return res.status(409).json({ error: "A pending signing request for this player already exists" })
      }
      initialStatus = "pending_admin" // skip team approval, no team to approve
    }

    const ins = await query(`
      INSERT INTO trade_requests
        (player_id, from_team_id, to_team_id, requested_by, trade_type, offered_player_id, offered_amount, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING id
    `, [playerId, fromTeamId, toTeamId, req.user.id, tradeType, offeredPlayerId ?? null, finalAmount, initialStatus])

    const fresh = await query(TRADE_SELECT + " WHERE tr.id = $1", [ins.rows[0].id])
    res.status(201).json({ ...fresh.rows[0], direction: "sent" })
  } catch (err) { next(err) }
})

// PATCH /api/trades/:id/team-review — target team owner accepts/rejects
const teamReviewSchema = z.object({
  action: z.enum(["accepted", "rejected"]),
  reason: z.string().max(300).optional(),
})

router.patch("/:id/team-review", authenticate, async (req, res, next) => {
  try {
    const { action, reason } = teamReviewSchema.parse(req.body)

    const tradeRes = await query(
      "SELECT * FROM trade_requests WHERE id = $1 AND status = 'pending_team'", [req.params.id]
    )
    if (!tradeRes.rows[0]) return res.status(404).json({ error: "Trade not found or already resolved" })
    const trade = tradeRes.rows[0]

    if (trade.to_team_id !== req.user.teamId) {
      return res.status(403).json({ error: "This request is not addressed to your team" })
    }

    const newStatus = action === "accepted" ? "pending_admin" : "rejected_by_team"

    await query(`
      UPDATE trade_requests
      SET status = $1, rejection_reason = $2, team_reviewed_by = $3, team_resolved_at = NOW()
      WHERE id = $4
    `, [newStatus, action === "rejected" ? (reason || null) : null, req.user.id, req.params.id])

    const fresh = await query(TRADE_SELECT + " WHERE tr.id = $1", [req.params.id])
    res.json(fresh.rows[0])
  } catch (err) { next(err) }
})

// PATCH /api/trades/:id/review — admin approves or rejects (final stage)
const reviewSchema = z.object({
  action: z.enum(["approved", "rejected"]),
})

router.patch("/:id/review", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { action } = reviewSchema.parse(req.body)

    const tradeRes = await query(
      "SELECT * FROM trade_requests WHERE id = $1 AND status = 'pending_admin'", [req.params.id]
    )
    if (!tradeRes.rows[0]) return res.status(404).json({ error: "Trade not found or not awaiting admin review" })
    const trade = tradeRes.rows[0]

    await withTransaction(async ({ query: q }) => {
      if (action === "approved") {
        // Move the target player to the requesting team
        await q("UPDATE players SET team_id = $1 WHERE id = $2", [trade.from_team_id, trade.player_id])

        if (trade.trade_type === "player_swap" || trade.trade_type === "player_plus_amount") {
          if (trade.offered_player_id) {
            await q("UPDATE players SET team_id = $1 WHERE id = $2", [trade.to_team_id, trade.offered_player_id])
          }
        }

        if (trade.offered_amount && trade.offered_amount > 0) {
          await q("UPDATE teams SET budget = budget - $1 WHERE id = $2", [trade.offered_amount, trade.from_team_id])
          if (trade.to_team_id) {
            await q("UPDATE teams SET budget = budget + $1 WHERE id = $2", [trade.offered_amount, trade.to_team_id])
          }
        }
      }

      await q(`
        UPDATE trade_requests
        SET status = $1, reviewed_by = $2, resolved_at = NOW()
        WHERE id = $3
      `, [action === "approved" ? "approved" : "rejected_by_admin", req.user.id, req.params.id])
    })

    const fresh = await query(TRADE_SELECT + " WHERE tr.id = $1", [req.params.id])
    res.json(fresh.rows[0])
  } catch (err) { next(err) }
})

// PATCH /api/trades/:id/cancel — requester withdraws their own pending request
router.patch("/:id/cancel", authenticate, async (req, res, next) => {
  try {
    const result = await query(`
      UPDATE trade_requests SET status = 'cancelled', resolved_at = NOW()
      WHERE id = $1 AND from_team_id = $2 AND status IN ('pending_team','pending_admin')
      RETURNING id
    `, [req.params.id, req.user.teamId])
    if (!result.rows[0]) return res.status(404).json({ error: "Trade not found or cannot be cancelled" })
    res.json({ cancelled: true })
  } catch (err) { next(err) }
})

export default router