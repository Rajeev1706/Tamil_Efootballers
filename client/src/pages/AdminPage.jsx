import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { LayoutDashboard, Users, Activity, Calendar, ArrowLeftRight, Shield, Settings } from "lucide-react"
import Layout from "../components/layout/Layout"
import AdminOverview from "../components/admin/AdminOverview"
import PlayerManagement from "../components/admin/PlayerManagement"
import MatchRecordEntry from "../components/admin/MatchRecordEntry"
import FixtureResults from "../components/admin/FixtureResults"
import TradeApproval from "../components/admin/TradeApproval"
import CreateTeam from "../components/admin/CreateTeam"
import CreatePlayer from "../components/admin/CreatePlayer"
import Loading from "../components/common/Loading"
import { usePlayers, useRecords, useFixtures, useTrades } from "../lib/queries"
import { adminActivity } from "../data/mockData"
import { cn } from "../lib/utils"
import ManageTeams from "../components/admin/ManageTeams"

const TABS = [
  { id: "setup",    label: "Setup",        icon: Settings        },
  { id: "overview", label: "Overview",     icon: LayoutDashboard },
  { id: "players",  label: "Players",      icon: Users           },
  { id: "records",  label: "Match records",icon: Activity        },
  { id: "fixtures", label: "Fixtures",     icon: Calendar        },
  { id: "trades",   label: "Trades",       icon: ArrowLeftRight  },
]

export default function AdminPage() {
  const navigate      = useNavigate()
  const [activeTab, setActiveTab] = useState("setup")

  const { data: players  = [], isLoading: pLoading } = usePlayers()
  const { data: records  = [], isLoading: rLoading } = useRecords()
  const { data: fixtures = [], isLoading: fLoading } = useFixtures()
  const { data: trades   = [] }                      = useTrades()

  const pendingTrades = trades.filter(t => t.status === "pending")
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
  </div>
)}

        {activeTab === "overview" && (
          <AdminOverview stats={stats} activity={adminActivity} onNavigate={setActiveTab} />
        )}
{activeTab === "players" && !isLoading && (
          <PlayerManagement players={players} onPlayerClick={p => navigate(`/player/${p.id}?ctx=admin`)} />
        )}
        {activeTab === "records" && !isLoading && (
          <MatchRecordEntry players={players} initialRecords={records} />
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