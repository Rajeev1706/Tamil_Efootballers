import { useState } from "react"
import { Target } from "lucide-react"
import { cn } from "../../lib/utils"
import { useTopScorers } from "../../lib/queries"
import teamLeagueTrophy from "../../../images/Team League.png"
import goldenBoot from "../../../images/Golden Boot.png"

export default function StandingsTable({ teams, players, onPlayerClick, view: controlledView, onViewChange }) {
  const [internalView, setInternalView] = useState("table")
  const view    = controlledView || internalView
  const setView = onViewChange || setInternalView
  const { data: scorers = [] } = useTopScorers()

  return (
    <div className="card overflow-hidden">
      {/* Header with dropdown */}
      <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <img
            src={view === "table" ? teamLeagueTrophy : goldenBoot}
            alt={view === "table" ? "Team League" : "Golden Boot"}
            className="w-9 h-9 object-contain flex-shrink-0"
          />
          <div>
            <p className="section-label mb-0.5">League table</p>
            <h2 className="text-base font-semibold text-white">
              {view === "table" ? "Season standings" : "Golden Boot"}
            </h2>
          </div>
        </div>
        <select
          value={view}
          onChange={e => setView(e.target.value)}
          className="bg-pitch-800 border border-surface-border rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-accent/40 transition-colors"
        >
          <option value="table">League table</option>
          <option value="scorers">Golden Boot</option>
        </select>
      </div>

      {/* League Table View */}
      {view === "table" && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border">
                {["#", "Team", "P", "W", "D", "L", "GF", "GA", "GD", "Pts"].map((h) => (
                  <th
                    key={h}
                    className={cn(
                      "py-2.5 text-xs font-semibold text-slate-500 tracking-wide",
                      h === "Team" ? "text-left px-4" : "text-center px-2",
                      h === "Pts"  && "text-gold"
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => {
                const pos     = team.position
                const isFirst = pos === 1
                return (
                  <tr
                    key={team.id}
                    className={cn(
                      "border-b border-surface-border/50 transition-colors",
                      "table-row-hover",
                      isFirst && "gold-border bg-gold/5"
                    )}
                  >
                    <td className="py-3 px-3 text-center">
                      {isFirst
                        ? <span className="rank-gold text-sm">1</span>
                        : <span className={cn("text-sm font-medium", pos <= 3 ? "text-slate-300" : "text-slate-500")}>{pos}</span>
                      }
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold",
                          isFirst ? "bg-gold/20 text-gold" : "bg-surface-border text-slate-400"
                        )}>
                          {team.name.charAt(0)}
                        </div>
                        <span className={cn("font-medium", isFirst ? "text-white" : "text-slate-300")}>
                          {team.name}
                        </span>
                      </div>
                    </td>
                    {[team.played, team.won, team.drawn, team.lost, team.gf, team.ga].map((val, i) => (
                      <td key={i} className="py-3 px-2 text-center text-slate-400">{val}</td>
                    ))}
                    <td className={cn("py-3 px-2 text-center font-medium text-sm",
                      team.gd > 0 ? "text-emerald-400" : team.gd < 0 ? "text-rose-400" : "text-slate-400"
                    )}>
                      {team.gd > 0 ? `+${team.gd}` : team.gd}
                    </td>
                    <td className={cn(
                      "py-3 px-2 text-center font-bold text-sm",
                      isFirst ? "text-gold" : "text-white"
                    )}>
                      {team.points}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Top 10 Goal Scorers View */}
      {view === "scorers" && (
        scorers.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Target className="w-6 h-6 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No goals logged yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border">
                  <th className="py-2.5 px-3 text-center text-xs font-semibold text-slate-500 tracking-wide w-10">#</th>
                  <th className="py-2.5 px-4 text-left text-xs font-semibold text-slate-500 tracking-wide">Player</th>
                  <th className="py-2.5 px-4 text-left text-xs font-semibold text-slate-500 tracking-wide">Team</th>
                  <th className="py-2.5 px-3 text-center text-xs font-semibold text-emerald-400 tracking-wide">Goals</th>
                </tr>
              </thead>
              <tbody>
                {scorers.map((scorer, idx) => {
                  const isFirst = idx === 0
                  const player  = players?.find(p => p.id === scorer.id)
                  return (
                    <tr
                      key={scorer.id}
                      onClick={() => player && onPlayerClick?.(player)}
                      className={cn(
                        "border-b border-surface-border/50 transition-colors",
                        player ? "cursor-pointer table-row-hover" : "",
                        isFirst && "bg-emerald-400/5"
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
                          {scorer.name}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-xs">{scorer.team ?? "—"}</td>
                      <td className="py-3 px-3 text-center">
                        <span className={cn("font-bold font-mono text-sm", isFirst ? "text-emerald-400" : "text-white")}>
                          {scorer.goals}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  )
}