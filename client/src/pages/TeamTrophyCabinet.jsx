import { useNavigate } from "react-router-dom"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Trophy, ChevronRight } from "lucide-react"
import Layout from "../components/layout/Layout"
import { useCachedImage } from "../hooks/useCachedImage"
import api from "../lib/api"
import { cn } from "../lib/utils"

import teamLeagueTrophy from "../../images/Team League.png"

function TeamRow({ team }) {
  const navigate = useNavigate()
  const logoSrc  = useCachedImage(team.logoUrl)
  const count    = team.totalTrophies || 0

  return (
    <button
      onClick={() => navigate(`/team-trophies/${team.id}`)}
      className="w-full flex items-center gap-4 px-5 py-4 hover:bg-surface-hover transition-colors group"
    >
      {/* Logo */}
      {logoSrc
        ? <img src={logoSrc} alt={team.name} className="w-10 h-10 rounded-xl object-cover border border-surface-border flex-shrink-0" />
        : <div className="w-10 h-10 rounded-xl bg-pitch-800 border border-surface-border flex items-center justify-center text-sm font-bold text-slate-400 flex-shrink-0">
            {team.name?.slice(0, 2).toUpperCase()}
          </div>
      }

      {/* Name */}
      <div className="flex-1 text-left min-w-0">
        <p className="font-bold text-white text-sm">{team.name}</p>
      </div>

      {/* Title count — always show, 0 for teams with no titles */}
      <span className={cn(
        "font-extrabold font-mono text-lg flex-shrink-0",
        count > 0 ? "text-gold" : "text-slate-700"
      )}>
        {count}
      </span>

      <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 flex-shrink-0" />
    </button>
  )
}

export default function TeamTrophyCabinet() {
  const [yearFilter, setYearFilter] = useState("overall")

  const { data: seasons = [] } = useQuery({
    queryKey: ["team-trophies-seasons"],
    queryFn:  () => api.get("/team-trophies/seasons").then(r => r.data),
  })

  const { data: teams = [], isLoading } = useQuery({
    queryKey: ["team-trophies", yearFilter],
    queryFn:  () => api.get(`/team-trophies${yearFilter !== "overall" ? `?year=${yearFilter}` : ""}`).then(r => r.data),
  })
  // seasons is now [{season_number, year}] — year comes from season_calendar

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gold/10 border border-gold/25 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-gold" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white">Team Trophy Cabinet</h1>
            <p className="text-sm text-slate-500">Team League champions by season</p>
          </div>
        </div>

        {/* Season filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setYearFilter("overall")}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all",
              yearFilter === "overall"
                ? "bg-accent text-white border-accent"
                : "bg-pitch-800 text-slate-400 border-surface-border hover:text-white"
            )}
          >
            Overall
          </button>
          {[...new Set(seasons.filter(s => s.year).map(s => s.year))].sort().map(year => (
            <button
              key={year}
              onClick={() => setYearFilter(String(year))}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all",
                yearFilter === String(year)
                  ? "bg-accent text-white border-accent"
                  : "bg-pitch-800 text-slate-400 border-surface-border hover:text-white"
              )}
            >
              {year}
            </button>
          ))}
        </div>

        {/* Teams list — all teams ordered by title count */}
        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="py-12 text-center text-slate-500 text-sm">Loading...</div>
          ) : (
            <div className="divide-y divide-surface-border/50">
              {teams.map(team => <TeamRow key={team.id} team={team} />)}
            </div>
          )}
        </div>

      </div>
    </Layout>
  )
}