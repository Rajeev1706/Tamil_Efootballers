import { useMemo, useState } from "react"
import { cn } from "../../../lib/utils"
import { Zap, Target, CheckCircle, Clock, XCircle, AlertTriangle, RefreshCw, TrendingUp, ChevronDown, ChevronUp, Users } from "lucide-react"
import GradeBadge from "../../common/GradeBadge"
import { TeamLogoIcon } from "../../common/TeamLogo"
import PlayerAvatarIcon from "../../common/PlayerAvatarIcon"
import { useAuctionCurrent } from "../../../lib/queries"

const PRIORITY_CONFIG = {
  must_have: { label:"Must Have", color:"text-rose-400" },
  want:      { label:"Want",      color:"text-accent"   },
  backup:    { label:"Backup",    color:"text-slate-400" },
}
const GRADE_NUM = { S:4, A:3, B:2, C:1 }
const MV_AVG    = { S:185, A:110, B:65, C:40 }

function formWinRate(form) {
  if (!form||!form.length) return 0
  return form.filter(f=>f==="W").length/form.length
}

export default function AuctionDay({ targets, myTeamId, totalBudget, myPlayers, allPlayers }) {
  const [expandedTeam, setExpandedTeam] = useState(null)
  const { data: auctionData } = useAuctionCurrent()

  const session    = auctionData?.session
  const sales      = auctionData?.sales      || []
  const currentBid = auctionData?.currentBid || null
  const recentBids = auctionData?.recentBids || []

  // Enrich targets with auction status
  const enriched = useMemo(() => {
    return targets.map(t => {
      const sale = sales.find(s=>s.playerId===t.playerId)
      const isLive = currentBid?.player?.id === t.playerId
      let status="waiting", statusLabel="Waiting"
      if (sale) {
        status = sale.teamId===myTeamId ? "won" : "lost"
        statusLabel = sale.teamId===myTeamId ? `Won for ${sale.price} pts` : `Sold to ${sale.teamName||"rival"} for ${sale.price} pts`
      } else if (isLive) {
        status="live"; statusLabel=`Live — current bid ${currentBid.amount} pts`
      }
      return { ...t, status, statusLabel, sale, isLive }
    })
  }, [targets, sales, currentBid, myTeamId])

  // Budget spent so far
  const spentSoFar = useMemo(() => {
    return sales.filter(s=>s.teamId===myTeamId).reduce((a,s)=>a+(s.price||0),0)
  }, [sales, myTeamId])

  const remaining = totalBudget - spentSoFar

  // ── Feature 23: Price Momentum Alert ─────────────────────────────────────
  const momentum = useMemo(() => {
    if (!recentBids || recentBids.length < 3) return null
    const last = recentBids.slice(-4)
    const gaps = []
    for (let i=1;i<last.length;i++) gaps.push(last[i].amount - last[i-1].amount)
    if (!gaps.length) return null
    const avgGap = gaps.reduce((a,b)=>a+b,0)/gaps.length
    const isAccelerating = gaps.length>=2 && gaps[gaps.length-1] > gaps[0]*1.3
    const uniqueBidders = new Set(last.map(b=>b.teamId)).size
    const isBiddingWar = uniqueBidders >= 2
    const currentAmount = last[last.length-1]?.amount || 0
    const playerMV = currentBid?.player?.marketValue || 0
    const overMV = playerMV > 0 && currentAmount > playerMV
    return { avgGap:+avgGap.toFixed(0), isAccelerating, isBiddingWar, currentAmount, overMV, uniqueBidders }
  }, [recentBids, currentBid])

  // ── Feature 22: Mid-Auction Squad Rebalancer ─────────────────────────────
  const rebalance = useMemo(() => {
    if (!session || session.status!=="active") return null
    const wonPlayers   = sales.filter(s=>s.teamId===myTeamId).map(s=>({ grade:s.grade||"B" }))
    const updatedSquad = [...myPlayers, ...wonPlayers]
    const gradeCounts  = ["S","A","B","C"].reduce((acc,g)=>{ acc[g]=updatedSquad.filter(p=>p.grade===g).length; return acc }, {})

    // Remaining must-haves
    const wonIds = new Set(sales.filter(s=>s.teamId===myTeamId).map(s=>s.playerId))
    const lostIds = new Set(sales.filter(s=>s.teamId!==myTeamId).map(s=>s.playerId))
    const remainingMustHaves = targets.filter(t=>t.priority==="must_have"&&!wonIds.has(t.playerId)&&!lostIds.has(t.playerId))
    const missedMustHaves    = targets.filter(t=>t.priority==="must_have"&&lostIds.has(t.playerId))

    // Recommendations
    const recs = []
    if (missedMustHaves.length > 0) {
      missedMustHaves.forEach(m => {
        recs.push(`Missed ${m.name} (${m.grade}). Promote your best Want target of same grade to Must Have.`)
      })
    }
    if (remaining < 50 && remainingMustHaves.length > 0) {
      recs.push(`Budget running low (${remaining}pts left). ${remainingMustHaves.length} must-have target${remainingMustHaves.length>1?"s":""} still remaining — be selective.`)
    }
    if (gradeCounts.S === 0 && wonPlayers.length > 0) {
      recs.push("Still no S-grade player. Prioritise any remaining S-grade in the pool immediately.")
    }

    return { gradeCounts, recs, missedMustHaves, remainingMustHaves, wonCount: wonPlayers.length }
  }, [session, sales, myTeamId, myPlayers, targets, remaining])

  // ── Feature 24: Post-Auction Debrief ─────────────────────────────────────
  const debrief = useMemo(() => {
    if (!session || session.status!=="completed") return null
    const won     = enriched.filter(t=>t.status==="won")
    const lost    = enriched.filter(t=>t.status==="lost")
    const waiting = enriched.filter(t=>t.status==="waiting")

    const myBuys  = sales.filter(s=>s.teamId===myTeamId)
    const totalSpent = myBuys.reduce((a,s)=>a+(s.price||0),0)

    const wonPlayers  = myBuys.map(s=>({ grade: s.grade||"B" }))
    const postSquad   = [...myPlayers, ...wonPlayers]
    const preAvgGrade  = myPlayers.length ? myPlayers.reduce((a,p)=>a+(GRADE_NUM[p.grade]||1),0)/myPlayers.length : 0
    const postAvgGrade = postSquad.length ? postSquad.reduce((a,p)=>a+(GRADE_NUM[p.grade]||1),0)/postSquad.length : 0

    return { won, lost, waiting, totalSpent, remaining: totalBudget-totalSpent, preAvgGrade:+preAvgGrade.toFixed(2), postAvgGrade:+postAvgGrade.toFixed(2), myBuys }
  }, [session, enriched, sales, myTeamId, myPlayers, totalBudget])

  // ── Confidence Score ──────────────────────────────────────────────────────
  const confidence = useMemo(() => {
    let score = 30
    const mustHaves = targets.filter(t=>t.priority==="must_have")
    if (mustHaves.length>0) score+=15
    if (mustHaves.reduce((a,t)=>a+(t.maxBid||0),0) <= totalBudget*0.6) score+=15
    if (targets.every(t=>!t.maxBid||t.maxBid<=(t.marketValue||999))) score+=10
    if (targets.length>=5) score+=10
    if (targets.some(t=>t.notes)) score+=10
    if ([...new Set(targets.map(t=>t.grade))].length>=2) score+=10
    return Math.min(score, 100)
  }, [targets, totalBudget])

  const confCls = confidence>=70?"text-emerald-400":confidence>=50?"text-amber-400":"text-rose-400"
  const confLabel = confidence>=70?"Strong":confidence>=50?"Decent":"Needs Work"

  return (
    <div className="space-y-4">

      {/* Feature 24: Post-Auction Debrief */}
      {debrief && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-border">
            <CheckCircle className="w-4 h-4 text-emerald-400"/>
            <h3 className="text-sm sm:text-sm font-bold text-white">Post-Auction Debrief</h3>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                {label:"Won",   val:debrief.won.length,   cls:"text-emerald-400"},
                {label:"Missed",val:debrief.lost.length,  cls:"text-rose-400"},
                {label:"Spent", val:`${debrief.totalSpent}pts`, cls:"text-amber-400"},
                {label:"Left",  val:`${debrief.remaining}pts`,  cls:"text-sky-400"},
              ].map(s=>(
                <div key={s.label} className="bg-pitch-900 rounded-xl p-3 text-center border border-surface-border">
                  <p className={cn("text-xl font-black font-mono",s.cls)}>{s.val}</p>
                  <p className="text-[10px] sm:text-sm text-slate-500">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="bg-pitch-900/60 rounded-xl p-3 border border-surface-border">
              <p className="text-xs sm:text-sm font-semibold text-white mb-1">Squad Grade Impact</p>
              <div className="flex items-center gap-3">
                <span className="text-sm sm:text-sm font-bold text-slate-400 font-mono">{debrief.preAvgGrade}</span>
                <div className="flex-1 flex items-center gap-1">
                  <div className="h-0.5 flex-1 bg-surface-border"/>
                  <TrendingUp className={cn("w-3 h-3",debrief.postAvgGrade>debrief.preAvgGrade?"text-emerald-400":"text-slate-500")}/>
                  <div className="h-0.5 flex-1 bg-surface-border"/>
                </div>
                <span className={cn("text-sm sm:text-sm font-bold font-mono",debrief.postAvgGrade>debrief.preAvgGrade?"text-emerald-400":"text-slate-400")}>{debrief.postAvgGrade}</span>
              </div>
              <p className="text-[10px] sm:text-sm text-slate-500 text-center mt-1">
                avg grade score {debrief.postAvgGrade>debrief.preAvgGrade?"+"+( (debrief.postAvgGrade-debrief.preAvgGrade).toFixed(2))+" improvement":"no change"} post-auction
              </p>
            </div>
          </div>
        </div>
      )}


      {/* ── Live Team Cards ──────────────────────────────────────────── */}
      {session && auctionData?.teams?.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-border">
            <Users className="w-4 h-4 text-accent" />
            <h3 className="sm:text-sm text-xs font-bold text-white">Live Team Status</h3>
            {session.status === "active" && (
              <span className="text-[9px] sm:text-[11px] font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/25 px-2 py-0.5 rounded-full ml-1 animate-pulse">🔴 LIVE</span>
            )}
          </div>
          <div className="divide-y divide-surface-border/40">
            {auctionData.teams.map(team => {
              const budgetPerTeam  = auctionData.session?.budgetPerTeam || 0
              const teamSales      = (auctionData.sales || []).filter(s => s.teamId === team.id)
              const teamRetentions = (auctionData.retentions || []).filter(r => r.teamId === team.id)
              const allAcquired    = [
                ...teamSales.map(s => ({ ...s, source: "bought" })),
                ...teamRetentions.map(r => ({ ...r, playerName: r.playerName, price: r.price, source: "retained" })),
              ]
              const spent      = budgetPerTeam - (team.budget ?? budgetPerTeam)
              const remaining  = team.budget ?? 0
              const spentPct   = budgetPerTeam > 0 ? Math.min(100, Math.round(spent / budgetPerTeam * 100)) : 0
              const isMyTeam   = team.id === myTeamId
              const isExpanded = expandedTeam === team.id

              // Grade breakdown from allPlayers lookup
              const gradeCount = { S: 0, A: 0, B: 0, C: 0 }
              allAcquired.forEach(a => {
                const p = allPlayers?.find(pl => pl.id === a.playerId)
                if (p?.grade) gradeCount[p.grade] = (gradeCount[p.grade] || 0) + 1
              })
              const gradeStr = Object.entries(gradeCount).filter(([,n]) => n > 0).map(([g,n]) => `${n}${g}`).join(" · ")

              return (
                <div key={team.id} className={cn("", isMyTeam && "bg-accent/5")}>
                  {/* Team header row */}
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface-hover/20 transition-colors"
                    onClick={() => setExpandedTeam(isExpanded ? null : team.id)}
                  >
                    <TeamLogoIcon logoUrl={team.logoUrl} name={team.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn("sm:text-sm text-xs font-semibold truncate", isMyTeam ? "text-accent" : "text-white")}>{team.name}</span>
                        {isMyTeam && <span className="text-[9px] sm:text-[11px] font-bold text-accent bg-accent/10 border border-accent/20 px-1.5 py-0.5 rounded">You</span>}
                      </div>
                      {/* Budget bar */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-pitch-700 rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-all",
                              spentPct > 80 ? "bg-rose-400" : spentPct > 60 ? "bg-amber-400" : "bg-emerald-400"
                            )}
                            style={{ width: `${spentPct}%` }}
                          />
                        </div>
                        <span className="text-[10px] sm:text-xs text-slate-400 font-mono flex-shrink-0">{spent}/{budgetPerTeam}</span>
                      </div>
                      {/* Grade summary */}
                      <div className="flex items-center gap-2 mt-1">
                        {gradeStr
                          ? <span className="text-[10px] sm:text-xs text-slate-400">Bought: <span className="text-white font-medium">{gradeStr}</span></span>
                          : <span className="text-[10px] sm:text-xs text-slate-600">No purchases yet</span>
                        }
                        <span className="text-slate-600">·</span>
                        <span className="text-[10px] sm:text-xs text-slate-500">
                          Remaining: <span className={cn("font-bold font-mono", remaining < 100 ? "text-rose-400" : remaining < 250 ? "text-amber-400" : "text-emerald-400")}>{remaining}</span>
                        </span>
                      </div>
                    </div>
                    {isExpanded
                      ? <ChevronUp className="w-4 h-4 text-slate-500 flex-shrink-0"/>
                      : <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0"/>
                    }
                  </div>

                  {/* Expanded: player list */}
                  {isExpanded && (
                    <div className="px-4 pb-3 bg-pitch-900/60 border-t border-surface-border/40">
                      {allAcquired.length === 0 ? (
                        <p className="text-[10px] sm:text-xs text-slate-600 py-2">No players acquired yet</p>
                      ) : (
                        <div className="space-y-1 pt-2">
                          {allAcquired.map((a, i) => {
                            const p = allPlayers?.find(pl => pl.id === a.playerId)
                            return (
                              <div key={i} className="flex items-center gap-2">
                                <span className={cn("text-[9px] sm:text-[11px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0",
                                  a.source === "retained"
                                    ? "text-violet-400 bg-violet-400/10 border-violet-400/20"
                                    : "text-sky-400 bg-sky-400/10 border-sky-400/15"
                                )}>{a.source === "retained" ? "RTN" : "BID"}</span>
                                {p && <GradeBadge grade={p.grade} size="sm"/>}
                                <span className="sm:text-sm text-xs text-white flex-1 truncate">{a.playerName}</span>
                                <span className="text-[10px] sm:text-xs text-slate-400 font-mono flex-shrink-0">{a.price} pts</span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Confidence Score */}
      <div className="card p-4">
        <div className="flex items-center gap-3 mb-3">
          <Zap className="w-4 h-4 text-gold"/>
          <span className="text-sm sm:text-sm font-bold text-white">Auction Confidence Score</span>
        </div>
        <div className="flex items-end gap-4 mb-3">
          <div><span className={cn("text-5xl font-black font-mono",confCls)}>{confidence}</span><span className="text-lg text-slate-500 ml-1">/100</span></div>
          <span className={cn("text-sm sm:text-sm font-bold px-3 py-1 rounded-full border mb-1",confidence>=70?"text-emerald-400 bg-emerald-400/10 border-emerald-400/25":confidence>=50?"text-amber-400 bg-amber-400/10 border-amber-400/25":"text-rose-400 bg-rose-400/10 border-rose-400/25")}>{confLabel}</span>
        </div>
        <div className="w-full h-2 bg-pitch-700 rounded-full overflow-hidden mb-3">
          <div className={cn("h-full rounded-full",confidence>=70?"bg-emerald-400":confidence>=50?"bg-amber-400":"bg-rose-400")} style={{width:`${confidence}%`}}/>
        </div>
        <div className="grid grid-cols-2 gap-1.5 text-[10px] sm:text-sm text-slate-500">
          <span className={targets.filter(t=>t.priority==="must_have").length>0?"text-emerald-400":""}>✓ {targets.filter(t=>t.priority==="must_have").length} must-have targets</span>
          <span className={targets.filter(t=>t.maxBid).length>0?"text-emerald-400":""}>✓ {targets.filter(t=>t.maxBid).length}/{targets.length} max bids set</span>
          <span className={targets.filter(t=>t.notes).length>0?"text-emerald-400":""}>✓ {targets.filter(t=>t.notes).length} with notes</span>
          <span className={[...new Set(targets.map(t=>t.grade))].length>=2?"text-emerald-400":""}>✓ {[...new Set(targets.map(t=>t.grade))].length} grade tiers</span>
        </div>
        {session?.status==="active"&&(
          <div className="mt-3 flex items-center justify-between bg-pitch-900/60 rounded-xl px-3 py-2 border border-surface-border">
            <span className="text-xs sm:text-sm text-slate-400">Budget remaining</span>
            <span className={cn("text-sm sm:text-sm font-bold font-mono",remaining<100?"text-rose-400":remaining<200?"text-amber-400":"text-emerald-400")}>{remaining} pts</span>
          </div>
        )}
      </div>

      {/* Feature 23: Price Momentum Alert */}
      {momentum && session?.status==="active" && currentBid && (
        <div className={cn("card p-4 border-l-4", momentum.isBiddingWar&&momentum.isAccelerating?"border-l-rose-400":momentum.overMV?"border-l-amber-400":"border-l-sky-400")}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className={cn("w-4 h-4",momentum.isBiddingWar&&momentum.isAccelerating?"text-rose-400":momentum.overMV?"text-amber-400":"text-sky-400")}/>
            <span className="text-sm sm:text-sm font-bold text-white">
              {momentum.isBiddingWar&&momentum.isAccelerating?"🔥 Bidding War Detected":momentum.overMV?"⚠ Above Market Value":"📊 Bid Tracking"}
            </span>
          </div>
          <div className="space-y-1.5 text-[11px] sm:text-sm text-slate-400">
            <p>Current bid: <span className="text-white font-bold font-mono">{momentum.currentAmount} pts</span> · {momentum.uniqueBidders} bidder{momentum.uniqueBidders>1?"s":""} active</p>
            <p>Avg bid gap: <span className="font-bold">{momentum.avgGap} pts</span> · {momentum.isAccelerating?"Bids are accelerating 📈":"Steady pace"}</p>
            {momentum.overMV&&<p className="text-amber-400">⚠ Bid is above market value ({currentBid?.player?.marketValue||"?"} pts) — overbid risk</p>}
            {momentum.isBiddingWar&&momentum.isAccelerating&&<p className="text-rose-300 font-semibold">Consider walking away — price likely heading 20-30% above MV</p>}
          </div>
        </div>
      )}

      {/* Feature 22: Mid-Auction Rebalancer */}
      {rebalance && (rebalance.recs.length > 0 || rebalance.wonCount > 0) && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-border">
            <RefreshCw className="w-4 h-4 text-violet-400"/>
            <h3 className="text-sm sm:text-sm font-bold text-white">Mid-Auction Rebalancer</h3>
            <span className="text-[10px] sm:text-sm text-slate-500 ml-1">— updated priorities</span>
          </div>
          <div className="p-4 space-y-3">
            {/* Current updated grade counts */}
            <div className="flex gap-3 flex-wrap">
              {["S","A","B","C"].map(g=>(
                <div key={g} className="flex items-center gap-1.5 bg-pitch-900/60 rounded-xl px-3 py-2 border border-surface-border">
                  <GradeBadge grade={g} size="sm"/>
                  <span className="text-sm sm:text-sm font-bold text-white">{rebalance.gradeCounts[g]}</span>
                </div>
              ))}
              <span className="text-[10px] sm:text-sm text-slate-500 self-center">updated squad</span>
            </div>
            {/* Recommendations */}
            {rebalance.recs.map((r,i)=>(
              <div key={i} className="flex items-start gap-2 bg-violet-400/5 border border-violet-400/20 rounded-xl px-3 py-2.5">
                <Zap className="w-3.5 h-3.5 text-violet-400 flex-shrink-0 mt-0.5"/>
                <p className="text-[11px] sm:text-sm text-violet-300 leading-relaxed">{r}</p>
              </div>
            ))}
            {rebalance.recs.length===0&&<p className="text-[11px] sm:text-sm text-emerald-300">✓ Auction on track — no priority changes needed</p>}
          </div>
        </div>
      )}

      {/* Bid Reminders */}
      {targets.filter(t=>t.maxBid).length>0&&(
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-border">
            <AlertTriangle className="w-4 h-4 text-amber-400"/>
            <h3 className="text-sm sm:text-sm font-bold text-white">Bid Reminders</h3>
          </div>
          <div className="divide-y divide-surface-border/50">
            {targets.filter(t=>t.maxBid).sort((a,b)=>b.maxBid-a.maxBid).map(t=>{
              const isOver = t.maxBid>(t.marketValue||999)
              const won = enriched.find(e=>e.playerId===t.playerId&&e.status==="won")
              const lost = enriched.find(e=>e.playerId===t.playerId&&e.status==="lost")
              return (
                <div key={t.id} className={cn("flex items-center gap-3 px-4 py-2.5",lost?"opacity-40":"")}>
                  <PlayerAvatarIcon player={t} size="w-7 h-7"/>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs sm:text-sm font-semibold text-white truncate">{t.name}</span>
                      <GradeBadge grade={t.grade} size="sm"/>
                      {won&&<span className="text-[9px] sm:text-sm sm:text-sm text-emerald-400 font-bold">✓ Won</span>}
                      {lost&&<span className="text-[9px] sm:text-sm sm:text-sm text-slate-500">Sold</span>}
                    </div>
                    <p className="text-[10px] sm:text-sm text-slate-500">{PRIORITY_CONFIG[t.priority]?.label} · MV:{t.marketValue}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={cn("text-sm sm:text-sm font-bold font-mono",isOver?"text-amber-400":"text-emerald-400")}>Stop at {t.maxBid}</p>
                    {isOver&&<p className="text-[9px] sm:text-sm sm:text-sm text-amber-400">⚠ Above MV</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Live Target Tracker */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-border">
          <Target className="w-4 h-4 text-accent"/>
          <h3 className="text-sm sm:text-sm font-bold text-white">Live Target Tracker</h3>
          {session?.status==="active"
            ?<span className="text-[9px] sm:text-sm sm:text-sm font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/25 px-2 py-0.5 rounded-full ml-1">🔴 LIVE</span>
            :<span className="text-[9px] sm:text-sm sm:text-sm text-slate-500 ml-1">— auction not active</span>
          }
        </div>
        {enriched.length===0
          ?<div className="p-8 text-center text-slate-500 text-sm">No targets set yet</div>
          :<div className="divide-y divide-surface-border/50">
            {enriched.filter(t=>t.status==="live").map(t=>(
              <div key={t.id} className="flex items-center gap-3 px-4 py-3 bg-accent/5">
                <PlayerAvatarIcon player={t} size="w-8 h-8"/>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm sm:text-sm font-bold text-white">{t.name}</span>
                    <GradeBadge grade={t.grade} size="sm"/>
                    <span className="text-[9px] sm:text-sm sm:text-sm font-bold text-accent bg-accent/15 border border-accent/30 px-1.5 py-0.5 rounded animate-pulse">🔴 BIDDING NOW</span>
                  </div>
                  <p className="text-[11px] sm:text-sm text-accent mt-0.5 font-semibold">{t.statusLabel}</p>
                  {t.maxBid&&<p className="text-[10px] sm:text-sm text-amber-400">Your limit: {t.maxBid} pts</p>}
                </div>
              </div>
            ))}
            {enriched.filter(t=>t.status==="won").map(t=>(
              <div key={t.id} className="flex items-center gap-3 px-4 py-2.5 bg-emerald-400/5">
                <PlayerAvatarIcon player={t} size="w-7 h-7"/>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5"><span className="text-xs sm:text-sm font-semibold text-white">{t.name}</span><GradeBadge grade={t.grade} size="sm"/></div>
                  <p className="text-[10px] sm:text-sm text-emerald-400 mt-0.5">✓ {t.statusLabel}</p>
                </div>
                <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0"/>
              </div>
            ))}
            {enriched.filter(t=>t.status==="lost").map(t=>(
              <div key={t.id} className="flex items-center gap-3 px-4 py-2.5 opacity-50">
                <PlayerAvatarIcon player={t} size="w-7 h-7"/>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5"><span className="text-xs sm:text-sm text-slate-400">{t.name}</span><GradeBadge grade={t.grade} size="sm"/></div>
                  <p className="text-[10px] sm:text-sm text-slate-500 mt-0.5">{t.statusLabel}</p>
                </div>
                <XCircle className="w-4 h-4 text-slate-600 flex-shrink-0"/>
              </div>
            ))}
            {enriched.filter(t=>t.status==="waiting").map(t=>(
              <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                <PlayerAvatarIcon player={t} size="w-7 h-7"/>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs sm:text-sm text-white">{t.name}</span>
                    <GradeBadge grade={t.grade} size="sm"/>
                    <span className={cn("text-[9px] sm:text-sm sm:text-sm font-bold",PRIORITY_CONFIG[t.priority]?.color)}>{PRIORITY_CONFIG[t.priority]?.label}</span>
                  </div>
                  {t.maxBid&&<p className="text-[10px] sm:text-sm text-slate-500 mt-0.5">Limit: {t.maxBid} pts{t.notes&&` · "${t.notes}"`}</p>}
                </div>
                <Clock className="w-3.5 h-3.5 text-slate-600 flex-shrink-0"/>
              </div>
            ))}
          </div>
        }
      </div>
    </div>
  )
}