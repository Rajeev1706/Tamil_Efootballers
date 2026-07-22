import { useNavigate } from "react-router-dom"
import { Gavel, Trophy, Sparkles, ArrowLeft } from "lucide-react"
import { useAuctionCurrent, usePlayer } from "../lib/queries"
import { cn } from "../lib/utils"
import { findMostExpensiveSale } from "../lib/auctionNarrative"
import { useAuctionReveal } from "../hooks/useAuctionReveal"
import TeamPanel from "../components/auction/TeamPanel"
import PoolPanel from "../components/auction/AuctionPoolPanel"
import { useAuctionSocket } from "../hooks/useAuctionSocket"
import { useAuctionTimer } from "../hooks/useAuctionTimer"
import { useBumpOnChange } from "../hooks/useBumpOnChange"
import HeadToHead from "../components/player/HeadToHead"
import SeasonSummary from "../components/player/SeasonSummary"

const CARD_COLORS = { silver: "text-slate-300", gold: "text-gold", purple: "text-purple-300" }

function FormDot({ result }) {
  const styles = {
    W: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
    D: "bg-amber-500/20 text-amber-400 border-amber-500/40",
    L: "bg-rose-500/20 text-rose-400 border-rose-500/40",
  }
  return <span className={cn("w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-bold", styles[result] || styles.D)}>{result}</span>
}

// Dedicated live-auction view for team captains — same live data as the
// public /auction/live page, but deliberately WITHOUT the narrative/war/
// collector/MVP/milestone flair (same call as the admin screen: keep it
// focused, not distracting), and WITH each player's real stats shown
// right on the card, since captains actually need that to decide whether
// to bid, not just names and animations.
export default function TeamAuctionLive() {
  const navigate = useNavigate()
  const { data } = useAuctionCurrent()
  const { data: currentPlayer } = usePlayer(data?.session?.currentPlayerId)
  const { timeLeft, timerActive } = useAuctionTimer(data?.session)
  const bidBumping = useBumpOnChange(data?.session?.currentBid)
  useAuctionReveal(data, { showMilestoneBanners: false })
  useAuctionSocket()

  if (!data?.session) {
    return (
      <div className="auction-page min-h-screen bg-pitch-900 flex items-center justify-center p-4">
        <div className="text-center">
          <Gavel className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500">No auction is currently running</p>
          <button onClick={() => navigate("/team")} className="mt-4 text-sm text-accent hover:underline">← Back to my team</button>
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
          <button onClick={() => navigate("/team")} className="mt-4 text-sm text-accent hover:underline">← Back to my team</button>
        </div>
      </div>
    )
  }

  const leftTeams = teams.slice(0, Math.ceil(teams.length / 2))
  const rightTeams = teams.slice(Math.ceil(teams.length / 2))

  return (
    <div className="auction-page min-h-screen bg-pitch-900 p-4 md:p-6">
      <div className="flex items-center gap-3 mb-6 justify-center relative">
        <button onClick={() => navigate("/team")} className="absolute left-0 flex items-center gap-2 text-slate-400 hover:text-white text-sm">
          <ArrowLeft className="w-4 h-4" /> My Team
        </button>
        <Gavel className="w-5 h-5 text-accent" />
        <h1 className="text-lg font-extrabold text-white">Live Player Auction</h1>
        <span className="text-xs text-slate-500">Round {session.round}</span>
      </div>

      <div className="auction-layout max-w-[100rem] mx-auto">
        <TeamPanel title="👤 Teams" teamList={leftTeams} sales={sales} retentions={retentions} budgetPerTeam={session.budgetPerTeam} />

        <div className="space-y-4">
          {/* Current player */}
          <div className={cn("card p-8 text-center", session.currentPlayerId && "auction-stage")}>
            {session.currentPlayerId ? (
              <>
                {currentPlayer?.imageUrl && (
                  <img src={currentPlayer.imageUrl} alt={currentPlayer.name} className="w-full max-w-md mx-auto object-contain rounded-xl border border-surface-border mb-4" />
                )}
                <h2 className="text-3xl auction-stage-name text-white mb-1">{session.currentPlayerName}</h2>
                {session.currentPlayerAlias && (
                  <p className="text-sm text-slate-400 mb-1">"{session.currentPlayerAlias}"</p>
                )}
                {session.currentPlayerPrevTeamId && (
                  <p className="text-xs text-slate-500 mb-3">Previously with {teamNameById[session.currentPlayerPrevTeamId]}</p>
                )}

                {/* Full player info shown right here — no need to click
                    away to a separate profile page. */}
                <div className="max-w-sm mx-auto mb-5">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <span className={cn("text-xs font-bold uppercase px-2 py-0.5 rounded border", CARD_COLORS[session.currentPlayerCardType])}>
                      {session.currentPlayerCardType} card
                    </span>
                    {currentPlayer?.grade && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-pitch-800 border border-surface-border text-slate-300">
                        Grade {currentPlayer.grade}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-pitch-800/60 border border-surface-border rounded-xl px-4 py-3 text-center">
                      <p className="text-xs text-slate-500 mb-1">Market value</p>
                      <p className="text-lg font-extrabold font-mono text-accent">₹{currentPlayer?.marketValue ?? session.currentPlayerMarketValue ?? "—"}</p>
                    </div>
                    <div className="bg-pitch-800/60 border border-surface-border rounded-xl px-4 py-3 text-center">
                      <p className="text-xs text-slate-500 mb-1">BDR points</p>
                      <p className="text-lg font-extrabold font-mono text-gold">{(currentPlayer?.bdrPoints ?? session.currentPlayerBdrPoints ?? 0).toLocaleString?.() ?? "—"}</p>
                    </div>
                  </div>

                  {currentPlayer?.form?.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-slate-500 uppercase tracking-widest mb-2 font-semibold text-center">Recent form</p>
                      <div className="flex items-center justify-center gap-2">
                        {currentPlayer.form.map((r, i) => <FormDot key={i} result={r} />)}
                      </div>
                    </div>
                  )}
                </div>

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

          {/* Overall career record — total wins/draws/losses, games
              played, goals, filterable by match type. Distinct from the
              head-to-head breakdown below, which is per-opponent. */}
          {currentPlayer && <SeasonSummary player={currentPlayer} />}

          {/* Full match history — exact same component the player
              profile page uses, complete opponent-by-opponent record,
              not just a trimmed recent-matches list. */}
          {currentPlayer?.matchHistory?.length > 0 && (
            <HeadToHead matchHistory={currentPlayer.matchHistory} />
          )}

          <PoolPanel pool={pool} clickable />
        </div>

        <TeamPanel title="👤 Teams" teamList={rightTeams} sales={sales} retentions={retentions} budgetPerTeam={session.budgetPerTeam} />
      </div>
    </div>
  )
}