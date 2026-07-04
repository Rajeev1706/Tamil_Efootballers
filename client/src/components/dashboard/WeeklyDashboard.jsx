import { useState } from "react"
import { Trophy, Target, Calendar } from "lucide-react"
import { useWeeklyCurrent, useWeeklyTopScorers } from "../../lib/queries"
import { cn } from "../../lib/utils"
import weeklyLogo from "../../../images/Weekly.png"
import goldenBootLogo from "../../../images/Golden Boot.png"

// Same stage-naming logic as the admin bracket view (WeeklyBracket.jsx),
// so "Round 1" for a 32-player bracket shows as "Round of 32", etc.,
// and the labels stay consistent between admin and public dashboard.
function getRoundLabel(round, totalRounds) {
  const fromEnd = totalRounds - round
  if (fromEnd === 0) return "Final"
  if (fromEnd === 1) return "Semi-Final"
  if (fromEnd === 2) return "Quarter-Final"
  if (fromEnd === 3) return "Round of 16"
  if (fromEnd === 4) return "Round of 32"
  if (fromEnd === 5) return "Round of 64"
  if (fromEnd === 6) return "Round of 128"
  return `Round ${round}`
}

export default function WeeklyDashboard({ onPlayerClick }) {
  const { data: tournament, isLoading } = useWeeklyCurrent()
  const { data: scorers = [] } = useWeeklyTopScorers()
  const [view, setView] = useState("fixtures") // "fixtures" | "scorers"
  const [activeRound, setActiveRound] = useState(1)

  if (isLoading) return <p className="text-sm text-slate-500 text-center py-8">Loading…</p>

  if (!tournament) {
    return (
      <div className="card px-6 py-14 text-center">
        <Trophy className="w-8 h-8 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400 font-medium">No Weekly Tournament yet</p>
        <p className="text-sm text-slate-600 mt-1">Check back once the admin starts one</p>
      </div>
    )
  }

  const rounds = [...new Set(tournament.matches.map(m => m.round))].sort((a, b) => a - b)
  const totalRounds = tournament.total_rounds || Math.max(...rounds, 1)
  const currentRound = rounds.includes(activeRound) ? activeRound : rounds[0]
  const roundMatches = tournament.matches.filter(m => m.round === currentRound)

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src={view === "fixtures" ? weeklyLogo : goldenBootLogo}
            alt={view === "fixtures" ? "Weekly Tournament" : "Golden Boot"}
            className="w-9 h-9 object-contain flex-shrink-0"
          />
          <div>
            <p className="section-label mb-0.5">Weekly Tournament</p>
            <h2 className="text-base font-semibold text-white">
              {view === "fixtures" ? tournament.name : "Top Scorers"}
            </h2>
          </div>
        </div>
        <select
          value={view}
          onChange={e => setView(e.target.value)}
          className="bg-pitch-800 border border-surface-border rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-accent/40 transition-colors"
        >
          <option value="fixtures">Fixtures</option>
          <option value="scorers">Top scorers</option>
        </select>
      </div>

      {/* Round tabs — only for fixtures view */}
      {view === "fixtures" && rounds.length > 1 && (
        <div className="flex gap-1.5 px-5 py-3 overflow-x-auto border-b border-surface-border/60">
          {rounds.map(r => (
            <button key={r} onClick={() => setActiveRound(r)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors",
                r === currentRound ? "bg-accent text-white" : "bg-pitch-800 text-slate-500 hover:text-white"
              )}>
              {getRoundLabel(r, totalRounds)}
            </button>
          ))}
        </div>
      )}

      {/* Fixtures list, grouped by round */}
      {view === "fixtures" && (
        roundMatches.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Calendar className="w-6 h-6 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No fixtures in this round yet</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-border/50">
            {roundMatches.map((m, i) => {
              const isBye = m.status === "bye"
              const isCompleted = m.status === "completed"
              return (
                <div key={i} className="flex items-center justify-between px-5 py-3.5">
                  <button
                    onClick={() => m.player1Id && onPlayerClick?.({ id: m.player1Id, name: m.player1Name })}
                    className={cn("font-medium text-left flex-1 truncate",
                      m.winnerId === m.player1Id ? "text-white" : "text-slate-400",
                      !m.player1Id && "text-slate-600 italic"
                    )}
                  >
                    {m.player1Name ?? "TBD"}
                  </button>

                  <div className="px-4 flex-shrink-0">
                    {isBye ? (
                      <span className="text-xs font-semibold text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full">BYE</span>
                    ) : isCompleted ? (
                      <span className="text-sm font-mono font-bold text-white bg-pitch-800 px-3 py-1 rounded-lg">
                        {m.player1Score} - {m.player2Score}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-600">vs</span>
                    )}
                  </div>

                  <button
                    onClick={() => m.player2Id && onPlayerClick?.({ id: m.player2Id, name: m.player2Name })}
                    className={cn("font-medium text-right flex-1 truncate",
                      m.winnerId === m.player2Id ? "text-white" : "text-slate-400",
                      !m.player2Id && "text-slate-600 italic"
                    )}
                  >
                    {m.player2Name ?? "TBD"}
                  </button>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* Top scorers */}
      {view === "scorers" && (
        scorers.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Target className="w-6 h-6 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No Weekly goals logged yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border">
                  <th className="py-2.5 px-3 text-center text-xs font-semibold text-slate-500 tracking-wide w-10">#</th>
                  <th className="py-2.5 px-4 text-left text-xs font-semibold text-slate-500 tracking-wide">Player</th>
                  <th className="py-2.5 px-4 text-left text-xs font-semibold text-slate-500 tracking-wide">Team</th>
                  <th className="py-2.5 px-3 text-center text-xs font-semibold text-slate-500 tracking-wide">Conceded</th>
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
                      <td className="py-3 px-3 text-center text-slate-400 text-sm">{scorer.conceded}</td>
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