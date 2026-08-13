import { useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Users, Search, Calendar, ArrowLeftRight, Settings, ClipboardList, Trophy, Gavel, Target, RefreshCw } from "lucide-react"
import Layout from "../components/layout/Layout"
import TeamHeader from "../components/team/TeamHeader"
import Squad from "../components/team/Squad"
import Scouting from "../components/team/Scouting"
import TeamFixtures from "../components/team/TeamFixtures"
import Trades from "../components/team/Trades"
import TeamSettings from "../components/team/TeamSettings"
import FixtureMaker from "../components/team/FixtureMaker"
import TeamResults from "../components/team/TeamResults"
import AuctionPlanner from "../components/team/auction/AuctionPlanner"
import ReplacementModule from "../components/common/ReplacementModule"
import Loading from "../components/common/Loading"
import { useAuthStore } from "../store/authStore"
import { useTeam, usePlayers, useFixtures, useTrades, useAuctionCurrent, useChampionship } from "../lib/queries"
import { useAuctionSocket } from "../hooks/useAuctionSocket"
import { useTeamColor } from "../lib/teamColor"
import { cn } from "../lib/utils"

const TABS = [
  { id: "squad",    label: "My squad",      icon: Users          },
  { id: "scouting",    label: "Scouting",      icon: Search         },
  { id: "fixtures",    label: "Fixtures",      icon: Calendar       },
  { id: "results",     label: "Results",       icon: Trophy         },
  { id: "replacement", label: "Replacement",   icon: RefreshCw      },
  { id: "fixmaker",    label: "Fixture maker", icon: ClipboardList  },
  { id: "trades",      label: "Trades",        icon: ArrowLeftRight },
  { id: "auction",     label: "Auction",       icon: Target         },
  { id: "settings",    label: "Settings",      icon: Settings       },
]

export default function TeamDashboard() {
  const navigate                  = useNavigate()
  const user                      = useAuthStore(s => s.user)
  const { data: auctionData } = useAuctionCurrent()
  const { data: championship = [] } = useChampionship()
  useAuctionSocket()
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
  const myPurse       = teamData?.purse ?? teamData?.budget ?? 0
  const pendingReceived = trades.filter(t => t.direction === "received" && t.status === "pending_team").length

  // Championship ranking
  const myChampionshipEntry = championship.find(t => t.id === user?.teamId)
  const myChampionshipRank  = championship.findIndex(t => t.id === user?.teamId) + 1
  const myChampionshipBdr   = myChampionshipEntry?.totalBdr ?? 0

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
        {auctionData?.session?.status === "active" && (
          <button
            onClick={() => navigate("/team/auction")}
            className="w-full mb-6 rounded-2xl border border-gold/40 bg-gradient-to-r from-gold/10 via-gold/5 to-transparent px-6 py-4 flex items-center gap-3 hover:border-gold/60 transition-colors text-left animate-champion-pop"
          >
            <span className="relative flex-shrink-0">
              <Gavel className="w-6 h-6 text-gold" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">Live Player Auction happening now</p>
              <p className="text-xs text-slate-400">
                {auctionData.session.currentPlayerName
                  ? `${auctionData.session.currentPlayerName} — ₹${auctionData.session.currentBid} current bid`
                  : "Tap to watch live"}
              </p>
            </div>
            <span className="text-xs font-semibold text-gold flex-shrink-0">Enter Auction →</span>
          </button>
        )}

        <TeamHeader team={myTeam} myPlayers={myPlayers} teamColor={teamColor} />

        {/* Championship standing banner */}
        {myChampionshipRank > 0 && (
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer hover:border-amber-400/40 transition-colors"
            style={{ background: "rgba(251,191,36,0.05)", borderColor: "rgba(251,191,36,0.2)" }}
            onClick={() => navigate("/championship")}
          >
            <div className="w-8 h-8 rounded-lg bg-amber-400/15 flex items-center justify-center flex-shrink-0">
              <Trophy className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-amber-400 font-semibold">Team of Champions Standing</p>
              <p className="text-sm text-white font-bold">
                #{myChampionshipRank} of {championship.length} teams
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xl font-extrabold font-mono text-amber-400">{myChampionshipBdr}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">Team BDR</p>
            </div>
          </div>
        )}

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
            const showAlert = id === "trades" && pendingReceived > 0
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
              myPlayers={myPlayers}
              myPurse={myPurse}
              onPlayerClick={handlePlayer}
              onTradeSuccess={() => setActiveTab("trades")}
              view={searchParams.get("scoutView") || undefined}
              onViewChange={(val) => {
                const next = new URLSearchParams(searchParams)
                next.set("scoutView", val)
                setSearchParams(next, { replace: true })
              }}
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
          {activeTab === "replacement" && (
            <ReplacementModule
              players={allPlayers}
              myTeamId={user?.teamId}
            />
          )}
          {activeTab === "fixmaker" && (
            <FixtureMaker
              fixtures={fixtures}
              myTeamName={myTeamName}
              myTeamId={teamData?.id}
              myPlayers={myPlayers}
              allPlayers={allPlayers}
              teamLogoUrl={teamData?.logoUrl}
            />
          )}
          {activeTab === "trades" && <Trades trades={trades} myPurse={myPurse} />}
          {activeTab === "auction" && (
            <AuctionPlanner
              myTeamId={user?.teamId}
              myPlayers={myPlayers}
              allPlayers={allPlayers}
              totalBudget={myPurse}
            />
          )}
          {activeTab === "settings" && <TeamSettings team={teamData} />}
        </div>
      </div>
    </Layout>
  )
}