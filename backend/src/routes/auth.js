import { Router } from "express"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { z } from "zod"
import { query } from "../db/pool.js"
import { authenticate } from "../middleware/auth.js"

const router = Router()

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
})

// POST /api/auth/login
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body)

    const result = await query(
      `SELECT u.*, t.name AS team_name
       FROM users u
       LEFT JOIN teams t ON u.team_id = t.id
       WHERE u.email = $1`,
      [email]
    )
    const user = result.rows[0]
    if (!user) return res.status(401).json({ error: "Invalid credentials" })

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) return res.status(401).json({ error: "Invalid credentials" })

    const token = jwt.sign(
      { id: user.id, role: user.role, teamId: user.team_id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    )

    res.json({
      token,
      user: {
        id:       user.id,
        username: user.username,
        email:    user.email,
        role:     user.role,
        teamId:   user.team_id,
        teamName: user.team_name,
      },
    })
  } catch (err) { next(err) }
})

// GET /api/auth/me — refresh user info from token
router.get("/me", authenticate, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT u.id, u.username, u.email, u.role, u.team_id, t.name AS team_name
       FROM users u
       LEFT JOIN teams t ON u.team_id = t.id
       WHERE u.id = $1`,
      [req.user.id]
    )
    const user = result.rows[0]
    if (!user) return res.status(404).json({ error: "User not found" })
    res.json({
      id: user.id, username: user.username, email: user.email,
      role: user.role, teamId: user.team_id, teamName: user.team_name,
    })
  } catch (err) { next(err) }
})

// POST /api/auth/change-password — captain changes their own password
const changePwdSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword:     z.string().min(6, "New password must be at least 6 characters"),
})

router.post("/change-password", authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = changePwdSchema.parse(req.body)

    const result = await query(
      "SELECT password_hash FROM users WHERE id = $1", [req.user.id]
    )
    const user = result.rows[0]
    if (!user) return res.status(404).json({ error: "User not found" })

    const valid = await bcrypt.compare(currentPassword, user.password_hash)
    if (!valid) return res.status(401).json({ error: "Current password is incorrect" })

    const hash = await bcrypt.hash(newPassword, 12)
    await query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, req.user.id])

    res.json({ success: true })
  } catch (err) { next(err) }
})

export default router