import { useState } from "react"
import Layout from "../components/layout/Layout"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { Zap, ChevronUp, ChevronDown, Minus, RefreshCw } from "lucide-react"
import api from "../lib/api"
import { getAvatarById } from "../lib/avatars"
import { cn } from "../lib/utils"

function RankChange({ rank, prevRank }) {
  if (!prevRank) return <span className="text-[10px] font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded">NEW</span>
  const diff = prevRank - rank
  if (diff > 0) return (
    <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-400">
      <ChevronUp className="w-3 h-3" />{diff}
    </span>
  )
  if (diff < 0) return (
    <span className="flex items-center gap-0.5 text-[10px] font-bold text-rose-400">
      <ChevronDown className="w-3 h-3" />{Math.abs(diff)}
    </span>
  )
  return <Minus className="w-3 h-3 text-slate-600" />
}

function formatWindow(start, end) {
  const s = new Date(start)
  const e = new Date(end)
  return `${s.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${e.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
}

export default function WeeklyPowerRankings() {
  const navigate    = useNavigate()
  const qc          = useQueryClient()
  const [week, setWeek]           = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  // ── Live current rankings — refetch every 60 s so new matches appear fast ──
  const { data: current = [], isLoading, dataUpdatedAt } = useQuery({
    queryKey:  ["power-rankings-current"],
    queryFn:   () => api.get("/power-rankings/current").then(r => r.data),
    staleTime: 0,              // always considered stale — refetch on window focus
    refetchInterval: 60_000,   // auto-refresh every 60 seconds in background
  })

  const { data: history = [] } = useQuery({
    queryKey: ["power-rankings-history"],
    queryFn:  () => api.get("/power-rankings/history").then(r => r.data),
    staleTime: 1000 * 60 * 5,
  })

  const { data: weekData = [] } = useQuery({
    queryKey: ["power-rankings-week", week],
    queryFn:  () => api.get(`/power-rankings/week/${week}`).then(r => r.data),
    enabled:  !!week,
    staleTime: 1000 * 60 * 10,
  })

  const displayed  = week ? weekData : current
  const windowLabel = displayed[0] ? formatWindow(displayed[0].weekStart, displayed[0].weekEnd) : null

  // Last-updated label (only shown for live view)
  const lastUpdated = !week && dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    : null

  async function handleRefresh() {
    setRefreshing(true)
    await qc.invalidateQueries({ queryKey: ["power-rankings-current"] })
    setRefreshing(false)
  }

  return (
    <Layout>
      <div className="space-y-4">

        {/* Page header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center flex-shrink-0">
              <Zap className="w-4 h-4 text-accent" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Best Player of the Week</h1>
              <p className="text-sm text-slate-500">
                All matches across every tournament · last 4 days
              </p>
            </div>
          </div>

          {/* Manual refresh — only shown for live view */}
          {!week && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-border text-xs text-slate-400 hover:text-white hover:border-accent/40 transition-colors disabled:opacity-40"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
              Refresh
            </button>
          )}
        </div>

        {/* Week selector — only show when there are past snapshots */}
        {history.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button onClick={() => setWeek(null)}
              className={cn("flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all border",
                !week ? "bg-accent text-white border-accent" : "bg-pitch-800 text-slate-400 border-surface-border hover:text-white")}>
              This Week
            </button>
            {history.map(h => (
              <button key={h.weekStart} onClick={() => setWeek(h.weekStart)}
                className={cn("flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all border",
                  week === h.weekStart ? "bg-accent text-white border-accent" : "bg-pitch-800 text-slate-400 border-surface-border hover:text-white")}>
                {new Date(h.weekStart).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </button>
            ))}
          </div>
        )}

        {/* Date window + last updated */}
        <div className="flex items-center justify-between">
          {windowLabel && <p className="text-xs text-slate-500">{windowLabel}</p>}
          {lastUpdated && (
            <p className="text-xs text-slate-600">Updated {lastUpdated}</p>
          )}
        </div>

        {/* Rankings list */}
        {isLoading ? (
          Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="card p-4 animate-pulse h-16" />
          ))
        ) : displayed.length === 0 ? (
          <div className="card p-12 text-center">
            <Zap className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">No matches in the last 4 days</p>
            <p className="text-slate-600 text-sm mt-1">
              Rankings appear as soon as match results are logged
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayed.map((p, i) => {
              const preset    = getAvatarById(p.avatarId)
              const avatarSrc = p.avatarUrl || preset?.thumb
              const isTop3    = i < 3
              const rankColor = i === 0 ? "text-yellow-400" : i === 1 ? "text-slate-300" : i === 2 ? "text-amber-600" : "text-slate-500"

              return (
                <div key={p.id}
                  onClick={() => navigate(`/player/${p.id}`)}
                  className="card p-4 flex items-center gap-3 cursor-pointer hover:border-accent/30 transition-all active:scale-[0.99]">

                  {/* Rank + change badge */}
                  <div className="w-8 flex-shrink-0 text-center">
                    <span className={cn("text-lg font-black font-mono", rankColor)}>{p.rank}</span>
                    <div className="flex justify-center mt-0.5">
                      <RankChange rank={p.rank} prevRank={p.prevRank} />
                    </div>
                  </div>

                  {/* Avatar */}
                  {avatarSrc ? (
                    <img src={avatarSrc} alt={p.name}
                      className="w-11 h-11 rounded-xl object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-pitch-800 border border-surface-border flex items-center justify-center font-bold text-slate-400 flex-shrink-0">
                      {p.name?.[0]}
                    </div>
                  )}

                  {/* Name + team */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-sm truncate">{p.name}</p>
                    <p className="text-xs text-slate-500 truncate">{p.teamName || "No team"}</p>
                  </div>

                  {/* Points + record */}
                  <div className="flex-shrink-0 text-right">
                    <p className={cn("text-lg font-black font-mono", isTop3 ? "text-accent" : "text-white")}>
                      {p.points}pts
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {p.wins}W {p.draws}D {p.losses}L · {p.matches}m
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Layout>
  )
}