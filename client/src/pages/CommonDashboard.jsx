import { useState, useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { ChevronDown, Trophy, Users, TrendingUp, Activity, Star } from "lucide-react"
import { cn } from "../lib/utils"
import Layout from "../components/layout/Layout"
import StandingsTable from "../components/dashboard/StandingsTable"
import BDRRanking from "../components/dashboard/BDRRanking"
import MarketValues from "../components/dashboard/MarketValues"
import TrophyRanking from "../components/dashboard/TrophyRanking"
import UclStandings from "../components/dashboard/UclStandings"
import WeeklyDashboard from "../components/dashboard/WeeklyDashboard"
import PlayersDirectory from "../components/dashboard/PlayersDirectory"
import PastSeasonDashboard from "../components/dashboard/PastSeasonDashboard"
import Loading from "../components/common/Loading"
import CountUp from "../components/common/CountUp"
import ChampionCelebration from "../components/common/ChampionCelebration"
import weeklyTrophyLogo from "../../images/Weekly.png"
import teamLeagueTrophyLogo from "../../images/Team League.png"
import uclTrophyLogo from "../../images/ucl.png"
import goldenBootLogo from "../../images/Golden Boot.png"
import { useTeams, usePlayers, useSeasonRecords, useSettings, useWeeklyCurrent, useFixtures, useUclKnockoutCurrent, useTopScorers, useUclTopScorers, useWeeklyTopScorers, useBestLeaguePerformer } from "../lib/queries"

const StatCard = ({ label, value, sub, icon: Icon, accent }) => (
  <div className="card p-4 flex items-start gap-3">
    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${accent}`}>
      <Icon className="w-4 h-4" />
    </div>
    <div>
      <p className="text-xs text-slate-500 font-medium mb-0.5">{label}</p>
      <p className="text-xl font-bold text-white font-mono"><CountUp value={value} /></p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  </div>
)

const GoldenBootBadge = ({ scorer }) => {
  // CountUp only animates CHANGES between renders, not the initial mount —
  // so start at 0 and flip to the real value a beat later, forcing an
  // actual transition it can animate through.
  const [animatedGoals, setAnimatedGoals] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setAnimatedGoals(scorer.goals), 50)
    return () => clearTimeout(t)
  }, [scorer.goals])

  return (
    <div className="mt-4 pt-4 border-t border-surface-border/50 flex items-center justify-center gap-2.5">
      <img src={goldenBootLogo} alt="Golden Boot" className="w-6 h-6 object-contain flex-shrink-0" />
      <p className="text-sm text-slate-300">
        Golden Boot: <span className="font-semibold text-white">{scorer.name}</span>
        <span className="text-slate-500"> (<CountUp value={animatedGoals} duration={5500} /> goals)</span>
      </p>
    </div>
  )
}

// Player chips for the Team League celebration — captain and best performer
// appear plain at first, then a beat after the card has landed, their chips
// visibly transition into their highlighted gold/emerald styling, as a
// distinct "reveal" moment rather than being static from the start.
function TeamRosterChips({ players, bestPerformerId, delay = 1700 }) {
  const [highlightsReady, setHighlightsReady] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setHighlightsReady(true), delay)
    return () => clearTimeout(t)
  }, [delay])

  // Order: captain first, best performer 2nd (unless they're the same
  // person, in which case no duplicate slot), then everyone else.
  const captain = players.find(p => p.isCaptain)
  const best    = (bestPerformerId && bestPerformerId !== captain?.id)
    ? players.find(p => p.id === bestPerformerId)
    : null
  const rest = players.filter(p => p.id !== captain?.id && p.id !== best?.id)
  const orderedPlayers = [captain, best, ...rest].filter(Boolean)

  return (
    <div className="mt-4 p-1.5 flex flex-wrap justify-center gap-1.5 max-h-40 overflow-y-auto">
      {orderedPlayers.map(p => {
        const isBest = bestPerformerId && p.id === bestPerformerId
        const highlight = highlightsReady && (p.isCaptain || isBest)
        return (
          <span
            key={p.id}
            className={cn(
              "text-xs px-2 py-1 rounded-lg border flex items-center justify-center gap-1 transition-all duration-500 w-[5.75rem] whitespace-nowrap overflow-hidden text-ellipsis flex-shrink-0",
              highlight && p.isCaptain
                ? "text-gold bg-gold/10 border-gold/40 font-semibold scale-105"
                : highlight && isBest
                ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/40 font-semibold scale-105"
                : "text-slate-300 bg-pitch-800 border-surface-border"
            )}
          >
            {highlight && isBest && <Star className="w-3 h-3 flex-shrink-0" />}
            {p.name}
          </span>
        )
      })}
    </div>
  )
}

const PANEL_OPTIONS = [
  { value: "players",   label: "Total players" },
  { value: "standings", label: "League table"  },
  { value: "ucl",       label: "UCL"           },
  { value: "weekly",    label: "Weekly"        },
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
  const { data: weeklyTournament }                        = useWeeklyCurrent()
  const { data: fixtures = [] }                           = useFixtures()
  const { data: uclKnockout }                             = useUclKnockoutCurrent()
  const { data: teamTopScorers = [] }                     = useTopScorers()
  const { data: uclTopScorers = [] }                      = useUclTopScorers()
  const { data: weeklyTopScorers = [] }                   = useWeeklyTopScorers()

  const urlParams = new URLSearchParams(window.location.search)

  // ── Weekly Tournament champion celebration ──────────────────────────────
  // Site-wide, once-per-visitor — fires on whatever page/view the visitor
  // lands on, tracked in localStorage per tournament so it doesn't replay
  // on repeat visits from the same browser.
  const [showWeeklyCelebration, setShowWeeklyCelebration] = useState(false)
  const weeklyFinalMatch = weeklyTournament?.matches?.find(
    m => m.round === weeklyTournament.total_rounds && m.status === "completed"
  )
  const weeklyChampion = weeklyFinalMatch
    ? (weeklyFinalMatch.winnerId === weeklyFinalMatch.player1Id ? weeklyFinalMatch.player1Name : weeklyFinalMatch.player2Name)
    : null

  // TEST-ONLY: ?testCelebration=SomePlayerName previews this instantly.
  const testWeeklyActive = urlParams.has("testCelebration")
  const testWeeklyParam  = urlParams.get("testCelebration")
  const testWeeklyName   = testWeeklyActive
    ? (testWeeklyParam && !["1", "true"].includes(testWeeklyParam) ? testWeeklyParam : "Test Player")
    : null
  const displayWeeklyChampion = testWeeklyName || weeklyChampion

  useEffect(() => {
    if (!testWeeklyActive) return
    setShowWeeklyCelebration(true)
    const dismiss = () => setShowWeeklyCelebration(false)
    const timer = setTimeout(dismiss, 7000)
    document.addEventListener("click", dismiss)
    return () => { clearTimeout(timer); document.removeEventListener("click", dismiss) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testWeeklyActive])

  useEffect(() => {
    if (testWeeklyActive) return
    if (!weeklyChampion || !weeklyTournament?.id) return
    const key = `weekly_champion_seen_${weeklyTournament.id}`
    if (!localStorage.getItem(key)) {
      setShowWeeklyCelebration(true)
      localStorage.setItem(key, "1")
      const dismiss = () => setShowWeeklyCelebration(false)
      const timer = setTimeout(dismiss, 7000)
      document.addEventListener("click", dismiss)
      return () => { clearTimeout(timer); document.removeEventListener("click", dismiss) }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeklyChampion, weeklyTournament?.id])

  // ── Team League champion celebration ────────────────────────────────────
  // Fires once the last league fixture is completed. `teams` is already
  // sorted by the league_standings view (points, then GD, then GF), so
  // teams[0] is the table topper the moment the season is fully played out.
  const [showTeamCelebration, setShowTeamCelebration] = useState(false)
  const teamCelebrationSeason = settings.current_season
  const leagueComplete = fixtures.length > 0 && fixtures.every(f => f.status === "completed")
  const teamChampion    = leagueComplete ? teams[0] : null

  // Captain always shown first in the roster list, wherever it's used.
  const sortCaptainFirst = (list) =>
    [...list].sort((a, b) => (b.isCaptain ? 1 : 0) - (a.isCaptain ? 1 : 0))

  const teamChampionPlayers = teamChampion
    ? sortCaptainFirst(players.filter(p => p.teamId === teamChampion.id))
    : []

  // TEST-ONLY: ?testTeamCelebration=SomeTeamName previews this instantly.
  const testTeamActive = urlParams.has("testTeamCelebration")
  const testTeamParam  = urlParams.get("testTeamCelebration")
  const testTeamName   = testTeamActive
    ? (testTeamParam && !["1", "true"].includes(testTeamParam) ? testTeamParam : "Test FC")
    : null
  const displayTeamChampion = testTeamName || teamChampion?.name

  // If the test name happens to match a real team (e.g. ?testTeamCelebration=Germany),
  // show that team's actual current players instead of an empty roster —
  // otherwise fall back to no players for a genuinely made-up test name.
  const testTeamMatch = testTeamName
    ? teams.find(t => t.name.toLowerCase() === testTeamName.toLowerCase())
    : null
  const displayTeamPlayers = testTeamMatch
    ? sortCaptainFirst(players.filter(p => p.teamId === testTeamMatch.id))
    : (testTeamName ? [] : teamChampionPlayers)
  const displayTeamLogo = testTeamMatch?.logoUrl || teamChampion?.logoUrl || null
  const bestPerformerTeamId = testTeamMatch?.id || teamChampion?.id || null
  const { data: displayBestPerformer } = useBestLeaguePerformer(bestPerformerTeamId)

  useEffect(() => {
    if (!testTeamActive) return
    if (teamsLoading || playersLoading) return // wait for real data before showing, so player chips don't pop in late
    setShowTeamCelebration(true)
    const dismiss = () => setShowTeamCelebration(false)
    const timer = setTimeout(dismiss, 10000)
    document.addEventListener("click", dismiss)
    return () => { clearTimeout(timer); document.removeEventListener("click", dismiss) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testTeamActive, teamsLoading, playersLoading])

  useEffect(() => {
    if (testTeamActive) return
    if (teamsLoading || playersLoading) return // wait for real data before showing, so player chips don't pop in late
    if (!teamChampion || !teamCelebrationSeason) return
    const key = `team_league_champion_seen_${teamCelebrationSeason}_${teamChampion.id}`
    if (!localStorage.getItem(key)) {
      setShowTeamCelebration(true)
      localStorage.setItem(key, "1")
      const dismiss = () => setShowTeamCelebration(false)
      const timer = setTimeout(dismiss, 10000)
      document.addEventListener("click", dismiss)
      return () => { clearTimeout(timer); document.removeEventListener("click", dismiss) }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamChampion?.id, teamCelebrationSeason, teamsLoading, playersLoading])

  // ── UCL Knockout champion celebration ───────────────────────────────────
  // Fires once the UCL Knockout Final is completed — mirrors the Weekly
  // Tournament celebration exactly, just reading from ucl-knockout instead.
  const [showUclCelebration, setShowUclCelebration] = useState(false)
  const uclFinalMatch = uclKnockout?.matches?.find(
    m => m.round === uclKnockout.totalRounds && m.status === "completed"
  )
  const uclChampion = uclFinalMatch
    ? (uclFinalMatch.winnerId === uclFinalMatch.player1Id ? uclFinalMatch.player1Name : uclFinalMatch.player2Name)
    : null

  // TEST-ONLY: ?testUclCelebration=SomePlayerName previews this instantly.
  const testUclActive = urlParams.has("testUclCelebration")
  const testUclParam  = urlParams.get("testUclCelebration")
  const testUclName   = testUclActive
    ? (testUclParam && !["1", "true"].includes(testUclParam) ? testUclParam : "Test Player")
    : null
  const displayUclChampion = testUclName || uclChampion

  useEffect(() => {
    if (!testUclActive) return
    setShowUclCelebration(true)
    const dismiss = () => setShowUclCelebration(false)
    const timer = setTimeout(dismiss, 7000)
    document.addEventListener("click", dismiss)
    return () => { clearTimeout(timer); document.removeEventListener("click", dismiss) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testUclActive])

  useEffect(() => {
    if (testUclActive) return
    if (!uclChampion || !uclKnockout?.id) return
    const key = `ucl_champion_seen_${uclKnockout.id}`
    if (!localStorage.getItem(key)) {
      setShowUclCelebration(true)
      localStorage.setItem(key, "1")
      const dismiss = () => setShowUclCelebration(false)
      const timer = setTimeout(dismiss, 7000)
      document.addEventListener("click", dismiss)
      return () => { clearTimeout(timer); document.removeEventListener("click", dismiss) }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uclChampion, uclKnockout?.id])

  const [searchParams, setSearchParams] = useSearchParams()
  const activePanel    = searchParams.get("view") || "players"
  const trophyKey      = searchParams.get("trophy") || undefined
  const standingsView  = searchParams.get("standingsView") || undefined
  const urlYear        = searchParams.get("year")
  const urlSeason      = searchParams.get("season")

  const setActivePanel = (val) => {
    const next = new URLSearchParams(searchParams)
    next.set("view", val)
    next.delete("trophy") // reset trophy sub-selection when switching panel
    next.delete("standingsView")
    setSearchParams(next, { replace: false })
  }

  const setTrophyKey = (val) => {
    const next = new URLSearchParams(searchParams)
    next.set("trophy", val)
    setSearchParams(next, { replace: true })
  }

  const setStandingsView = (val) => {
    const next = new URLSearchParams(searchParams)
    next.set("standingsView", val)
    setSearchParams(next, { replace: true })
  }

  const [selectedYear, setSelectedYearState] = useState(urlYear ? parseInt(urlYear) : new Date().getFullYear())
  const [selectedSeason, setSelectedSeasonState] = useState(urlSeason ? parseInt(urlSeason) : null)

  const setSelectedYear = (yr) => {
    setSelectedYearState(yr)
    const next = new URLSearchParams(searchParams)
    next.set("year", yr)
    setSearchParams(next, { replace: false })
  }
  const setSelectedSeason = (s) => {
    setSelectedSeasonState(s)
    const next = new URLSearchParams(searchParams)
    if (s) next.set("season", s); else next.delete("season")
    setSearchParams(next, { replace: false })
  }

  const handlePlayer = (player) => navigate(`/player/${player.id}?${searchParams.toString()}`)
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

  // Golden Boot winners for each celebration — each list is already sorted
  // goals DESC by its endpoint, so [0] is the top scorer. Only shown if
  // someone has actually scored (goals > 0), so an empty/fresh competition
  // doesn't show a misleading "0 goals" winner.
  const teamGoldenBoot   = teamTopScorers[0]?.goals > 0   ? teamTopScorers[0]   : null
  const uclGoldenBoot    = uclTopScorers[0]?.goals > 0    ? uclTopScorers[0]    : null
  const weeklyGoldenBoot = weeklyTopScorers[0]?.goals > 0 ? weeklyTopScorers[0] : null

  return (
    <Layout>
      {showWeeklyCelebration && displayWeeklyChampion ? (
        <ChampionCelebration
          trophyImage={weeklyTrophyLogo}
          eyebrow="Weekly Tournament"
          title={displayWeeklyChampion}
          subtitle="is the Weekly Champion! 🎉"
        >
          {weeklyGoldenBoot && <GoldenBootBadge scorer={weeklyGoldenBoot} />}
        </ChampionCelebration>
      ) : showTeamCelebration && displayTeamChampion ? (
        <ChampionCelebration
          trophyImage={teamLeagueTrophyLogo}
          eyebrow="Team League"
          title={displayTeamChampion}
          subtitle="are the Team League Champions! 🏆"
          badgeImage={displayTeamLogo}
        >
          {displayTeamPlayers.length > 0 && (
            <TeamRosterChips players={displayTeamPlayers} bestPerformerId={displayBestPerformer?.id} />
          )}
          {teamGoldenBoot && <GoldenBootBadge scorer={teamGoldenBoot} />}
        </ChampionCelebration>
      ) : showUclCelebration && displayUclChampion ? (
        <ChampionCelebration
          trophyImage={uclTrophyLogo}
          eyebrow="UCL"
          title={displayUclChampion}
          subtitle="is the UCL Champion! 🏆"
        >
          {uclGoldenBoot && <GoldenBootBadge scorer={uclGoldenBoot} />}
        </ChampionCelebration>
      ) : null}
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
                <StatCard label="BDR Leader"  value={leader?.bdrPoints ?? "—"} sub={leader?.name}    icon={Trophy}    accent="bg-gold/15 text-gold"              />
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

              <div key={activePanel} className="animate-panel-in">
                {activePanel === "players"   && <PlayersDirectory players={players} onPlayerClick={handlePlayer} />}
                {activePanel === "standings" && <StandingsTable teams={teams} players={players} onPlayerClick={handlePlayer} view={standingsView} onViewChange={setStandingsView} />}
                {activePanel === "ucl"       && <UclStandings onPlayerClick={handlePlayer} />}
                {activePanel === "weekly"    && <WeeklyDashboard onPlayerClick={handlePlayer} />}
                {activePanel === "bdr"       && <BDRRanking players={players} onPlayerClick={handlePlayer} />}
                {activePanel === "market"    && <MarketValues players={players} onPlayerClick={handlePlayer} />}
                {activePanel === "trophies"  && <TrophyRanking players={players} onPlayerClick={handlePlayer} trophyKey={trophyKey} onTrophyChange={setTrophyKey} />}
              </div>
            </>
          )}
        </>
      )}
    </Layout>
  )
}