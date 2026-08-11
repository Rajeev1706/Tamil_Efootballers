import { useNavigate } from "react-router-dom"
import { useState } from "react"
import { Trophy } from "lucide-react"
import { cn } from "../lib/utils"
import { useTrophyHistory, useTrophyHistoryYear } from "../lib/queries"
import { getAvatarById } from "../lib/avatars"
import Layout from "../components/layout/Layout"
import GradeBadge from "../components/common/GradeBadge"

import ballondorTrophy    from "../../images/ballondor.png"
import teamLeagueTrophy   from "../../images/Team League.png"
import weeklyTrophy       from "../../images/Weekly.png"
import uclTrophy          from "../../images/ucl.png"
import goldenBootTrophy   from "../../images/Golden Boot.png"
import teamLeagueGBTrophy from "../../images/team league_gb.png"
import uclGBTrophy        from "../../images/ucl_gb.png"
import revolutionTrophy   from "../../images/revolution.png"

const TROPHIES = [
  { key: "trophy1Count", image: ballondorTrophy,    label: "Ballon d'Or",        color: "#f59e0b" },
  { key: "trophy2Count", image: teamLeagueTrophy,   label: "Team League",        color: "#10b981" },
  { key: "trophy4Count", image: uclTrophy,          label: "UCL",                color: "#818cf8" },
  { key: "trophy3Count", image: weeklyTrophy,       label: "Weekly",             color: "#38bdf8" },
  { key: "trophy5Count", image: goldenBootTrophy,   label: "Weekly GB",          color: "#fbbf24" },
  { key: "trophy6Count", image: teamLeagueGBTrophy, label: "League GB",          color: "#34d399" },
  { key: "trophy7Count", image: uclGBTrophy,        label: "UCL GB",             color: "#a78bfa" },
  { key: "trophy8Count", image: revolutionTrophy,   label: "Revolution",         color: "#f43f5e" },
]

export default function TrophyCabinet() {
  const navigate = useNavigate()
  const [yearFilter, setYearFilter] = useState("overall")
  const [search, setSearch] = useState("")
  const currentYear = new Date().getFullYear()
  const pastYear    = currentYear - 1

  const isOverall     = yearFilter === "overall"
  const yearNum       = isOverall ? null : parseInt(yearFilter)

  const { data: overallData = [],  isLoading: loadOverall } = useTrophyHistory()
  const { data: yearData    = [],  isLoading: loadYear    } = useTrophyHistoryYear(yearNum)

  const allPlayers = isOverall ? overallData : yearData
  const isLoading  = isOverall ? loadOverall : loadYear

  const allFiltered = allPlayers
    .map(p => ({
      ...p,
      total: TROPHIES.reduce((a, t) => a + (Number(p[t.key]) || 0), 0),
    }))
    .filter(p => p.total > 0)
    .sort((a, b) => b.total - a.total)

  const players = search
    ? allFiltered.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || (p.team || "").toLowerCase().includes(search.toLowerCase()))
    : allFiltered

  return (
    <Layout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl bg-gold/10 border border-gold/25 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-gold" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white">Trophy Cabinet</h1>
            <p className="text-sm text-slate-500">{players.length} players with trophies</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search player or team..."
            className="w-full pl-4 pr-4 py-2.5 bg-pitch-800 border border-surface-border rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent"
          />
        </div>

        {/* Player list */}
        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-7 h-7 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : players.length === 0 ? (
            <div className="py-16 text-center">
              <Trophy className="w-8 h-8 text-slate-700 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">No trophies awarded yet</p>
            </div>
          ) : (
            <div className="divide-y divide-surface-border/50">
              {players.map((player, idx) => {
                const preset    = getAvatarById(player.avatarId)
                const avatarSrc = player.avatarUrl || preset?.thumb
                return (
                  <div
                    key={player.id}
                    onClick={() => navigate(`/trophy-cabinet/${player.id}`)}
                    className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-surface-hover/30 transition-colors"
                  >
                    {/* Rank */}
                    <span className={cn("text-sm font-bold w-6 text-center flex-shrink-0",
                      idx === 0 ? "text-gold" : idx === 1 ? "text-slate-300" : idx === 2 ? "text-amber-600" : "text-slate-500"
                    )}>
                      #{idx + 1}
                    </span>

                    {/* Player avatar */}
                    {avatarSrc
                      ? <img src={avatarSrc} alt={player.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                      : <div className="w-10 h-10 rounded-lg bg-surface-border flex items-center justify-center text-sm font-bold text-slate-400 flex-shrink-0">
                          {player.name?.split(" ").map(n => n[0]).join("")}
                        </div>
                    }

                    {/* Name + team */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-white truncate">{player.name}</span>
                        <GradeBadge grade={player.grade} size="sm" />
                      </div>
                      <span className="text-[10px] text-slate-500 truncate">{player.team || "—"}</span>
                    </div>

                    {/* Total */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-black text-gold font-mono">{player.total}</p>
                      <p className="text-[10px] text-slate-500">total</p>
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