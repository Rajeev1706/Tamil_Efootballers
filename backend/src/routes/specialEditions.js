import { Router } from "express"
import { query } from "../db/pool.js"
import { authenticate, adminOnly } from "../middleware/auth.js"

const router = Router()

// Ensure table exists on first use
async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS special_editions (
      id          SERIAL PRIMARY KEY,
      title       VARCHAR(200) NOT NULL,
      subtitle    TEXT,
      image_url   TEXT,
      sort_order  INT DEFAULT 0,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {})
}

// GET /api/special-editions — public
router.get("/", async (_req, res, next) => {
  try {
    await ensureTable()
    const result = await query(
      "SELECT * FROM special_editions ORDER BY sort_order ASC, id DESC"
    )
    res.json(result.rows)
  } catch (err) { next(err) }
})

// POST /api/special-editions — admin only
router.post("/", authenticate, adminOnly, async (req, res, next) => {
  try {
    await ensureTable()
    const { title, subtitle, imageUrl, sortOrder } = req.body
    if (!title?.trim()) return res.status(400).json({ error: "Title is required" })
    const result = await query(
      `INSERT INTO special_editions (title, subtitle, image_url, sort_order)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [title.trim(), subtitle?.trim() || null, imageUrl || null, sortOrder ?? 0]
    )
    res.status(201).json(result.rows[0])
  } catch (err) { next(err) }
})

// PATCH /api/special-editions/:id — admin only
router.patch("/:id", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { title, subtitle, imageUrl, sortOrder } = req.body
    const result = await query(
      `UPDATE special_editions
       SET title = COALESCE($1, title),
           subtitle = $2,
           image_url = COALESCE($3, image_url),
           sort_order = COALESCE($4, sort_order)
       WHERE id = $5 RETURNING *`,
      [title?.trim() || null, subtitle?.trim() || null, imageUrl || null, sortOrder ?? null, req.params.id]
    )
    if (!result.rows[0]) return res.status(404).json({ error: "Not found" })
    res.json(result.rows[0])
  } catch (err) { next(err) }
})

// DELETE /api/special-editions/:id — admin only
router.delete("/:id", authenticate, adminOnly, async (req, res, next) => {
  try {
    await query("DELETE FROM special_editions WHERE id = $1", [req.params.id])
    res.json({ deleted: true })
  } catch (err) { next(err) }
})

export default router