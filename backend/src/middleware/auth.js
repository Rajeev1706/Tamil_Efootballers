import jwt from "jsonwebtoken"

export function authenticate(req, res, next) {
  const header = req.headers.authorization
             || req.headers["x-authorization"]
  const bodyToken = req.body?.token
  const raw = header?.startsWith("Bearer ") ? header.slice(7) : bodyToken
  if (!raw) {
    console.error("[auth] No token — headers:", JSON.stringify(req.headers))
    return res.status(401).json({ error: "No token provided" })
  }
  try {
    req.user = jwt.verify(raw, process.env.JWT_SECRET)
    next()
  } catch (e) {
    console.error("[auth] Token error:", e.message)
    return res.status(401).json({ error: "Invalid or expired token" })
  }
}

export function adminOnly(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" })
  }
  next()
}