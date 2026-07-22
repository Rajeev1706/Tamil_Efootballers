import { Router } from "express"
import { z } from "zod"
import { query } from "../db/pool.js"
import { authenticate, adminOnly } from "../middleware/auth.js"
import { broadcastAuctionUpdate } from "../services/socket.js"

const router = Router()

const STARTING_BID = 25

async function getCurrentSeason() {
  const r = await query("SELECT value FROM app_settings WHERE key = 'current_season'")
  return parseInt(r.rows[0]?.value || "1")
}

// Fetches the full live auction state — shared by GET /current (for the
// initial page load / fallback polling) and the WebSocket broadcast that
// fires after every mutation, so both paths always return the identical
// shape and can never drift apart.
async function getFullAuctionState() {
  const sessionRes = await query(`
    SELECT
      s.id, s.season_number AS "seasonNumber", s.status, s.round,
      s.budget_per_team AS "budgetPerTeam",
      s.current_player_id AS "currentPlayerId",
      s.current_bid AS "currentBid",
      s.current_bidder_team_id AS "currentBidderTeamId",
      s.is_thunder AS "isThunder", s.thunder_from AS "thunderFrom", s.thunder_to AS "thunderTo",
      s.has_entered AS "hasEntered", s.version, s.timer_started_at AS "timerStartedAt",
           p.name AS "currentPlayerName", p.alias AS "currentPlayerAlias",
           p.grade AS "currentPlayerGrade", p.bdr_points AS "currentPlayerBdrPoints",
           p.market_value AS "currentPlayerMarketValue",
           ap.card_type AS "currentPlayerCardType", ap.prev_team_id AS "currentPlayerPrevTeamId",
           t.name AS "currentBidderTeamName"
    FROM auction_sessions s
    LEFT JOIN players p ON s.current_player_id = p.id
    LEFT JOIN auction_pool ap ON ap.session_id = s.id AND ap.player_id = s.current_player_id
    LEFT JOIN teams t ON s.current_bidder_team_id = t.id
    ORDER BY s.id DESC LIMIT 1
  `)
  const session = sessionRes.rows[0]
  if (!session) return { session: null }

  const poolRes = await query(`
    SELECT ap.id, ap.player_id AS "playerId", p.name, p.alias, p.grade,
           p.bdr_points AS "bdrPoints", p.market_value AS "marketValue",
           ap.card_type AS "cardType",
           ap.prev_team_id AS "prevTeamId", ap.status, ap.round_seen AS "roundSeen"
    FROM auction_pool ap JOIN players p ON ap.player_id = p.id
    WHERE ap.session_id = $1
    ORDER BY p.name
  `, [session.id])

  const salesRes = await query(`
    SELECT s.id, s.player_id AS "playerId", p.name AS "playerName",
           s.team_id AS "teamId", t.name AS "teamName", s.price, s.round, s.rtm_used AS "rtmUsed"
    FROM auction_sales s
    JOIN players p ON s.player_id = p.id
    JOIN teams t ON s.team_id = t.id
    WHERE s.session_id = $1
    ORDER BY s.sold_at DESC
  `, [session.id])

  const teamsRes = await query(`
    SELECT t.id, t.name, t.budget, t.logo_url AS "logoUrl",
      COALESCE(
        json_agg(json_build_object('id', p.id, 'name', p.name) ORDER BY p.name)
        FILTER (WHERE p.id IS NOT NULL),
        '[]'
      ) AS captains
    FROM teams t
    LEFT JOIN players p ON p.team_id = t.id AND p.is_captain = true
    GROUP BY t.id, t.name, t.budget, t.logo_url
    ORDER BY t.name
  `)

  const retentionsRes = await query(`
    SELECT r.id, r.team_id AS "teamId", r.player_id AS "playerId", p.name AS "playerName", r.price
    FROM auction_retentions r JOIN players p ON r.player_id = p.id
    WHERE r.session_id = $1
  `, [session.id])

  // Recent bid-by-bid history for whoever's currently up — this is what
  // lets every connected screen detect bidding wars/fightbacks/intruders
  // identically, since it's the same shared, persisted history rather
  // than each screen's own incomplete local memory.
  let recentBids = []
  if (session.currentPlayerId) {
    const bidLogRes = await query(`
      SELECT bl.id, bl.team_id AS "teamId", t.name AS "teamName", bl.amount, bl.created_at AS "createdAt"
      FROM auction_bid_log bl JOIN teams t ON bl.team_id = t.id
      WHERE bl.session_id = $1 AND bl.player_id = $2
      ORDER BY bl.created_at DESC LIMIT 10
    `, [session.id, session.currentPlayerId])
    recentBids = bidLogRes.rows.reverse() // oldest-first, easier to detect patterns in order
  }

  return { session, pool: poolRes.rows, sales: salesRes.rows, teams: teamsRes.rows, retentions: retentionsRes.rows, recentBids }
}

// GET /api/auction/current — used for the initial page load, and as a
// low-frequency safety-net poll in case a client's WebSocket connection
// ever silently drops. No auth required (public view needs it).
router.get("/current", async (req, res, next) => {
  try {
    res.json(await getFullAuctionState())
  } catch (err) { next(err) }
})

// POST /api/auction/start — creates a new session shell. Nothing is
// released yet — retention happens first, while everyone still shows
// their real current team.
router.post("/start", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { budgetPerTeam } = z.object({ budgetPerTeam: z.number().int().positive().default(1100) }).parse(req.body)
    const activeRes = await query("SELECT id FROM auction_sessions WHERE status != 'completed' LIMIT 1")
    if (activeRes.rows.length > 0) {
      return res.status(400).json({ error: "An auction is already in progress. Complete or delete it first." })
    }
    const season = await getCurrentSeason()
    const result = await query(
      "INSERT INTO auction_sessions (season_number, status, budget_per_team) VALUES ($1, 'retention', $2) RETURNING id",
      [season, budgetPerTeam]
    )
    res.json({ sessionId: result.rows[0].id })
    broadcastAuctionUpdate(getFullAuctionState)
  } catch (err) { next(err) }
})

// POST /api/auction/retain — retain a player for a team at a fixed price.
// Max 2 per team, enforced here.
router.post("/retain", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { sessionId, teamId, playerId, price } = z.object({
      sessionId: z.number().int(), teamId: z.number().int(),
      playerId: z.number().int(), price: z.number().int().min(0),
    }).parse(req.body)

    const countRes = await query("SELECT COUNT(*) FROM auction_retentions WHERE session_id=$1 AND team_id=$2", [sessionId, teamId])
    if (parseInt(countRes.rows[0].count) >= 2) {
      return res.status(400).json({ error: "This team has already retained the maximum of 2 players." })
    }

    await query(
      "INSERT INTO auction_retentions (session_id, team_id, player_id, price) VALUES ($1,$2,$3,$4)",
      [sessionId, teamId, playerId, price]
    )
    await query("UPDATE players SET auction_price = $1 WHERE id = $2", [price, playerId])
    res.json({ success: true })
    broadcastAuctionUpdate(getFullAuctionState)
  } catch (err) {
    if (err.code === "23505") return res.status(400).json({ error: "This player is already retained." })
    next(err)
  }
})

router.delete("/retain/:id", authenticate, adminOnly, async (req, res, next) => {
  try {
    await query("DELETE FROM auction_retentions WHERE id = $1", [req.params.id])
    res.json({ success: true })
    broadcastAuctionUpdate(getFullAuctionState)
  } catch (err) { next(err) }
})

const GRADE_TO_CARD = { S: "purple", A: "gold", B: "silver", C: "silver" }

// POST /api/auction/pool/add — admin explicitly adds ONE existing player
// to this session's auction pool. Card tier is derived automatically from
// their grade (S→Purple, A→Gold, B/C→Silver) — never manually tagged.
// Captures their CURRENT team as prevTeamId for RTM/narrative use later,
// but does NOT release them yet — that happens in bulk when the auction
// actually starts, so admins can freely add/remove players beforehand.
router.post("/pool/add", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { sessionId, playerId } = z.object({ sessionId: z.number().int(), playerId: z.number().int() }).parse(req.body)

    const sessionRes = await query("SELECT status FROM auction_sessions WHERE id=$1", [sessionId])
    if (sessionRes.rows[0]?.status !== "retention") {
      return res.status(400).json({ error: "Can't add players once the auction has started — only during setup." })
    }

    const playerRes = await query("SELECT team_id, grade, is_captain FROM players WHERE id = $1", [playerId])
    const player = playerRes.rows[0]
    if (!player) return res.status(404).json({ error: "Player not found" })
    if (player.is_captain) return res.status(400).json({ error: "Captains aren't auctioned." })

    const retainedRes = await query("SELECT 1 FROM auction_retentions WHERE session_id=$1 AND player_id=$2", [sessionId, playerId])
    if (retainedRes.rows.length > 0) return res.status(400).json({ error: "This player is already retained — can't also add them to the pool." })

    const cardType = GRADE_TO_CARD[player.grade] || "silver"
    await query(
      "INSERT INTO auction_pool (session_id, player_id, card_type, prev_team_id) VALUES ($1,$2,$3,$4)",
      [sessionId, playerId, cardType, player.team_id]
    )
    res.json({ success: true, cardType })
    broadcastAuctionUpdate(getFullAuctionState)
  } catch (err) {
    if (err.code === "23505") return res.status(400).json({ error: "This player is already in the pool." })
    next(err)
  }
})

// DELETE /api/auction/pool/:id — remove a player from the pool before the
// auction has actually started (undo an add). Only allowed during the
// retention/prep phase — once the auction has started, the pool is
// locked and can't be edited.
router.delete("/pool/:id", authenticate, adminOnly, async (req, res, next) => {
  try {
    const poolEntryRes = await query("SELECT session_id FROM auction_pool WHERE id=$1", [req.params.id])
    const sessionId = poolEntryRes.rows[0]?.session_id
    if (sessionId) {
      const sessionRes = await query("SELECT status FROM auction_sessions WHERE id=$1", [sessionId])
      if (sessionRes.rows[0]?.status !== "retention") {
        return res.status(400).json({ error: "Can't remove players once the auction has started — only during setup." })
      }
    }
    const result = await query("DELETE FROM auction_pool WHERE id=$1 AND status='pending' RETURNING id", [req.params.id])
    if (result.rows.length === 0) return res.status(400).json({ error: "Can't remove a player who's already been put up for bidding or sold." })
    res.json({ success: true })
    broadcastAuctionUpdate(getFullAuctionState)
  } catch (err) { next(err) }
})

// POST /api/auction/build-pool — finalizes whoever the admin has already
// explicitly added to the pool (via /pool/add) and genuinely releases
// them (team_id = NULL), moving the session to 'active' so bidding can
// begin. Does not add anyone new itself — that's /pool/add's job.
router.post("/build-pool", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { sessionId } = z.object({ sessionId: z.number().int() }).parse(req.body)

    const sessionRes = await query("SELECT * FROM auction_sessions WHERE id = $1", [sessionId])
    if (!sessionRes.rows[0]) return res.status(404).json({ error: "Session not found" })
    if (sessionRes.rows[0].status !== "retention") {
      return res.status(400).json({ error: "This auction has already been started." })
    }

    const poolCountRes = await query("SELECT COUNT(*) FROM auction_pool WHERE session_id = $1", [sessionId])
    if (parseInt(poolCountRes.rows[0].count) === 0) {
      return res.status(400).json({ error: "Add at least one player to the pool before starting." })
    }

    await query(
      `UPDATE players SET team_id = NULL, auction_price = 0
       WHERE id IN (SELECT player_id FROM auction_pool WHERE session_id = $1)`,
      [sessionId]
    )

    // Set every team's budget to the session's budget_per_team, then deduct
    // whatever they already spent on retained players. This is the authoritative
    // moment where the admin-set budget actually takes effect — it was stored
    // in auction_sessions but never applied to teams.budget until now.
    const session = sessionRes.rows[0]
    await query("UPDATE teams SET budget = $1", [session.budget_per_team])
    await query(`
      UPDATE teams t SET budget = budget - COALESCE((
        SELECT SUM(r.price) FROM auction_retentions r
        WHERE r.session_id = $1 AND r.team_id = t.id
      ), 0)
    `, [sessionId])

    await query("UPDATE auction_sessions SET status = 'active', version = version + 1 WHERE id = $1", [sessionId])

    res.json({ success: true, poolCount: parseInt(poolCountRes.rows[0].count) })
    broadcastAuctionUpdate(getFullAuctionState)
  } catch (err) { next(err) }
})

// POST /api/auction/next-player — puts a player up for bidding. If no
// playerId is given, randomly draws one from the pending pool — matching
// the original app's behavior exactly (admin never hand-picks who's next,
// clicking "Start Auction" just draws randomly each time). Resets the live
// bid state to the starting bid, no bidder yet. Also decides here (once,
// server-side) whether this reveal is a "thunder" upgrade — this involves
// randomness, so it must be decided in exactly one place and shared via
// GET /current, never re-rolled independently by each viewer's browser
// (which would show different effects to different people for the same
// player).
router.post("/next-player", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { sessionId, playerId: requestedPlayerId } = z.object({
      sessionId: z.number().int(),
      playerId: z.number().int().optional(),
    }).parse(req.body)

    let poolEntry
    if (requestedPlayerId != null) {
      const poolRes = await query("SELECT * FROM auction_pool WHERE session_id=$1 AND player_id=$2", [sessionId, requestedPlayerId])
      poolEntry = poolRes.rows[0]
    } else {
      const poolRes = await query(
        "SELECT * FROM auction_pool WHERE session_id=$1 AND status='pending' ORDER BY random() LIMIT 1",
        [sessionId]
      )
      poolEntry = poolRes.rows[0]
    }
    if (!poolEntry || poolEntry.status !== "pending") {
      return res.status(400).json({ error: "No player available to put up for bidding." })
    }
    const playerId = poolEntry.player_id

    const sessionRes = await query("SELECT * FROM auction_sessions WHERE id=$1", [sessionId])
    const session = sessionRes.rows[0]
    const newRevealIndex = session.reveal_total_index + 1

    const cardType = poolEntry.card_type
    const canThunder = cardType === "gold" || cardType === "purple"
    const isThunder =
      canThunder &&
      session.thunder_reveal_count < 4 &&
      newRevealIndex > 5 &&
      (newRevealIndex - session.last_thunder_reveal_index) > 5 &&
      Math.random() < 0.45

    let thunderFrom = null, thunderTo = null
    if (isThunder) {
      if (cardType === "gold") { thunderFrom = "silver"; thunderTo = "gold" }
      else { [thunderFrom, thunderTo] = Math.random() < 0.5 ? ["silver", "purple"] : ["gold", "purple"] }
    }

    await query(
      `UPDATE auction_sessions SET
         current_player_id=$1, current_bid=$2, current_bidder_team_id=NULL,
         reveal_total_index=$3,
         thunder_reveal_count = thunder_reveal_count + $4,
         last_thunder_reveal_index = CASE WHEN $4=1 THEN $3 ELSE last_thunder_reveal_index END,
         is_thunder=$5, thunder_from=$6, thunder_to=$7,
         timer_started_at = $8
      , version = version + 1 WHERE id=$9`,
      [playerId, STARTING_BID, newRevealIndex, isThunder ? 1 : 0, isThunder, thunderFrom, thunderTo, new Date(), sessionId]
    )
    res.json({ success: true, playerId })
    broadcastAuctionUpdate(getFullAuctionState)
  } catch (err) { next(err) }
})

// POST /api/auction/bid — a team places a bid on the current player.
router.post("/bid", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { sessionId, teamId, amount } = z.object({
      sessionId: z.number().int(), teamId: z.number().int(), amount: z.number().int().positive(),
    }).parse(req.body)

    const sessionRes = await query("SELECT current_bid, current_player_id FROM auction_sessions WHERE id=$1", [sessionId])
    const session = sessionRes.rows[0]
    if (!session?.current_player_id) return res.status(400).json({ error: "No player is currently up for bidding." })
    if (amount <= session.current_bid) return res.status(400).json({ error: `Bid must be higher than the current ₹${session.current_bid}.` })

    const teamRes = await query("SELECT budget FROM teams WHERE id=$1", [teamId])
    if (amount > teamRes.rows[0].budget) return res.status(400).json({ error: "This team doesn't have enough budget for that bid." })

    await query("UPDATE auction_sessions SET current_bid=$1, current_bidder_team_id=$2, timer_started_at = $3, version = version + 1 WHERE id=$4", [amount, teamId, new Date(), sessionId])
    await query(
      "INSERT INTO auction_bid_log (session_id, player_id, team_id, amount) VALUES ($1,$2,$3,$4)",
      [sessionId, session.current_player_id, teamId, amount]
    )
    res.json({ success: true })
    broadcastAuctionUpdate(getFullAuctionState)
  } catch (err) { next(err) }
})

// POST /api/auction/sell — finalizes the sale of the current player.
// Normally sells to the current highest bidder at the current bid — but
// RTM can change who actually wins and at what price (the previous team
// matching, or the original bidder raising their final offer), so both
// are optionally overridable. Immediately assigns the real player to the
// real team and deducts the real budget — live, not batched.
router.post("/sell", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { sessionId, rtmUsed, overrideTeamId, overridePrice } = z.object({
      sessionId: z.number().int(),
      rtmUsed: z.boolean().default(false),
      overrideTeamId: z.number().int().optional(),
      overridePrice: z.number().int().positive().optional(),
    }).parse(req.body)
    const sessionRes = await query("SELECT * FROM auction_sessions WHERE id=$1", [sessionId])
    const session = sessionRes.rows[0]
    if (!session?.current_player_id || !session.current_bidder_team_id) {
      return res.status(400).json({ error: "No active bid to sell." })
    }

    const finalTeamId = overrideTeamId ?? session.current_bidder_team_id
    const finalPrice  = overridePrice ?? session.current_bid

    const teamRes = await query("SELECT budget FROM teams WHERE id=$1", [finalTeamId])
    if (!teamRes.rows[0]) return res.status(400).json({ error: "Winning team not found." })
    if (finalPrice > teamRes.rows[0].budget) return res.status(400).json({ error: "That team doesn't have enough budget for this price." })

    await query(
      "INSERT INTO auction_sales (session_id, player_id, team_id, price, round, rtm_used) VALUES ($1,$2,$3,$4,$5,$6)",
      [sessionId, session.current_player_id, finalTeamId, finalPrice, session.round, rtmUsed]
    )
    await query("UPDATE auction_pool SET status='sold' WHERE session_id=$1 AND player_id=$2", [sessionId, session.current_player_id])
    await query("UPDATE players SET team_id=$1, auction_price=$2 WHERE id=$3", [finalTeamId, finalPrice, session.current_player_id])
    await query("UPDATE teams SET budget = budget - $1 WHERE id=$2", [finalPrice, finalTeamId])
    await query("UPDATE auction_sessions SET current_player_id=NULL, current_bid=NULL, current_bidder_team_id=NULL, version = version + 1 WHERE id=$1", [sessionId])

    res.json({ success: true })
    broadcastAuctionUpdate(getFullAuctionState)
  } catch (err) { next(err) }
})

// POST /api/auction/mark-unsold — no bids came in for the current player.
router.post("/mark-unsold", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { sessionId } = z.object({ sessionId: z.number().int() }).parse(req.body)
    const sessionRes = await query("SELECT current_player_id, round FROM auction_sessions WHERE id=$1", [sessionId])
    const session = sessionRes.rows[0]
    if (!session?.current_player_id) return res.status(400).json({ error: "No player is currently up." })

    const unsoldStatus = session.round === 1 ? "unsold_r1" : "unsold_r2"
    await query("UPDATE auction_pool SET status=$1 WHERE session_id=$2 AND player_id=$3", [unsoldStatus, sessionId, session.current_player_id])
    await query("UPDATE auction_sessions SET current_player_id=NULL, current_bid=NULL, current_bidder_team_id=NULL, version = version + 1 WHERE id=$1", [sessionId])

    res.json({ success: true })
    broadcastAuctionUpdate(getFullAuctionState)
  } catch (err) { next(err) }
})

// POST /api/auction/advance-round — carries round-1-unsold players into
// round 2 as fresh pending pool entries.
router.post("/advance-round", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { sessionId } = z.object({ sessionId: z.number().int() }).parse(req.body)
    const result = await query(
      "UPDATE auction_pool SET status='pending', round_seen=2 WHERE session_id=$1 AND status='unsold_r1' RETURNING id",
      [sessionId]
    )
    await query("UPDATE auction_sessions SET round=2, version = version + 1 WHERE id=$1", [sessionId])
    res.json({ success: true, playersCarriedOver: result.rows.length })
    broadcastAuctionUpdate(getFullAuctionState)
  } catch (err) { next(err) }
})

// POST /api/auction/complete — closes out the session.
router.post("/complete", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { sessionId } = z.object({ sessionId: z.number().int() }).parse(req.body)
    await query("UPDATE auction_sessions SET status='completed', completed_at=NOW(), version = version + 1 WHERE id=$1", [sessionId])
    res.json({ success: true })
    broadcastAuctionUpdate(getFullAuctionState)
  } catch (err) { next(err) }
})

// POST /api/auction/set-bidder — corrects who's currently marked as the
// leading bidder, WITHOUT changing the current bid amount (unlike a real
// bid, which must be higher than the current price). A correction tool
// for when the wrong team gets marked as leading by mistake.
router.post("/set-bidder", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { sessionId, teamId } = z.object({ sessionId: z.number().int(), teamId: z.number().int() }).parse(req.body)
    const sessionRes = await query("SELECT current_player_id FROM auction_sessions WHERE id=$1", [sessionId])
    if (!sessionRes.rows[0]?.current_player_id) return res.status(400).json({ error: "No player is currently up for bidding." })
    await query("UPDATE auction_sessions SET current_bidder_team_id=$1, version = version + 1 WHERE id=$2", [teamId, sessionId])
    res.json({ success: true })
    broadcastAuctionUpdate(getFullAuctionState)
  } catch (err) { next(err) }
})

// POST /api/auction/reduce-bid — decreases the current bid by ₹5, floored
// at the starting bid. A correction tool for a bid entered too high.
// POST /api/auction/extra-time — gives 30 more seconds on the shared
// countdown by shifting timer_started_at back 30s, since every screen
// computes its remaining time from that single timestamp now (not a
// local per-client counter). Purely dramatic, same as the timer itself.
router.post("/extra-time", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { sessionId } = z.object({ sessionId: z.number().int() }).parse(req.body)
    await query(
      "UPDATE auction_sessions SET timer_started_at = timer_started_at + INTERVAL '30 seconds', version = version + 1 WHERE id=$1",
      [sessionId]
    )
    res.json({ success: true })
    broadcastAuctionUpdate(getFullAuctionState)
  } catch (err) { next(err) }
})

router.post("/reduce-bid", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { sessionId } = z.object({ sessionId: z.number().int() }).parse(req.body)
    const sessionRes = await query("SELECT current_bid, current_player_id FROM auction_sessions WHERE id=$1", [sessionId])
    const session = sessionRes.rows[0]
    if (!session?.current_player_id) return res.status(400).json({ error: "No player is currently up for bidding." })
    if (session.current_bid <= STARTING_BID) return res.status(400).json({ error: `Can't go below the starting bid of ₹${STARTING_BID}.` })
    await query("UPDATE auction_sessions SET current_bid = current_bid - 5, version = version + 1 WHERE id=$1", [sessionId])
    res.json({ success: true })
    broadcastAuctionUpdate(getFullAuctionState)
  } catch (err) { next(err) }
})

// POST /api/auction/undo-last-sale — reverses the most recent sale for
// this session: refunds the team's budget, removes the player from their
// roster, and puts the player back up as the current player (pending
// again in the pool) so the admin can re-run the sale correctly.
router.post("/undo-last-sale", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { sessionId } = z.object({ sessionId: z.number().int() }).parse(req.body)
    const lastSaleRes = await query(
      "SELECT * FROM auction_sales WHERE session_id=$1 ORDER BY sold_at DESC LIMIT 1",
      [sessionId]
    )
    const lastSale = lastSaleRes.rows[0]
    if (!lastSale) return res.status(400).json({ error: "No sale to undo." })

    await query("UPDATE teams SET budget = budget + $1 WHERE id=$2", [lastSale.price, lastSale.team_id])
    await query("UPDATE players SET team_id=NULL, auction_price=0 WHERE id=$1", [lastSale.player_id])
    await query("UPDATE auction_pool SET status='pending' WHERE session_id=$1 AND player_id=$2", [sessionId, lastSale.player_id])
    await query("DELETE FROM auction_sales WHERE id=$1", [lastSale.id])
    await query("DELETE FROM auction_bid_log WHERE session_id=$1 AND player_id=$2", [sessionId, lastSale.player_id])

    // Always brings the undone player straight back up for bidding, even
    // if someone else was already up — by explicit request. Any bidding
    // in progress on that other player is discarded (they simply remain
    // in the pending pool and can be drawn again via "Start Auction").
    await query(
      "UPDATE auction_sessions SET current_player_id=$1, current_bid=$2, current_bidder_team_id=NULL, timer_started_at=$3, version = version + 1 WHERE id=$4",
      [lastSale.player_id, STARTING_BID, new Date(), sessionId]
    )

    res.json({ success: true, restoredAsCurrent: true })
    broadcastAuctionUpdate(getFullAuctionState, { skipReveal: true })
  } catch (err) { next(err) }
})

// DELETE /api/auction/:sessionId — abandons an auction entirely and lets
// a new one start. During retention this is a simple delete (nothing
// real has happened yet). Once live, it first REVERSES every sale
// recorded so far — refunding each team's spent budget and un-assigning
// every sold player — before deleting, so nothing is left corrupted
// (a team stuck with the wrong budget, a player stuck assigned to a
// deleted auction). Retentions/pool/sales all cascade-delete via schema.
router.delete("/:sessionId", authenticate, adminOnly, async (req, res, next) => {
  try {
    const sessionRes = await query("SELECT status FROM auction_sessions WHERE id=$1", [req.params.sessionId])
    if (!sessionRes.rows[0]) return res.status(404).json({ error: "Session not found" })

    if (sessionRes.rows[0].status === "active") {
      const salesRes = await query("SELECT * FROM auction_sales WHERE session_id=$1", [req.params.sessionId])
      for (const sale of salesRes.rows) {
        await query("UPDATE teams SET budget = budget + $1 WHERE id=$2", [sale.price, sale.team_id])
        await query("UPDATE players SET team_id=NULL, auction_price=0 WHERE id=$1", [sale.player_id])
      }
    }

    await query("DELETE FROM auction_sessions WHERE id=$1", [req.params.sessionId])
    res.json({ success: true })
    broadcastAuctionUpdate(getFullAuctionState)
  } catch (err) { next(err) }
})

// POST /api/auction/enter — marks that the admin has actually entered the
// live auction (clicked "Enter Auction"), as opposed to the raw 'active'
// status which flips true the moment the pool is built, before anyone's
// necessarily started running it. This is what the public dashboard
// banner actually watches, so it doesn't show "live now" during that gap.
router.post("/enter", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { sessionId } = z.object({ sessionId: z.number().int() }).parse(req.body)
    await query("UPDATE auction_sessions SET has_entered=true, version = version + 1 WHERE id=$1", [sessionId])
    res.json({ success: true })
    broadcastAuctionUpdate(getFullAuctionState)
  } catch (err) { next(err) }
})

// POST /api/auction/leave — the counterpart to /enter: flips has_entered
// back off when the admin explicitly navigates away from the auction
// page, so the public dashboard banner disappears the moment nobody's
// actually managing it anymore, rather than staying "live" indefinitely
// just because someone entered it once.
router.post("/leave", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { sessionId } = z.object({ sessionId: z.number().int() }).parse(req.body)
    await query("UPDATE auction_sessions SET has_entered=false, version = version + 1 WHERE id=$1", [sessionId])
    res.json({ success: true })
    broadcastAuctionUpdate(getFullAuctionState)
  } catch (err) { next(err) }
})

// POST /api/auction/bid/quick — the "+₹5" quick-bid button. Unlike /bid
// (which takes a specific target amount computed by the browser), this
// increments the price atomically on the server itself: "add ₹5 to
// whatever the real current price is, at the exact moment this request
// is processed." This makes it immune to network reordering — two rapid
// clicks sent in one order can still arrive at the server in a different
// order, and a client-computed target amount can end up too low by the
// time it's actually processed. An atomic server-side increment has no
// such problem, since each request just adds ₹5 to the true live price
// whenever it happens to run, regardless of arrival order.
router.post("/bid/quick", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { sessionId, teamId } = z.object({ sessionId: z.number().int(), teamId: z.number().int() }).parse(req.body)

    const result = await query(`
      UPDATE auction_sessions
      SET current_bid = current_bid + 5, current_bidder_team_id = $1, version = version + 1
      WHERE id = $2
        AND current_player_id IS NOT NULL
        AND (current_bid + 5) <= (SELECT budget FROM teams WHERE id = $1)
      RETURNING current_bid
    `, [teamId, sessionId])

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "Can't bid — no player up, or this team can't afford ₹5 more right now." })
    }

    await query(
      "INSERT INTO auction_bid_log (session_id, player_id, team_id, amount) SELECT $1, current_player_id, $2, $3 FROM auction_sessions WHERE id=$1",
      [sessionId, teamId, result.rows[0].current_bid]
    )

    res.json({ success: true, currentBid: result.rows[0].current_bid })
    broadcastAuctionUpdate(getFullAuctionState)
  } catch (err) { next(err) }
})

export default router