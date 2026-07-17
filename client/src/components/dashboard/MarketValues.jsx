import { TrendingUp } from "lucide-react"
import { cn } from "../../lib/utils"
import { TeamLogoIcon } from "../common/TeamLogo"

export default function MarketValues({ players, onPlayerClick }) {
  const sorted = [...players].sort((a, b) =>
    (b.marketValue - a.marketValue) || a.name.localeCompare(b.name)
  )

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between">
        <div>
          <p className="section-label mb-0.5">Market values</p>
          <h2 className="text-base font-semibold text-white">Player valuations</h2>
        </div>
        <TrendingUp className="w-4 h-4 text-accent" />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border">
              {["#", "Player", "Team", "MV"].map((h) => (
                <th
                  key={h}
                  className={cn(
                    "py-2.5 text-xs font-semibold text-slate-500 tracking-wide",
                    h === "Player" || h === "Team" ? "text-left px-4" : "text-center px-3",
                    h === "MV" && "text-accent"
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((player, idx) => {
              const isFirst = idx === 0

              return (
                <tr
                  key={player.id}
                  onClick={() => onPlayerClick?.(player)}
                  className={cn(
                    "table-row-hover border-b border-surface-border/50 cursor-pointer",
                    isFirst && "bg-gold/5"
                  )}
                >
                  <td className="py-3 px-3 text-center">
                    {isFirst
                      ? <span className="rank-gold text-sm">1</span>
                      : <span className="text-slate-500 text-sm">{idx + 1}</span>
                    }
                  </td>
                  <td className="py-3 px-4">
                    <span className={cn("font-medium", isFirst ? "text-white" : "text-slate-300")}>
                      {player.name}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-400 text-xs">
                    <span className="inline-flex items-center gap-2">
                      <TeamLogoIcon logoUrl={player.teamLogo} name={player.team} />
                      {player.team}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className={cn("font-bold font-mono text-sm", isFirst ? "text-gold" : "text-white")}>
                      {player.marketValue}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}