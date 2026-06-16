import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Users, Search, Calendar, ArrowLeftRight, Settings, ClipboardList } from "lucide-react"
import Layout from "../components/layout/Layout"
import TeamHeader from "../components/team/TeamHeader"
import Squad from "../components/team/Squad"
import Scouting from "../components/team/Scouting"
import TeamFixtures from "../components/team/TeamFixtures"
import Trades from "../components/team/Trades"
import TeamSettings from "../components/team/TeamSettings"
import FixtureMaker from "../components/team/FixtureMaker"
import Loading from "../components/common/Loading"
import { useAuthStore } from "../store/authStore"
import { useTeam, usePlayers, useFixtures, useTrades } from "../lib/queries"
import { cn } from "../lib/utils"

const TABS = [
  { id: "squad",        label: "My squad",      icon: Users          },
  { id: "scouting",    label: "Scouting",       icon: Search         },
  { id: "fixtures",    label: "Fixtures",       icon: Calendar       },
  { id: "fixmaker",    label: "Fixture maker",  icon: ClipboardList  },
  { id: "trades",      label: "Trades",         icon: ArrowLeftRight },
  { id: "settings",    label: "Settings",       icon: Settings       },
]

export default function TeamDashboard() {
  const navigate                  = useNavigate()
  const user                      = useAuthStore(s => s.user)
  const [activeTab, setActiveTab] = useState("squad")

  const { data: teamData, isLoading: teamLoading } = useTeam(user?.teamId)
  const { data: allPlayers = [] }                  = usePlayers()
  const { data: fixtures = [] }                    = useFixtures({ teamId: user?.teamId })
  const { data: trades = [] }                      = useTrades()

  const handlePlayer = (player) => navigate(`/player/${player.id}?ctx=team`)

  const myPlayers     = teamData?.players || []
  const myTeamName    = teamData?.name || ""
  const pendingTrades = trades.filter(t => t.direction === "received" && t.status === "pending").length

  if (teamLoading) return <Layout><Loading /></Layout>

  const myTeam = {
    ...teamData,
    position: teamData?.position ?? 1,
  }

  return (
    <Layout>
      <TeamHeader team={myTeam} myPlayers={myPlayers} />

      <div className="flex items-center gap-1 border-b border-surface-border overflow-x-auto -mb-px">
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive  = activeTab === id
          const showAlert = id === "trades" && pendingTrades > 0
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap",
                isActive
                  ? "border-accent text-accent"
                  : "border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-600"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
              {showAlert && <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />}
            </button>
          )
        })}
      </div>

      <div className="mt-6">
        {activeTab === "squad" && (
          <Squad players={myPlayers} onPlayerClick={handlePlayer} />
        )}
        {activeTab === "scouting" && (
          <Scouting
            allPlayers={allPlayers}
            myTeamName={myTeamName}
            onPlayerClick={handlePlayer}
            onTradeSuccess={() => setActiveTab("trades")}
          />
        )}
        {activeTab === "fixtures" && (
          <TeamFixtures fixtures={fixtures} myTeamName={myTeamName} />
        )}
        {activeTab === "fixmaker" && (
          <FixtureMaker
            fixtures={fixtures}
            myTeamName={myTeamName}
            myPlayers={myPlayers}
            allPlayers={allPlayers}
          />
        )}
        {activeTab === "trades" && <Trades trades={trades} />}
        {activeTab === "settings" && <TeamSettings team={teamData} />}
      </div>
    </Layout>
  )
}