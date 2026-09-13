import { useState, useEffect, useRef, lazy, Suspense } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { ChevronDown, Trophy, Users, TrendingUp, Activity, Star, Gavel } from "lucide-react"
import { cn } from "../lib/utils"
import { getAvatarById } from "../lib/avatars"
import Layout from "../components/layout/Layout"
import StandingsTable from "../components/dashboard/StandingsTable"
import BDRRanking from "../components/dashboard/BDRRanking"
import MarketValues from "../components/dashboard/MarketValues"
import TrophyRanking from "../components/dashboard/TrophyRanking"
import UclStandings from "../components/dashboard/UclStandings"
import WeeklyDashboard from "../components/dashboard/WeeklyDashboard"
import RevolutionDashboard from "../components/dashboard/RevolutionDashboard"
import DuoDashboard from "../components/dashboard/DuoDashboard"
import PlayersDirectory from "../components/dashboard/PlayersDirectory"
import PastSeasonDashboard from "../components/dashboard/PastSeasonDashboard"
import PlayerComparison from "../components/dashboard/PlayerComparison"
import TeamsDirectory from "../components/dashboard/TeamsDirectory"
import Loading from "../components/common/Loading"
import CountUp from "../components/common/CountUp"
import ChampionCelebration from "../components/common/ChampionCelebration"
import WeeklyTournamentCelebration from "../components/common/WeeklyTournamentCelebration"
import DshannLeagueCelebration     from "../components/common/DshannLeagueCelebration"
import RevolutionCelebration       from "../components/common/RevolutionCelebration"
import BallonDorCelebration from "../components/common/BallonDorCelebration"
import ChampionshipCelebration from "../components/common/ChampionshipCelebration"
import DuoWinnerCelebration from "../components/common/DuoWinnerCelebration"
import weeklyTrophyLogo from "../../images/Weekly.png"
import teamLeagueTrophyLogo from "../../images/Team League.png"
import europaTrophyLogo      from "../../images/europa.png"
import duoTrophyLogo          from "../../images/duo.png"
import revolutionTrophyLogo   from "../../images/revolution.png"
import uclTrophyLogo from "../../images/ucl.png"
import goldenBootLogo from "../../images/Golden Boot.png"
import ballonDorTrophy from "../../images/ballondor.png"
import championshipTrophy from "../../images/championship.png"
import teamsImg from "../../images/teams.jpg"
import { useTeams, usePlayers, useSeasonRecords, useSettings, useWeeklyCurrent, useFixtures, useUclKnockoutCurrent, useTopScorers, useUclTopScorers, useWeeklyTopScorers, useBestLeaguePerformer, useTeamLeaguePlayoffs, useAuctionCurrent, useLeagueFormatPublic, useChampionship, useGroupStandings, useTeamKnockoutCurrent, useRevolutionCurrent } from "../lib/queries"
import { useAuctionSocket } from "../hooks/useAuctionSocket"
import WeeklyCelebrationOverlay from "../components/dashboard/WeeklyCelebrationOverlay"

// Lazy-loaded after all imports — keeps it out of the TDZ that causes
// "Cannot access before initialization" in production bundles
const TeamKnockoutDashboard = lazy(() => import("../components/dashboard/TeamKnockoutDashboard"))

// Resolves a player's chosen avatar — custom upload takes priority,
// falls back to their picked preset character, then to nothing at all.
function resolveAvatar(obj) {
  if (!obj) return { thumb: null, bg: null }
  const preset = getAvatarById(obj.avatarId)
  return {
    thumb: obj.avatarUrl || preset?.thumb || null,
    bg: obj.avatarBgUrl || preset?.bg || null,
  }
}

const StatCard = ({ label, value, sub, icon: Icon, accent, image, avatarStyle, trophyStyle, onClick }) => (
  <div
    className={cn("card p-4 flex items-center", trophyStyle ? "gap-1" : "gap-3", onClick && "cursor-pointer hover:border-accent/30 transition-colors")}
    onClick={onClick}
  >
    {trophyStyle && image ? (
      <>
        <img src={image} alt="" className="w-14 h-14 object-contain flex-shrink-0" />
        <div>
          <p className="text-xs text-slate-500 font-medium mb-0.5">{label}</p>
          <p className="text-xl font-bold text-white font-mono"><CountUp value={value} /></p>
          {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
        </div>
      </>
    ) : avatarStyle && image ? (
      <>
        <div className="w-16 h-16 rounded-2xl flex-shrink-0 overflow-hidden border border-surface-border bg-pitch-800">
          <img src={image} alt="" className="w-full h-full object-cover" />
        </div>
        <div>
          <p className="text-xs text-slate-500 font-medium mb-0.5">{label}</p>
          <p className="text-xl font-bold text-white font-mono"><CountUp value={value} /></p>
          {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
        </div>
      </>
    ) : (
      <>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden ${image ? "" : accent}`}>
          {image
            ? <img src={image} alt="" className="w-full h-full object-contain" />
            : <Icon className="w-4 h-4" />
          }
        </div>
        <div>
          <p className="text-xs text-slate-500 font-medium mb-0.5">{label}</p>
          <p className="text-xl font-bold text-white font-mono"><CountUp value={value} /></p>
          {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
        </div>
      </>
    )}
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
    <div className="relative mt-4 pt-4 border-t border-surface-border/50 flex items-center justify-center">
      <div className="flex items-center gap-2.5 bg-pitch-900/80 rounded-full px-3.5 py-1.5">
        <img src={goldenBootLogo} alt="Golden Boot" className="w-6 h-6 object-contain flex-shrink-0" />
        <p className="text-sm text-slate-300 whitespace-nowrap">
          Golden Boot: <span className="font-semibold text-white">{scorer.name}</span>
          <span className="text-slate-400"> (<CountUp value={animatedGoals} duration={5500} /> goals)</span>
        </p>
      </div>
    </div>
  )
}

// Player chips for the Team League celebration — captain and best performer
// appear plain at first, then a beat after the card has landed, their chips
// visibly transition into their highlighted gold/emerald styling, as a
// distinct "reveal" moment rather than being static from the start.
function TeamRosterChips({ players, bestPerformerId, delay = 3000 }) {
  const sweepDuration = 700 // ms, how long the left-to-right wipe itself takes
  const [captainRevealed, setCaptainRevealed] = useState(false)
  const [bestRevealed, setBestRevealed]       = useState(false)
  useEffect(() => {
    const t1 = setTimeout(() => setCaptainRevealed(true), delay)
    const t2 = setTimeout(() => setBestRevealed(true), delay + sweepDuration)
    return () => { clearTimeout(t1); clearTimeout(t2) }
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
        const revealed = p.isCaptain ? captainRevealed : isBest ? bestRevealed : false
        const highlightColor = p.isCaptain ? "gold" : "emerald"
        return (
          <span
            key={p.id}
            className="relative w-[5.75rem] flex-shrink-0 rounded-lg border overflow-hidden flex items-center justify-center"
            style={{
              borderColor: revealed
                ? (p.isCaptain ? "rgba(245,158,11,0.4)" : "rgba(52,211,153,0.4)")
                : "var(--surface-border)",
              transition: `border-color ${sweepDuration}ms ease-out`,
            }}
          >
            {/* Background fill sweeps left to right — a plain color rectangle,
                never contains text, so there's nothing to visually overlap. */}
            {(p.isCaptain || isBest) && (
              <span
                className="absolute inset-0"
                style={{
                  background: p.isCaptain ? "rgba(245,158,11,0.1)" : "rgba(52,211,153,0.1)",
                  clipPath: revealed ? "inset(0 0% 0 0)" : "inset(0 100% 0 0)",
                  transition: `clip-path ${sweepDuration}ms ease-out`,
                }}
              />
            )}
            {/* Single text layer — never duplicated, just its color transitions */}
            <span
              className="relative z-10 text-xs px-2 py-1 font-semibold whitespace-nowrap overflow-hidden text-ellipsis flex items-center gap-1"
              style={{
                color: revealed
                  ? (p.isCaptain ? "#f5a623" : "#34d399")
                  : "#cbd5e1",
                transition: `color ${sweepDuration}ms ease-out`,
              }}
            >
              {revealed && isBest && <Star className="w-3 h-3 flex-shrink-0" />}
              {p.name}
            </span>
          </span>
        )
      })}
    </div>
  )
}

const PANEL_OPTIONS = [
  { value: "standings",     label: "League table"      },
  { value: "ucl",           label: "UCL"               },
  { value: "duo",           label: "Duo Tournament"    },
  { value: "weekly",        label: "Weekly"            },
  { value: "revolution",    label: "Revolution Trophy" },
]


// Check if a tournament completion timestamp is within the celebration window
function isWithinCelebrationWindow(completedAt, hours) {
  if (!completedAt) return false
  const ms = hours * 60 * 60 * 1000
  return Date.now() - new Date(completedAt).getTime() < ms
}

// Check if a timestamp is within 48 hours of now
function isWithin48Hours(isoTimestamp) {
  if (!isoTimestamp) return false
  const completedAt = new Date(isoTimestamp).getTime()
  const now = Date.now()
  return (now - completedAt) < 48 * 60 * 60 * 1000
}

export default function CommonDashboard() {
  const navigate = useNavigate()
  const { data: auctionData } = useAuctionCurrent()
  useAuctionSocket()
  const { data: teams   = [], isLoading: teamsLoading   } = useTeams()
  const { data: players = [], isLoading: playersLoading } = usePlayers()
  const { data: championship = [] }                       = useChampionship()
  const { data: seasonRecords = [] }                      = useSeasonRecords()
  const { data: settings = {} }                          = useSettings()
  const { data: weeklyTournament }                        = useWeeklyCurrent()
  const { data: fixtures = [] }                           = useFixtures()
  const { data: uclKnockout }                             = useUclKnockoutCurrent()
  const { data: teamTopScorers = [] }                     = useTopScorers()
  const { data: uclTopScorers = [] }                      = useUclTopScorers()
  const { data: weeklyTopScorers = [] }                   = useWeeklyTopScorers()

  // useSearchParams must be used for all URL reads — window.location.search bypasses
  // React Router and can read stale values during programmatic navigation.
  const [searchParams, setSearchParams] = useSearchParams()
  const urlParams = searchParams

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
  const weeklyChampionAvatar = weeklyFinalMatch
    ? resolveAvatar(
        weeklyFinalMatch.winnerId === weeklyFinalMatch.player1Id
          ? { avatarId: weeklyFinalMatch.player1AvatarId, avatarUrl: weeklyFinalMatch.player1AvatarUrl, avatarBgUrl: weeklyFinalMatch.player1AvatarBgUrl }
          : { avatarId: weeklyFinalMatch.player2AvatarId, avatarUrl: weeklyFinalMatch.player2AvatarUrl, avatarBgUrl: weeklyFinalMatch.player2AvatarBgUrl }
      )
    : { thumb: null, bg: null }

  // TEST-ONLY: ?testCelebration=SomePlayerName previews this instantly.
  // If the name matches a real player, their real avatar/background shows
  // too — type a player who actually has one set (e.g. ?testCelebration=Sidhu)
  // to preview that. Otherwise it's just a fake name with no avatar.
  const testWeeklyActive = urlParams.has("testCelebration")
  const testWeeklyParam  = urlParams.get("testCelebration")
  const testWeeklyMatchedPlayer = testWeeklyParam
    ? (players.filter(p => p.name.toLowerCase() === testWeeklyParam.toLowerCase())
        .sort((a, b) => (b.avatarUrl || b.avatarId ? 1 : 0) - (a.avatarUrl || a.avatarId ? 1 : 0))[0])
    : null
  const testWeeklyName   = testWeeklyActive
    ? (testWeeklyMatchedPlayer?.name || (testWeeklyParam && !["1", "true"].includes(testWeeklyParam) ? testWeeklyParam : "Test Player"))
    : null
  // TEST: ?testGoldenBoot=PlayerName shows golden boot on the card
  const testGoldenBootParam = urlParams.get("testGoldenBoot")
  const testGoldenBoot = testWeeklyActive
    ? { name: testGoldenBootParam || "Top Scorer", goals: 5 }
    : null
  const displayWeeklyChampion = testWeeklyName || weeklyChampion
  const displayWeeklyChampionAvatar = testWeeklyActive
    ? resolveAvatar(testWeeklyMatchedPlayer)
    : weeklyChampionAvatar

  useEffect(() => {
    if (!testWeeklyActive) return
    setShowWeeklyCelebration(true)
    const dismiss = () => setShowWeeklyCelebration(false)
    const timer = setTimeout(dismiss, 10000)
    document.addEventListener("click", dismiss)
    return () => { clearTimeout(timer); document.removeEventListener("click", dismiss) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testWeeklyActive])

  // Weekly real trigger → handled by queue below

  // ── Team League champion celebration ────────────────────────────────────
  // Fires once the PLAYOFF FINAL is completed — NOT when regular-season
  // fixtures finish (that moment only generates the playoff bracket; the
  // actual champion isn't decided until the Final itself is played).
  const [showTeamCelebration, setShowTeamCelebration] = useState(false)
  const teamCelebrationSeason = settings.current_season
  const [showEuropaCelebration, setShowEuropaCelebration] = useState(false)
  const { data: playoffsData }   = useTeamLeaguePlayoffs()
  const { data: leagueFormatData, isLoading: leagueFormatLoading } = useLeagueFormatPublic()
  const isLeagueOnly    = leagueFormatData?.format === "league"
  const isGroupKnockout = leagueFormatData?.format === "group_knockout"
  const { data: groupStandings }   = useGroupStandings()
  const { data: revolutionData }   = useRevolutionCurrent()
  const [showRevCelebration, setShowRevCelebration]   = useState(false)
  const [testRevDismissed, setTestRevDismissed]        = useState(false)
  const [showDuoCelebration, setShowDuoCelebration]   = useState(false)
  const [testDuoDismissed, setTestDuoDismissed]         = useState(false)

  // Revolution — find final winner
  const revTotalRounds = revolutionData?.total_rounds
  const revFinalMatch  = revTotalRounds
    ? revolutionData?.matches?.find(m => m.round === revTotalRounds && m.status === "completed")
    : null
  const revChampion = revFinalMatch
    ? players.find(p => p.id === revFinalMatch.winnerId)
    : null
  const revChampionAvatar = revChampion ? resolveAvatar(revChampion) : { thumb: null, bg: null }

  // Duo — fetch current and find champion pair
  const [duoData, setDuoData] = useState(null)
  useEffect(() => {
    import("../lib/api").then(({ default: apiClient }) => {
      apiClient.get("/duo/current").then(r => setDuoData(r.data)).catch(() => {})
    })
  }, [])
  const duoChampion = duoData?.champion ?? null

  // TEST-ONLY: ?testDuoCelebration=Player1Name:Player2Name
  const testDuoParam  = urlParams.get("testDuoCelebration")
  const testDuoActive = !!testDuoParam
  const testDuoP1Name = testDuoParam?.split(":")?.[0] || "Player 1"
  const testDuoP2Name = testDuoParam?.split(":")?.[1] || "Player 2"
  const testDuoP1Match = (testDuoActive && players.length > 0) ? players.find(p => p.name.toLowerCase() === testDuoP1Name.toLowerCase()) : null
  const testDuoP2Match = (testDuoActive && players.length > 0) ? players.find(p => p.name.toLowerCase() === testDuoP2Name.toLowerCase()) : null
  const testDuoP1     = testDuoActive ? { name: testDuoP1Name, avatar: testDuoP1Match ? resolveAvatar(testDuoP1Match).thumb : null } : null
  const testDuoP2     = testDuoActive ? { name: testDuoP2Name, avatar: testDuoP2Match ? resolveAvatar(testDuoP2Match).thumb : null } : null

  const duoPlayer1 = testDuoP1 || (duoChampion ? {
    name:    duoChampion.set1Name,
    avatar:  duoChampion.set1AvatarUrl,
    bgImage: duoChampion.set1AvatarBg,
  } : null)
  const duoPlayer2 = testDuoP2 || (duoChampion ? {
    name:    duoChampion.set2Name,
    avatar:  duoChampion.set2AvatarUrl,
    bgImage: duoChampion.set2AvatarBg,
  } : null)

  const playoffFinal    = playoffsData?.matches?.find(m => m.matchType === "final")
  const playoffComplete = playoffFinal?.status === "completed"

  // Captain always shown first in the roster list, wherever it's used.
  // Defined here BEFORE first use to avoid TDZ crash in production bundles.
  const sortCaptainFirst = (list) =>
    [...list].sort((a, b) => (b.isCaptain ? 1 : 0) - (a.isCaptain ? 1 : 0))

  // For group_knockout format — read champion from team knockout Champions Final
  const { data: teamKOData, isLoading: teamKOLoading } = useTeamKnockoutCurrent()
  const knockoutChampsFinal  = teamKOData?.matches?.find(m => m.match_type === "champions_final")
  const knockoutChampion     = knockoutChampsFinal?.status === "completed" ? knockoutChampsFinal?.winner_id : null

  // Europa Final winner (group_knockout format)
  const knockoutEuropaFinal   = teamKOData?.matches?.find(m => m.match_type === "europa_final")
  const knockoutEuropaWinnerId = knockoutEuropaFinal?.status === "completed" ? knockoutEuropaFinal?.winner_id : null
  const europaChampion        = knockoutEuropaWinnerId ? teams.find(t => t.id === knockoutEuropaWinnerId) : null
  const europaChampionPlayers = europaChampion ? sortCaptainFirst(players.filter(p => p.teamId === europaChampion.id)) : []

  // Champion detection — works for all formats:
  // Group+Knockout: read from team_knockout_matches Champions Final
  // League+Knockout: read from the playoff Final winner
  // League Only: read the stored champion team ID from app_settings
  const championTeamId = isGroupKnockout
    ? knockoutChampion
    : isLeagueOnly
      ? (leagueFormatData?.leagueOnlyChampionTeamId || null)
      : (playoffComplete ? playoffFinal.winnerTeamId : null)
  const teamChampion = championTeamId ? teams.find(t => t.id === championTeamId) : null

  const teamChampionPlayers = teamChampion
    ? sortCaptainFirst(players.filter(p => p.teamId === teamChampion.id))
    : []

  // TEST-ONLY: ?testTeamCelebration=SomeTeamName previews this instantly.
  const testTeamActive = urlParams.has("testTeamCelebration")
  const testTeamParam  = urlParams.get("testTeamCelebration")
  const testTeamName   = testTeamActive

  // TEST-ONLY: ?testRevolution=PlayerName
  const testRevParam  = urlParams.get("testRevolution")
  const testRevActive = !!testRevParam
  const testRevPlayer = (testRevActive && players.length > 0)
    ? players.find(p => p.name.toLowerCase() === testRevParam.toLowerCase())
    : null
  const testRevAvatar = testRevPlayer ? resolveAvatar(testRevPlayer).thumb : null
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
  const displayTeamLogo   = testTeamMatch?.logoUrl || teamChampion?.logoUrl || null
  const displayTeamAnthem = testTeamMatch?.anthemUrl || teamChampion?.anthemUrl || null
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

  // Team real trigger → handled by queue below

  // Europa real trigger → handled by queue below

  // Revolution real trigger → handled by queue below

  // Duo real trigger → handled by queue below

  // ── UCL Knockout champion celebration ───────────────────────────────────────
  // Fires once the UCL Knockout Final is completed — mirrors the Weekly
  // Tournament celebration exactly, just reading from ucl-knockout instead.
  const [showUclCelebration, setShowUclCelebration] = useState(false)
  const uclFinalMatch = uclKnockout?.matches?.find(
    m => m.round === uclKnockout.totalRounds && m.status === "completed"
  )
  const uclChampion = uclFinalMatch
    ? (uclFinalMatch.winnerId === uclFinalMatch.player1Id ? uclFinalMatch.player1Name : uclFinalMatch.player2Name)
    : null
  const uclChampionAvatar = uclFinalMatch
    ? resolveAvatar(
        uclFinalMatch.winnerId === uclFinalMatch.player1Id
          ? { avatarId: uclFinalMatch.player1AvatarId, avatarUrl: uclFinalMatch.player1AvatarUrl, avatarBgUrl: uclFinalMatch.player1AvatarBgUrl }
          : { avatarId: uclFinalMatch.player2AvatarId, avatarUrl: uclFinalMatch.player2AvatarUrl, avatarBgUrl: uclFinalMatch.player2AvatarBgUrl }
      )
    : { thumb: null, bg: null }

  // TEST-ONLY: ?testUclCelebration=SomePlayerName previews this instantly.
  const testUclActive = urlParams.has("testUclCelebration")
  const testUclParam  = urlParams.get("testUclCelebration")
  const testUclMatchedPlayer = testUclParam
    ? players.find(p => p.name.toLowerCase() === testUclParam.toLowerCase())
    : null
  const testUclName   = testUclActive
    ? (testUclMatchedPlayer?.name || (testUclParam && !["1", "true"].includes(testUclParam) ? testUclParam : "Test Player"))
    : null
  const displayUclChampion = testUclName || uclChampion
  const displayUclChampionAvatar = testUclActive
    ? resolveAvatar(testUclMatchedPlayer)
    : uclChampionAvatar

  useEffect(() => {
    if (!testUclActive) return
    setShowUclCelebration(true)
    const dismiss = () => setShowUclCelebration(false)
    const timer = setTimeout(dismiss, 10000)
    document.addEventListener("click", dismiss)
    return () => { clearTimeout(timer); document.removeEventListener("click", dismiss) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testUclActive])

  // UCL real trigger → handled by queue below

  // ── Ballon d'Or celebration ──────────────────────────────────────────────
  // Fires immediately after the UCL Champion celebration finishes (whether
  // dismissed by timeout or click) — a sequential "part 2" reveal, not a
  // simultaneous one, since both trigger from the same UCL Final moment.
  // Winner = whoever has the highest total BDR points at that instant,
  // which already includes the UCL awards since those apply server-side
  // before this data is ever fetched.
  const [showBallonDorCelebration, setShowBallonDorCelebration] = useState(false)
  const [showChampionshipCelebration, setShowChampionshipCelebration] = useState(false)
  const [showWeeklyHonours, setShowWeeklyHonours] = useState(false)
  // TEST-ONLY: ?testChampionshipCelebration=TeamName previews instantly
  const testChampActive = urlParams.has("testChampionshipCelebration")
  const testChampParam  = urlParams.get("testChampionshipCelebration")
  const testChampTeam   = testChampParam && !["1","true"].includes(testChampParam)
    ? teams.find(t => t.name.toLowerCase().includes(testChampParam.toLowerCase()))
    : (teams[0] ?? null)
  useEffect(() => {
    if (!testChampActive) return
    setShowChampionshipCelebration(true)
  }, [testChampActive])

  // Championship winning team players (UCL winner's team)
  const championshipTeamId = uclKnockout?.matches
    ?.find(m => m.round === uclKnockout?.totalRounds && m.status === "completed")
    ?.winnerId
    ? players.find(p => p.id === uclKnockout?.matches?.find(m => m.round === uclKnockout?.totalRounds && m.status === "completed")?.winnerId)?.teamId
    : null
  const championshipTeamPlayers = championshipTeamId
    ? players.filter(p => p.teamId === championshipTeamId)
    : []
  const championshipTeam = teams.find(t => t.id === championshipTeamId)

  const ballonDorWinner = players.length > 0
    ? [...players].sort((a, b) => b.bdrPoints - a.bdrPoints)[0]
    : null

  // TEST-ONLY: ?testBallonDor=1 previews this instantly, skipping the
  // UCL-first sequencing, for quick testing. ?testBallonDor=SomePlayerName
  // previews with that specific player instead of the real current leader —
  // useful for checking a player's avatar/background who isn't actually #1.
  const testBallonDorActive = urlParams.has("testBallonDor")
  const testBallonDorParam  = urlParams.get("testBallonDor")
  const testBallonDorMatchedPlayer = testBallonDorParam && !["1", "true"].includes(testBallonDorParam)
    ? players.find(p => p.name.toLowerCase() === testBallonDorParam.toLowerCase())
    : null
  const displayBallonDorWinner = testBallonDorActive
    ? (testBallonDorMatchedPlayer || ballonDorWinner)
    : ballonDorWinner
  useEffect(() => {
    if (!testBallonDorActive) return
    setShowBallonDorCelebration(true)
    const dismiss = () => setShowBallonDorCelebration(false)
    const timer = setTimeout(dismiss, 10000)
    document.addEventListener("click", dismiss)
    return () => { clearTimeout(timer); document.removeEventListener("click", dismiss) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testBallonDorActive])

  // BallonDor real trigger → handled by queue below

  // ── Celebration Queue ────────────────────────────────────────────────────
  // Builds once when data is ready. Collects all unseen eligible celebrations.
  // Plays them one by one — marks as seen only when each actually dismisses.
  const [celebQueue, setCelebQueue] = useState(null)
  const [celebIndex, setCelebIndex] = useState(0)
  const queueReady = !teamsLoading && !playersLoading && !leagueFormatLoading && !teamKOLoading

  const dismissCelebration = () => {
    if (!celebQueue || celebIndex >= celebQueue.length) return
    const current = celebQueue[celebIndex]
    localStorage.setItem(current.key, "1")
    current.setter(false)
    const next = celebIndex + 1
    setCelebIndex(next)
    if (next < celebQueue.length) {
      setTimeout(() => celebQueue[next].setter(true), 500)
    }
  }

  // Build the queue once when all relevant data has loaded
  useEffect(() => {
    if (!queueReady || celebQueue !== null) return
    const entries = []

    // 1. Weekly (24h)
    if (weeklyChampion && weeklyTournament?.id) {
      const k = `weekly_champion_seen_${weeklyTournament.id}`
      const at = settings[`weekly_champion_completed_at_${weeklyTournament.id}`]
      if (!localStorage.getItem(k) && isWithinCelebrationWindow(at, 24))
        entries.push({ key: k, setter: setShowWeeklyCelebration })
    }
    // 2. Team Champion (48h)
    if (teamChampion && teamCelebrationSeason) {
      const k = `team_league_champion_seen_${teamCelebrationSeason}_${teamChampion.id}`
      const at = isGroupKnockout ? knockoutChampsFinal?.completed_at : settings["league_champion_completed_at"]
      if (!localStorage.getItem(k) && isWithinCelebrationWindow(at, 48))
        entries.push({ key: k, setter: setShowTeamCelebration })
    }
    // 3. Europa Champion (48h)
    if (europaChampion && teamCelebrationSeason) {
      const k = `europa_champion_seen_${teamCelebrationSeason}_${europaChampion.id}`
      if (!localStorage.getItem(k) && isWithinCelebrationWindow(knockoutEuropaFinal?.completed_at, 48))
        entries.push({ key: k, setter: setShowEuropaCelebration })
    }
    // 4. UCL (24h)
    if (uclChampion && uclKnockout?.id) {
      const k = `ucl_champion_seen_${uclKnockout.id}`
      const at = settings[`ucl_champion_completed_at_${uclKnockout.id}`]
      if (!localStorage.getItem(k) && isWithinCelebrationWindow(at, 24))
        entries.push({ key: k, setter: setShowUclCelebration })
    }
    // 5. Revolution (6h)
    if (revChampion && revolutionData?.id) {
      const k = `revolution_champion_seen_${revolutionData.id}`
      const at = settings[`revolution_champion_completed_at_${revolutionData.id}`]
      if (!localStorage.getItem(k) && isWithinCelebrationWindow(at, 6))
        entries.push({ key: k, setter: setShowRevCelebration })
    }
    // 6. Duo (24h)
    if (duoChampion && duoData?.seasonNumber) {
      const k = `duo_champion_seen_${duoData.seasonNumber}`
      const at = settings[`duo_champion_completed_at_${duoData.seasonNumber}`]
      if (!localStorage.getItem(k) && isWithinCelebrationWindow(at, 24))
        entries.push({ key: k, setter: setShowDuoCelebration })
    }
    // 7. Ballon d'Or (follows UCL, 24h)
    if (ballonDorWinner && uclKnockout?.id) {
      const k = `ballon_dor_seen_${uclKnockout.id}`
      const at = settings[`ucl_champion_completed_at_${uclKnockout.id}`]
      if (!localStorage.getItem(k) && isWithinCelebrationWindow(at, 24))
        entries.push({ key: k, setter: setShowBallonDorCelebration })
    }

    setCelebQueue(entries)
    if (entries.length > 0) entries[0].setter(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueReady, teamChampion?.id, europaChampion?.id, revChampion?.id,
      duoChampion?.set1Name, uclChampion, weeklyChampion, settings])

  // Auto-dismiss timer for current celebration
  useEffect(() => {
    if (!celebQueue || celebIndex >= celebQueue.length) return
    const timer = setTimeout(dismissCelebration, 10000)
    document.addEventListener("click", dismissCelebration)
    return () => { clearTimeout(timer); document.removeEventListener("click", dismissCelebration) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celebIndex, celebQueue?.length])

  // Read featured panel: localStorage first (instant, no API wait), then sync from settings
  const storedPanel    = typeof window !== "undefined" ? localStorage.getItem("featured_panel") : null
  // ── Weekly Honours celebration trigger ─────────────────────────────────────
  const weeklyHonoursTriggeredAt = settings?.weekly_celebration_triggered_at
  const weeklyHonoursKey = `weekly_honours_seen_${weeklyHonoursTriggeredAt}`
  if (weeklyHonoursTriggeredAt && !showWeeklyHonours) {
    const seenKey = localStorage.getItem(weeklyHonoursKey)
    const age     = Date.now() - new Date(weeklyHonoursTriggeredAt).getTime()
    if (!seenKey && age < 8 * 60 * 60 * 1000) {
      setTimeout(() => setShowWeeklyHonours(true), 300)
    }
  }

  const featuredPanel  = settings?.featured_panel || storedPanel || "standings"
  // Sync localStorage whenever settings API returns a value
  if (settings?.featured_panel && settings.featured_panel !== storedPanel) {
    localStorage.setItem("featured_panel", settings.featured_panel)
  }
  const activePanel    = searchParams.get("view") || featuredPanel

  // Re-declare top scorer queries here so they can use activePanel + celebration states
  // as enabled guards — defers these requests until they're actually needed, cutting
  // the initial parallel request burst from 11 down to 9 on a cold first load.
  const { data: uclTopScorersDeferred = [] }    = useUclTopScorers(
    activePanel === "ucl" || showUclCelebration || showBallonDorCelebration
  )
  const { data: weeklyTopScorersDeferred = [] } = useWeeklyTopScorers(
    activePanel === "weekly" || showWeeklyCelebration
  )
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
  const uclGoldenBoot    = uclTopScorersDeferred[0]?.goals > 0    ? uclTopScorersDeferred[0]    : null
  const weeklyGoldenBoot = weeklyTopScorersDeferred[0]?.goals > 0 ? weeklyTopScorersDeferred[0] : null

  return (
    <Layout>
      {showWeeklyCelebration && displayWeeklyChampion ? (
        <WeeklyTournamentCelebration
          name={displayWeeklyChampion}
          avatarThumb={displayWeeklyChampionAvatar?.thumb}
          scorer={testGoldenBoot || weeklyGoldenBoot || null}
          onDismiss={() => setShowWeeklyCelebration(false)}
        />
      ) : showTeamCelebration && displayTeamChampion ? (
        <DshannLeagueCelebration
          teamName={displayTeamChampion}
          teamLogo={displayTeamLogo}
          players={displayTeamPlayers}
          scorer={teamGoldenBoot || null}
          anthemUrl={displayTeamAnthem}
          onDismiss={() => setShowTeamCelebration(false)}
        />
      ) : showEuropaCelebration && europaChampion ? (
        <ChampionCelebration
          trophyImage={europaTrophyLogo}
          eyebrow="Europa Championship"
          title={europaChampion.name}
          subtitle="are the Europa Champions! 🥈"
          badgeImage={europaChampion.logoUrl}
          onClick={dismissCelebration}
        >
          {europaChampionPlayers.length > 0 && (
            <TeamRosterChips players={europaChampionPlayers} />
          )}
        </ChampionCelebration>
      ) : showUclCelebration && displayUclChampion ? (
        <ChampionCelebration
          trophyImage={uclTrophyLogo}
          eyebrow="UCL"
          title={displayUclChampion}
          subtitle="is the UCL Champion! 🏆"
          badgeImage={displayUclChampionAvatar.thumb}
          bgImage={displayUclChampionAvatar.bg}
        >
          {uclGoldenBoot && <GoldenBootBadge scorer={uclGoldenBoot} />}
        </ChampionCelebration>
      ) : (showRevCelebration && revChampion) || (testRevActive && !testRevDismissed) ? (
        <RevolutionCelebration
          name={testRevActive ? (testRevParam || "Test Player") : revChampion.name}
          avatarThumb={testRevActive ? testRevAvatar : revChampionAvatar.thumb}
          anthemUrl={null}
          onDismiss={() => { setShowRevCelebration(false); setTestRevDismissed(true) }}
        />
      ) : (showDuoCelebration || (testDuoActive && !testDuoDismissed)) && (duoChampion || testDuoActive) ? (
        <DuoWinnerCelebration
          player1={duoPlayer1}
          player2={duoPlayer2}
          scorer={null}
          onDismiss={() => { setShowDuoCelebration(false); setTestDuoDismissed(true) }}
        />
      ) : showBallonDorCelebration && displayBallonDorWinner ? (
        <BallonDorCelebration
          trophyImage={ballonDorTrophy}
          winnerName={displayBallonDorWinner.name}
          bdrPoints={displayBallonDorWinner.bdrPoints}
          avatarImage={resolveAvatar(displayBallonDorWinner).thumb}
          bgImage={resolveAvatar(displayBallonDorWinner).bg}
        />
      ) : showChampionshipCelebration ? (
        <ChampionshipCelebration
          teamName={testChampActive
            ? (testChampTeam?.name ?? "ADRENALINE")
            : (championshipTeam?.name ?? "Champions")}
          teamLogo={testChampActive ? testChampTeam?.logoUrl : championshipTeam?.logoUrl}
          players={testChampActive
            ? (players.filter(p => p.teamId === testChampTeam?.id).length > 0
                ? players.filter(p => p.teamId === testChampTeam?.id)
                : ["Sidhu","Sri","Abdul","Pappali","Gokul Sanjay","Aakash","Karthi","Vicky","Nithish JB5","Jefery","Gowri Shankar"].map(name => ({ name })))
            : championshipTeamPlayers}
          onDismiss={() => {
            setShowChampionshipCelebration(false)
            if (celebQueue && celebIndex < celebQueue.length) dismissCelebration()
          }}
        />
      ) : null}
      {/* Live auction banner — only shows when an auction is actually active */}
      {auctionData?.session?.status === "active" && auctionData?.session?.hasEntered && (
        <button
          onClick={() => navigate("/auction/live")}
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
          <span className="text-xs font-semibold text-gold flex-shrink-0">Watch Live →</span>
        </button>
      )}

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
              {isGroupKnockout ? (
                // Group+Knockout format — show each group's leader separately
                (groupStandings?.A?.[0] || groupStandings?.B?.[0]) && (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-500">Group leaders</span>
                    {groupStandings?.A?.[0] && (
                      <span className="text-xs font-semibold text-white bg-accent/15 border border-accent/25 px-2 py-0.5 rounded-full">
                        A: {groupStandings.A[0].teamName} · {groupStandings.A[0].pts} pts
                      </span>
                    )}
                    {groupStandings?.B?.[0] && (
                      <span className="text-xs font-semibold text-white bg-accent/15 border border-accent/25 px-2 py-0.5 rounded-full">
                        B: {groupStandings.B[0].teamName} · {groupStandings.B[0].pts} pts
                      </span>
                    )}
                  </div>
                )
              ) : (
                teams[0] && (
                  <div className="mt-4 flex items-center gap-2">
                    <span className="text-xs text-slate-500">League leader</span>
                    <span className="text-xs font-semibold text-white bg-accent/15 border border-accent/25 px-2 py-0.5 rounded-full">
                      {teams[0].name} · {teams[0].points} pts
                    </span>
                  </div>
                )
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
                <StatCard label="BDR Leader"    value={leader?.bdrPoints ?? "—"} sub={leader?.name}    icon={Trophy}    accent="bg-gold/15 text-gold"
                  image={ballonDorTrophy} trophyStyle
                  onClick={() => setActivePanel("bdr")} />
                <StatCard label="Highest MV"    value={topMV?.marketValue ?? "—"} sub={topMV?.name} icon={TrendingUp} accent="bg-accent/15 text-accent"
                  image={topMV ? (resolveAvatar(topMV).thumb || null) : null} avatarStyle
                  onClick={() => setActivePanel("market")} />
                <StatCard label="Teams"         value={teams.length}                                   sub="in the league"   icon={Users}      accent="bg-violet-400/15 text-violet-400"
                  image={teamsImg} avatarStyle
                  onClick={() => navigate("/team-trophies")} />
                <StatCard label="Team of Champions"  value={championship[0]?.totalBdr ?? "—"}               sub={championship[0]?.name} icon={Trophy} accent="bg-amber-400/15 text-amber-400"
                  image={championshipTrophy} trophyStyle
                  onClick={() => navigate("/championship")} />
              </div>

              {/* Panel */}
              {(() => {
                const isSidebarView = ["players","compare","teams","bdr","market","trophies"].includes(activePanel)
                const sidebarLabels = { players: "Total Players", compare: "Compare Players", teams: "Teams", bdr: "BDR Rankings", market: "Market Values", trophies: "Trophies" }
                return (
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Dashboard view</p>
                    {isSidebarView ? (
                      <span className="bg-pitch-800 border border-surface-border rounded-xl px-3 py-1.5 text-sm text-white">
                        {sidebarLabels[activePanel]}
                      </span>
                    ) : (
                      <select
                        value={activePanel}
                        onChange={e => setActivePanel(e.target.value)}
                        className="bg-pitch-800 border border-surface-border rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-accent/40 transition-colors"
                      >
                        {PANEL_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )
              })()}

              <div key={activePanel} className="animate-panel-in">
                {activePanel === "players"   && <PlayersDirectory players={players} onPlayerClick={handlePlayer} />}
                {activePanel === "standings" && (
                  <StandingsTable
                    teams={teams} players={players}
                    onPlayerClick={handlePlayer}
                    view={standingsView} onViewChange={setStandingsView}
                  />
                )}
                {activePanel === "ucl"       && <UclStandings onPlayerClick={handlePlayer} />}
                {activePanel === "weekly"    && <WeeklyDashboard onPlayerClick={handlePlayer} />}
                {activePanel === "revolution" && <RevolutionDashboard onPlayerClick={handlePlayer} />}
                {activePanel === "duo"        && <DuoDashboard />}
                {activePanel === "teamknockout" && (
                  <Suspense fallback={<div className="text-slate-500 text-sm py-4 text-center">Loading…</div>}>
                    <TeamKnockoutDashboard />
                  </Suspense>
                )}
                {activePanel === "bdr"       && <BDRRanking players={players} onPlayerClick={handlePlayer} />}
                {activePanel === "market"    && <MarketValues players={players} onPlayerClick={handlePlayer} />}
                {activePanel === "trophies"  && <TrophyRanking players={players} onPlayerClick={handlePlayer} trophyKey={trophyKey} onTrophyChange={setTrophyKey} />}
                {activePanel === "compare"   && <PlayerComparison onPlayerClick={handlePlayer} />}
                {activePanel === "teams"     && <TeamsDirectory teams={teams} />}
              </div>
            </>
          )}
        </>
      )}

      {/* Weekly Honours Celebration — side by side overlay */}
      {showWeeklyHonours && (
        <WeeklyCelebrationOverlay
          settings={settings || {}}
          onDismiss={() => {
            setShowWeeklyHonours(false)
            if (weeklyHonoursKey) localStorage.setItem(weeklyHonoursKey, "1")
          }}
        />
      )}
    </Layout>
  )
}