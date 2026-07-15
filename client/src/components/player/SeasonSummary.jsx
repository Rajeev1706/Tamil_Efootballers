import { useState } from "react"
import { Trophy } from "lucide-react"
import { cn } from "../../lib/utils"

const MATCH_TYPE_OPTIONS = [
  { value: "all",    label: "Total matches" },
  { value: "league", label: "Team league"   },
  { value: "ucl",    label: "UCL"           },
  { value: "weekly", label: "Weekly"        },
]

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-white font-semibold font-mono">{value}</span>
    </div>
  )
}

// Overall career match record — total wins/draws/losses, games played,
// win rate, goals, filterable by match type. This is the OVERALL summary
// across every match, distinct from HeadToHead which is filtered to one
// specific opponent at a time. Shared identically between the player
// profile page and the team auction page.
export default function SeasonSummary({ player }) {
  const [summaryFilter, setSummaryFilter] = useState("all")
  const allHistory = player?.matchHistory || []

  const filteredHistory = summaryFilter === "all"
    ? allHistory
    : allHistory.filter(m => m.matchType === summaryFilter)

  const filteredWins   = filteredHistory.filter(m => m.result === "win").length
  const filteredDraws  = filteredHistory.filter(m => m.result === "draw").length
  const filteredLosses = filteredHistory.filter(m => m.result === "loss").length
  const filteredTotal  = filteredWins + filteredDraws + filteredLosses

  const filteredGoals  = filteredHistory.reduce((sum, m) =>
    sum + (m.playerScore != null ? m.playerScore : 0), 0)
  const goalsPerMatch  = filteredTotal > 0
    ? (filteredGoals / filteredTotal).toFixed(1)
    : "—"

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-surface-border">
        <Trophy className="w-4 h-4 text-gold" />
        <h2 className="text-base font-semibold text-white">Season summary</h2>
      </div>

      <div className="px-5 pt-4">
        <select
          value={summaryFilter}
          onChange={e => setSummaryFilter(e.target.value)}
          className="w-full bg-pitch-800 border border-surface-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent/40 transition-colors"
        >
          {MATCH_TYPE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className="p-5 grid grid-cols-3 gap-3">
        {[
          { label: "Wins",   value: filteredWins,   color: "text-emerald-400" },
          { label: "Draws",  value: filteredDraws,  color: "text-amber-400"  },
          { label: "Losses", value: filteredLosses, color: "text-rose-400"   },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-pitch-800 rounded-xl p-3 text-center border border-surface-border">
            <p className={cn("text-2xl font-extrabold font-mono", color)}>{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="px-5 pb-5 space-y-2.5">
        <SummaryRow label="Games played" value={filteredTotal} />
        <SummaryRow
          label="Win rate"
          value={filteredTotal ? `${Math.round((filteredWins / filteredTotal) * 100)}%` : "—"}
        />
        <SummaryRow label="Goals scored" value={filteredGoals} />
        <SummaryRow label="Goals per match" value={goalsPerMatch} />
        <SummaryRow label="BDR points" value={player?.bdrPoints?.toLocaleString() ?? "—"} />
      </div>
    </div>
  )
}