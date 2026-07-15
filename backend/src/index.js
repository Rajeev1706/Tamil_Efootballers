import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import { createServer } from "http"
import { Server as SocketIOServer } from "socket.io"
dotenv.config()

import authRoutes     from "./routes/auth.js"
import teamRoutes     from "./routes/teams.js"
import playerRoutes   from "./routes/players.js"
import recordRoutes   from "./routes/records.js"
import fixtureRoutes  from "./routes/fixtures.js"
import tradeRoutes    from "./routes/trades.js"
import lineupRoutes   from "./routes/lineup.js"
import favoriteRoutes from "./routes/favorites.js"
import uclRoutes      from "./routes/ucl.js"
import weeklyRoutes      from "./routes/weekly.js"
import uclKnockoutRoutes from "./routes/uclKnockout.js"
import auctionRoutes     from "./routes/auction.js"
import { setSocketServer } from "./services/socket.js"
import { errorHandler } from "./middleware/errorHandler.js"

const app  = express()
const PORT = process.env.PORT || 3001

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin:      process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true,
}))
app.use(express.json())

// Request logger (dev only)
if (process.env.NODE_ENV === "development") {
  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
    next()
  })
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth",     authRoutes)
app.use("/api/teams",    teamRoutes)
app.use("/api/players",  playerRoutes)
app.use("/api/records",  recordRoutes)
app.use("/api/fixtures", fixtureRoutes)
app.use("/api/trades",   tradeRoutes)
app.use("/api/lineups",  lineupRoutes)
app.use("/api/favorites", favoriteRoutes)
app.use("/api/ucl",    uclRoutes)
app.use("/api/weekly",       weeklyRoutes)
app.use("/api/ucl-knockout", uclKnockoutRoutes)
app.use("/api/auction",      auctionRoutes)

// GET /api/settings — public app settings (current season etc.)
app.get("/api/settings", async (_req, res) => {
  try {
    const result = await query("SELECT key, value FROM app_settings")
    const settings = Object.fromEntries(result.rows.map(r => [r.key, r.value]))
    res.json(settings)
  } catch (err) {
    res.json({ current_season: "6" })
  }
})

// PATCH /api/settings — admin updates settings
app.patch("/api/settings", authenticate, adminOnly, async (req, res) => {
  try {
    const { key, value } = req.body
    await query(
      "INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2",
      [key, String(value)]
    )
    res.json({ key, value })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// One-off admin utility — recalculates market_value for ALL players using the
// full corrected JS formula (both sides + BDR). Hit once after deploying the
// marketValue.js fix to correct stale MVs. Admin auth required.
import { query } from "./db/pool.js"
import { recalcMarketValue } from "./services/marketValue.js"
import { authenticate, adminOnly } from "./middleware/auth.js"

app.post("/admin/recalc-mv", authenticate, adminOnly, async (req, res) => {
  try {
    // Do everything in one SQL query to avoid connection pool exhaustion.
    // Computes MV for every player involved in a match using the correct
    // both-sides formula, then updates in bulk.
    await query(`
      UPDATE players p
      SET market_value = GREATEST(50, ROUND(computed.mv_raw / 5.0) * 5)
      FROM (
        SELECT
          pl.id,
          CASE
            WHEN COALESCE(SUM(
              CASE
                WHEN mr.player_id = pl.id THEN
                  CASE
                    WHEN mr.result = 'win'  AND mr.opponent_grade = 'S'  THEN 1.5
                    WHEN mr.result = 'win'  AND mr.opponent_grade = 'A+' THEN 1.2
                    WHEN mr.result = 'win'  AND mr.opponent_grade = 'A'  THEN 0.9
                    WHEN mr.result = 'win'  AND mr.opponent_grade = 'B'  THEN 0.7
                    WHEN mr.result = 'win'  AND mr.opponent_grade = 'C'  THEN 0.6
                    WHEN mr.result = 'draw' AND mr.opponent_grade = 'S'  THEN 0.75
                    WHEN mr.result = 'draw' AND mr.opponent_grade = 'A+' THEN 0.60
                    WHEN mr.result = 'draw' AND mr.opponent_grade = 'A'  THEN 0.45
                    WHEN mr.result = 'draw' AND mr.opponent_grade = 'B'  THEN 0.35
                    WHEN mr.result = 'draw' AND mr.opponent_grade = 'C'  THEN 0.30
                    WHEN mr.result = 'loss' AND mr.opponent_grade = 'S'  THEN -0.5
                    WHEN mr.result = 'loss' AND mr.opponent_grade = 'A+' THEN -0.6
                    WHEN mr.result = 'loss' AND mr.opponent_grade = 'A'  THEN -0.7
                    WHEN mr.result = 'loss' AND mr.opponent_grade = 'B'  THEN -0.8
                    WHEN mr.result = 'loss' AND mr.opponent_grade = 'C'  THEN -1.0
                    ELSE 0
                  END
                WHEN mr.opponent_id = pl.id THEN
                  CASE
                    WHEN mr.result = 'loss' AND pl2.grade = 'S'  THEN 1.5
                    WHEN mr.result = 'loss' AND pl2.grade = 'A+' THEN 1.2
                    WHEN mr.result = 'loss' AND pl2.grade = 'A'  THEN 0.9
                    WHEN mr.result = 'loss' AND pl2.grade = 'B'  THEN 0.7
                    WHEN mr.result = 'loss' AND pl2.grade = 'C'  THEN 0.6
                    WHEN mr.result = 'draw' AND pl2.grade = 'S'  THEN 0.75
                    WHEN mr.result = 'draw' AND pl2.grade = 'A+' THEN 0.60
                    WHEN mr.result = 'draw' AND pl2.grade = 'A'  THEN 0.45
                    WHEN mr.result = 'draw' AND pl2.grade = 'B'  THEN 0.35
                    WHEN mr.result = 'draw' AND pl2.grade = 'C'  THEN 0.30
                    WHEN mr.result = 'win'  AND pl2.grade = 'S'  THEN -0.5
                    WHEN mr.result = 'win'  AND pl2.grade = 'A+' THEN -0.6
                    WHEN mr.result = 'win'  AND pl2.grade = 'A'  THEN -0.7
                    WHEN mr.result = 'win'  AND pl2.grade = 'B'  THEN -0.8
                    WHEN mr.result = 'win'  AND pl2.grade = 'C'  THEN -1.0
                    ELSE 0
                  END
                ELSE 0
              END
            ), 0) > 0
            THEN
              LEAST(COALESCE(SUM(
                CASE
                  WHEN mr.player_id = pl.id THEN
                    CASE
                      WHEN mr.result = 'win'  AND mr.opponent_grade = 'S'  THEN 1.5
                      WHEN mr.result = 'win'  AND mr.opponent_grade = 'A+' THEN 1.2
                      WHEN mr.result = 'win'  AND mr.opponent_grade = 'A'  THEN 0.9
                      WHEN mr.result = 'win'  AND mr.opponent_grade = 'B'  THEN 0.7
                      WHEN mr.result = 'win'  AND mr.opponent_grade = 'C'  THEN 0.6
                      WHEN mr.result = 'draw' AND mr.opponent_grade = 'S'  THEN 0.75
                      WHEN mr.result = 'draw' AND mr.opponent_grade = 'A+' THEN 0.60
                      WHEN mr.result = 'draw' AND mr.opponent_grade = 'A'  THEN 0.45
                      WHEN mr.result = 'draw' AND mr.opponent_grade = 'B'  THEN 0.35
                      WHEN mr.result = 'draw' AND mr.opponent_grade = 'C'  THEN 0.30
                      WHEN mr.result = 'loss' AND mr.opponent_grade = 'S'  THEN -0.5
                      WHEN mr.result = 'loss' AND mr.opponent_grade = 'A+' THEN -0.6
                      WHEN mr.result = 'loss' AND mr.opponent_grade = 'A'  THEN -0.7
                      WHEN mr.result = 'loss' AND mr.opponent_grade = 'B'  THEN -0.8
                      WHEN mr.result = 'loss' AND mr.opponent_grade = 'C'  THEN -1.0
                      ELSE 0
                    END
                  WHEN mr.opponent_id = pl.id THEN
                    CASE
                      WHEN mr.result = 'loss' AND pl2.grade = 'S'  THEN 1.5
                      WHEN mr.result = 'loss' AND pl2.grade = 'A+' THEN 1.2
                      WHEN mr.result = 'loss' AND pl2.grade = 'A'  THEN 0.9
                      WHEN mr.result = 'loss' AND pl2.grade = 'B'  THEN 0.7
                      WHEN mr.result = 'loss' AND pl2.grade = 'C'  THEN 0.6
                      WHEN mr.result = 'draw' AND pl2.grade = 'S'  THEN 0.75
                      WHEN mr.result = 'draw' AND pl2.grade = 'A+' THEN 0.60
                      WHEN mr.result = 'draw' AND pl2.grade = 'A'  THEN 0.45
                      WHEN mr.result = 'draw' AND pl2.grade = 'B'  THEN 0.35
                      WHEN mr.result = 'draw' AND pl2.grade = 'C'  THEN 0.30
                      WHEN mr.result = 'win'  AND pl2.grade = 'S'  THEN -0.5
                      WHEN mr.result = 'win'  AND pl2.grade = 'A+' THEN -0.6
                      WHEN mr.result = 'win'  AND pl2.grade = 'A'  THEN -0.7
                      WHEN mr.result = 'win'  AND pl2.grade = 'B'  THEN -0.8
                      WHEN mr.result = 'win'  AND pl2.grade = 'C'  THEN -1.0
                      ELSE 0
                    END
                  ELSE 0
                END
              ), 0), 14) * 3 * 5
              + (LEAST(COALESCE(SUM(
                CASE
                  WHEN mr.player_id = pl.id THEN
                    CASE
                      WHEN mr.result = 'win'  AND mr.opponent_grade = 'S'  THEN 1.5
                      WHEN mr.result = 'win'  AND mr.opponent_grade = 'A'  THEN 0.9
                      WHEN mr.result = 'win'  AND mr.opponent_grade = 'B'  THEN 0.7
                      WHEN mr.result = 'win'  AND mr.opponent_grade = 'C'  THEN 0.6
                      WHEN mr.result = 'draw' AND mr.opponent_grade = 'S'  THEN 0.75
                      WHEN mr.result = 'draw' AND mr.opponent_grade = 'A'  THEN 0.45
                      WHEN mr.result = 'draw' AND mr.opponent_grade = 'B'  THEN 0.35
                      WHEN mr.result = 'draw' AND mr.opponent_grade = 'C'  THEN 0.30
                      WHEN mr.result = 'loss' AND mr.opponent_grade = 'S'  THEN -0.5
                      WHEN mr.result = 'loss' AND mr.opponent_grade = 'A'  THEN -0.7
                      WHEN mr.result = 'loss' AND mr.opponent_grade = 'B'  THEN -0.8
                      WHEN mr.result = 'loss' AND mr.opponent_grade = 'C'  THEN -1.0
                      ELSE 0
                    END
                  ELSE 0
                END
              ), 0), 14) / 14.0) * 85
            ELSE 50
          END AS mv_raw
        FROM players pl
        LEFT JOIN match_records mr ON mr.player_id = pl.id OR mr.opponent_id = pl.id
        LEFT JOIN players pl2 ON pl2.id = mr.player_id
        WHERE pl.id IN (
          SELECT player_id FROM match_records
          UNION
          SELECT opponent_id FROM match_records
        )
        GROUP BY pl.id
      ) AS computed
      WHERE p.id = computed.id
    `)

    const countRes = await query(`
      SELECT COUNT(DISTINCT id) AS cnt FROM (
        SELECT player_id AS id FROM match_records
        UNION
        SELECT opponent_id FROM match_records
      ) sub
    `)
    const updated = parseInt(countRes.rows[0].cnt)
    res.json({ success: true, updated, message: `Recalculated MV for ${updated} players` })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── League Info board (public read, admin write) ───────────────────────────
app.get("/api/league-info", async (_req, res) => {
  try {
    const result = await query("SELECT * FROM league_info ORDER BY sort_order ASC, id ASC")
    res.json(result.rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})
app.post("/api/league-info", authenticate, adminOnly, async (req, res) => {
  try {
    const { title, content, sortOrder } = req.body
    const result = await query(
      "INSERT INTO league_info (title, content, sort_order) VALUES ($1,$2,$3) RETURNING *",
      [title, content, sortOrder ?? 0]
    )
    res.status(201).json(result.rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})
app.patch("/api/league-info/:id", authenticate, adminOnly, async (req, res) => {
  try {
    const { title, content, sortOrder } = req.body
    const result = await query(
      "UPDATE league_info SET title=$1, content=$2, sort_order=$3 WHERE id=$4 RETURNING *",
      [title, content, sortOrder ?? 0, req.params.id]
    )
    res.json(result.rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})
app.delete("/api/league-info/:id", authenticate, adminOnly, async (req, res) => {
  try {
    await query("DELETE FROM league_info WHERE id=$1", [req.params.id])
    res.json({ deleted: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// 404 handler
app.use((_req, res) => res.status(404).json({ error: "Route not found" }))

// Global error handler (must be last)
app.use(errorHandler)

const httpServer = createServer(app)

// Socket.IO — used specifically for real-time auction sync (bids, sales,
// new players coming up) so every connected screen updates the instant
// something happens, instead of waiting on a polling interval. Same CORS
// origin as the REST API.
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  },
})
setSocketServer(io)
io.on("connection", (socket) => {
  if (process.env.NODE_ENV === "development") console.log(`[socket] client connected: ${socket.id}`)
})

httpServer.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`)
  console.log(`   Env: ${process.env.NODE_ENV || "development"}`)
  console.log(`   DB:  ${process.env.DATABASE_URL ? "connected" : "⚠️  DATABASE_URL not set"}`)
  console.log(`   WebSocket: ready`)
})