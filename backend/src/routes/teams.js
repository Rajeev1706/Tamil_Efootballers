import { Router } from "express"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { query } from "../db/pool.js"
import { authenticate, adminOnly } from "../middleware/auth.js"

const router = Router()

// GET /api/teams/top-scorers — top 10 players by goals in team league
router.get("/top-scorers", async (req, res, next) => {
  try {
    const result = await query(`
      SELECT
        p.id,
        p.name,
        t.name AS team,
        COALESCE(SUM(mr.player_score), 0) AS goals
      FROM players p
      LEFT JOIN match_records mr
        ON mr.player_id = p.id
        AND mr.match_type = 'league'
        AND mr.player_score IS NOT NULL
      LEFT JOIN teams t ON p.team_id = t.id
      GROUP BY p.id, p.name, t.name
      ORDER BY goals DESC, p.name ASC
      LIMIT 10
    `)
    res.json(result.rows)
  } catch (err) { next(err) }
})

// GET /api/teams — public
router.get("/", async (req, res, next) => {
  try {
    const result = await query("SELECT * FROM league_standings ORDER BY position")
    res.json(result.rows)
  } catch (err) { next(err) }
})

// GET /api/teams/:id — single team with roster
router.get("/:id", authenticate, async (req, res, next) => {
  try {
    const teamRes = await query("SELECT * FROM league_standings WHERE id = $1", [req.params.id])
    if (!teamRes.rows[0]) return res.status(404).json({ error: "Team not found" })
    const playersRes = await query(
      `SELECT * FROM players_full WHERE "teamId" = $1 ORDER BY "bdrPoints" DESC`,
      [req.params.id]
    )
    res.json({ ...teamRes.rows[0], players: playersRes.rows })
  } catch (err) { next(err) }
})

// POST /api/teams — admin creates team + owner account
const createTeamSchema = z.object({
  name:          z.string().min(1),
  ownerUsername: z.string().min(2),
  ownerEmail:    z.string().email(),
  ownerPassword: z.string().min(6),
})

router.post("/", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { name, ownerUsername, ownerEmail, ownerPassword } = createTeamSchema.parse(req.body)
    const teamRes = await query(
      "INSERT INTO teams (name) VALUES ($1) RETURNING id, name", [name]
    )
    const team = teamRes.rows[0]
    const hash = await bcrypt.hash(ownerPassword, 12)
    await query(
      `INSERT INTO users (username, email, password_hash, role, team_id) VALUES ($1,$2,$3,'team_owner',$4)`,
      [ownerUsername, ownerEmail, hash, team.id]
    )
    res.status(201).json({ team, owner: { username: ownerUsername, email: ownerEmail } })
  } catch (err) { next(err) }
})

// PATCH /api/teams/:id — admin edits team name or stats
router.patch("/:id", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { name, played, won, drawn, lost, gf, ga } = req.body
    const result = await query(`
      UPDATE teams SET
        name   = COALESCE($1, name),
        played = COALESCE($2, played), won   = COALESCE($3, won),
        drawn  = COALESCE($4, drawn),  lost  = COALESCE($5, lost),
        gf     = COALESCE($6, gf),     ga    = COALESCE($7, ga)
      WHERE id = $8 RETURNING *
    `, [name ?? null, played, won, drawn, lost, gf, ga, req.params.id])
    if (!result.rows[0]) return res.status(404).json({ error: "Team not found" })
    res.json(result.rows[0])
  } catch (err) { next(err) }
})

// PATCH /api/teams/:id/settings — team owner (own team only) or admin updates name/logo
const settingsSchema = z.object({
  name:    z.string().min(1).optional(),
  logoUrl: z.string().url().optional().nullable(),
}).refine(d => d.name !== undefined || d.logoUrl !== undefined, {
  message: "Provide at least name or logoUrl",
})

router.patch("/:id/settings", authenticate, async (req, res, next) => {
  try {
    const targetId = parseInt(req.params.id)
    const isOwner  = req.user.role === "team_owner" && req.user.teamId === targetId
    const isAdmin  = req.user.role === "admin"
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Not authorized to edit this team" })
    }

    const { name, logoUrl } = settingsSchema.parse(req.body)
    const result = await query(`
      UPDATE teams SET
        name     = COALESCE($1, name),
        logo_url = COALESCE($2, logo_url)
      WHERE id = $3
      RETURNING id, name, logo_url AS "logoUrl"
    `, [name ?? null, logoUrl ?? null, targetId])

    if (!result.rows[0]) return res.status(404).json({ error: "Team not found" })
    res.json(result.rows[0])
  } catch (err) { next(err) }
})

// PATCH /api/teams/:id/password — admin resets the team owner's password
const changePasswordSchema = z.object({
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
})

router.patch("/:id/password", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { newPassword } = changePasswordSchema.parse(req.body)

    // Find the team_owner user linked to this team
    const userRes = await query(
      "SELECT id FROM users WHERE team_id = $1 AND role = 'team_owner'",
      [req.params.id]
    )
    if (!userRes.rows[0]) {
      return res.status(404).json({ error: "No team owner account found for this team" })
    }

    const hash = await bcrypt.hash(newPassword, 12)
    await query(
      "UPDATE users SET password_hash = $1 WHERE id = $2",
      [hash, userRes.rows[0].id]
    )

    res.json({ success: true })
  } catch (err) { next(err) }
})

// DELETE /api/teams/:id — admin deletes team
router.delete("/:id", authenticate, adminOnly, async (req, res, next) => {
  try {
    const result = await query(
      "DELETE FROM teams WHERE id = $1 RETURNING id, name", [req.params.id]
    )
    if (!result.rows[0]) return res.status(404).json({ error: "Team not found" })
    res.json({ deleted: true, team: result.rows[0] })
  } catch (err) { next(err) }
})

export default router