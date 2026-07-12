import { useState } from "react"
import { Trophy, Target, Swords } from "lucide-react"
import { useUclStandings, useUclTopScorers, useUclKnockoutCurrent } from "../../lib/queries"
import { cn } from "../../lib/utils"
import uclTrophy from "../../../images/ucl.png"
import goldenBootGB from "../../../images/ucl_gb.png"

function getRoundLabel(round, totalRounds) {
  const fromEnd = totalRounds - round
  if (fromEnd === 0) return "Final"
  if (fromEnd === 1) return "Semi-Final"
  if (fromEnd === 2) return "Quarter-Final"
  if (fromEnd === 3) return "Round of 16"
  if (fromEnd === 4) return "Round of 32"
  return `Round ${round}`
}

export default function UclStandings({ onPlayerClick }) {
  const { data: groups = [], isLoading } = useUclStandings()
  const { data: scorers = [] } = useUclTopScorers()
  const { data: knockout } = useUclKnockoutCurrent()
  const [activeGroup, setActiveGroup] = useState(0)
  const [activeKoRound, setActiveKoRound] = useState(1)
  const [view, setView] = useState("table") // "table" | "scorers" | "knockout"

  if (isLoading) return <p className="text-sm text-slate-500 text-center py-8">Loading…</p>

  if (groups.length === 0) {
    return (
      <div className="card px-6 py-14 text-center">
        <Trophy className="w-8 h-8 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400 font-medium">UCL groups not set up yet</p>
        <p className="text-sm text-slate-600 mt-1">Check back once the admin creates the group stage</p>
      </div>
    )
  }

  const group = groups[activeGroup] || groups[0]
  const koTotalRounds = knockout?.totalRounds || 5
  const koRounds = Array.from({ length: koTotalRounds }, (_, i) => i + 1)
  const koCurrentRound = koRounds.includes(activeKoRound) ? activeKoRound : koRounds[0]
  const koMatches = (knockout?.matches || []).filter(m => m.round === koCurrentRound)

  const headerIcon  = view === "table" ? uclTrophy : view === "knockout" ? uclTrophy : goldenBootGB
  const headerTitle = view === "table" ? group?.name : view === "knockout" ? "Knockout Stage" : "Golden Boot"

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={headerIcon} alt="UCL" className="w-9 h-9 object-contain flex-shrink-0" />
          <div>
            <p className="section-label mb-0.5">UCL</p>
            <h2 className="text-base font-semibold text-white">{headerTitle}</h2>
          </div>
        </div>
        <select
          value={view}
          onChange={e => setView(e.target.value)}
          className="bg-pitch-800 border border-surface-border rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-accent/40 transition-colors"
        >
          <option value="table">Group table</option>
          <option value="knockout">Knockout</option>
          <option value="scorers">Golden Boot</option>
        </select>
      </div>

      {/* Group tabs — only for table view */}
      {view === "table" && (
        <div className="flex gap-1.5 px-5 py-3 overflow-x-auto border-b border-surface-border/60">
          {groups.map((g, i) => (
            <button key={g.id} onClick={() => setActiveGroup(i)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors",
                i === activeGroup ? "bg-accent text-white" : "bg-pitch-800 text-slate-500 hover:text-white"
              )}>
              {g.name}
            </button>
          ))}
        </div>
      )}

      {/* Standings table */}
      {view === "table" && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border">
                {["#", "Player", "P", "W", "D", "L", "GF", "GA", "GD", "Pts"].map(h => (
                  <th key={h} className={cn("py-2.5 text-xs font-semibold text-slate-500 tracking-wide",
                    h === "Player" ? "text-left px-4" : "text-center px-2"
                  )}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {group?.players.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-8 text-slate-500 text-sm">No players in this group</td></tr>
              ) : group?.players.map((p, i) => (
                <tr
                  key={p.id}
                  onClick={() => onPlayerClick?.(p)}
                  className={cn(
                    "border-b border-surface-border/50 transition-colors cursor-pointer hover:bg-surface-hover",
                    i === 0 && "bg-gold/5 border-l-2 border-l-gold/60"
                  )}
                >
                  <td className="py-3 px-2 text-center">
                    <span className={cn("text-sm font-medium", i < 4 ? "text-emerald-400" : "text-slate-500")}>{i + 1}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={cn("font-medium", i === 0 ? "text-gold" : "text-slate-300")}>{p.name}</span>
                    {p.team && <span className="text-xs text-slate-600 ml-2">{p.team}</span>}
                  </td>
                  <td className="py-3 px-2 text-center text-slate-400">{p.played}</td>
                  <td className="py-3 px-2 text-center text-emerald-400 font-semibold">{p.won}</td>
                  <td className="py-3 px-2 text-center text-amber-400 font-semibold">{p.drawn}</td>
                  <td className="py-3 px-2 text-center text-rose-400 font-semibold">{p.lost}</td>
                  <td className="py-3 px-2 text-center text-slate-400">{p.gf}</td>
                  <td className="py-3 px-2 text-center text-slate-400">{p.ga}</td>
                  <td className={cn("py-3 px-2 text-center font-medium", p.gd > 0 ? "text-emerald-400" : p.gd < 0 ? "text-rose-400" : "text-slate-400")}>
                    {p.gd > 0 ? `+${p.gd}` : p.gd}
                  </td>
                  <td className="py-3 px-2 text-center font-bold text-white">{p.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Knockout Stage — read-only round-tabs bracket view */}
      {view === "knockout" && (
        !knockout || (knockout.matches || []).length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Swords className="w-6 h-6 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500">UCL Knockout hasn't started yet</p>
          </div>
        ) : (
          <>
            <div className="flex gap-1.5 px-5 py-3 overflow-x-auto border-b border-surface-border/60">
              {koRounds.map(r => (
                <button key={r} onClick={() => setActiveKoRound(r)}
                  className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors",
                    r === koCurrentRound ? "bg-accent text-white" : "bg-pitch-800 text-slate-500 hover:text-white"
                  )}>
                  {getRoundLabel(r, koTotalRounds)}
                </button>
              ))}
            </div>

            {koMatches.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm text-slate-500">No fixtures in this round yet</p>
              </div>
            ) : (
              <div>
                {koMatches.map(m => {
                  const isCompleted = m.status === "completed"
                  const p1IsWinner = isCompleted && m.winnerId === m.player1Id
                  const p2IsWinner = isCompleted && m.winnerId === m.player2Id
                  return (
                    <div key={`${m.round}-${m.matchNumber}`} className="flex items-center justify-between px-5 py-3.5 border-b border-surface-border/50">
                      <span
                        onClick={() => m.player1Id && onPlayerClick?.({ id: m.player1Id, name: m.player1Name })}
                        className={cn("flex-1 min-w-0 truncate font-medium",
                          m.player1Id ? "cursor-pointer hover:text-accent" : "",
                          !m.player1Id ? "text-slate-600 italic" : p1IsWinner ? "text-emerald-400" : "text-white"
                        )}>
                        {m.player1Name ?? "TBD"}
                      </span>
                      <div className="px-4 flex-shrink-0">
                        <span className="text-xs text-slate-600">vs</span>
                      </div>
                      <span
                        onClick={() => m.player2Id && onPlayerClick?.({ id: m.player2Id, name: m.player2Name })}
                        className={cn("flex-1 min-w-0 truncate font-medium text-right",
                          m.player2Id ? "cursor-pointer hover:text-accent" : "",
                          !m.player2Id ? "text-slate-600 italic" : p2IsWinner ? "text-emerald-400" : "text-white"
                        )}>
                        {m.player2Name ?? "TBD"}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )
      )}

      {/* Golden Boot — top scorers */}
      {view === "scorers" && (
        scorers.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Target className="w-6 h-6 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No UCL goals logged yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border">
                  <th className="py-2.5 px-3 text-center text-xs font-semibold text-slate-500 tracking-wide w-10">#</th>
                  <th className="py-2.5 px-4 text-left text-xs font-semibold text-slate-500 tracking-wide">Player</th>
                  <th className="py-2.5 px-4 text-left text-xs font-semibold text-slate-500 tracking-wide">Team</th>
                  <th className="py-2.5 px-4 text-left text-xs font-semibold text-slate-500 tracking-wide">Group</th>
                  <th className="py-2.5 px-3 text-center text-xs font-semibold text-emerald-400 tracking-wide">Goals</th>
                </tr>
              </thead>
              <tbody>
                {scorers.map((scorer, idx) => {
                  const isFirst = idx === 0
                  return (
                    <tr
                      key={scorer.id}
                      onClick={() => onPlayerClick?.(scorer)}
                      className={cn(
                        "border-b border-surface-border/50 transition-colors cursor-pointer table-row-hover",
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
                      <td className="py-3 px-4 text-slate-500 text-xs">{scorer.groupName ?? "—"}</td>
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

      {view === "table" && group?.players.length >= 2 && (
        <div className="px-5 py-3 border-t border-surface-border/60 flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400/60" /> Top 4 advance</span>
        </div>
      )}
    </div>
  )
}