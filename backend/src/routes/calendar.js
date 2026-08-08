// backend/src/routes/calendar.js
import express from "express"
import { query } from "../db/pool.js"
import { authenticate, adminOnly } from "../middleware/auth.js"

const router = express.Router()

// ── Public ────────────────────────────────────────────────────────────────────

// GET /api/calendar?season=7&month=2026-08
router.get("/", async (req, res, next) => {
  try {
    const { season, month } = req.query
    let sql = `SELECT * FROM season_calendar WHERE 1=1`
    const params = []

    if (season) {
      params.push(season)
      sql += ` AND season_number = $${params.length}`
    }
    if (month) {
      // month = "2026-08" → filter by that month
      params.push(month + "-01")
      params.push(month + "-31")
      sql += ` AND event_date BETWEEN $${params.length - 1} AND $${params.length}`
    }

    sql += ` ORDER BY event_date ASC`
    const result = await query(sql, params)
    res.json(result.rows)
  } catch (err) { next(err) }
})

// GET /api/calendar/upcoming — next 5 events from today
router.get("/upcoming", async (req, res, next) => {
  try {
    const result = await query(`
      SELECT * FROM season_calendar
      WHERE event_date >= CURRENT_DATE
        AND status != 'cancelled'
      ORDER BY event_date ASC
      LIMIT 5
    `)
    res.json(result.rows)
  } catch (err) { next(err) }
})

// GET /api/calendar/seasons — distinct season numbers
router.get("/seasons", async (req, res, next) => {
  try {
    const result = await query(`
      SELECT DISTINCT season_number FROM season_calendar ORDER BY season_number DESC
    `)
    res.json(result.rows.map(r => r.season_number))
  } catch (err) { next(err) }
})

// ── Admin ─────────────────────────────────────────────────────────────────────

// POST /api/calendar — create event
router.post("/", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { seasonNumber, eventDate, tournament, roundLabel, notes, status } = req.body
    if (!seasonNumber || !eventDate || !tournament || !roundLabel) {
      return res.status(400).json({ error: "seasonNumber, eventDate, tournament, roundLabel are required" })
    }
    const result = await query(`
      INSERT INTO season_calendar (season_number, event_date, tournament, round_label, notes, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [seasonNumber, eventDate, tournament, roundLabel, notes || null, status || "upcoming"])
    res.status(201).json(result.rows[0])
  } catch (err) { next(err) }
})

// PUT /api/calendar/:id — update event
router.put("/:id", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { seasonNumber, eventDate, tournament, roundLabel, notes, status } = req.body
    const result = await query(`
      UPDATE season_calendar SET
        season_number = COALESCE($1, season_number),
        event_date    = COALESCE($2, event_date),
        tournament    = COALESCE($3, tournament),
        round_label   = COALESCE($4, round_label),
        notes         = $5,
        status        = COALESCE($6, status)
      WHERE id = $7
      RETURNING *
    `, [seasonNumber, eventDate, tournament, roundLabel, notes ?? null, status, req.params.id])
    if (!result.rows[0]) return res.status(404).json({ error: "Event not found" })
    res.json(result.rows[0])
  } catch (err) { next(err) }
})

// DELETE /api/calendar/:id
router.delete("/:id", authenticate, adminOnly, async (req, res, next) => {
  try {
    await query(`DELETE FROM season_calendar WHERE id = $1`, [req.params.id])
    res.json({ deleted: true })
  } catch (err) { next(err) }
})

export default router