import { useState, useEffect, useRef } from "react"
import { X } from "lucide-react"
import { cn } from "../../lib/utils"

const GRADE_ORDER  = ["S", "A+", "A", "B", "C"]
const GRADE_COLORS = {
  S:    "text-gold border-gold/40 bg-gold/10",
  "A+": "text-purple-300 border-purple-300/30 bg-purple-300/10",
  A:    "text-blue-300 border-blue-300/30 bg-blue-300/10",
  B:    "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
  C:    "text-slate-400 border-slate-600 bg-pitch-800",
}

// ── Grade Scarcity Counter — single compact row ───────────────────────────
export function GradeScarcityCounter({ pool = [] }) {
  const pending  = pool.filter(p => p.status === "pending")
  const relevant = GRADE_ORDER.filter(g => pool.some(p => p.grade === g))

  if (!pending.length) return null

  return (
    <div className="card px-3 py-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] text-slate-600 font-semibold uppercase tracking-wide flex-shrink-0">Left:</span>
        {relevant.map(grade => {
          const count  = pending.filter(p => p.grade === grade).length
          const isCrit = count <= 1 && count > 0
          const gone   = count === 0
          return (
            <span key={grade} className={cn(
              "text-xs font-bold px-2 py-0.5 rounded-lg border flex-shrink-0",
              gone   ? "opacity-30 text-slate-600 border-slate-700 bg-pitch-900" :
              isCrit ? "text-rose-400 border-rose-400/40 bg-rose-400/10 animate-pulse" :
                       GRADE_COLORS[grade]
            )}>
              {grade} {count}
            </span>
          )
        })}
        <span className="ml-auto text-[10px] text-slate-600 flex-shrink-0">{pending.length} total</span>
      </div>
    </div>
  )
}

// ── Best Remaining Alert — single line toast ──────────────────────────────
function getTopPlayer(pool) {
  const pending = pool.filter(p => p.status === "pending")
  if (!pending.length) return null
  return pending.reduce((best, p) =>
    (p.marketValue ?? 0) > (best.marketValue ?? 0) ? p : best
  , pending[0])
}

export function BestRemainingAlert({ pool = [] }) {
  const [alert, setAlert]   = useState(null)
  const [visible, setVisible] = useState(false)
  const prevTopRef          = useRef(null)
  const timer               = useRef(null)

  useEffect(() => {
    const top  = getTopPlayer(pool)
    const prev = prevTopRef.current
    if (!prev) { prevTopRef.current = top; return }
    if (top && prev && top.playerId !== prev.playerId) {
      setAlert(top)
      setVisible(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setVisible(false), 5000)
    }
    prevTopRef.current = top
    return () => clearTimeout(timer.current)
  }, [pool.filter(p => p.status === "pending").map(p => p.playerId).join(",")])

  if (!visible || !alert) return null

  return (
    <div className="card px-3 py-2 border-accent/30 bg-accent/5 flex items-center gap-2">
      <span className="text-[10px] font-bold text-accent uppercase flex-shrink-0">🔥 Top now:</span>
      <span className="text-sm font-bold text-white truncate">{alert.name}</span>
      <span className="text-xs text-slate-400 flex-shrink-0">{alert.grade} · ₹{alert.marketValue ?? "?"}</span>
      <button onClick={() => setVisible(false)} className="ml-auto text-slate-600 hover:text-white flex-shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}