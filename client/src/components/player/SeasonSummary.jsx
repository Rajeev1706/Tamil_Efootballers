import { useState } from "react"
import { Trophy, ChevronDown } from "lucide-react"
import { cn } from "../../lib/utils"

const MATCH_TYPE_OPTIONS = [
  { value: "all",    label: "Total matches" },
  { value: "league", label: "Team League"   },
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

function Dropdown({ value, onChange, options }) {
  return (
    <div className="relative flex-1">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full appearance-none bg-pitch-800 border border-surface-border rounded-xl pl-3 pr-7 py-2 text-sm text-white focus:outline-none focus:border-accent/40 transition-colors cursor-pointer">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="w-3 h-3 text-slate-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  )
}

export default function SeasonSummary({ player }) {
  const [seasonFilter, setSeasonFilter] = useState("overall")
  const [typeFilter, setTypeFilter] = useState("all")

  const allHistory = player?.matchHistory || []

  // Build available seasons from match history
  const seasons = [...new Set(allHistory.map(m => m.seasonNumber).filter(Boolean))].sort((a, b) => b - a)
  const currentSeason = seasons[0] ?? null

  const seasonOptions = [
    { value: "overall", label: "Overall (All-time)" },
    { value: "current", label: "Current Season" },
    ...seasons.slice(1).map(s => ({ value: String(s), label: `Season ${s}` })),
  ]

  // First filter by season
  const seasonFiltered = seasonFilter === "overall"
    ? allHistory
    : seasonFilter === "current"
      ? allHistory.filter(m => m.seasonNumber === currentSeason)
      : allHistory.filter(m => m.seasonNumber === parseInt(seasonFilter))

  // Then filter by match type
  const filtered = typeFilter === "all"
    ? seasonFiltered
    : seasonFiltered.filter(m => m.matchType === typeFilter)

  const wins   = filtered.filter(m => m.result === "win").length
  const draws  = filtered.filter(m => m.result === "draw").length
  const losses = filtered.filter(m => m.result === "loss").length
  const total  = wins + draws + losses
  const goals  = filtered.reduce((s, m) => s + (m.playerScore ?? 0), 0)

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-surface-border">
        <Trophy className="w-4 h-4 text-gold" />
        <h2 className="text-base font-semibold text-white">Season summary</h2>
      </div>

      {/* Two dropdowns side by side */}
      <div className="px-5 pt-4 flex gap-2">
        <Dropdown value={seasonFilter} onChange={setSeasonFilter} options={seasonOptions} />
        <Dropdown value={typeFilter}   onChange={setTypeFilter}   options={MATCH_TYPE_OPTIONS} />
      </div>

      <div className="p-5 grid grid-cols-3 gap-3">
        {[
          { label: "Wins",   value: wins,   color: "text-emerald-400" },
          { label: "Draws",  value: draws,  color: "text-amber-400"  },
          { label: "Losses", value: losses, color: "text-rose-400"   },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-pitch-800 rounded-xl p-3 text-center border border-surface-border">
            <p className={cn("text-2xl font-extrabold font-mono", color)}>{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="px-5 pb-5 space-y-2.5">
        <SummaryRow label="Games played"   value={total} />
        <SummaryRow label="Win rate"       value={total ? `${Math.round((wins / total) * 100)}%` : "—"} />
        <SummaryRow label="Goals scored"   value={goals} />
        <SummaryRow label="Goals per match" value={total ? (goals / total).toFixed(1) : "—"} />
        <SummaryRow label="BDR points"     value={player?.bdrPoints?.toLocaleString() ?? "—"} />
      </div>
    </div>
  )
}