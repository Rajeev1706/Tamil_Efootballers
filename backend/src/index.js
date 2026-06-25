import express from "express"
import cors from "cors"
import dotenv from "dotenv"
dotenv.config()

import authRoutes     from "./routes/auth.js"
import teamRoutes     from "./routes/teams.js"
import playerRoutes   from "./routes/players.js"
import recordRoutes   from "./routes/records.js"
import fixtureRoutes  from "./routes/fixtures.js"
import tradeRoutes    from "./routes/trades.js"
import lineupRoutes   from "./routes/lineup.js"
import favoriteRoutes from "./routes/favorites.js"
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

// Health check
app.get("/health", (_req, res) => res.json({ status: "ok", env: process.env.NODE_ENV }))

// One-off admin utility — recalculates market_value for ALL players using the
// full corrected JS formula (both sides + BDR). Hit once after deploying the
// marketValue.js fix to correct stale MVs. Admin auth required.
import { query } from "./db/pool.js"
import { recalcMarketValue } from "./services/marketValue.js"
import { authenticate, adminOnly } from "./middleware/auth.js"

app.post("/admin/recalc-mv", authenticate, adminOnly, async (req, res) => {
  try {
    const involved = await query(`
      SELECT DISTINCT id FROM players WHERE id IN (
        SELECT player_id   FROM match_records
        UNION
        SELECT opponent_id FROM match_records
      )
    `)
    const ids = involved.rows.map(r => r.id)
    // Run sequentially to avoid exhausting the connection pool
    for (const id of ids) {
      await recalcMarketValue(id)
    }
    res.json({ success: true, updated: ids.length, message: `Recalculated MV for ${ids.length} players` })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 404 handler
app.use((_req, res) => res.status(404).json({ error: "Route not found" }))

// Global error handler (must be last)
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`)
  console.log(`   Env: ${process.env.NODE_ENV || "development"}`)
  console.log(`   DB:  ${process.env.DATABASE_URL ? "connected" : "⚠️  DATABASE_URL not set"}`)
})