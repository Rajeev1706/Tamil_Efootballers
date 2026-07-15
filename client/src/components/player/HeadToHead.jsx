import { useState } from "react"
import { Swords } from "lucide-react"
import { cn } from "../../lib/utils"

// Full head-to-head match history browser — pick an opponent, see the
// complete win/draw/loss record and every match played against them.
// Shared identically between the player profile page and the team
// auction page, so it's always the exact same experience either way.
export default function HeadToHead({ matchHistory = [] }) {
  const [selectedOpp, setSelectedOpp] = useState("")

  const opponents = [...new Set(matchHistory.map(m => m.opponentName))]
  const records   = matchHistory.filter(m => m.opponentName === selectedOpp)
  const wins      = records.filter(m => m.result === "win").length
  const draws     = records.filter(m => m.result === "draw").length
  const losses    = records.filter(m => m.result === "loss").length
  const total     = wins + draws + losses

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-surface-border">
        <Swords className="w-4 h-4 text-violet-400" />
        <h2 className="text-base font-semibold text-white">Head-to-head record</h2>
      </div>

      <div className="p-5">
        <select
          value={selectedOpp}
          onChange={e => setSelectedOpp(e.target.value)}
          className="w-full bg-pitch-800 border border-surface-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent/40 transition-colors mb-4"
        >
          <option value="">Select opponent…</option>
          {opponents.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>

        {!selectedOpp && (
          <div className="py-8 text-center">
            <p className="text-slate-500 text-sm">Select an opponent to view head-to-head records</p>
          </div>
        )}

        {selectedOpp && (
          <div>
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-surface-border">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-surface-border flex items-center justify-center text-xs font-bold text-slate-400">
                  {selectedOpp.split(" ").map(n => n[0]).join("")}
                </div>
                <div>
                  <span className="text-sm font-semibold text-white">{selectedOpp}</span>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {total} match{total !== 1 ? "es" : ""}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold font-mono text-white">
                  {total ? Math.round((wins / total) * 100) : 0}%
                </p>
                <p className="text-xs text-slate-500 mt-0.5">win rate</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-emerald-400/10 border border-emerald-400/20 rounded-xl p-3 text-center">
                <p className="text-2xl font-extrabold font-mono text-emerald-400">{wins}</p>
                <p className="text-xs text-slate-500 mt-0.5">Wins</p>
              </div>
              <div className="bg-amber-400/10 border border-amber-400/20 rounded-xl p-3 text-center">
                <p className="text-2xl font-extrabold font-mono text-amber-400">{draws}</p>
                <p className="text-xs text-slate-500 mt-0.5">Draws</p>
              </div>
              <div className="bg-rose-400/10 border border-rose-400/20 rounded-xl p-3 text-center">
                <p className="text-2xl font-extrabold font-mono text-rose-400">{losses}</p>
                <p className="text-xs text-slate-500 mt-0.5">Losses</p>
              </div>
            </div>

            <div className="space-y-1.5">
              {records.map(m => (
                <div key={m.id}
                  className="flex items-center gap-3 bg-pitch-800 rounded-xl px-4 py-2.5 border border-surface-border">
                  <span className="text-xs text-slate-600 w-14 flex-shrink-0">
                    {m.date
                      ? new Date(m.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                      : "—"}
                  </span>
                  <span className={cn(
                    "text-xs font-bold px-2 py-0.5 rounded border flex-shrink-0",
                    m.result === "win"  ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/25"
                    : m.result === "draw" ? "bg-amber-400/10 text-amber-400 border-amber-400/25"
                    : "bg-rose-400/10 text-rose-400 border-rose-400/25"
                  )}>
                    {m.result.toUpperCase()}
                  </span>
                  {m.playerScore !== null && m.playerScore !== undefined && (
                    <span className="text-xs font-mono font-bold text-white">
                      {m.playerScore}-{m.opponentScore}
                    </span>
                  )}
                  {m.matchType && (
                    <span className="text-xs text-slate-500 capitalize ml-auto">{m.matchType}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}