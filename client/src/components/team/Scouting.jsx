import { useState } from "react"
import { Search, ArrowLeftRight, CheckCircle, Crown, Star } from "lucide-react"
import GradeBadge from "../common/GradeBadge"
import TradeModal from "./TradeModal"
import { useRequestTrade, useFavorites, useToggleFavorite } from "../../lib/queries"
import { getMVTier, cn } from "../../lib/utils"
import { TeamLogoIcon } from "../common/TeamLogo"

const GRADES = ["All","S","A","B","C"]

export default function Scouting({ allPlayers, myTeamName, myPlayers = [], myPurse = 0, onPlayerClick, onTradeSuccess, view: controlledView, onViewChange }) {
  const [gradeFilter, setGradeFilter] = useState("All")
  const [teamFilter, setTeamFilter]   = useState("All")
  const [search, setSearch]           = useState("")
  const [tradeTarget, setTradeTarget] = useState(null)
  const [requested, setRequested]     = useState(new Set())
  const [internalView, setInternalView] = useState("favorites") // "favorites" | "all"
  const view    = controlledView || internalView
  const setView = onViewChange || setInternalView

  const requestTrade   = useRequestTrade()
  const { data: favoriteIds = [] } = useFavorites()
  const toggleFavorite = useToggleFavorite()
  const favoriteSet     = new Set(favoriteIds)

  const teams = ["All", ...new Set(allPlayers.map(p => p.team))]

  const scopedPlayers = view === "favorites"
    ? allPlayers.filter(p => favoriteSet.has(p.id))
    : allPlayers

  const filtered = scopedPlayers.filter(p => {
    const matchGrade = gradeFilter === "All" || p.grade === gradeFilter
    const matchTeam  = teamFilter  === "All" || p.team  === teamFilter
    const matchName  = p.name.toLowerCase().includes(search.toLowerCase())
    return matchGrade && matchTeam && matchName
  })

  const handleConfirm = (body) => {
    requestTrade.mutate(
      body,
      {
        onSuccess: () => {
          setRequested(prev => new Set([...prev, body.playerId]))
          setTradeTarget(null)
          onTradeSuccess?.()
        },
        onError: (err) => {
          alert(err.response?.data?.error || "Trade request failed")
        },
      }
    )
  }

  const handleToggleFavorite = (playerId, e) => {
    e.stopPropagation()
    toggleFavorite.mutate({ playerId, isFavorited: favoriteSet.has(playerId) })
  }

  return (
    <>
      {/* View toggle: My favorites vs All players */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setView("favorites")}
          className={cn(
            "flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-xl border transition-all",
            view === "favorites"
              ? "border-amber-400/50 bg-amber-400/10 text-amber-400"
              : "border-surface-border text-slate-400 hover:text-white hover:border-slate-500"
          )}
        >
          <Star className={cn("w-3.5 h-3.5", view === "favorites" && "fill-amber-400")} />
          My favorites {favoriteIds.length > 0 && `(${favoriteIds.length})`}
        </button>
        <button
          onClick={() => setView("all")}
          className={cn(
            "text-sm font-semibold px-3.5 py-2 rounded-xl border transition-all",
            view === "all"
              ? "border-accent/50 bg-accent/10 text-accent"
              : "border-surface-border text-slate-400 hover:text-white hover:border-slate-500"
          )}
        >
          All players
        </button>
      </div>

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
        <div className="hidden sm:grid grid-cols-[32px_2fr_80px_2fr_100px_100px_100px_140px] px-5 py-2.5 border-b border-surface-border">
          {["","Player","Grade","Team","Auction","MV","BDR",""].map((h, i) => (
            <span key={i} className={cn("text-xs font-semibold text-slate-600 uppercase tracking-wide", h === "Auction" || h === "MV" || h === "BDR" ? "text-right" : "")}>{h}</span>
          ))}
        </div>
        <div className="divide-y divide-surface-border/60">
          {filtered.length === 0 ? (
            <div className="px-5 py-12 text-center text-slate-500 text-sm">
              {view === "favorites"
                ? "No favorites yet — star players to track them here."
                : "No players match your filters."}
            </div>
          ) : filtered.map(player => {
            const isMyPlayer   = player.team === myTeamName
            const hasRequested = requested.has(player.id)
            const tier         = getMVTier(player.marketValue)
            const isFavorited  = favoriteSet.has(player.id)
            return (
              <div key={player.id} className={cn("grid grid-cols-1 sm:grid-cols-[32px_2fr_80px_2fr_100px_100px_100px_140px] px-5 py-4 items-center transition-colors", isMyPlayer?"bg-accent/5":"hover:bg-surface-hover")}>
                <button
                  onClick={(e) => handleToggleFavorite(player.id, e)}
                  className="flex items-center justify-center w-6 h-6 mb-2 sm:mb-0 hover:scale-110 transition-transform"
                  title={isFavorited ? "Remove from favorites" : "Add to favorites"}
                >
                  <Star className={cn(
                    "w-4 h-4 transition-colors",
                    isFavorited ? "fill-amber-400 text-amber-400" : "text-slate-600 hover:text-slate-400"
                  )} />
                </button>
                <button
                  onClick={() => onPlayerClick?.(player)}
                  className="flex items-center gap-2.5 text-left hover:opacity-80 transition-opacity"
                >
                  <div className="w-8 h-8 rounded-lg bg-surface-border flex items-center justify-center text-xs font-bold text-slate-400 flex-shrink-0">
                    {player.name.split(" ").map(n=>n[0]).join("")}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-white hover:text-accent transition-colors">{player.name}</span>
                      {player.isCaptain && <Crown className="w-3 h-3 text-gold flex-shrink-0" />}
                    </div>
                    <p className="text-xs text-slate-600 sm:hidden inline-flex items-center gap-1.5">
                      <TeamLogoIcon logoUrl={player.teamLogo} name={player.team} size="w-3 h-3" />
                      {player.team}
                    </p>
                  </div>
                </button>
                <div><GradeBadge grade={player.grade} /></div>
                <p className="hidden sm:flex items-center gap-2 text-sm text-slate-400 truncate">
                  <TeamLogoIcon logoUrl={player.teamLogo} name={player.team} />
                  {player.team}
                </p>
                <p className={cn("text-sm font-mono text-right", player.isCaptain ? "font-bold text-gold" : "text-slate-400")}>
                  {player.isCaptain ? "CAP" : player.auctionPrice}
                </p>
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
        myPlayers={myPlayers}
        myPurse={myPurse}
        onConfirm={handleConfirm}
        onClose={() => setTradeTarget(null)}
        isLoading={requestTrade.isPending}
      />
    </>
  )
}