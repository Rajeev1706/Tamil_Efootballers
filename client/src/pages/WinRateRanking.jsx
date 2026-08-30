import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { TrendingUp, Crown, Search } from "lucide-react"
import { cn } from "../lib/utils"
import { getAvatarById } from "../lib/avatars"
import { useWinRateRanking, useWinRateSeasons } from "../lib/queries"
import Layout from "../components/layout/Layout"
import GradeBadge from "../components/common/GradeBadge"
import RankBadge from "../components/common/RankBadge"
import { useRankChanges } from "../hooks/useRankChanges"

const TYPES = [
  { id: "overall", label: "Overall"     },
  { id: "league",  label: "Dshann League" },
  { id: "weekly",  label: "Weekly"      },
  { id: "ucl",     label: "UCL"         },
]

const FormDot = ({ result }) => {
  const map = { W: "bg-emerald-500", D: "bg-amber-400", L: "bg-rose-500" }
  return <span className={cn("w-2 h-2 rounded-full", map[result] || "bg-slate-600")} title={result} />
}

export default function WinRateRanking() {
  const [activeType,   setActiveType]   = useState("overall")
  const [search,       setSearch]       = useState("")
  const [activeSeason, setActiveSeason] = useState("all")
  const navigate = useNavigate()

  const { data: seasonsData } = useWinRateSeasons()
  const currentSeason = seasonsData?.currentSeason
  const allSeasons    = seasonsData?.seasons || []
  const pastSeasons   = allSeasons.filter(s => s !== currentSeason)

  const { data: players = [], isLoading } = useWinRateRanking(activeType, activeSeason)
  const rankChanges = useRankChanges("winrate-ranking-" + activeType, players.map(p => p.id))

  const filtered = search
    ? players.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || (p.team || "").toLowerCase().includes(search.toLowerCase()))
    : players
  const maxWR = Number(players[0]?.winRate) || 1

  return (
    <Layout>
      <div className="space-y-4">

        {/* Type tabs — matches the sub-tab style used across the app */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {TYPES.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveType(t.id)}
              className={cn(
                "flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all border",
                activeType === t.id
                  ? "bg-accent text-white border-accent"
                  : "bg-pitch-800 text-slate-400 border-surface-border hover:text-white hover:border-slate-600"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Season dropdown */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 flex-shrink-0">Season:</label>
          <select
            value={activeSeason}
            onChange={e => setActiveSeason(e.target.value)}
            className="bg-pitch-800 border border-surface-border rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
          >
            <option value="all">All Seasons</option>
            <option value="current">Current Season {currentSeason ? `(S${currentSeason})` : ""}</option>
            {pastSeasons.map(s => (
              <option key={s} value={String(s)}>Season {s}</option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search player or team..."
            className="w-full pl-10 pr-4 py-2.5 bg-pitch-800 border border-surface-border rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent"
          />
        </div>

        {/* Main card — same structure as BDRRanking */}
        <div className="card overflow-hidden">

          {/* Header */}
          <div className="px-5 py-4 border-b border-surface-border flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/25 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="section-label mb-0.5">Win Rate Ranking</p>
              <h2 className="text-base font-semibold text-white">
                {TYPES.find(t => t.id === activeType)?.label} ·{" "}
                {activeSeason === "all" ? "All Seasons" : activeSeason === "current" ? `Season ${currentSeason}` : `Season ${activeSeason}`}
                {activeSeason === "all" && ` · min ${activeType === "overall" ? 20 : activeType === "league" ? 14 : activeType === "ucl" ? 8 : 10} matches`}
                {activeSeason !== "all" && ` · min matches apply`}
              </h2>
            </div>
            {!isLoading && (
              <span className="ml-auto text-xs text-slate-500">{filtered.length}{filtered.length !== players.length ? ` of ${players.length}` : ""} players</span>
            )}
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <div className="w-7 h-7 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Empty */}
          {!isLoading && players.length === 0 && (
            <div className="py-16 text-center">
              <TrendingUp className="w-8 h-8 text-slate-700 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">No players with matches yet</p>
            </div>
          )}

          {/* Rows */}
          {!isLoading && players.length > 0 && (
            <div className="divide-y divide-surface-border">
              {filtered.map((player, idx) => {
                const isFirst  = idx === 0
                const wr       = Number(player.winRate)
                const barPct   = (wr / maxWR) * 100
                const preset   = getAvatarById(player.avatarId)
                const avatarSrc = player.avatarUrl || preset?.thumb

                return (
                  <div
                    key={player.id}
                    onClick={() => navigate(`/player/${player.id}`)}
                    className={cn(
                      "px-5 py-3.5 flex items-center gap-4 transition-colors cursor-pointer",
                      isFirst ? "bg-accent/5 hover:bg-accent/8" : "hover:bg-surface-hover"
                    )}
                  >
                    {/* Rank */}
                    <div className="w-8 sm:w-14 flex-shrink-0 flex items-center justify-center">
                      {isFirst
                        ? <Crown className="w-4 h-4 text-accent" />
                        : <span className="text-xs font-medium text-slate-500">#{idx + 1}</span>
                      }
                    </div>

                    {/* Avatar */}
                    {avatarSrc
                      ? <img src={avatarSrc} alt={player.name} className="w-8 h-8 sm:w-[43px] sm:h-[43px] rounded-lg object-cover flex-shrink-0" />
                      : <div className={cn("w-8 h-8 sm:w-[43px] sm:h-[43px] rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0",
                          isFirst ? "bg-accent/20 text-accent" : "bg-surface-border text-slate-400"
                        )}>
                          {player.name.split(" ").map(n => n[0]).join("")}
                        </div>
                    }

                    {/* Name + bar + stats */}
                    <div className="flex-1 min-w-0">
                      <p className={cn("font-semibold text-xs sm:text-sm truncate", isFirst ? "text-white" : "text-slate-300")}>
                        {player.name}
                      </p>
                      <div className="h-1 bg-surface-border rounded-full overflow-hidden my-1">
                        <div className={cn("h-full rounded-full", wr>=70?"bg-emerald-400":wr>=50?"bg-accent":wr>=35?"bg-amber-400":"bg-rose-400")} style={{width:`${barPct}%`}}/>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] text-emerald-400 font-mono">{player.wins}W</span>
                        <span className="text-[9px] text-amber-400 font-mono">{player.draws}D</span>
                        <span className="text-[9px] text-rose-400 font-mono">{player.losses}L</span>
                        {player.team && <span className="text-[9px] text-slate-600 truncate hidden sm:inline">· {player.team}</span>}
                      </div>
                    </div>

                    {/* Matches */}
                    <div className="text-center flex-shrink-0 w-10 sm:w-16">
                      <span className="text-xs sm:text-sm font-bold text-white font-mono">{player.total}</span>
                      <p className="text-[9px] sm:text-xs text-slate-500">matches</p>
                    </div>

                    {/* Desktop: form dots */}
                    <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
                      {(player.form || []).slice(0,5).map((r, i) => <FormDot key={i} result={r} />)}
                    </div>

                    {/* Desktop: W/D/L full */}
                    <div className="hidden sm:flex items-center gap-2 text-xs flex-shrink-0 w-24 justify-end">
                      <span className="text-emerald-400 font-mono">{player.wins}W</span>
                      <span className="text-amber-400 font-mono">{player.draws}D</span>
                      <span className="text-rose-400 font-mono">{player.losses}L</span>
                    </div>

                    {/* Win rate */}
                    <div className="text-right flex-shrink-0 w-14 sm:w-16">
                      <span className={cn("font-bold text-xs sm:text-sm font-mono",
                        wr>=70?"text-emerald-400":wr>=50?"text-accent":wr>=35?"text-amber-400":"text-rose-400"
                      )}>{wr}%</span>
                      <p className="text-[9px] sm:text-xs text-slate-600 mt-0.5">win rate</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}