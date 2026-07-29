import { useMemo } from "react"
import { Target, AlertTriangle, CheckCircle, Zap, Wallet, TrendingUp } from "lucide-react"
import { cn } from "../../../lib/utils"
import TargetBoard from "./TargetBoard"
import { useAuctionTargets, useAuctionCurrent, useTeams } from "../../../lib/queries"

const GRADE_NUM = { S: 4, A: 3, B: 2, C: 1 }
const MV_AVG    = { S: 185, A: 110, B: 65, C: 40 }

function formWinRate(form) {
  if (!form || !form.length) return 0
  return form.filter(f => f === "W").length / form.length
}

// ── Smart Alerts bar — always visible at top ──────────────────────────────────
function SmartAlerts({ targets, totalBudget, myPlayers, allPlayers, myTeamId }) {
  const { data: auctionData } = useAuctionCurrent()
  const { data: teams = [] }  = useTeams()

  const alerts = useMemo(() => {
    const list = []

    // ── Budget alerts ──────────────────────────────────────────────────────
    const mustTotal = targets.filter(t => t.priority === "must_have").reduce((a, t) => a + (t.maxBid || MV_AVG[t.grade] || 80), 0)
    const wantTotal = targets.filter(t => t.priority === "want").reduce((a, t) => a + (t.maxBid || MV_AVG[t.grade] || 80), 0)
    const totalPlanned = mustTotal + wantTotal

    if (totalBudget > 0 && totalPlanned > totalBudget) {
      list.push({ type: "critical", msg: `Planned bids exceed budget by ${totalPlanned - totalBudget} pts — reduce max bids or reprioritise.` })
    } else if (totalBudget > 0 && mustTotal > totalBudget * 0.7) {
      list.push({ type: "warning", msg: `Must-Haves alone use ${Math.round(mustTotal / totalBudget * 100)}% of budget — little left for bidding wars.` })
    }

    // ── Overbid alerts ─────────────────────────────────────────────────────
    const overbids = targets.filter(t => t.maxBid && t.marketValue && t.maxBid > t.marketValue)
    if (overbids.length > 0) {
      list.push({ type: "warning", msg: `${overbids.map(t => t.name).join(", ")} — max bid above market value. Expect competition.` })
    }

    // ── No must-haves set ──────────────────────────────────────────────────
    if (targets.length > 0 && !targets.some(t => t.priority === "must_have")) {
      list.push({ type: "info", msg: "No Must Have targets set — mark your top priorities so you don't overspend on lower-priority players." })
    }

    // ── Squad gap: no S player and no S target ─────────────────────────────
    const hasS = myPlayers.some(p => p.grade === "S")
    const targetingS = targets.some(t => t.grade === "S")
    if (!hasS && !targetingS) {
      list.push({ type: "warning", msg: "No S-grade player and none targeted — you'll be at a disadvantage vs top squads in key matchups." })
    }

    // ── Bidding war: multiple rivals need same grade ───────────────────────
    const rivalTeams = teams.filter(t => t.id !== myTeamId)
    const rivalSquads = rivalTeams.map(t => ({
      name: t.name,
      grades: allPlayers.filter(p => p.teamId === t.id).map(p => p.grade),
    }))
    const myTargetGrades = [...new Set(targets.map(t => t.grade))]
    for (const g of myTargetGrades) {
      const needingRivals = rivalSquads.filter(r => {
        const count = r.grades.filter(gr => gr === g).length
        return count === 0 || count <= 1
      })
      if (needingRivals.length >= 3) {
        list.push({ type: "warning", msg: `${needingRivals.length} rival teams also need ${g}-grade — expect bidding wars on your ${g} targets.` })
        break
      }
    }

    // ── Live auction alert ─────────────────────────────────────────────────
    if (auctionData?.session?.status === "active") {
      const currentBid = auctionData.currentBid
      const liveTarget = currentBid ? targets.find(t => t.playerId === currentBid.player?.id) : null
      if (liveTarget) {
        list.push({ type: "live", msg: `🔴 ${liveTarget.name} is being bid on right now — current: ${currentBid.amount} pts · Your limit: ${liveTarget.maxBid || "not set"}` })
      } else {
        list.push({ type: "live", msg: `🔴 Auction is LIVE — ${(auctionData.sales || []).length} players sold so far.` })
      }
    }

    // ── All good ──────────────────────────────────────────────────────────
    if (list.length === 0 && targets.length > 0) {
      list.push({ type: "success", msg: `${targets.length} targets set · Budget looks healthy · You're ready for the auction.` })
    }

    return list
  }, [targets, totalBudget, myPlayers, allPlayers, teams, myTeamId, auctionData])

  if (!alerts.length) return null

  return (
    <div className="space-y-2 mb-4">
      {alerts.map((a, i) => (
        <div key={i} className={cn(
          "flex items-start gap-2.5 rounded-xl px-4 py-3 border",
          a.type === "critical" ? "bg-rose-400/8 border-rose-400/25" :
          a.type === "warning"  ? "bg-amber-400/8 border-amber-400/25" :
          a.type === "live"     ? "bg-accent/8 border-accent/25 animate-pulse" :
          a.type === "success"  ? "bg-emerald-400/8 border-emerald-400/25" :
                                   "bg-sky-400/8 border-sky-400/25"
        )}>
          {a.type === "critical" && <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />}
          {a.type === "warning"  && <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />}
          {a.type === "live"     && <Zap           className="w-4 h-4 text-accent    flex-shrink-0 mt-0.5" />}
          {a.type === "success"  && <CheckCircle   className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />}
          {a.type === "info"     && <TrendingUp    className="w-4 h-4 text-sky-400   flex-shrink-0 mt-0.5" />}
          <p className={cn(
            "text-xs sm:text-sm leading-relaxed",
            a.type === "critical" ? "text-rose-300" :
            a.type === "warning"  ? "text-amber-300" :
            a.type === "live"     ? "text-accent" :
            a.type === "success"  ? "text-emerald-300" : "text-sky-300"
          )}>{a.msg}</p>
        </div>
      ))}
    </div>
  )
}

// ── Quick stats bar ───────────────────────────────────────────────────────────
function QuickStats({ targets, totalBudget }) {
  const mustTotal  = targets.filter(t => t.priority === "must_have").reduce((a, t) => a + (t.maxBid || 0), 0)
  const wantTotal  = targets.filter(t => t.priority === "want").reduce((a, t) => a + (t.maxBid || 0), 0)
  const backupTotal= targets.filter(t => t.priority === "backup").reduce((a, t) => a + (t.maxBid || 0), 0)
  const planned    = mustTotal + wantTotal + backupTotal
  const buffer     = Math.max(0, totalBudget - planned)
  const pct        = totalBudget > 0 ? Math.min(100, Math.round(planned / totalBudget * 100)) : 0
  const over       = planned > totalBudget

  if (!targets.length && !totalBudget) return null

  return (
    <div className="card p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-gold" />
          <span className="text-sm sm:text-base font-bold text-white">Auction Budget</span>
        </div>
        <span className={cn("text-sm sm:text-base font-bold font-mono", over ? "text-rose-400" : "text-slate-300")}>
          {planned} / {totalBudget} pts
        </span>
      </div>

      {/* Segmented bar */}
      <div className="w-full h-2.5 bg-pitch-700 rounded-full overflow-hidden flex mb-3">
        {totalBudget > 0 && (
          <>
            <div className="h-full bg-rose-400 transition-all" style={{ width: `${Math.min(100, mustTotal/totalBudget*100)}%` }} />
            <div className="h-full bg-accent transition-all"   style={{ width: `${Math.min(100, wantTotal/totalBudget*100)}%` }} />
            <div className="h-full bg-slate-500 transition-all" style={{ width: `${Math.min(100, backupTotal/totalBudget*100)}%` }} />
          </>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs sm:text-sm">
        {[
          { label: "Must Have", val: mustTotal,  color: "text-rose-400"   },
          { label: "Want",      val: wantTotal,  color: "text-accent"     },
          { label: "Backup",    val: backupTotal,color: "text-slate-400"  },
          { label: "Buffer",    val: buffer,     color: over ? "text-rose-400" : "text-emerald-400" },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className="text-slate-500">{s.label}:</span>
            <span className={cn("font-bold font-mono", s.color)}>{s.val}</span>
          </div>
        ))}
      </div>

      {/* Target summary pills */}
      {targets.length > 0 && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-surface-border/50 flex-wrap">
          <span className="text-xs sm:text-sm text-slate-500">{targets.length} targets:</span>
          {["must_have","want","backup"].map(p => {
            const n = targets.filter(t => t.priority === p).length
            if (!n) return null
            const cls = p==="must_have"?"text-rose-400 bg-rose-400/10 border-rose-400/20":p==="want"?"text-accent bg-accent/10 border-accent/20":"text-slate-400 bg-slate-400/10 border-slate-400/20"
            const lbl = p==="must_have"?"Must Have":p==="want"?"Want":"Backup"
            return <span key={p} className={cn("text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full border",cls)}>{n} {lbl}</span>
          })}
        </div>
      )}
    </div>
  )
}

// ── Main AuctionPlanner ───────────────────────────────────────────────────────
export default function AuctionPlanner({ myTeamId, myPlayers, allPlayers, totalBudget }) {
  const { data: targets = [] } = useAuctionTargets(myTeamId)

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gold/10 border border-gold/25 flex items-center justify-center">
          <Target className="w-4 h-4 text-gold" />
        </div>
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white">Auction Planner</h2>
          <p className="text-xs sm:text-sm text-slate-500">Build your target list and plan your bids before the auction</p>
        </div>
      </div>

      {/* Always-visible: Smart Alerts */}
      <SmartAlerts
        targets={targets}
        totalBudget={totalBudget}
        myPlayers={myPlayers}
        allPlayers={allPlayers}
        myTeamId={myTeamId}
      />

      {/* Always-visible: Budget quick stats */}
      <QuickStats targets={targets} totalBudget={totalBudget} />

      {/* Main planner board */}
      <TargetBoard
        myTeamId={myTeamId}
        myPlayers={myPlayers}
        allPlayers={allPlayers}
        totalBudget={totalBudget}
      />
    </div>
  )
}