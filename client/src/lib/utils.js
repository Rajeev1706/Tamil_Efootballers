import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function roundTo5(n) {
  return Math.round(n / 5) * 5
}

export function formatMV(value) {
  return value.toLocaleString()
}

export function calcMV(record, bdrPoints = 0) {
  const WIN_W  = { S: 1.0,  A: 0.65, B: 0.49,  C: 0.39 }
  const DRAW_W = { S: 0.75, A: 0.50, B: 0.375, C: 0.30 }
  const LOSS_W = { S: -0.5, A: -0.7, B: -0.85, C: -1.0 }
  const grades = ["S", "A", "B", "C"]

  let ewRaw = 0
  grades.forEach((g) => {
    ewRaw += (record.wins?.[g]   || 0) * WIN_W[g]
    ewRaw += (record.draws?.[g]  || 0) * DRAW_W[g]
    ewRaw += (record.losses?.[g] || 0) * LOSS_W[g]
  })

  // EW clipped to [0, 14] — negative EW (net losses) clips to 0, never penalizes below base
  const ew     = Math.min(Math.max(ewRaw, 0), 14)
  const pp     = ew * 3
  const winPct = ew / 14

  // Match swing — max 264 at EW=14
  const matchSwing = Math.max(0, pp * 5 + winPct * 54)

  // BDR swing — max 36, only counts if player has actually played
  let bdrSwing = 0
  if (ewRaw > 0) {
    bdrSwing = (Math.min(bdrPoints, 120) / 120) * 36
  }

  // Fixed base of 50 PLUS swing — never subtracted below 50
  const mvRaw = 50 + matchSwing + bdrSwing
  return Math.max(50, roundTo5(mvRaw))
}

export function getMVTier(mv) {
  if (mv >= 320) return { label: "Elite",    color: "text-amber-400" }
  if (mv >= 270) return { label: "Top",      color: "text-violet-400" }
  if (mv >= 210) return { label: "Strong",   color: "text-blue-400" }
  if (mv >= 150) return { label: "Mid",      color: "text-slate-300" }
  if (mv >= 90)  return { label: "Low-mid",  color: "text-slate-400" }
  return             { label: "Weak",        color: "text-slate-500" }
}