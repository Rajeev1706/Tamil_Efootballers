import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ChevronDown, Trophy, Users, TrendingUp, Activity } from "lucide-react"
import Layout from "../components/layout/Layout"
import StandingsTable from "../components/dashboard/StandingsTable"
import BDRRanking from "../components/dashboard/BDRRanking"
import MarketValues from "../components/dashboard/MarketValues"
import TrophyRanking from "../components/dashboard/TrophyRanking"
import PlayersDirectory from "../components/dashboard/PlayersDirectory"
import PastSeasonDashboard from "../components/dashboard/PastSeasonDashboard"
import Loading from "../components/common/Loading"
import { useTeams, usePlayers, useSeasonRecords, useSettings } from "../lib/queries"

const StatCard = ({ label, value, sub, icon: Icon, accent }) => (
  <div className="card p-4 flex items-start gap-3">
    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${accent}`}>
      <Icon className="w-4 h-4" />
    </div>
    <div>
      <p className="text-xs text-slate-500 font-medium mb-0.5">{label}</p>
      <p className="text-xl font-bold text-white font-mono">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  </div>
)

const PANEL_OPTIONS = [
  { value: "players",   label: "Total players" },
  { value: "standings", label: "League table"  },
  { value: "bdr",       label: "BDR ranking"   },
  { value: "market",    label: "Market values" },
  { value: "trophies",  label: "Trophies"      },
]

export default function CommonDashboard() {
  const navigate = useNavigate()
  const { data: teams   = [], isLoading: teamsLoading   } = useTeams()
  const { data: players = [], isLoading: playersLoading } = usePlayers()
  const { data: seasonRecords = [] }                      = useSeasonRecords()
  const { data: settings = {} }                          = useSettings()
  const [activePanel, setActivePanel]       = useState("players")
  const [selectedYear, setSelectedYear]     = useState(new Date().getFullYear())
  const [selectedSeason, setSelectedSeason] = useState(null)

  const handlePlayer = (player) => navigate(`/player/${player.id}`)
  const isLoading    = teamsLoading || playersLoading

  const currentSeason = parseInt(settings.current_season || "6")
  const currentYear   = new Date().getFullYear()

  const savedSeasons = [...seasonRecords].sort((a, b) => b.season_number - a.season_number)

  const availableYears = [
    ...new Set([currentYear, ...savedSeasons.map(r => r.year).filter(Boolean)])
  ].sort((a, b) => b - a)

  const seasonsForYear = selectedYear === currentYear
    ? [{ label: `Season ${currentSeason} · Current`, value: null }, ...savedSeasons.filter(r => r.year === selectedYear && r.season_number !== currentSeason).map(r => ({ label: r.season_name || `Season ${r.season_number}`, value: r.season_number }))]
    : savedSeasons.filter(r => r.year === selectedYear).map(r => ({ label: r.season_name || `Season ${r.season_number}`, value: r.season_number }))

  const isCurrent  = selectedSeason === null
  const pastRecord = selectedSeason ? seasonRecords.find(r => r.season_number === selectedSeason) : null

  const leader = [...players].sort((a, b) =>
    (b.bdrPoints - a.bdrPoints) || a.name.localeCompare(b.name)
  )[0]
  const topMV = [...players].sort((a, b) =>
    (b.marketValue - a.marketValue) || a.name.localeCompare(b.name)
  )[0]

  const currentSeasonRecord = seasonRecords.find(r => r.season_number === currentSeason)

  return (
    <Layout>
      {/* Hero */}
      <div className="relative mb-8 rounded-2xl overflow-hidden border border-surface-border">
        <div className="absolute inset-0 bg-gradient-to-r from-pitch-800 via-pitch-800 to-pitch-700" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.12),transparent_60%)]" />
        <div className="relative px-6 py-8 sm:px-8">

          {/* Year + Season selectors */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {/* Year dropdown */}
            <div className="relative">
              <select
                value={selectedYear}
                onChange={e => {
                  const yr = parseInt(e.target.value)
                  setSelectedYear(yr)
                  setSelectedSeason(null) // reset to current when year changes
                }}
                className="appearance-none bg-white/10 border border-white/20 rounded-lg pl-3 pr-8 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-accent/50 cursor-pointer"
              >
                {availableYears.map(y => (
                  <option key={y} value={y} className="bg-pitch-900 text-white">{y}</option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-white/60 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Season dropdown */}
            <div className="relative">
              <select
                value={selectedSeason ?? "current"}
                onChange={e => {
                  const val = e.target.value
                  setSelectedSeason(val === "current" ? null : parseInt(val))
                }}
                className="appearance-none bg-white/10 border border-white/20 rounded-lg pl-3 pr-8 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-accent/50 cursor-pointer"
              >
                {seasonsForYear.map(s => (
                  <option key={s.value ?? "current"} value={s.value ?? "current"} className="bg-pitch-900 text-white">
                    {s.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-white/60 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {!isCurrent && (
              <span className="text-xs text-slate-500 bg-pitch-800 border border-surface-border px-2 py-1 rounded-lg">
                Archived
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-1">
            Tamil Efootball League
          </h1>

          {isCurrent ? (
            <>
              <p className="text-slate-400 text-sm">{teams.length} teams · {players.length} players</p>
              {teams[0] && (
                <div className="mt-4 flex items-center gap-2">
                  <span className="text-xs text-slate-500">League leader</span>
                  <span className="text-xs font-semibold text-white bg-accent/15 border border-accent/25 px-2 py-0.5 rounded-full">
                    {teams[0].name} · {teams[0].points} pts
                  </span>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-slate-400 text-sm">
                {pastRecord?.season_name || `Season ${selectedSeason}`}
              </p>
              {pastRecord?.champion_team && (
                <div className="mt-4 flex items-center gap-2">
                  <span className="text-xs text-slate-500">Champions</span>
                  <span className="text-xs font-semibold text-gold bg-gold/10 border border-gold/25 px-2 py-0.5 rounded-full">
                    🏆 {pastRecord.champion_team} · {pastRecord.champion_pts} pts
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Past season view */}
      {!isCurrent ? (
        <PastSeasonDashboard record={pastRecord} season={selectedSeason} />
      ) : (
        <>
          {isLoading ? <Loading /> : (
            <>
              {/* Stat cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
                <StatCard label="BDR Leader"  value={leader?.bdrPoints?.toLocaleString() ?? "—"} sub={leader?.name}    icon={Trophy}    accent="bg-gold/15 text-gold"              />
                <StatCard label="Highest MV"  value={topMV?.marketValue ?? "—"}                   sub={topMV?.name}     icon={TrendingUp} accent="bg-accent/15 text-accent"        />
                <StatCard label="Teams"       value={teams.length}                                 sub="in the league"   icon={Users}      accent="bg-violet-400/15 text-violet-400" />
                <StatCard label="Players"     value={players.length}                               sub="registered"      icon={Activity}   accent="bg-blue-400/15 text-blue-400"    />
              </div>

              {/* Panel */}
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Dashboard view</p>
                <select
                  value={activePanel}
                  onChange={e => setActivePanel(e.target.value)}
                  className="bg-pitch-800 border border-surface-border rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-accent/40 transition-colors"
                >
                  {PANEL_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {activePanel === "players"   && <PlayersDirectory players={players} onPlayerClick={handlePlayer} />}
              {activePanel === "standings" && <StandingsTable teams={teams} players={players} onPlayerClick={handlePlayer} />}
              {activePanel === "bdr"       && <BDRRanking players={players} onPlayerClick={handlePlayer} />}
              {activePanel === "market"    && <MarketValues players={players} onPlayerClick={handlePlayer} />}
              {activePanel === "trophies"  && <TrophyRanking players={players} onPlayerClick={handlePlayer} />}
            </>
          )}
        </>
      )}
    </Layout>
  )
}