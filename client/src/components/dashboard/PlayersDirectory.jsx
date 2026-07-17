import { useState, useMemo } from "react"
import { Search, Users, X } from "lucide-react"
import { TeamLogoIcon } from "../common/TeamLogo"

export default function PlayersDirectory({ players, onPlayerClick }) {
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const list = [...players].sort((a, b) => a.name.localeCompare(b.name))
    if (!query.trim()) return list
    const q = query.trim().toLowerCase()
    return list.filter(p =>
      p.name?.toLowerCase().includes(q) ||
      p.alias?.toLowerCase().includes(q) ||
      p.team?.toLowerCase().includes(q)
    )
  }, [players, query])

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-400/15 text-blue-400 flex items-center justify-center flex-shrink-0">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <p className="section-label mb-0.5">Total players</p>
            <h2 className="text-base font-semibold text-white">
              {players.length} registered
            </h2>
          </div>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search players or teams..."
            className="w-full bg-pitch-800 border border-surface-border rounded-xl pl-9 pr-9 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-accent/40 transition-colors"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <Search className="w-6 h-6 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No players match "{query}"</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border">
                <th className="py-2.5 px-4 text-left text-xs font-semibold text-slate-500 tracking-wide">Player</th>
                <th className="py-2.5 px-4 text-left text-xs font-semibold text-slate-500 tracking-wide">Team</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(player => (
                <tr
                  key={player.id}
                  onClick={() => onPlayerClick?.(player)}
                  className="table-row-hover border-b border-surface-border/50 cursor-pointer"
                >
                  <td className="py-3 px-4">
                    <span className="font-medium text-slate-300">{player.name}</span>
                    {player.alias && (
                      <span className="text-xs text-slate-500 ml-2">"{player.alias}"</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-400 text-xs">
                    <span className="inline-flex items-center gap-2">
                      <TeamLogoIcon logoUrl={player.teamLogo} name={player.team} />
                      {player.team ?? "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {query && filtered.length > 0 && (
        <div className="px-5 py-3 border-t border-surface-border">
          <p className="text-xs text-slate-500">
            {filtered.length} of {players.length} players match
          </p>
        </div>
      )}
    </div>
  )
}