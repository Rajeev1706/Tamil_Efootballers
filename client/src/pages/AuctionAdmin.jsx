import { useState, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Gavel, Trophy, Sparkles } from "lucide-react"
import { useTeams, usePlayers } from "../lib/queries"
import {
  useAuctionCurrent, useStartAuction, useRetainPlayer, useRemoveRetention,
  useAddToPool, useRemoveFromPool, useBuildAuctionPool, useNextAuctionPlayer, usePlaceBid, useSellPlayer,
  useMarkUnsold, useAdvanceAuctionRound, useCompleteAuction,
  useSetBidder, useReduceBid, useExtraTime, useUndoLastSale, useDeleteAuctionSession, useEnterAuction, useLeaveAuction,
} from "../lib/queries"
import { cn } from "../lib/utils"
import { findMostExpensiveSale } from "../lib/auctionNarrative"
import { useAuctionReveal } from "../hooks/useAuctionReveal"
import { useAuctionTimer } from "../hooks/useAuctionTimer"
import { useBumpOnChange } from "../hooks/useBumpOnChange"
import TeamPanel from "../components/auction/TeamPanel"
import PoolPanel from "../components/auction/AuctionPoolPanel"
import { useAuctionSocket } from "../hooks/useAuctionSocket"

const CARD_COLORS = { silver: "border-slate-400 text-slate-300", gold: "border-gold text-gold", purple: "border-purple-400 text-purple-300" }

// ── Screen 0: no session yet ────────────────────────────────────────────
function StartScreen() {
  const [budget, setBudget] = useState(1100)
  const startAuction = useStartAuction()
  return (
    <div className="max-w-md mx-auto mt-20 card p-6 text-center">
      <Gavel className="w-8 h-8 text-accent mx-auto mb-3" />
      <h2 className="text-lg font-bold text-white mb-1">Start a new Player Auction</h2>
      <p className="text-sm text-slate-500 mb-5">This releases every non-captain player back into the pool for a full re-draft.</p>
      <label className="text-xs text-slate-500 block mb-1 text-left">Budget per team (₹)</label>
      <input type="number" value={budget} onChange={e => setBudget(Number(e.target.value))}
        className="w-full bg-pitch-800 border border-surface-border rounded-lg px-3 py-2 text-white mb-4" />
      <button onClick={() => startAuction.mutate(budget)} disabled={startAuction.isPending}
        className="w-full py-2.5 rounded-xl bg-accent text-white font-semibold disabled:opacity-50">
        {startAuction.isPending ? "Starting…" : "Start Auction"}
      </button>
      {startAuction.error && <p className="text-xs text-rose-400 mt-2">{startAuction.error.response?.data?.error}</p>}
    </div>
  )
}

const GRADE_TO_CARD = { S: "purple", A: "gold", B: "silver", C: "silver" }

// ── Screen 1: retention + add players to pool ────────────────────────────
function RetentionScreen({ session, teams, allPlayers, retentions = [], pool = [] }) {
  const retainPlayer = useRetainPlayer()
  const removeRetention = useRemoveRetention()
  const addToPool = useAddToPool()
  const removeFromPool = useRemoveFromPool()
  const buildPool = useBuildAuctionPool()
  const [picks, setPicks] = useState({}) // teamId -> { playerId, price }
  const [search, setSearch] = useState("")

  const retainedIds = new Set(retentions.map(r => r.playerId))
  const pooledIds = new Set(pool.map(p => p.playerId))
  const eligibleForPool = allPlayers.filter(p =>
    !p.isCaptain && !retainedIds.has(p.id) && !pooledIds.has(p.id) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="card p-4">
        <h2 className="text-base font-bold text-white mb-1">Auction Setup</h2>
        <p className="text-sm text-slate-500">Retain up to 2 players per team, then add whoever's actually going up for auction.</p>
      </div>

      {teams.map(team => {
        const teamRetentions = retentions.filter(r => r.teamId === team.id)
        const pick = picks[team.id] || {}
        return (
          <div key={team.id} className="card p-4">
            <p className="font-semibold text-white mb-2">{team.name} <span className="text-xs text-slate-500">({teamRetentions.length}/2 retained)</span></p>
            <div className="flex flex-wrap gap-2 mb-2">
              {teamRetentions.map(r => (
                <span key={r.id} className="flex items-center gap-2 text-xs bg-pitch-800 border border-surface-border rounded-lg px-2.5 py-1">
                  {r.playerName} — ₹{r.price}
                  <button onClick={() => removeRetention.mutate(r.id)} className="text-rose-400">✕</button>
                </span>
              ))}
            </div>
            {teamRetentions.length < 2 && (
              <div className="flex gap-2">
                <select value={pick.playerId || ""} onChange={e => setPicks(p => ({ ...p, [team.id]: { ...pick, playerId: e.target.value } }))}
                  className="flex-1 bg-pitch-800 border border-surface-border rounded-lg px-2 py-1.5 text-sm text-white">
                  <option value="">Select player…</option>
                  {allPlayers.filter(p => !p.isCaptain && !retainedIds.has(p.id) && !pooledIds.has(p.id)).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <input type="number" placeholder="Price" value={pick.price || ""}
                  onChange={e => setPicks(p => ({ ...p, [team.id]: { ...pick, price: e.target.value } }))}
                  className="w-24 bg-pitch-800 border border-surface-border rounded-lg px-2 py-1.5 text-sm text-white" />
                <button
                  onClick={() => {
                    if (!pick.playerId || !pick.price) return
                    retainPlayer.mutate({ sessionId: session.id, teamId: team.id, playerId: Number(pick.playerId), price: Number(pick.price) })
                    setPicks(p => ({ ...p, [team.id]: {} }))
                  }}
                  className="px-3 py-1.5 rounded-lg bg-accent/20 text-accent border border-accent/30 text-sm font-semibold">
                  Retain
                </button>
              </div>
            )}
          </div>
        )
      })}

      {/* Add players to the auction pool */}
      <div className="card p-4">
        <p className="text-sm font-semibold text-white mb-1">Add players to the auction</p>
        <p className="text-xs text-slate-500 mb-3">Card tier is set automatically from grade — S → Purple, A → Gold, B/C → Silver.</p>
        <input type="text" placeholder="Search players…" value={search} onChange={e => setSearch(e.target.value)}
          className="w-full bg-pitch-800 border border-surface-border rounded-lg px-3 py-2 text-sm text-white mb-3" />
        <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto">
          {eligibleForPool.map(p => (
            <button key={p.id} onClick={() => addToPool.mutate({ sessionId: session.id, playerId: p.id })}
              className={cn("flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors",
                CARD_COLORS[GRADE_TO_CARD[p.grade] || "silver"], "border-current/30 hover:bg-white/5"
              )}>
              + {p.name} <span className="opacity-60">({p.grade || "—"})</span>
            </button>
          ))}
          {eligibleForPool.length === 0 && <p className="text-xs text-slate-600">No more eligible players{search && " matching that search"}.</p>}
        </div>
      </div>

      {/* Current pool */}
      <div className="card p-4">
        <p className="text-sm font-semibold text-white mb-3">In the pool ({pool.length})</p>
        <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto">
          {pool.map(p => (
            <span key={p.id} className={cn("flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border", CARD_COLORS[p.cardType], "border-current/30")}>
              {p.name}
              <button onClick={() => removeFromPool.mutate(p.id)} className="text-rose-400">✕</button>
            </span>
          ))}
          {pool.length === 0 && <p className="text-xs text-slate-600">Nobody added yet.</p>}
        </div>
      </div>

      <button
        onClick={() => buildPool.mutate(session.id)}
        disabled={buildPool.isPending || pool.length === 0}
        className="w-full py-3 rounded-xl bg-accent text-white font-bold disabled:opacity-50">
        {buildPool.isPending ? "Starting…" : `Start Auction with ${pool.length} Player${pool.length === 1 ? "" : "s"}`}
      </button>
      {buildPool.error && <p className="text-xs text-rose-400 text-center">{buildPool.error.response?.data?.error}</p>}
    </div>
  )
}

// ── RTM modal (3-step, purely local state) ───────────────────────────────
function RtmModal({ player, currentBidderName, currentBid, prevTeamName, onResolve, onClose }) {
  const [step, setStep] = useState(1)
  const [finalBid, setFinalBid] = useState(currentBid)

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
      <div className="card p-6 max-w-sm w-full mx-4">
        {step === 1 && (
          <>
            <h3 className="font-bold text-white mb-2">🃏 RTM Opportunity</h3>
            <p className="text-sm text-slate-400 mb-4">
              <strong>{prevTeamName}</strong>, your former player <strong>{player}</strong> is about to be sold to <strong>{currentBidderName}</strong> for ₹{currentBid}. Use your Right to Match?
            </p>
            <div className="flex gap-2">
              <button onClick={() => onResolve({ rtmUsed: false })} className="flex-1 py-2 rounded-lg border border-surface-border text-slate-400">No, let them go</button>
              <button onClick={() => setStep(2)} className="flex-1 py-2 rounded-lg bg-accent text-white font-semibold">Yes, use RTM</button>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <h3 className="font-bold text-white mb-2">⚡ RTM Triggered</h3>
            <p className="text-sm text-slate-400 mb-3"><strong>{currentBidderName}</strong>, one final chance to raise your bid (current: ₹{currentBid}).</p>
            <input type="number" value={finalBid} onChange={e => setFinalBid(Number(e.target.value))}
              className="w-full bg-pitch-800 border border-surface-border rounded-lg px-3 py-2 text-white mb-4" />
            <button onClick={() => setStep(3)} className="w-full py-2 rounded-lg bg-accent text-white font-semibold">Submit Final Bid</button>
          </>
        )}
        {step === 3 && (
          <>
            <h3 className="font-bold text-white mb-2">🎯 Final Match Decision</h3>
            <p className="text-sm text-slate-400 mb-4">
              Final price is ₹{finalBid}. <strong>{prevTeamName}</strong>, match it and claim {player}, or let {currentBidderName} keep them?
            </p>
            <div className="flex gap-2">
              <button onClick={() => onResolve({ rtmUsed: true, prevTeamWins: false, finalBid })} className="flex-1 py-2 rounded-lg border border-surface-border text-slate-400">Leave player</button>
              <button onClick={() => onResolve({ rtmUsed: true, prevTeamWins: true, finalBid })} className="flex-1 py-2 rounded-lg bg-emerald-500 text-white font-semibold">Match & Buy</button>
            </div>
          </>
        )}
        <button onClick={onClose} className="mt-3 text-xs text-slate-500 w-full text-center">Cancel</button>
      </div>
    </div>
  )
}

// ── Screen 2: live auction ────────────────────────────────────────────────
function LiveAuctionScreen({ session, pool = [], sales = [], teams = [], retentions = [] }) {
  const qc = useQueryClient()

  // Bid queue — decouples "how it feels" from "how it's processed". Every
  // click updates the screen INSTANTLY (a plain synchronous cache write,
  // zero network wait), so clicking never feels blocked or laggy. The
  // actual network requests are queued and sent to the server strictly
  // one at a time in the background — this is what guarantees correct
  // ordering and stops rapid clicks from racing each other and getting
  // rejected, without needing to disable the buttons at all.
  const bidQueueRef = useRef([])
  const isProcessingBidQueueRef = useRef(false)

  const processBidQueue = async () => {
    if (isProcessingBidQueueRef.current) return
    isProcessingBidQueueRef.current = true
    while (bidQueueRef.current.length > 0) {
      const next = bidQueueRef.current.shift()
      try {
        await placeBid.mutateAsync(next)
      } catch {
        // A queued bid can legitimately get rejected (e.g. a later queued
        // bid already raised the price past it) — that's expected and
        // fine, just move on to the next queued item. The real broadcast
        // will correct the display regardless.
      }
    }
    isProcessingBidQueueRef.current = false
  }

  const enqueueBid = (teamId, amount) => {
    const bidderTeam = teams.find(t => t.id === teamId)
    qc.setQueryData(["auction-current"], (prev) => {
      if (!prev?.session) return prev
      return {
        ...prev,
        session: {
          ...prev.session,
          currentBid: amount,
          currentBidderTeamId: teamId,
          currentBidderTeamName: bidderTeam?.name ?? prev.session.currentBidderTeamName,
        },
      }
    })
    bidQueueRef.current.push({ sessionId: session.id, teamId, amount })
    processBidQueue()
  }

  const nextPlayer = useNextAuctionPlayer()
  const placeBid = usePlaceBid()
  const sellPlayer = useSellPlayer()
  const markUnsold = useMarkUnsold()
  const setBidder = useSetBidder()
  const reduceBid = useReduceBid()
  const extraTime = useExtraTime()
  const undoLastSale = useUndoLastSale()
  const [showBidderPicker, setShowBidderPicker] = useState(false)
  const advanceRound = useAdvanceAuctionRound()
  const completeAuction = useCompleteAuction()
  const [customBids, setCustomBids] = useState({}) // teamId -> string amount
  const [showRtm, setShowRtm] = useState(false)

  const { timeLeft, timerActive, shake, goingText } = useAuctionTimer(session)
  const bidBumping = useBumpOnChange(session.currentBid)

  const teamNameById = Object.fromEntries(teams.map(t => [t.id, t.name]))
  const pending = pool.filter(p => p.status === "pending")
  const currentPoolEntry = pool.find(p => p.playerId === session.currentPlayerId)
  const round1Remaining = pool.filter(p => p.roundSeen === 1 && p.status === "pending").length
  const round1Unsold = pool.filter(p => p.status === "unsold_r1").length

  const handleSellClick = () => {
    // Unified "End Bidding" — matches the original app's endAuction():
    // no bidder yet means nobody wants this player, so mark unsold
    // instead of trying to sell to no one.
    if (!session.currentBidderTeamId) {
      markUnsold.mutate(session.id)
      return
    }
    if (currentPoolEntry?.prevTeamId && currentPoolEntry.prevTeamId !== session.currentBidderTeamId) {
      setShowRtm(true)
    } else {
      doSell({})
    }
  }

  const doSell = (opts) => {
    sellPlayer.mutate({ sessionId: session.id, ...opts })
    setShowRtm(false)
    setCustomBids({})
  }

  const leftTeams = teams.slice(0, Math.ceil(teams.length / 2))
  const rightTeams = teams.slice(Math.ceil(teams.length / 2))

  return (
    <div className="auction-layout max-w-[100rem] mx-auto">
      <TeamPanel title="👤 Teams" teamList={leftTeams} sales={sales} retentions={retentions} budgetPerTeam={session.budgetPerTeam} />

      <div className={cn("space-y-4", shake && "auction-shake")}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">Round {session.round} · {pending.length} pending · {round1Unsold} unsold from R1</p>
        <div className="flex gap-2">
          {session.round === 1 && round1Remaining === 0 && round1Unsold > 0 && (
            <button onClick={() => advanceRound.mutate(session.id)} className="text-xs px-3 py-1.5 rounded-lg bg-accent/20 text-accent border border-accent/30">Advance to Round 2</button>
          )}
          {pending.length === 0 && round1Unsold === 0 && (
            <button onClick={() => completeAuction.mutate(session.id)} className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-400/30">Complete Auction</button>
          )}
        </div>
      </div>

      {/* Current player card */}
      <div className={cn("card p-6", session.currentPlayerId && "auction-stage")}>
        {session.currentPlayerId ? (
          <>
            <div className="auction-focus">
              🔥 <strong>Bidding for:</strong> <span className="player-name auction-stage-name">{session.currentPlayerName}</span>
            </div>
            {session.currentPlayerPrevTeamId && (
              <p className="text-xs text-slate-500 text-center mb-3">Previously: {teamNameById[session.currentPlayerPrevTeamId]}</p>
            )}

            <div className="auction-stats">
              <div>💰 <strong>Current Bid:</strong> <span className={cn("auction-stage-bid", bidBumping && "bump")}>₹{session.currentBid}</span></div>
              <div>👑 <strong>Leading:</strong> {session.currentBidderTeamName || "None"}</div>
            </div>

            {timerActive && (
              <div className={cn("auction-timer", timeLeft <= 5 && "red")}>⏱ {timeLeft}s</div>
            )}
            {goingText && <p className="text-center text-sm text-amber-400 font-semibold mb-3">{goingText}</p>}

            <div className="mt-2 mb-4">
              {teams.map(t => {
                const minBid = session.currentBid + 5
                const canQuickBid = t.budget >= minBid
                const isLeading = session.currentBidderTeamId === t.id
                return (
                  <div key={t.id} className={cn("bid-row", isLeading && "bid-row-war")}>
                    <div className="bid-row-header">
                      <span className="bid-captain-name">{t.name}</span>
                    </div>
                    <div className="bid-row-controls">
                      <button className="bid-plus" disabled={!canQuickBid}
                        onClick={() => {
                          // Read the TRUE latest price from the live cache
                          // right now, not the value this row was rendered
                          // with — closing over a render-time value meant
                          // two rapid clicks (even on the same button)
                          // could both compute the same stale "+₹5" amount.
                          const live = qc.getQueryData(["auction-current"])
                          const freshMinBid = (live?.session?.currentBid ?? session.currentBid) + 5
                          enqueueBid(t.id, freshMinBid)
                        }}>
                        (₹{t.budget}) ➕ ₹5
                      </button>
                      <input type="number" className="bid-input" placeholder={`Min ₹${minBid}`}
                        value={customBids[t.id] || ""}
                        onChange={e => setCustomBids(c => ({ ...c, [t.id]: e.target.value }))} />
                      <button className="bid-set"
                        onClick={() => {
                          const amt = Number(customBids[t.id])
                          if (amt) enqueueBid(t.id, amt)
                        }}>
                        Set Bid
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
            {placeBid.error && <p className="text-xs text-rose-400 text-center mb-2">{placeBid.error.response?.data?.error}</p>}

            <div className="flex flex-wrap gap-2 justify-center">
              <button onClick={handleSellClick} disabled={!session.currentPlayerId}
                className="px-5 py-2.5 rounded-full bg-rose-500 text-white font-bold text-sm disabled:opacity-40">
                ⛔ End Bidding
              </button>
              <button onClick={() => extraTime.mutate(session.id)}
                className="px-4 py-2 rounded-full border border-surface-border text-slate-300 text-sm">
                ⏳ Extra Time (+30s)
              </button>
              <button onClick={() => setShowBidderPicker(true)}
                className="px-4 py-2 rounded-full border border-surface-border text-slate-300 text-sm">
                ↔ Change Current Bidder
              </button>
              <button onClick={() => markUnsold.mutate(session.id)}
                className="px-4 py-2 rounded-full border border-surface-border text-slate-300 text-sm">
                ⏭ Skip Player
              </button>
              <button onClick={() => reduceBid.mutate(session.id)}
                className="px-4 py-2 rounded-full border border-surface-border text-slate-300 text-sm">
                ➖ Reduce Bid ₹5
              </button>
              <button onClick={() => undoLastSale.mutate(session.id)}
                className="px-4 py-2 rounded-full border border-surface-border text-slate-300 text-sm">
                ↺ Undo Last Sale
              </button>
            </div>

            {showBidderPicker && (
              <div className="mt-3 flex items-center justify-center gap-2">
                <select
                  onChange={e => {
                    if (e.target.value) setBidder.mutate({ sessionId: session.id, teamId: Number(e.target.value) })
                    setShowBidderPicker(false)
                  }}
                  className="bg-pitch-800 border border-surface-border rounded-lg px-3 py-1.5 text-sm text-white">
                  <option value="">Select the correct leading team…</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <button onClick={() => setShowBidderPicker(false)} className="text-xs text-slate-500">Cancel</button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center">
            <Sparkles className="w-6 h-6 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500 mb-4">{pending.length} players left in the pool</p>
            <button
              onClick={() => nextPlayer.mutate({ sessionId: session.id })}
              disabled={nextPlayer.isPending || pending.length === 0}
              className="px-6 py-3 rounded-xl bg-accent text-white font-bold text-base disabled:opacity-40">
              {nextPlayer.isPending ? "Drawing…" : "🎲 Start Auction"}
            </button>
            {nextPlayer.error && (
              <p className="text-xs text-rose-400 mt-3">
                {nextPlayer.error.response?.data?.error || nextPlayer.error.message || "Something went wrong."}
              </p>
            )}
          </div>
        )}
      </div>

      {showRtm && currentPoolEntry && (
        <RtmModal
          player={session.currentPlayerName}
          currentBidderName={session.currentBidderTeamName}
          currentBid={session.currentBid}
          prevTeamName={teamNameById[currentPoolEntry.prevTeamId]}
          onClose={() => setShowRtm(false)}
          onResolve={(decision) => {
            if (!decision.rtmUsed) { doSell({}); return }
            if (decision.prevTeamWins) {
              doSell({ overrideTeamId: currentPoolEntry.prevTeamId, overridePrice: decision.finalBid, rtmUsed: true })
            } else {
              doSell({ overrideTeamId: session.currentBidderTeamId, overridePrice: decision.finalBid, rtmUsed: true })
            }
          }}
        />
      )}

      {/* Recent sales */}
      <div className="card p-4">
        <p className="text-sm font-semibold text-white mb-2">Recent sales</p>
        <div className="space-y-1 max-h-56 overflow-y-auto">
          {sales.slice(0, 15).map(s => (
            <div key={s.id} className="flex items-center justify-between text-sm">
              <span className="text-slate-300">{s.playerName} → {s.teamName}</span>
              <span className="text-gold font-mono">₹{s.price}{s.rtmUsed && <span className="text-xs text-purple-400 ml-1">RTM</span>}</span>
            </div>
          ))}
        </div>
      </div>

      <PoolPanel pool={pool} clickable />
      </div>

      <TeamPanel title="👤 Teams" teamList={rightTeams} sales={sales} retentions={retentions} budgetPerTeam={session.budgetPerTeam} />
    </div>
  )
}

// ── Screen 3: completed ────────────────────────────────────────────────
function CompletedScreen({ sales = [] }) {
  const biggest = findMostExpensiveSale(sales)
  return (
    <div className="max-w-md mx-auto mt-20 card p-6 text-center">
      <Trophy className="w-8 h-8 text-gold mx-auto mb-3" />
      <h2 className="text-lg font-bold text-white mb-2">Auction Complete</h2>
      <p className="text-sm text-slate-400">{sales.length} players sold</p>
      {biggest && <p className="text-sm text-gold mt-2">Biggest sale: {biggest.playerName} → {biggest.teamName} for ₹{biggest.price}</p>}
    </div>
  )
}

// ── Overview / landing screen — shown first, matching the UCL Knockout
// pattern: current status + an explicit "Enter Auction" button, rather
// than dropping straight into the live screens on every visit.
function AuctionOverview({ session, pool = [], onEnter, enterError, entering }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const deleteSession = useDeleteAuctionSession()
  const isPreparing = session.status === "retention"
  const pending = pool.filter(p => p.status === "pending").length

  return (
    <div className="max-w-md mx-auto mt-20 card p-6 text-center">
      <Gavel className="w-8 h-8 text-accent mx-auto mb-3" />
      <h2 className="text-lg font-bold text-white mb-1">Season {session.seasonNumber} Auction</h2>
      {isPreparing ? (
        <p className="text-sm text-slate-400 mb-5">Preparing — {pool.length} players in the pool, not yet started</p>
      ) : (
        <p className="text-sm text-slate-400 mb-5">Live — Round {session.round}, {pending} players pending</p>
      )}

      <button onClick={onEnter} disabled={entering} className="w-full py-2.5 rounded-xl bg-accent text-white font-semibold mb-2 disabled:opacity-50">
        {entering ? "Entering…" : "▶ Enter Auction"}
      </button>
      {enterError && (
        <p className="text-xs text-rose-400 mb-2">
          {enterError.response?.data?.error || enterError.message || "Failed to enter — this didn't actually register on the server."}
        </p>
      )}

      {confirmDelete ? (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-rose-400">
            {isPreparing
              ? "Delete this prepared auction? Nothing real has happened yet, so this is safe."
              : "⚠️ This is a LIVE auction. Deleting it will refund every team's spent budget and un-assign every player already sold, then wipe it completely. This cannot be undone."}
          </p>
          <div className="flex items-center justify-center gap-2">
            <button onClick={() => setConfirmDelete(false)} className="text-xs px-3 py-1.5 rounded border border-surface-border text-slate-400">Cancel</button>
            <button onClick={() => deleteSession.mutate(session.id)} disabled={deleteSession.isPending}
              className="text-xs px-3 py-1.5 rounded bg-rose-500 text-white font-semibold">
              {deleteSession.isPending ? "Deleting…" : isPreparing ? "Yes, Delete" : "Yes, Reverse & Delete Everything"}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setConfirmDelete(true)} className="text-xs text-slate-500 hover:text-rose-400 mt-1">
          Delete & Start Over
        </button>
      )}
    </div>
  )
}

export default function AuctionAdmin() {
  const navigate = useNavigate()
  const { data } = useAuctionCurrent()
  const { data: teams = [] } = useTeams()
  const { data: allPlayers = [] } = usePlayers()
  const [entered, setEntered] = useState(false)
  const enterAuction = useEnterAuction()
  const leaveAuction = useLeaveAuction()
  useAuctionReveal(entered ? data : null, { showMilestoneBanners: false })
  useAuctionSocket()

  const hasInProgressSession = data?.session && data.session.status !== "completed"

  return (
    <div className="auction-page min-h-screen bg-pitch-900 p-4 md:p-6">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => {
            if (data?.session?.id) leaveAuction.mutate(data.session.id)
            navigate("/admin")
          }}
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm">
          <ArrowLeft className="w-4 h-4" /> Admin
        </button>
        <Gavel className="w-5 h-5 text-accent" />
        <h1 className="text-lg font-extrabold text-white">Player Auction</h1>
      </div>

      {!hasInProgressSession && <StartScreen />}
      {hasInProgressSession && !entered && (
        <AuctionOverview
          session={data.session}
          pool={data.pool}
          onEnter={() => enterAuction.mutate(data.session.id, { onSuccess: () => setEntered(true) })}
          enterError={enterAuction.error}
          entering={enterAuction.isPending}
        />
      )}
      {hasInProgressSession && entered && data.session.status === "retention" && (
        <RetentionScreen session={data.session} teams={teams} allPlayers={allPlayers} retentions={data.retentions || []} pool={data.pool || []} />
      )}
      {hasInProgressSession && entered && data.session.status === "active" && (
        <LiveAuctionScreen session={data.session} pool={data.pool || []} sales={data.sales || []} teams={data.teams || []} retentions={data.retentions || []} />
      )}
    </div>
  )
}