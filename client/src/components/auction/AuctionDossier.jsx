/**
 * AuctionDossier — Pre-auction scouting report for team captains.
 * Shows every player in the auction pool with full stats:
 * MV, form, grade, BDR, grade ceiling, previous price, value score.
 * Sortable and filterable. Captain's homework sheet before auction day.
 */
import { useState, useMemo } from "react"
import { Search, TrendingUp, Zap, ChevronUp, ChevronDown } from "lucide-react"
import { cn } from "../../lib/utils"
import PlayerAvatarIcon from "../common/PlayerAvatarIcon"
import GradeBadge from "../common/GradeBadge"

const GRADE_MV = { S: 180, "A+": 140, A: 110, B: 65, C: 40 }
function gradeRank(g) { return { S: 5, "A+": 4, A: 3, B: 2, C: 1 }[g] ?? 0 }
function winRate(form = []) {
  if (!form?.length) return null
  return Math.round(form.filter(f => f === "W").length / form.length * 100)
}
function valueScore(p) {
  const mv    = p.marketValue ?? 0
  const bench = GRADE_MV[p.grade] ?? 60
  const wr    = winRate(p.form) ?? 50
  if (mv === 0) return 50
  return Math.min(100, Math.max(0, Math.round((bench / Math.max(mv, 1)) * 60 + wr * 0.4)))
}
function isSleeper(p) {
  const wr  = winRate(p.form) ?? 0
  const bdr = p.bdrPoints ?? 0
  return wr >= 60 && bdr < 15
}

const COLS = [
  { id: "name",        label: "Player"       },
  { id: "grade",       label: "Grade"        },
  { id: "marketValue", label: "MV"           },
  { id: "bdrPoints",   label: "BDR"          },
  { id: "wr",          label: "WR %"         },
  { id: "vs",          label: "Value Score"  },
]

export default function AuctionDossier({ pool = [], allPlayers = [] }) {
  const [search, setSearch]     = useState("")
  const [gradeFilter, setGrade] = useState("All")
  const [sortCol, setSort]      = useState("vs")
  const [sortDir, setSortDir]   = useState("desc")
  const [expanded, setExpanded] = useState(null)

  const enriched = useMemo(() => {
    return pool
      .filter(p => p.status === "pending")
      .map(p => {
        const full = allPlayers.find(ap => ap.id === p.playerId) ?? {}
        return {
          ...p,
          ...full,
          id:           p.id,
          playerId:     p.playerId,
          name:         p.name ?? full.name,
          grade:        p.grade ?? full.grade,
          marketValue:  full.marketValue ?? p.marketValue ?? 0,
          bdrPoints:    full.bdrPoints   ?? 0,
          form:         full.form        ?? [],
          gradeCeiling: full.gradeCeiling,
          gradeFloor:   full.gradeFloor,
          team:         full.team,
          wr:           winRate(full.form ?? []),
          vs:           valueScore({ ...p, ...full }),
          sleeper:      isSleeper({ ...full, bdrPoints: full.bdrPoints ?? 0 }),
        }
      })
  }, [pool, allPlayers])

  const filtered = useMemo(() => {
    let data = enriched
    if (search)       data = data.filter(p => p.name?.toLowerCase().includes(search.toLowerCase()))
    if (gradeFilter !== "All") data = data.filter(p => p.grade === gradeFilter)
    return [...data].sort((a, b) => {
      let av = a[sortCol] ?? 0
      let bv = b[sortCol] ?? 0
      if (sortCol === "name") { av = a.name ?? ""; bv = b.name ?? "" }
      if (sortCol === "grade") { av = gradeRank(a.grade); bv = gradeRank(b.grade) }
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av)
      return sortDir === "asc" ? av - bv : bv - av
    })
  }, [enriched, search, gradeFilter, sortCol, sortDir])

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSort(col); setSortDir("desc") }
  }

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return null
    return sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search player..."
            className="w-full pl-8 pr-3 py-2 bg-pitch-800 border border-surface-border rounded-lg text-sm text-white focus:outline-none focus:border-accent/40"
          />
        </div>
        <select
          value={gradeFilter}
          onChange={e => setGrade(e.target.value)}
          className="bg-pitch-800 border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/40"
        >
          {["All", "S", "A", "A+", "B", "C"].map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <span className="text-xs text-slate-500">{filtered.length} players</span>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Value ≥ 75</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-accent inline-block" /> Value 50–74</span>
        <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-amber-400" /> Sleeper Pick</span>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-2 px-4 py-2.5 border-b border-surface-border bg-pitch-800/40">
          {COLS.map(col => (
            <button
              key={col.id}
              onClick={() => toggleSort(col.id)}
              className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-white transition-colors text-left"
            >
              {col.label} <SortIcon col={col.id} />
            </button>
          ))}
        </div>

        {/* Rows */}
        <div className="divide-y divide-surface-border/50">
          {filtered.length === 0 ? (
            <p className="text-center text-slate-500 text-sm py-8">No players match your filter.</p>
          ) : filtered.map(p => (
            <div key={p.id}>
              <button
                onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                className="w-full grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-2 px-4 py-3 hover:bg-pitch-800/40 transition-colors text-left"
              >
                {/* Player */}
                <div className="flex items-center gap-2 min-w-0">
                  <PlayerAvatarIcon player={p} size="sm" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-white truncate">{p.name}</span>
                      {p.sleeper && <Zap className="w-3 h-3 text-amber-400 flex-shrink-0" />}
                    </div>
                    <span className="text-xs text-slate-500 truncate">{p.team ?? "—"}</span>
                  </div>
                </div>

                {/* Grade */}
                <div className="flex items-center">
                  <GradeBadge grade={p.grade} />
                </div>

                {/* MV */}
                <div className="flex items-center">
                  <span className="text-sm font-mono text-white">₹{p.marketValue}</span>
                </div>

                {/* BDR */}
                <div className="flex items-center">
                  <span className="text-sm text-slate-300">{p.bdrPoints}</span>
                </div>

                {/* WR */}
                <div className="flex items-center">
                  <span className={cn("text-sm font-semibold",
                    p.wr == null ? "text-slate-600" :
                    p.wr >= 70 ? "text-emerald-400" :
                    p.wr >= 50 ? "text-white" : "text-rose-400"
                  )}>
                    {p.wr != null ? `${p.wr}%` : "—"}
                  </span>
                </div>

                {/* Value Score */}
                <div className="flex items-center">
                  <span className={cn("text-sm font-bold",
                    p.vs >= 75 ? "text-emerald-400" :
                    p.vs >= 50 ? "text-accent" : "text-slate-400"
                  )}>{p.vs}</span>
                </div>
              </button>

              {/* Expanded detail */}
              {expanded === p.id && (
                <div className="px-4 pb-3 pt-1 bg-pitch-900/40 border-t border-surface-border/40 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <p className="text-xs text-slate-500">Grade Ceiling</p>
                    <p className="text-sm font-semibold text-white mt-0.5">{p.gradeCeiling ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Grade Floor</p>
                    <p className="text-sm font-semibold text-white mt-0.5">{p.gradeFloor ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Recent Form</p>
                    <div className="flex gap-0.5 mt-0.5">
                      {(p.form ?? []).slice(0, 5).map((f, i) => (
                        <span key={i} className={cn("w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center",
                          f === "W" ? "bg-emerald-400/20 text-emerald-400" :
                          f === "D" ? "bg-amber-400/20 text-amber-400" :
                                      "bg-rose-400/20 text-rose-400"
                        )}>{f}</span>
                      ))}
                      {!p.form?.length && <span className="text-xs text-slate-600">No data</span>}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Auction type</p>
                    <p className="text-sm text-white mt-0.5 capitalize">{p.cardType ?? "Standard"}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}