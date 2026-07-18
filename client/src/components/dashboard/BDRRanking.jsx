import { Crown } from "lucide-react"
import { cn } from "../../lib/utils"
import { getAvatarById } from "../../lib/avatars"
import ballondorImg from "../../../images/ballondor.png"

const FormDot = ({ result }) => {
  const map = { W: "bg-emerald-500", D: "bg-amber-400", L: "bg-rose-500" }
  return <span className={cn("w-2 h-2 rounded-full", map[result] || "bg-slate-600")} title={result} />
}

export default function BDRRanking({ players, onPlayerClick }) {
  const sorted = [...players].sort((a, b) =>
    (b.bdrPoints - a.bdrPoints) || a.name.localeCompare(b.name)
  )
  const maxPts = sorted[0]?.bdrPoints || 1

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
          const isFirst = idx === 0
          const barPct  = (player.bdrPoints / maxPts) * 100

          return (
            <div
              key={player.id}
              onClick={() => onPlayerClick?.(player)}
              className={cn(
                "px-5 py-3.5 flex items-center gap-4 transition-colors cursor-pointer",
                isFirst ? "bg-gold/5 hover:bg-gold/8" : "hover:bg-surface-hover"
              )}
            >
              {/* Rank */}
              <div className="w-6 flex-shrink-0 text-center">
                {isFirst
                  ? <Crown className="w-4 h-4 text-gold mx-auto" />
                  : <span className="text-sm font-medium text-slate-500">#{idx + 1}</span>
                }
              </div>

              {/* Avatar */}
              {(() => {
                const preset = getAvatarById(player.avatarId)
                const avatarSrc = player.avatarUrl || preset?.thumb
                if (avatarSrc) {
                  return (
                    <img
                      src={avatarSrc}
                      alt={player.name}
                      className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                    />
                  )
                }
                return (
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0",
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
                  {player.bdrPoints.toLocaleString()}
                </span>
                <p className="text-xs text-slate-600 mt-0.5">pts</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}