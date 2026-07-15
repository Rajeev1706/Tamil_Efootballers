import { useEffect, useRef, useState } from "react"
import { Gavel, Trophy, Sparkles } from "lucide-react"
import { useAuctionCurrent } from "../lib/queries"
import { cn } from "../lib/utils"
import { generateSaleNarratives, findMostExpensiveSale, detectCollector, getMvpCheckpoint } from "../lib/auctionNarrative"
import { useAuctionReveal } from "../hooks/useAuctionReveal"
import TeamPanel from "../components/auction/TeamPanel"
import PoolPanel from "../components/auction/AuctionPoolPanel"
import { useAuctionSocket } from "../hooks/useAuctionSocket"
import { useAuctionTimer } from "../hooks/useAuctionTimer"
import { useBumpOnChange } from "../hooks/useBumpOnChange"

export default function AuctionLive() {
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
      <div className="flex items-center gap-3 mb-6 justify-center">
        <Gavel className="w-5 h-5 text-accent" />
        <h1 className="text-lg font-extrabold text-white">Live Player Auction</h1>
        <span className="text-xs text-slate-500">Round {session.round}</span>
      </div>

      <div className="auction-layout max-w-[100rem] mx-auto">
        <TeamPanel title="👤 Teams" teamList={leftTeams} sales={sales} budgetPerTeam={session.budgetPerTeam} />

        <div className="space-y-4">
          {narratives.map((n, i) => (
            <div key={i} className="card p-3 bg-gold/5 border-gold/30 text-sm text-white text-center animate-champion-pop" dangerouslySetInnerHTML={{ __html: n }} />
          ))}

          {/* Current player */}
          <div className={cn("card p-8 text-center", session.currentPlayerId && "auction-stage")}>
            {session.currentPlayerId ? (
              <>
                <h2 className="text-3xl auction-stage-name text-white mb-1">{session.currentPlayerName}</h2>
                {session.currentPlayerPrevTeamId && (
                  <p className="text-xs text-slate-500 mb-4">Previously with {teamNameById[session.currentPlayerPrevTeamId]}</p>
                )}
                <p className="text-4xl font-mono font-bold text-gold mb-2">
                  <span className={cn("auction-stage-bid", bidBumping && "bump")}>₹{session.currentBid}</span>
                </p>
                <p className="text-sm text-slate-400 mb-2">
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
                <p className="text-sm text-slate-500">Waiting for the next player to go under the hammer…</p>
              </>
            )}
          </div>

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

        <TeamPanel title="👤 Teams" teamList={rightTeams} sales={sales} budgetPerTeam={session.budgetPerTeam} />
      </div>
    </div>
  )
}