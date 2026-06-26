import { useState } from "react"
import { useNavigate } from "react-router-dom"
import Layout from "../components/layout/Layout"
import StandingsTable from "../components/dashboard/StandingsTable"
import BDRRanking from "../components/dashboard/BDRRanking"
import MarketValues from "../components/dashboard/MarketValues"
import TrophyRanking from "../components/dashboard/TrophyRanking"
import PlayersDirectory from "../components/dashboard/PlayersDirectory"
import Loading from "../components/common/Loading"
import { useTeams, usePlayers } from "../lib/queries"
import { Trophy, Users, TrendingUp, Activity } from "lucide-react"

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
  { value: "players",    label: "Total players" },
  { value: "standings", label: "League table" },
  { value: "bdr",        label: "BDR ranking" },
  { value: "market",     label: "Market values" },
  { value: "trophies",   label: "Trophies" },
]

export default function CommonDashboard() {
  const navigate = useNavigate()
  const { data: teams = [],   isLoading: teamsLoading,   isError: teamsError   } = useTeams()
  const { data: players = [], isLoading: playersLoading, isError: playersError } = usePlayers()
  const [activePanel, setActivePanel] = useState("players")

  const handlePlayer = (player) => navigate(`/player/${player.id}`)
  const isLoading = teamsLoading || playersLoading
  const isError   = teamsError   || playersError

  const leader = [...players].sort((a, b) =>
    (b.bdrPoints - a.bdrPoints) || a.name.localeCompare(b.name)
  )[0]
  const topMV  = [...players].sort((a, b) =>
    (b.marketValue - a.marketValue) || a.name.localeCompare(b.name)
  )[0]

  return (
    <Layout>
      {/* Hero */}
      <div className="relative mb-8 rounded-2xl overflow-hidden border border-surface-border">
        <div className="absolute inset-0 bg-gradient-to-r from-pitch-800 via-pitch-800 to-pitch-700" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.12),transparent_60%)]" />
        <div className="relative px-6 py-8 sm:px-8">
          <p className="section-label mb-2">Season 6 · 2026-27</p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-1">
            Tamil Efootball League
          </h1>
          <p className="text-slate-400 text-sm">
            {teams.length} teams · {players.length} players
          </p>
          {teams[0] && (
            <div className="mt-4 flex items-center gap-2">
              <span className="text-xs text-slate-500">League leader</span>
              <span className="text-xs font-semibold text-white bg-accent/15 border border-accent/25 px-2 py-0.5 rounded-full">
                {teams[0].name} · {teams[0].points} pts
              </span>
            </div>
          )}
        </div>
      </div>

      {isLoading ? <Loading /> : isError ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-rose-400" />
          </div>
          <div className="text-center">
            <p className="text-white font-semibold mb-1">Server is waking up</p>
            <p className="text-sm text-slate-500 mb-4">The backend is starting — this usually takes 30–60 seconds on first load.</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-accent/15 text-accent border border-accent/25 rounded-lg text-sm font-medium hover:bg-accent/25 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            <StatCard label="BDR Leader"  value={leader?.bdrPoints?.toLocaleString() ?? "—"} sub={leader?.name}    icon={Trophy}    accent="bg-gold/15 text-gold"              />
            <StatCard label="Highest MV"  value={topMV?.marketValue ?? "—"}                   sub={topMV?.name}     icon={TrendingUp} accent="bg-accent/15 text-accent"        />
            <StatCard label="Teams"       value={teams.length}                                 sub="in the league"   icon={Users}      accent="bg-violet-400/15 text-violet-400" />
            <StatCard label="Players"     value={players.length}                               sub="registered"      icon={Activity}   accent="bg-blue-400/15 text-blue-400"    />
          </div>

          {/* Panel switcher */}
          <div className="flex items-center justify-between mb-4">
            <p className="section-label">Dashboard view</p>
            <select
              value={activePanel}
              onChange={e => setActivePanel(e.target.value)}
              className="bg-pitch-800 border border-surface-border rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/40 transition-colors"
            >
              {PANEL_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {activePanel === "standings" && <StandingsTable teams={teams} players={players} onPlayerClick={handlePlayer} />}
          {activePanel === "bdr"       && <BDRRanking players={players} onPlayerClick={handlePlayer} />}
          {activePanel === "market"    && <MarketValues players={players} onPlayerClick={handlePlayer} />}
          {activePanel === "trophies"  && <TrophyRanking players={players} onPlayerClick={handlePlayer} />}
          {activePanel === "players"   && <PlayersDirectory players={players} onPlayerClick={handlePlayer} />}
        </>
      )}
    </Layout>
  )
}