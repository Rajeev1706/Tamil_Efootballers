import { useState } from "react"
import { Crown, ChevronDown, ChevronUp } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { cn } from "../../lib/utils"
import { getAvatarById } from "../../lib/avatars"
import ballondorImg from "../../../images/ballondor.png"
import RankBadge from "../common/RankBadge"
import { useRankChanges } from "../../hooks/useRankChanges"
import api from "../../lib/api"

const FormDot = ({ result }) => {
  const map = { W: "bg-emerald-500", D: "bg-amber-400", L: "bg-rose-500" }
  return <span className={cn("w-2 h-2 rounded-full", map[result] || "bg-slate-600")} title={result} />
}

// Label → accent colour mapping
const LABEL_COLOR = {
  "Team League Champion":    "text-yellow-400",
  "Team League Runner-up":   "text-slate-300",
  "Team League 3rd Place":   "text-amber-600",
  "Team League 4th Place":   "text-slate-400",
  "Team League 1st":         "text-yellow-400",
  "Team League 2nd":         "text-slate-300",
  "Team League 3rd":         "text-amber-600",
  "Team League 4th":         "text-slate-400",
  "UCL Champion":            "text-blue-400",
  "UCL Group Stage Winner":  "text-blue-300",
  "UCL Knockout Golden Boot":"text-yellow-300",
  "Weekly Champion":         "text-purple-400",
  "Weekly Golden Boot":      "text-yellow-300",
  "Duo Champion":            "text-emerald-400",
  "Duo Runner-up":           "text-slate-300",
  "Duo QF Eliminated":       "text-slate-400",
  "Duo SF Eliminated":       "text-slate-400",
  "Duo Golden Boot":         "text-yellow-300",
  "TLG Champion":            "text-orange-400",
  "TLG Runner-up":           "text-slate-300",
}

function BreakdownRow({ playerId }) {
  const { data = {}, isLoading } = useQuery({
    queryKey: ["bdr-breakdown", playerId],
    queryFn: () => api.get(`/players/${playerId}/bdr-breakdown`).then(r => r.data),
    staleTime: 1000 * 60 * 5,
  })
  const rows = Array.isArray(data) ? data : (data.rows ?? [])
  const _data = rows

  if (isLoading) return (
    <div className="px-5 py-3 border-t border-surface-border/50">
      <div className="animate-pulse h-4 bg-surface-border rounded w-40" />
    </div>
  )

  if (_data.length === 0) return (
    <div className="px-5 py-3 border-t border-surface-border/50">
      <p className="text-xs text-slate-600 italic">
        No breakdown available — points were awarded before this feature was added
      </p>
    </div>
  )

  return (
    <div className="px-5 py-3 border-t border-surface-border/50 space-y-1.5">
      <p className="text-[10px] text-slate-600 font-semibold uppercase tracking-widest mb-2">BDR Breakdown</p>
      {_data.map((row, i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <span className={cn("text-xs font-medium", LABEL_COLOR[row.label] || "text-slate-400")}>
            {row.label}
          </span>
          <div className="flex items-center gap-1.5">
            <div className="h-px bg-surface-border/60 w-12 flex-shrink-0" />
            <span className="text-xs font-bold font-mono text-white">+{row.total}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function BDRRanking({ players, onPlayerClick }) {
  const [expandedId, setExpandedId] = useState(null)

  // Use bdr_points directly — it is the authoritative current-season total
  // maintained by the admin. player_bdr_breakdown is only for the detail
  // drill-down, not for ranking totals (it only has partial entries).
  const withBdr = players.map(p => ({ ...p, displayBdr: p.bdrPoints ?? 0 }))

  const sorted = [...withBdr].sort((a, b) =>
    (b.displayBdr - a.displayBdr) || a.name.localeCompare(b.name)
  )
  const maxPts = sorted[0]?.displayBdr || 1
  const rankChanges = useRankChanges("bdr-ranking", sorted.map(p => p.id))

  function toggleExpand(e, playerId) {
    e.stopPropagation()
    setExpandedId(prev => prev === playerId ? null : playerId)
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-surface-border flex items-center gap-3">
        <img src={ballondorImg} alt="Ballon d'Or" className="w-9 h-9 object-contain flex-shrink-0" />
        <div>
          <p className="section-label mb-0.5">BDR ranking</p>
          <h2 className="text-base font-semibold text-white">BALLOND'OR</h2>
        </div>
      </div>

      <div className="divide-y divide-surface-border">
        {sorted.map((player, idx) => {
          const isFirst    = idx === 0
          const barPct     = (player.displayBdr / maxPts) * 100
          const isExpanded = expandedId === player.id

          return (
            <div key={player.id}>
              {/* Main row */}
              <div
                onClick={() => onPlayerClick?.(player)}
                className={cn(
                  "px-5 py-3.5 flex items-center gap-4 transition-colors cursor-pointer",
                  isFirst ? "bg-gold/5 hover:bg-gold/8" : "hover:bg-surface-hover"
                )}
              >
                {/* Rank */}
                <div className="w-14 flex-shrink-0 flex items-center justify-center gap-1">
                  {isFirst
                    ? <Crown className="w-4 h-4 text-gold" />
                    : <><span className="text-sm font-medium text-slate-500">#{idx + 1}</span><RankBadge change={rankChanges[player.id]} /></>
                  }
                </div>

                {/* Avatar */}
                {(() => {
                  const preset    = getAvatarById(player.avatarId)
                  const avatarSrc = player.avatarUrl || preset?.thumb
                  if (avatarSrc) {
                    return (
                      <img src={avatarSrc} alt={player.name}
                        className="w-[43px] h-[43px] rounded-lg object-cover flex-shrink-0" />
                    )
                  }
                  return (
                    <div className={cn(
                      "w-[43px] h-[43px] rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0",
                      isFirst ? "bg-gold/20 text-gold" : "bg-surface-border text-slate-400"
                    )}>
                      {player.name.split(" ").map(n => n[0]).join("")}
                    </div>
                  )
                })()}

                {/* Name + bar */}
                <div className="flex-1 min-w-0">
                  <span className={cn("font-semibold text-sm truncate block mb-0.5", isFirst ? "text-white" : "text-slate-300")}>
                    {player.name}
                  </span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="flex-1 h-1 bg-surface-border rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", isFirst ? "bg-gold" : "bg-accent/60")}
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Form */}
                <div className="hidden sm:flex items-center gap-1">
                  {player.form.map((r, i) => <FormDot key={i} result={r} />)}
                </div>

                {/* Points */}
                <div className="text-right flex-shrink-0">
                  <span className={cn("font-bold text-sm font-mono", isFirst ? "text-gold" : "text-white")}>
                    {player.displayBdr.toLocaleString()}
                  </span>
                  <p className="text-xs text-slate-600 mt-0.5">pts</p>
                </div>

                {/* Expand toggle */}
                <button
                  onClick={e => toggleExpand(e, player.id)}
                  className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-border transition-colors"
                >
                  {isExpanded
                    ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                    : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                  }
                </button>
              </div>

              {/* Breakdown panel */}
              {isExpanded && <BreakdownRow playerId={player.id} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}