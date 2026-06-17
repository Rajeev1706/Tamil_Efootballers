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

export function calcMV(record) {
  const WIN_W  = { S: 1.5,  A: 1.0,  B: 0.75,  C: 0.6 }
  const DRAW_W = { S: 0.75, A: 0.50, B: 0.375, C: 0.30 }
  const LOSS_W = { S: -0.5, A: -0.7, B: -0.85, C: -1.0 }
  const grades = ["S", "A", "B", "C"]

  let ewRaw = 0
  grades.forEach((g) => {
    ewRaw += (record.wins?.[g]   || 0) * WIN_W[g]
    ewRaw += (record.draws?.[g]  || 0) * DRAW_W[g]
    ewRaw += (record.losses?.[g] || 0) * LOSS_W[g]
  })

  const ew     = Math.min(ewRaw, 14)
  const pp     = ew * 3
  const winPct = Math.max(ew / 14, 0)
  const mvRaw  = pp * 5 + winPct * 140
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