import { useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { LayoutDashboard, Users, Activity, Calendar, ArrowLeftRight, Shield, Settings, AlertTriangle, RotateCcw, Trophy } from "lucide-react"
import Layout from "../components/layout/Layout"
import AdminOverview from "../components/admin/AdminOverview"
import PlayerManagement from "../components/admin/PlayerManagement"
import MatchRecordEntry from "../components/admin/MatchRecordEntry"
import FixtureResults from "../components/admin/FixtureResults"
import TradeApproval from "../components/admin/TradeApproval"
import CreateTeam from "../components/admin/CreateTeam"
import CreatePlayer from "../components/admin/CreatePlayer"
import TeamLeagueResults from "../components/admin/TeamLeagueResults"
import UclGroupsAdmin from "../components/admin/UclGroupsAdmin"
import UclResults from "../components/admin/UclResults"
import WeeklyAdmin from "../components/admin/WeeklyTournament"
import Loading from "../components/common/Loading"
import { usePlayers, useRecords, useFixtures, useTrades } from "../lib/queries"
import { teamsApi } from "../lib/api"
import { adminActivity } from "../data/mockData"
import { cn } from "../lib/utils"
import ManageTeams from "../components/admin/ManageTeams"
import SeasonRecordsAdmin from "../components/admin/SeasonRecordsAdmin"
import LeagueInfoAdmin from "../components/admin/LeagueInfoAdmin"

function ResetMVCard() {
  const [confirm, setConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone]       = useState(false)

  async function handleReset() {
    setLoading(true)
    try {
      await fetch(`${import.meta.env.VITE_API_URL || "https://tamil-efootballers.onrender.com/api"}/players/reset-mv`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json",
        },
      })
      setDone(true)
      setConfirm(false)
    } catch (err) {
      alert("Reset failed")
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="card p-6 border-emerald-500/30 bg-emerald-500/5 text-center">
        <p className="text-emerald-400 font-semibold text-lg mb-1">✅ Market values reset!</p>
        <p className="text-sm text-slate-400">All player market values have been reset to 0.</p>
        <button onClick={() => setDone(false)} className="mt-3 text-xs text-slate-500 hover:text-white transition-colors">Dismiss</button>
      </div>
    )
  }

  if (confirm) {
    return (
      <div className="card p-6 border-rose-500/30 bg-rose-500/5 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-rose-400 font-semibold mb-1">Reset all market values to 0?</p>
            <p className="text-sm text-slate-400">All 97 player market values will be set to 0. Match records, trophies and BDR points are untouched.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setConfirm(false)}
            className="flex-1 py-2 rounded-lg border border-surface-border text-slate-400 hover:text-white text-sm transition-colors">
            Cancel
          </button>
          <button onClick={handleReset} disabled={loading}
            className="flex-1 py-2 rounded-lg bg-rose-500 text-white font-semibold text-sm disabled:opacity-40 hover:bg-rose-600 transition-colors">
            {loading ? "Resetting…" : "Yes, Reset"}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="card p-6 flex items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <RotateCcw className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-white font-semibold">Reset Market Values</p>
          <p className="text-sm text-slate-500 mt-0.5">Reset all player market values to 0. Match records and trophies are kept safe.</p>
        </div>
      </div>
      <button onClick={() => setConfirm(true)}
        className="flex-shrink-0 px-4 py-2 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-sm font-semibold transition-colors">
        Reset MV
      </button>
    </div>
  )
}

const TABS = [
  { id: "setup",      label: "Setup",        icon: Settings        },
  { id: "overview",   label: "Overview",     icon: LayoutDashboard },
  { id: "players",    label: "Players",      icon: Users           },
  { id: "records",    label: "Match records", icon: Activity       },
  { id: "uclgroups",  label: "UCL Groups",   icon: Trophy          },
  { id: "uclresults", label: "UCL Results",  icon: Trophy          },
  { id: "weekly",     label: "Weekly",       icon: Trophy          },
  { id: "fixtures",   label: "Fixtures",     icon: Calendar        },
  { id: "teamresults",label: "Team Results", icon: Users           },
  { id: "trades",     label: "Trades",       icon: ArrowLeftRight  },
]

export default function AdminPage() {
  const navigate      = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get("tab") || "setup"
  const setActiveTab = (tab) => {
    const next = new URLSearchParams(searchParams)
    next.set("tab", tab)
    setSearchParams(next, { replace: false })
  }

  const { data: players  = [], isLoading: pLoading } = usePlayers()
  const { data: records  = [], isLoading: rLoading } = useRecords()
  const { data: fixtures = [], isLoading: fLoading } = useFixtures()
  const { data: trades   = [] }                      = useTrades()

  const pendingTrades = trades.filter(t => t.status === "pending_admin")
  const isLoading     = pLoading || rLoading || fLoading

  const stats = {
    pendingTrades:    pendingTrades.length,
    totalPlayers:     players.length,
    matchesLogged:    records.length,
    upcomingFixtures: fixtures.filter(f => f.status === "upcoming").length,
  }

  return (
    <Layout>
      {/* Admin header */}
      <div className="relative rounded-2xl overflow-hidden border border-surface-border mb-6">
        <div className="absolute inset-0 bg-gradient-to-r from-pitch-800 via-pitch-800 to-pitch-700" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(139,92,246,0.10),transparent_55%)]" />
        <div className="relative px-6 py-6 sm:px-8 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-violet-400/20 border border-violet-400/30 flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-0.5">Admin panel</p>
            <h1 className="text-xl font-extrabold text-white">League management</h1>
          </div>
          {pendingTrades.length > 0 && (
            <div className="ml-auto flex items-center gap-2 bg-amber-400/10 border border-amber-400/20 rounded-xl px-4 py-2">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-sm font-semibold text-amber-400">{pendingTrades.length} pending trades</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-surface-border overflow-x-auto -mb-px mb-0">
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive  = activeTab === id
          const showAlert = id === "trades" && pendingTrades.length > 0
          return (
            <button key={id} onClick={() => setActiveTab(id)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap",
                isActive
                  ? "border-violet-400 text-violet-400"
                  : "border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-600"
              )}>
              <Icon className="w-4 h-4" />
              {label}
              {showAlert && <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />}
            </button>
          )
        })}
      </div>

      <div className="mt-6">
        {/* Setup tab — create teams and players */}
{activeTab === "setup" && (
  <div className="space-y-8">
    <p className="text-sm text-slate-400">
      Create teams first, then add players. You can rename or delete at any time.
    </p>

    {/* Teams */}
    <div>
      <p className="section-label mb-3">Teams</p>
<div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
  <ManageTeams players={players} />
  <CreateTeam onSuccess={() => {}} />
</div>
    </div>

    {/* Players */}
    <div>
      <p className="section-label mb-3">Players</p>
      <CreatePlayer onSuccess={() => {}} />
    </div>

    {/* League Info Board */}
    <div>
      <p className="section-label mb-3">League Info Board</p>
      <LeagueInfoAdmin />
    </div>

    {/* Season Records / Hall of Fame */}
    <div>
      <p className="section-label mb-3">Hall of Fame</p>
      <SeasonRecordsAdmin />
    </div>

    {/* Market Value Reset */}
    <div>
      <p className="section-label mb-3">Market Value</p>
      <ResetMVCard />
    </div>
  </div>
)}

        {activeTab === "overview" && (
          <AdminOverview stats={stats} activity={adminActivity} onNavigate={setActiveTab} />
        )}
{activeTab === "players" && !isLoading && (
          <PlayerManagement players={players} onPlayerClick={p => navigate(`/player/${p.id}?ctx=admin&${searchParams.toString()}`)} />
        )}
        {activeTab === "records" && !isLoading && (
          <MatchRecordEntry players={players} initialRecords={records} />
        )}
        {activeTab === "teamresults" && !isLoading && (
          <TeamLeagueResults />
        )}
        {activeTab === "uclgroups" && !isLoading && (
          <UclGroupsAdmin />
        )}
        {activeTab === "uclresults" && !isLoading && (
          <UclResults />
        )}
        {activeTab === "weekly" && (
          <WeeklyAdmin />
        )}
        {activeTab === "fixtures" && !isLoading && (
          <FixtureResults fixtures={fixtures} />
        )}
        {activeTab === "trades" && (
          <TradeApproval trades={pendingTrades} />
        )}
        {isLoading && activeTab !== "setup" && activeTab !== "overview" && activeTab !== "trades" && (
          <Loading />
        )}
      </div>
    </Layout>
  )
}