import { Router } from "express"
import { query } from "../db/pool.js"
import { authenticate } from "../middleware/auth.js"

const router = Router()

// GET /api/favorites — list current user's favorited player IDs
router.get("/", authenticate, async (req, res, next) => {
  try {
    const result = await query(
      "SELECT player_id AS \"playerId\" FROM favorites WHERE user_id = $1",
      [req.user.id]
    )
    res.json(result.rows.map(r => r.playerId))
  } catch (err) { next(err) }
})

// POST /api/favorites/:playerId — star a player
router.post("/:playerId", authenticate, async (req, res, next) => {
  try {
    await query(
      `INSERT INTO favorites (user_id, player_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, player_id) DO NOTHING`,
      [req.user.id, req.params.playerId]
    )
    res.status(201).json({ favorited: true })
  } catch (err) { next(err) }
})

// DELETE /api/favorites/:playerId — unstar a player
router.delete("/:playerId", authenticate, async (req, res, next) => {
  try {
    await query(
      "DELETE FROM favorites WHERE user_id = $1 AND player_id = $2",
      [req.user.id, req.params.playerId]
    )
    res.json({ favorited: false })
  } catch (err) { next(err) }
})

export default router