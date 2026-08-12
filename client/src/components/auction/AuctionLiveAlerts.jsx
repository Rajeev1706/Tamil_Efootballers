/**
 * AuctionLiveAlerts
 * Two live intelligence components for team captains during auction:
 *
 * 1. GradeScarcityCounter — live count of remaining players per grade.
 *    Goes amber when ≤ 3 of a grade remain, red when ≤ 1.
 *
 * 2. BestRemainingAlert — flash toast when the highest-MV player in the
 *    pool changes (i.e. the previous top player just got sold). Tells the
 *    captain who the new king of the pool is.
 */
import { useState, useEffect, useRef } from "react"
import { TrendingUp, X } from "lucide-react"
import { cn } from "../../lib/utils"

// ── Grade Scarcity Counter ─────────────────────────────────────────────────

const GRADE_ORDER  = ["S", "A+", "A", "B", "C"]
const GRADE_COLORS = {
  S:  "text-gold  border-gold/30  bg-gold/10",
  "A+": "text-purple-300 border-purple-300/30 bg-purple-300/10",
  A:  "text-blue-300 border-blue-300/30 bg-blue-300/10",
  B:  "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
  C:  "text-slate-400 border-slate-400/30 bg-slate-400/10",
}

export function GradeScarcityCounter({ pool = [] }) {
  const pending = pool.filter(p => p.status === "pending")

  // Count by grade
  const counts = GRADE_ORDER.reduce((acc, g) => {
    acc[g] = pending.filter(p => p.grade === g).length
    return acc
  }, {})

  // Only show grades that ever had players
  const relevant = GRADE_ORDER.filter(g =>
    pool.some(p => p.grade === g)
  )

  if (!pending.length) return null

  return (
    <div className="card px-4 py-3">
      <div className="flex items-center gap-2 mb-2.5">
        <TrendingUp className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Grade Scarcity</span>
        <span className="ml-auto text-xs text-slate-600">{pending.length} players left</span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {relevant.map(grade => {
          const count   = counts[grade] ?? 0
          const isCrit  = count <= 1
          const isWarn  = count <= 3 && count > 1
          const isEmpty = count === 0

          return (
            <div
              key={grade}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all",
                isEmpty
                  ? "opacity-30 border-slate-700 bg-pitch-900 text-slate-600"
                  : isCrit
                    ? "border-rose-400/40 bg-rose-400/10 text-rose-400 animate-pulse"
                    : isWarn
                      ? "border-amber-400/40 bg-amber-400/10 text-amber-400"
                      : GRADE_COLORS[grade] ?? GRADE_COLORS.C
              )}
            >
              <span>{grade}</span>
              <span className={cn(
                "font-mono text-base leading-none",
                isCrit && !isEmpty ? "text-rose-400" : ""
              )}>
                {count}
              </span>
              {isCrit && !isEmpty && (
                <span className="text-[9px] font-bold text-rose-400 uppercase tracking-wide">LAST!</span>
              )}
              {isEmpty && <span className="text-[9px] text-slate-600">Gone</span>}
            </div>
          )
        })}
      </div>

      {/* Warning when S-grade almost gone */}
      {(counts["S"] ?? 0) <= 2 && (counts["S"] ?? 0) > 0 && (
        <p className="text-xs text-rose-400 mt-2 font-semibold">
          ⚠️ Only {counts["S"]} S-grade player{counts["S"] !== 1 ? "s" : ""} remaining — if you need one, act now.
        </p>
      )}
      {(counts["S"] ?? 0) === 0 && pool.some(p => p.grade === "S") && (
        <p className="text-xs text-slate-500 mt-2">All S-grade players have been sold.</p>
      )}
    </div>
  )
}

// ── Best Remaining Player Alert ────────────────────────────────────────────

function getTopPlayer(pool) {
  const pending = pool.filter(p => p.status === "pending")
  if (!pending.length) return null
  return pending.reduce((best, p) =>
    (p.marketValue ?? 0) > (best.marketValue ?? 0) ? p : best
  , pending[0])
}

export function BestRemainingAlert({ pool = [] }) {
  const [alert, setAlert]           = useState(null)  // { name, grade, marketValue }
  const [visible, setVisible]       = useState(false)
  const prevTopRef                  = useRef(null)
  const dismissTimer                = useRef(null)

  useEffect(() => {
    const top = getTopPlayer(pool)
    const prev = prevTopRef.current

    // On first mount just set the ref, don't show an alert
    if (!prev) {
      prevTopRef.current = top
      return
    }

    // Top player changed — the previous top must have been sold
    if (top && prev && top.playerId !== prev.playerId) {
      setAlert(top)
      setVisible(true)

      // Auto-dismiss after 6 seconds
      clearTimeout(dismissTimer.current)
      dismissTimer.current = setTimeout(() => setVisible(false), 6000)
    }

    prevTopRef.current = top

    return () => clearTimeout(dismissTimer.current)
  }, [pool.filter(p => p.status === "pending").map(p => p.playerId).join(",")])

  if (!visible || !alert) return null

  return (
    <div className={cn(
      "card px-4 py-3 border-accent/30 bg-accent/5",
      "animate-in slide-in-from-top-2 duration-300"
    )}>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center flex-shrink-0">
          <TrendingUp className="w-4 h-4 text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-accent uppercase tracking-wide mb-0.5">
            New Top Player Available
          </p>
          <p className="text-sm font-semibold text-white">
            {alert.name}
            <span className="ml-2 text-xs font-normal text-slate-400">
              Grade {alert.grade} · MV ₹{alert.marketValue ?? "?"}
            </span>
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            The previous top player was just sold — this is now the highest-value player remaining.
          </p>
        </div>
        <button
          onClick={() => { setVisible(false); clearTimeout(dismissTimer.current) }}
          className="text-slate-600 hover:text-white transition-colors flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}