import { useEffect, useRef, useState } from "react"
import { Gavel, Trophy, Sparkles, ArrowLeft } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useAuctionCurrent } from "../lib/queries"
import { cn } from "../lib/utils"
import { generateSaleNarratives, findMostExpensiveSale, detectCollector, getMvpCheckpoint } from "../lib/auctionNarrative"
import { useAuctionReveal } from "../hooks/useAuctionReveal"
import TeamPanel from "../components/auction/TeamPanel"
import PoolPanel from "../components/auction/AuctionPoolPanel"
import { useAuctionSocket } from "../hooks/useAuctionSocket"
import { useAuctionTimer } from "../hooks/useAuctionTimer"
import { useBumpOnChange } from "../hooks/useBumpOnChange"
import { getAvatarById } from "../lib/avatars"
import { useCachedImage } from "../hooks/useCachedImage"



// Shows player avatar + previous team logo in the auction stage center panel
function AuctionPlayerHero({ session, teamLogoById }) {
  const preset      = getAvatarById(session.currentPlayerAvatarId)
  const rawAvatar   = session.currentPlayerAvatarUrl   || preset?.thumb || null
  const avatarSrc   = useCachedImage(rawAvatar)
  const prevLogoSrc = useCachedImage(teamLogoById?.[session.currentPlayerPrevTeamId])

  return (
    <>
      {/* Avatar — centered above player name */}
      {avatarSrc && (
        <div className="flex justify-center mb-3">
          <img
            src={avatarSrc}
            alt={session.currentPlayerName}
            className="w-20 h-20 rounded-2xl object-cover border-2 border-surface-border shadow-lg"
          />
        </div>
      )}
    </>
  )
}

// Previous team logo shown BELOW the card type + grade badges
function PrevTeamLogo({ session, teamLogoById, teamNameById }) {
  const prevLogoSrc = useCachedImage(teamLogoById?.[session.currentPlayerPrevTeamId])
  if (!session.currentPlayerPrevTeamId) return null

  return (
    <div className="flex flex-col items-center gap-1 mt-3 mb-2">
      {prevLogoSrc ? (
        <img
          src={prevLogoSrc}
          alt="Previous team"
          className="w-16 h-16 rounded-full object-cover border-2 border-surface-border shadow-md"
        />
      ) : (
        <div className="w-16 h-16 rounded-full bg-pitch-800 border-2 border-surface-border flex items-center justify-center text-sm font-bold text-slate-400">
          {teamNameById?.[session.currentPlayerPrevTeamId]?.slice(0,2).toUpperCase()}
        </div>
      )}
      <p className="text-[10px] text-slate-500 font-medium">Previous team</p>
    </div>
  )
}


// Full auction stage panel with player bg image as hero background
function AuctionStagePanel({ session, teamLogoById, teamNameById, bidBumping, timerActive, timeLeft }) {
  const preset    = getAvatarById(session.currentPlayerAvatarId)
  const rawAvatar = session.currentPlayerAvatarUrl   || preset?.thumb || null
  const rawBg     = session.currentPlayerAvatarBgUrl || preset?.bg    || null
  const avatarSrc = useCachedImage(rawAvatar)
  const bgSrc     = useCachedImage(rawBg)

  return (
    <div className={cn("relative rounded-2xl overflow-hidden border border-surface-border text-center", session.currentPlayerId && "auction-stage")}>
      {bgSrc && (
        <>
          <div className="absolute inset-0 bg-cover bg-center bg-top" style={{ backgroundImage: `url(${bgSrc})` }} />
          <div className="absolute inset-0 bg-pitch-900/75" />
        </>
      )}
      {!bgSrc && <div className="absolute inset-0 bg-gradient-to-br from-pitch-800 to-pitch-900" />}
      <div className="relative z-10 p-8">
        {session.currentPlayerId ? (
          <>
            {avatarSrc && (
              <div className="flex justify-center mb-3">
                <img src={avatarSrc} alt={session.currentPlayerName} className="w-20 h-20 rounded-2xl object-cover border-2 border-surface-border shadow-lg" />
              </div>
            )}
            <h2 className="text-3xl auction-stage-name text-white mb-1">{session.currentPlayerName}</h2>
            <PrevTeamLogo session={session} teamLogoById={teamLogoById} teamNameById={teamNameById} />
            <p className="text-4xl font-mono font-bold text-gold mb-2">
              <span className={cn("auction-stage-bid", bidBumping && "bump")}>₹{session.currentBid}</span>
            </p>
            <p className="text-sm text-slate-300 mb-2">
              {session.currentBidderTeamName ? (
                <>Highest bid: <span className="text-white font-semibold">{session.currentBidderTeamName}</span></>
              ) : "Waiting for bids…"}
            </p>
            {timerActive && (
              <div className={cn("auction-timer", timeLeft <= 5 && "red")}>⏱ {timeLeft}s</div>
            )}
          </>
        ) : (
          <>
            <Sparkles className="w-6 h-6 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Waiting for the next player…</p>
          </>
        )}
      </div>
    </div>
  )
}

export default function AuctionLive() {
  const navigate = useNavigate()
  const { data } = useAuctionCurrent()
  const { timeLeft, timerActive } = useAuctionTimer(data?.session)
  const bidBumping = useBumpOnChange(data?.session?.currentBid)
  const [narratives, setNarratives] = useState([])
  useAuctionReveal(data, {
    onBidPattern: (html) => {
      setNarratives(prev => [...prev, html])
      setTimeout(() => setNarratives(prev => prev.filter(n => n !== html)), 6000)
    },
  })
  useAuctionSocket()
  const prevTopSaleId = useRef(null)

  // Detect a brand-new sale between polls (not on first load) and show its
  // narrative banner for a few seconds — same generator the admin screen
  // uses, so the story is identical for everyone watching.
  useEffect(() => {
    if (!data?.sales?.length) return
    const topSale = data.sales[0]
    if (prevTopSaleId.current !== null && topSale.id !== prevTopSaleId.current) {
      const poolEntry = data.pool.find(p => p.playerId === topSale.playerId)
      const teamNameById = Object.fromEntries(data.teams.map(t => [t.id, t.name]))
      const teamLogoById  = Object.fromEntries(data.teams.map(t => [t.id, t.logoUrl]))
      const stories = generateSaleNarratives({
        sale: topSale, poolEntry, teamNameById,
        mostExpensiveSoFar: findMostExpensiveSale(data.sales.slice(1)),
      })

      const collectorHtml = detectCollector({ sale: topSale, poolEntry, sales: data.sales, pool: data.pool, teamNameById })
      if (collectorHtml) stories.push(collectorHtml)

      const mvp = getMvpCheckpoint(data.sales, data.teams, data.pool)
      if (mvp) stories.push(mvp.html)

      setNarratives(prev => [...prev, ...stories])
      const timer = setTimeout(() => setNarratives(prev => prev.filter(n => !stories.includes(n))), 6000)
      return () => clearTimeout(timer)
    }
    prevTopSaleId.current = topSale.id
  }, [data?.sales])

  if (!data?.session) {
    return (
      <div className="auction-page min-h-screen bg-pitch-900 flex items-center justify-center">
        <div className="text-center">
          <Gavel className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500">No auction is currently running</p>
        </div>
      </div>
    )
  }

  const { session, pool = [], sales = [], teams = [], retentions = [] } = data
  const teamNameById = Object.fromEntries(teams.map(t => [t.id, t.name]))
  const teamLogoById  = Object.fromEntries(teams.map(t => [t.id, t.logoUrl]))

  if (session.status === "retention") {
    return (
      <div className="auction-page min-h-screen bg-pitch-900 flex items-center justify-center p-4">
        <div className="text-center">
          <Sparkles className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">Retention in progress</p>
          <p className="text-sm text-slate-600 mt-1">The auction will begin shortly</p>
        </div>
      </div>
    )
  }

  if (session.status === "completed") {
    const biggest = findMostExpensiveSale(sales)
    return (
      <div className="auction-page min-h-screen bg-pitch-900 flex items-center justify-center p-4">
        <div className="card p-8 text-center max-w-sm">
          <Trophy className="w-8 h-8 text-gold mx-auto mb-3" />
          <h1 className="text-lg font-bold text-white mb-2">Auction Complete</h1>
          <p className="text-sm text-slate-400">{sales.length} players sold</p>
          {biggest && <p className="text-sm text-gold mt-2">Biggest sale: {biggest.playerName} → {biggest.teamName} for ₹{biggest.price}</p>}
        </div>
      </div>
    )
  }

  const leftTeams = teams.slice(0, Math.ceil(teams.length / 2))
  const rightTeams = teams.slice(Math.ceil(teams.length / 2))

  return (
    <div className="auction-page min-h-screen bg-pitch-900 p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm w-fit">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-center gap-2 sm:mx-auto">
          <Gavel className="w-5 h-5 text-accent" />
          <h1 className="text-lg font-extrabold text-white">Live Player Auction</h1>
          <span className="text-xs text-slate-500">Round {session.round}</span>
        </div>
      </div>

      <div className="auction-layout max-w-[100rem] mx-auto">
        <TeamPanel title="👤 Teams" teamList={leftTeams} sales={sales} retentions={retentions} budgetPerTeam={session.budgetPerTeam} />

        <div className="space-y-4">
          {narratives.map((n, i) => (
            <div key={i} className="card p-3 bg-gold/5 border-gold/30 text-sm text-white text-center animate-champion-pop" dangerouslySetInnerHTML={{ __html: n }} />
          ))}

          {/* Current player */}
          {/* Resolve player bg for the hero panel */}
          <AuctionStagePanel session={session} teamLogoById={teamLogoById} teamNameById={teamNameById} bidBumping={bidBumping} timerActive={timerActive} timeLeft={timeLeft} />

          {/* Recent sales */}
          <div className="card p-4">
            <p className="text-sm font-semibold text-white mb-3">Recent sales</p>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {sales.length === 0 && <p className="text-xs text-slate-600 text-center py-4">No sales yet</p>}
              {sales.slice(0, 20).map(s => (
                <div key={s.id} className="flex items-center justify-between text-sm border-b border-surface-border/40 pb-2 last:border-0">
                  <span className="text-slate-300">{s.playerName} → <span className="text-white font-medium">{s.teamName}</span></span>
                  <span className="text-gold font-mono font-semibold">
                    ₹{s.price}{s.rtmUsed && <span className="text-xs text-purple-400 ml-1.5">RTM</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <PoolPanel pool={pool} />
        </div>

        <TeamPanel title="👤 Teams" teamList={rightTeams} sales={sales} retentions={retentions} budgetPerTeam={session.budgetPerTeam} />
      </div>
    </div>
  )
}