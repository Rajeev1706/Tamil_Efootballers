import { useState, useRef, useEffect } from "react"
import { Swords, Search, X, ChevronDown } from "lucide-react"
import { cn } from "../../lib/utils"

// Searchable opponent picker — works on desktop and mobile
function OpponentPicker({ opponents, value, onChange }) {
  const [open, setOpen]       = useState(false)
  const [query, setQuery]     = useState("")
  const containerRef          = useRef(null)
  const inputRef              = useRef(null)

  const filtered = opponents.filter(n =>
    n.toLowerCase().includes(query.toLowerCase())
  )

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
        setQuery("")
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  function select(name) {
    onChange(name)
    setOpen(false)
    setQuery("")
  }

  function clear(e) {
    e.stopPropagation()
    onChange("")
    setQuery("")
  }

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setTimeout(() => inputRef.current?.focus(), 50) }}
        className="w-full flex items-center gap-2 bg-pitch-800 border border-surface-border rounded-xl px-3 py-2.5 text-sm text-left focus:outline-none focus:border-accent/40 transition-colors"
      >
        <Search className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
        <span className={cn("flex-1 truncate", value ? "text-white" : "text-slate-500")}>
          {value || "Search opponent…"}
        </span>
        {value
          ? <button type="button" onClick={clear} className="text-slate-500 hover:text-white flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
          : <ChevronDown className={cn("w-3.5 h-3.5 text-slate-500 flex-shrink-0 transition-transform", open && "rotate-180")} />
        }
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-pitch-800 border border-surface-border rounded-xl shadow-xl overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-surface-border">
            <div className="flex items-center gap-2 bg-pitch-900 rounded-lg px-3 py-2">
              <Search className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Type to search…"
                className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
              />
              {query && (
                <button onClick={() => setQuery("")} className="text-slate-500 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Results */}
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0
              ? <p className="text-xs text-slate-500 text-center py-4">No results for "{query}"</p>
              : filtered.map(name => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => select(name)}
                    className={cn(
                      "w-full text-left px-4 py-2.5 text-sm transition-colors",
                      name === value
                        ? "bg-accent/15 text-accent font-semibold"
                        : "text-white hover:bg-pitch-700"
                    )}
                  >
                    {name}
                  </button>
                ))
            }
          </div>
        </div>
      )}
    </div>
  )
}

export default function HeadToHead({ matchHistory = [] }) {
  const [selectedOpp, setSelectedOpp] = useState("")

  const opponents = [...new Set(matchHistory.map(m => m.opponentName))].sort()
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
        {opponents.length > 0 && (
          <span className="ml-auto text-xs text-slate-500">{opponents.length} opponents</span>
        )}
      </div>

      <div className="p-5">
        <OpponentPicker
          opponents={opponents}
          value={selectedOpp}
          onChange={setSelectedOpp}
        />

        {!selectedOpp && (
          <div className="py-8 text-center">
            <p className="text-slate-500 text-sm">Search or select an opponent to view head-to-head records</p>
          </div>
        )}

        {selectedOpp && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-surface-border">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-surface-border flex items-center justify-center text-xs font-bold text-slate-400">
                  {selectedOpp.split(" ").map(n => n[0]).join("")}
                </div>
                <div>
                  <span className="text-sm font-semibold text-white">{selectedOpp}</span>
                  <p className="text-xs text-slate-500 mt-0.5">{total} match{total !== 1 ? "es" : ""}</p>
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