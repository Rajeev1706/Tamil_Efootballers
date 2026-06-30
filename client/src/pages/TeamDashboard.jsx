import { useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Users, Search, Calendar, ArrowLeftRight, Settings, ClipboardList, Trophy } from "lucide-react"
import Layout from "../components/layout/Layout"
import TeamHeader from "../components/team/TeamHeader"
import Squad from "../components/team/Squad"
import Scouting from "../components/team/Scouting"
import TeamFixtures from "../components/team/TeamFixtures"
import Trades from "../components/team/Trades"
import TeamSettings from "../components/team/TeamSettings"
import FixtureMaker from "../components/team/FixtureMaker"
import TeamResults from "../components/team/TeamResults"
import Loading from "../components/common/Loading"
import { useAuthStore } from "../store/authStore"
import { useTeam, usePlayers, useFixtures, useTrades } from "../lib/queries"
import { useTeamColor } from "../lib/teamColor"
import { cn } from "../lib/utils"

const TABS = [
  { id: "squad",    label: "My squad",      icon: Users          },
  { id: "scouting", label: "Scouting",      icon: Search         },
  { id: "fixtures", label: "Fixtures",      icon: Calendar       },
  { id: "results",  label: "Results",       icon: Trophy         },
  { id: "fixmaker", label: "Fixture maker", icon: ClipboardList  },
  { id: "trades",   label: "Trades",        icon: ArrowLeftRight },
  { id: "settings", label: "Settings",      icon: Settings       },
]

export default function TeamDashboard() {
  const navigate                  = useNavigate()
  const user                      = useAuthStore(s => s.user)
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get("tab") || "squad"
  const setActiveTab = (tab) => {
    const next = new URLSearchParams(searchParams)
    next.set("tab", tab)
    setSearchParams(next, { replace: false })
  }

  const { data: teamData, isLoading: teamLoading } = useTeam(user?.teamId)
  const { data: allPlayers = [] }                  = usePlayers()
  const { data: fixtures = [] }                    = useFixtures({ teamId: user?.teamId })
  const { data: trades = [] }                      = useTrades()

  // Extract dominant color from team logo
  const teamColor = useTeamColor(teamData?.logoUrl)

  const handlePlayer = (player) => navigate(`/player/${player.id}?ctx=team&${searchParams.toString()}`)

  const myPlayers     = teamData?.players || []
  const myTeamName    = teamData?.name || ""
  const pendingTrades = trades.filter(t => t.direction === "received" && t.status === "pending").length

  if (teamLoading) return <Layout><Loading /></Layout>

  const myTeam = { ...teamData, position: teamData?.position ?? 1 }

  // Build inline CSS variables from extracted color
  const colorStyle = teamColor ? {
    "--team-r":   teamColor.r,
    "--team-g":   teamColor.g,
    "--team-b":   teamColor.b,
    "--team-rgb": teamColor.css,
  } : {}

  return (
    <Layout>
      <div style={colorStyle}>
        <TeamHeader team={myTeam} myPlayers={myPlayers} teamColor={teamColor} />

        {/* Tabs */}
        <div
          className="flex items-center gap-1 border-b overflow-x-auto -mb-px"
          style={teamColor
            ? { borderBottomColor: `rgba(${teamColor.css}, 0.3)` }
            : { borderBottomColor: "rgba(255,255,255,0.08)" }
          }
        >
          {TABS.map(({ id, label, icon: Icon }) => {
            const isActive  = activeTab === id
            const showAlert = id === "trades" && pendingTrades > 0
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                style={isActive && teamColor ? {
                  borderBottomColor: teamColor.hex,
                  color: teamColor.hex,
                  background: `rgba(${teamColor.css}, 0.05)`,
                } : {}}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap rounded-t-lg",
                  isActive && !teamColor
                    ? "border-accent text-accent bg-accent/5"
                    : !isActive
                    ? "border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-600"
                    : ""
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
                {showAlert && (
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse"
                    style={{ backgroundColor: teamColor ? teamColor.hex : "#f59e0b" }}
                  />
                )}
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
          {activeTab === "results" && (
            <TeamResults
              fixtures={fixtures}
              myPlayers={myPlayers}
              allPlayers={allPlayers}
              myTeamId={user?.teamId}
            />
          )}
          {activeTab === "fixmaker" && (
            <FixtureMaker
              fixtures={fixtures}
              myTeamName={myTeamName}
              myPlayers={myPlayers}
              allPlayers={allPlayers}
              teamLogoUrl={teamData?.logoUrl}
            />
          )}
          {activeTab === "trades" && <Trades trades={trades} />}
          {activeTab === "settings" && <TeamSettings team={teamData} />}
        </div>
      </div>
    </Layout>
  )
}