import { useQuery } from "@tanstack/react-query"
import Layout from "../components/layout/Layout"
import { useNavigate } from "react-router-dom"
import { Eye, Flame } from "lucide-react"
import api from "../lib/api"
import { getAvatarById } from "../lib/avatars"
import { cn } from "../lib/utils"

const GRADE_COLORS = {
  S:   "bg-yellow-400/15 text-yellow-400 border-yellow-400/30",
  "A+":"bg-emerald-400/15 text-emerald-400 border-emerald-400/30",
  A:   "bg-blue-400/15 text-blue-400 border-blue-400/30",
  B:   "bg-violet-400/15 text-violet-400 border-violet-400/30",
  C:   "bg-slate-400/15 text-slate-400 border-slate-400/30",
}

export default function TrendingProfiles() {
  const navigate = useNavigate()
  const { data: players = [], isLoading } = useQuery({
    queryKey: ["trending-profiles"],
    queryFn:  () => api.get("/trending/profiles").then(r => r.data),
    staleTime: 1000 * 60 * 5,
  })

  return (
    <Layout>
      <div className="space-y-4">

        {/* Page header */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-400/15 flex items-center justify-center flex-shrink-0">
            <Flame className="w-4 h-4 text-orange-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Trending This Week</h1>
            <p className="text-sm text-slate-500">Most visited player profiles in the last 7 days</p>
          </div>
        </div>

        {/* Player list */}
        {isLoading ? (
          Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="card p-4 animate-pulse h-16" />
          ))
        ) : players.length === 0 ? (
          <div className="card p-12 text-center">
            <Eye className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No profile views recorded yet this week</p>
          </div>
        ) : (
          <div className="space-y-2">
            {players.map((p, i) => {
              const preset    = getAvatarById(p.avatarId)
              const avatarSrc = p.avatarUrl || preset?.thumb
              const rankColor = i === 0 ? "text-yellow-400" : i === 1 ? "text-slate-300" : i === 2 ? "text-amber-600" : "text-slate-500"

              return (
                <div key={p.id}
                  onClick={() => navigate(`/player/${p.id}`)}
                  className="card p-4 flex items-center gap-4 cursor-pointer hover:border-accent/30 transition-all active:scale-[0.99]">
                  <span className={cn("text-lg font-black font-mono w-8 text-center flex-shrink-0", rankColor)}>
                    {i + 1}
                  </span>
                  {avatarSrc ? (
                    <img src={avatarSrc} alt={p.name}
                      className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-surface-border" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-pitch-800 border border-surface-border flex items-center justify-center text-lg font-bold text-slate-400 flex-shrink-0">
                      {p.name?.[0]}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-white truncate">{p.name}</p>
                    </div>
                    <p className="text-xs text-slate-500 truncate">{p.teamName || "No team"}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="flex items-center gap-1.5 justify-end">
                      <Eye className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-sm font-bold text-white">{p.views.toLocaleString()}</span>
                    </div>
                    {p.viewsToday > 0 && (
                      <p className="text-[10px] text-orange-400 font-medium">+{p.viewsToday} today</p>
                    )}
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