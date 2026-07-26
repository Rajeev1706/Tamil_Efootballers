import { useState, useEffect } from "react"
import { BarChart3, TrendingUp, Shield, Flame, Crosshair, Trophy, Zap, Target } from "lucide-react"
import { usePlayerPercentiles } from "../../lib/queries"
import { cn } from "../../lib/utils"

// ── Stat config ──────────────────────────────────────────────────────────────
const STAT_CONFIG = {
  winRate:       { label: "Win Rate",        icon: TrendingUp, description: "Overall match win percentage" },
  consistency:   { label: "Consistency",     icon: Shield,     description: "How stable results are (low variance)" },
  clutch:        { label: "Clutch",          icon: Crosshair,  description: "Win rate in UCL & Weekly tournaments" },
  giantKilling:  { label: "Giant Killing",   icon: Flame,      description: "Win rate vs toughest opponents" },
  form:          { label: "Current Form",    icon: Zap,        description: "Weighted score of last 5 matches" },
  lossAvoidance: { label: "Loss Avoidance",  icon: Shield,     description: "How hard this player is to beat" },
  trophies:      { label: "Trophy Haul",     icon: Trophy,     description: "Total trophies won across all types" },
  valueGrowth:   { label: "Value Growth",    icon: Target,     description: "Market value ROI since auction" },
}

// ── Color tier (no labels, just colors) ──────────────────────────────────────
function getTier(pct) {
  if (pct === null || pct === undefined) return { color: "text-slate-500", bg: "bg-slate-500/20", bar: "bg-slate-600", border: "border-slate-600/30" }
  if (pct >= 90) return { color: "text-gold",        bg: "bg-gold/10",        bar: "bg-gradient-to-r from-amber-500 to-gold", border: "border-gold/30" }
  if (pct >= 75) return { color: "text-emerald-400", bg: "bg-emerald-400/10", bar: "bg-gradient-to-r from-emerald-600 to-emerald-400", border: "border-emerald-400/30" }
  if (pct >= 50) return { color: "text-sky-400",     bg: "bg-sky-400/10",     bar: "bg-gradient-to-r from-sky-600 to-sky-400", border: "border-sky-400/30" }
  if (pct >= 25) return { color: "text-amber-400",   bg: "bg-amber-400/10",   bar: "bg-gradient-to-r from-amber-600 to-amber-400", border: "border-amber-400/30" }
  return               { color: "text-rose-400",    bg: "bg-rose-400/10",    bar: "bg-gradient-to-r from-rose-600 to-rose-400", border: "border-rose-400/30" }
}

function formatRaw(stat, value) {
  if (value === null || value === undefined) return "—"
  if (stat === "trophies") return String(Math.round(value))
  if (stat === "valueGrowth") return `${value >= 0 ? "+" : ""}${Math.round(value * 100)}%`
  return `${Math.round(value * 100)}%`
}

// ── Animated bar ─────────────────────────────────────────────────────────────
function PercentileBar({ stat, percentile, rawValue, delay = 0 }) {
  const [width, setWidth] = useState(0)
  const config = STAT_CONFIG[stat]
  const tier = getTier(percentile)
  const Icon = config?.icon || BarChart3

  useEffect(() => {
    const t = setTimeout(() => setWidth(percentile ?? 0), 100 + delay)
    return () => clearTimeout(t)
  }, [percentile, delay])

  const isNull = percentile === null || percentile === undefined

  return (
    <div className="group">
      {/* Label row */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={cn("w-3.5 h-3.5 flex-shrink-0", tier.color)} />
          <span className="text-sm font-medium text-slate-300 truncate">{config?.label || stat}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-slate-500 font-mono">{formatRaw(stat, rawValue)}</span>
          <span className={cn(
            "text-xs font-bold px-1.5 py-0.5 rounded border",
            tier.bg, tier.color, tier.border,
          )}>
            {isNull ? "N/A" : `Top ${100 - percentile}%`}
          </span>
        </div>
      </div>

      {/* Bar */}
      <div className="relative h-2.5 rounded-full bg-pitch-800 border border-surface-border overflow-hidden">
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out", tier.bar)}
          style={{ width: `${width}%` }}
        />
      </div>

      {/* Tooltip on hover */}
      <p className="text-xs text-slate-600 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {config?.description}
      </p>
    </div>
  )
}

// ── Positive headline generator ──────────────────────────────────────────────
function generateHeadline(best, worst, percentiles) {
  if (!best) return null

  const bestLabel = STAT_CONFIG[best.stat]?.label || best.stat
  const bestPct = 100 - best.percentile

  // Count how many stats are in Top 25%
  const strongStats = Object.entries(percentiles)
    .filter(([, v]) => v !== null && v >= 75)
    .map(([k]) => STAT_CONFIG[k]?.label || k)

  // Build a positive message highlighting strengths
  if (strongStats.length >= 4) {
    return (
      <span>
        An all-round powerhouse — dominant across <strong className="text-emerald-400">{strongStats.length} categories</strong>
      </span>
    )
  }

  if (strongStats.length >= 2) {
    return (
      <span>
        Strongest in <strong className="text-emerald-400">{bestLabel}</strong> (Top {bestPct}%), with {strongStats.length} standout stats
      </span>
    )
  }

  if (bestPct <= 10) {
    return (
      <span>
        Elite-level <strong className="text-emerald-400">{bestLabel}</strong> — ranked in the Top {bestPct}%
      </span>
    )
  }

  if (bestPct <= 25) {
    return (
      <span>
        Excels in <strong className="text-emerald-400">{bestLabel}</strong> — Top {bestPct}% among all players
      </span>
    )
  }

  // Even for lower-rated players, find something positive
  if (bestPct <= 50) {
    return (
      <span>
        Shows real strength in <strong className="text-sky-400">{bestLabel}</strong> — Top {bestPct}%, with room to grow
      </span>
    )
  }

  return (
    <span>
      Best showing in <strong className="text-sky-400">{bestLabel}</strong> — a player on the rise with upside to unlock
    </span>
  )
}

// ── Overall rating ───────────────────────────────────────────────────────────
function OverallRating({ percentiles }) {
  const valid = Object.values(percentiles).filter(v => v !== null && v !== undefined)
  if (valid.length === 0) return null
  const avg = Math.max(Math.round(valid.reduce((a, b) => a + b, 0) / valid.length), 50)
  const tier = getTier(avg)

  return (
    <div className="flex flex-col items-center justify-center gap-1">
      <div className={cn(
        "relative w-20 h-20 rounded-2xl border-2 flex items-center justify-center",
        tier.bg, tier.border,
      )}>
        <span className={cn("text-2xl font-extrabold font-mono", tier.color)}>{avg}</span>
      </div>
      <p className="text-xs text-slate-500 mt-2">Overall Rating</p>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export default function PercentileDashboard({ playerId }) {
  const { data, isLoading, isError } = usePlayerPercentiles(playerId)

  if (isLoading) {
    return (
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-surface-border">
          <BarChart3 className="w-4 h-4 text-accent" />
          <h2 className="text-base font-semibold text-white">Percentile Rankings</h2>
        </div>
        <div className="p-5 flex items-center justify-center h-48">
          <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (isError || !data?.percentiles) {
    return (
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-surface-border">
          <BarChart3 className="w-4 h-4 text-accent" />
          <h2 className="text-base font-semibold text-white">Percentile Rankings</h2>
        </div>
        <div className="px-5 py-12 text-center text-slate-500 text-sm">
          Not enough match data to generate percentile rankings yet.
        </div>
      </div>
    )
  }

  const { percentiles, rawValues, totalPlayers, best, worst } = data
  const statOrder = ["winRate", "form", "clutch", "giantKilling", "consistency", "lossAvoidance", "trophies", "valueGrowth"]

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-accent" />
          <h2 className="text-base font-semibold text-white">Percentile Rankings</h2>
        </div>
        <span className="text-xs text-slate-500">vs {totalPlayers} players</span>
      </div>

      <div className="p-5">
        {/* Headline + Overall rating */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 mb-6 pb-5 border-b border-surface-border/50">
          <OverallRating percentiles={percentiles} />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-300 leading-relaxed">
              {generateHeadline(best, worst, percentiles)}
            </p>
          </div>
        </div>

        {/* Stat bars */}
        <div className="space-y-4">
          {statOrder.map((stat, i) => (
            <PercentileBar
              key={stat}
              stat={stat}
              percentile={percentiles[stat]}
              rawValue={rawValues[stat]}
              delay={i * 80}
            />
          ))}
        </div>
      </div>
    </div>
  )
}