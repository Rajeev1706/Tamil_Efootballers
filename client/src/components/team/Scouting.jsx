import { useState } from "react"
import { Search, ArrowLeftRight, CheckCircle } from "lucide-react"
import GradeBadge from "../common/GradeBadge"
import TradeModal from "./TradeModal"
import { useRequestTrade } from "../../lib/queries"
import { getMVTier, cn } from "../../lib/utils"

const GRADES = ["All","S","A","B","C"]

export default function Scouting({ allPlayers, myTeamName, onPlayerClick, onTradeSuccess }) {
  const [gradeFilter, setGradeFilter] = useState("All")
  const [teamFilter, setTeamFilter]   = useState("All")
  const [search, setSearch]           = useState("")
  const [tradeTarget, setTradeTarget] = useState(null)
  const [requested, setRequested]     = useState(new Set())

  const requestTrade = useRequestTrade()
  const teams = ["All", ...new Set(allPlayers.map(p => p.team))]

  const filtered = allPlayers.filter(p => {
    const matchGrade = gradeFilter === "All" || p.grade === gradeFilter
    const matchTeam  = teamFilter  === "All" || p.team  === teamFilter
    const matchName  = p.name.toLowerCase().includes(search.toLowerCase())
    return matchGrade && matchTeam && matchName
  })

  const handleConfirm = (player) => {
    requestTrade.mutate(
      { playerId: player.id, toTeamId: player.teamId },
      {
        onSuccess: () => {
          setRequested(prev => new Set([...prev, player.id]))
          setTradeTarget(null)
          onTradeSuccess?.()
        },
        onError: (err) => {
          alert(err.response?.data?.error || "Trade request failed")
          setTradeTarget(null)
        },
      }
    )
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input type="text" placeholder="Search player name…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-pitch-800 border border-surface-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent/40 transition-colors" />
        </div>
        <div className="flex gap-2">
          <select value={gradeFilter} onChange={e => setGradeFilter(e.target.value)}
            className="bg-pitch-800 border border-surface-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent/40">
            {GRADES.map(g => <option key={g}>{g}</option>)}
          </select>
          <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)}
            className="bg-pitch-800 border border-surface-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent/40 max-w-[160px]">
            {teams.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <p className="text-xs text-slate-600 mb-4">{filtered.length} player{filtered.length!==1?"s":""} found</p>

      <div className="card overflow-hidden">
        <div className="hidden sm:grid grid-cols-[2fr_80px_2fr_100px_100px_100px_140px] px-5 py-2.5 border-b border-surface-border">
          {["Player","Grade","Team","Auction","MV","BDR",""].map(h => (
            <span key={h} className={cn("text-xs font-semibold text-slate-600 uppercase tracking-wide", h === "Auction" || h === "MV" || h === "BDR" ? "text-right" : "")}>{h}</span>
          ))}
        </div>
        <div className="divide-y divide-surface-border/60">
          {filtered.length === 0 ? (
            <div className="px-5 py-12 text-center text-slate-500 text-sm">No players match your filters.</div>
          ) : filtered.map(player => {
            const isMyPlayer   = player.team === myTeamName
            const hasRequested = requested.has(player.id)
            const tier         = getMVTier(player.marketValue)
            return (
              <div key={player.id} className={cn("grid grid-cols-1 sm:grid-cols-[2fr_80px_2fr_100px_100px_100px_140px] px-5 py-4 items-center transition-colors", isMyPlayer?"bg-accent/5":"hover:bg-surface-hover")}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-surface-border flex items-center justify-center text-xs font-bold text-slate-400 flex-shrink-0">
                    {player.name.split(" ").map(n=>n[0]).join("")}
                  </div>
                  <div>
                    <button onClick={() => onPlayerClick?.(player)} className="text-sm font-medium text-white hover:text-accent transition-colors text-left">{player.name}</button>
                    <p className="text-xs text-slate-600 sm:hidden">{player.team}</p>
                  </div>
                </div>
                <div><GradeBadge grade={player.grade} /></div>
                <p className="hidden sm:block text-sm text-slate-400 truncate">{player.team}</p>
                <p className="text-sm font-mono text-slate-400 text-right">{player.auctionPrice}</p>
                <div className="text-right">
                  <p className="text-sm font-bold font-mono text-white">{player.marketValue}</p>
                  <p className={cn("text-xs", tier.color)}>{tier.label}</p>
                </div>
                <p className="text-sm font-mono text-slate-300 text-right">{player.bdrPoints?.toLocaleString()}</p>
                <div className="flex justify-end">
                  {isMyPlayer ? (
                    <span className="text-xs text-accent font-semibold bg-accent/10 border border-accent/20 px-2.5 py-1 rounded-lg">Your player</span>
                  ) : hasRequested ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold"><CheckCircle className="w-3.5 h-3.5" /> Requested</span>
                  ) : (
                    <button onClick={() => setTradeTarget(player)} className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-surface-border hover:bg-surface-hover border border-surface-border hover:border-accent/30 px-3 py-1.5 rounded-lg transition-all">
                      <ArrowLeftRight className="w-3 h-3" /> Request trade
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <TradeModal
        player={tradeTarget}
        onConfirm={handleConfirm}
        onClose={() => setTradeTarget(null)}
        isLoading={requestTrade.isPending}
      />
    </>
  )
}