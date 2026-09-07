/**
 * SmartAnalysis — minimal auction intelligence, one glance readable.
 * 6 lines max: Verdict · Value · Squad Need · Budget · Competition · Target
 */
import { useMemo } from "react"
import { Brain, CheckCircle, AlertTriangle, XCircle } from "lucide-react"
import { cn } from "../../lib/utils"
import { usePlayerTargetInterest } from "../../lib/queries"

function gradeRank(g) { return { S: 5, "A+": 4, A: 3, B: 2, C: 1 }[g] ?? 0 }
function winRate(form = []) {
  if (!form?.length) return null
  return Math.round(form.filter(f => f === "W").length / form.length * 100)
}

// ── Single row ────────────────────────────────────────────────────────────
function Row({ icon, label, value, type = "info" }) {
  const colors = { good: "text-emerald-400", warn: "text-amber-400", bad: "text-rose-400", info: "text-slate-300" }
  const Icon = icon === "good" ? CheckCircle : icon === "warn" ? AlertTriangle : icon === "bad" ? XCircle : null
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-surface-border/30 last:border-0">
      <span className="text-[10px] text-slate-600 w-20 flex-shrink-0 uppercase tracking-wide">{label}</span>
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        {Icon && <Icon className={cn("w-3 h-3 flex-shrink-0", colors[icon])} />}
        <span className={cn("text-xs font-medium truncate", colors[type])}>{value}</span>
      </div>
    </div>
  )
}

export default function SmartAnalysis({
  session, pool, sales, teams, retentions, recentBids,
  currentPlayer, myTeamId, targets, myPlayers, isAdmin,
}) {
  const currentPlayerId = session?.currentPlayerId
  const { data: interest } = usePlayerTargetInterest(currentPlayerId)

  const rows = useMemo(() => {
    if (!session?.currentPlayerId || !myTeamId) return []

    const myTeam       = teams.find(t => t.id === myTeamId)
    const myBudget     = myTeam?.budget ?? 0
    const currentBid   = session.currentBid ?? 25
    const playerGrade  = session.currentPlayerGrade
    const playerName   = session.currentPlayerName
    const playerMV     = session.currentPlayerMarketValue ?? currentPlayer?.marketValue ?? 0
    const pendingPool  = pool.filter(p => p.status === "pending")
    const pendingAfter = pendingPool.length - 1
    const myWins       = sales.filter(s => s.teamId === myTeamId)
    const myRetentions = retentions.filter(r => r.teamId === myTeamId)
    const myCount      = myWins.length + myRetentions.length
    const myTarget     = targets?.find(t => t.playerId === currentPlayerId)
    const maxBid       = myTarget?.maxBid
    const priority     = myTarget?.priority
    const myGradeCount = (myPlayers || []).filter(p => p.grade === playerGrade).length
    const wr           = winRate(currentPlayer?.form)
    const perPlayer    = pendingAfter > 0
      ? Math.floor((myBudget - currentBid) / pendingAfter)
      : myBudget - currentBid

    // ── 1. Verdict ────────────────────────────────────────────────────────
    const isOverpriced = playerMV > 0 && currentBid > playerMV
    const budgetTight  = perPlayer < 25 && pendingAfter > 0
    const exceedsMax   = maxBid != null && currentBid > maxBid
    const valuePct     = playerMV > 0 ? Math.round(((playerMV - currentBid) / playerMV) * 100) : 0
    const isGoodValue  = valuePct >= 20

    let verdict = "BID", verdictType = "good", verdictIcon = "good"
    if (myBudget < currentBid)      { verdict = "CAN'T AFFORD";  verdictType = "bad";  verdictIcon = "bad" }
    else if (exceedsMax)             { verdict = "OVER YOUR MAX"; verdictType = "warn"; verdictIcon = "warn" }
    else if (isOverpriced && budgetTight) { verdict = "PASS";    verdictType = "bad";  verdictIcon = "bad" }
    else if (budgetTight)            { verdict = "CAREFUL — BUDGET TIGHT"; verdictType = "warn"; verdictIcon = "warn" }
    else if (isOverpriced)           { verdict = "OVERPRICED";   verdictType = "warn"; verdictIcon = "warn" }
    else if (!myTarget && !isGoodValue) { verdict = "PASS — NOT TARGETED"; verdictType = "warn"; verdictIcon = "warn" }
    else if (priority === "must_have" && isGoodValue) { verdict = "BID — MUST HAVE TARGET"; verdictType = "good"; verdictIcon = "good" }
    else if (priority === "want" && isGoodValue)      { verdict = "BID — WANTED PLAYER";   verdictType = "good"; verdictIcon = "good" }

    const result = [{ label: "VERDICT", value: verdict, type: verdictType, icon: verdictIcon }]

    // ── 2. Value ──────────────────────────────────────────────────────────
    if (playerMV > 0) {
      const valStr = isOverpriced
        ? `₹${currentBid} · ₹${currentBid - playerMV} ABOVE MV`
        : `₹${currentBid} · ${valuePct}% below MV ₹${playerMV}`
      result.push({ label: "VALUE", value: valStr, type: isOverpriced ? "warn" : valuePct >= 30 ? "good" : "info" })
    }

    // ── 3. Form ───────────────────────────────────────────────────────────
    if (wr !== null) {
      const form = currentPlayer?.form || []
      const formStr = `${wr}% WR · ${form.slice(0,5).join(" ")} · BDR ${currentPlayer?.bdrPoints ?? 0}`
      result.push({ label: "FORM", value: formStr, type: wr >= 65 ? "good" : wr >= 45 ? "info" : "warn" })
    }

    // ── 4. Squad Need ─────────────────────────────────────────────────────
    const sameGrade = myGradeCount === 0
      ? `No ${playerGrade} yet — fills gap`
      : myGradeCount <= 2
        ? `Already have ${myGradeCount} ${playerGrade}-grade`
        : `Heavy on ${playerGrade} — have ${myGradeCount} already`
    result.push({ label: "SQUAD", value: sameGrade, type: myGradeCount === 0 ? "good" : myGradeCount <= 2 ? "info" : "warn" })

    // ── 5. Budget ─────────────────────────────────────────────────────────
    const budgetStr = pendingAfter > 0
      ? `₹${myBudget} left · ₹${Math.max(0, perPlayer)}/player after (${pendingAfter} remaining)`
      : `₹${myBudget} left · last player`
    result.push({ label: "BUDGET", value: budgetStr, type: perPlayer >= 80 ? "good" : perPlayer >= 30 ? "info" : "warn" })

    // ── 6. Competition ────────────────────────────────────────────────────
    const activeBidders = recentBids?.length > 1
      ? [...new Set(recentBids.slice(-6).map(b => b.teamId))].filter(id => id !== myTeamId).length
      : 0
    const lastBidder = recentBids?.length
      ? teams.find(t => t.id === recentBids[recentBids.length - 1]?.teamId)
      : null
    const compStr = activeBidders > 1
      ? `${activeBidders} teams bidding — price rising`
      : lastBidder && lastBidder.id !== myTeamId
        ? `Led by ${lastBidder.name} · ₹${currentBid}`
        : "Low competition right now"
    result.push({ label: "COMPETITION", value: compStr, type: activeBidders > 1 ? "warn" : "good" })

    // ── 7. Your Target ────────────────────────────────────────────────────
    if (myTarget) {
      const pLabel = { must_have: "MUST HAVE", want: "WANT", backup: "BACKUP" }[priority] || priority
      const maxStr = maxBid
        ? exceedsMax
          ? `Max ₹${maxBid} EXCEEDED by ₹${currentBid - maxBid}`
          : `Max ₹${maxBid} · ₹${maxBid - currentBid} room`
        : "No max bid set"
      result.push({ label: "TARGET", value: `${pLabel} · ${maxStr}`, type: exceedsMax ? "warn" : "good" })
    } else {
      result.push({ label: "TARGET", value: "Not on your list — unplanned pick", type: "warn" })
    }

    return result
  }, [session, pool, sales, teams, retentions, recentBids, currentPlayer, myTeamId, targets, myPlayers])

  if (!session?.currentPlayerId || !myTeamId) return null

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-surface-border">
        <Brain className="w-3.5 h-3.5 text-accent" />
        <span className="text-xs font-semibold text-white">Smart Analysis</span>
        {/* Opponent interest chip */}
        {interest?.count > 0 && (
          <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-400/15 text-rose-400 flex-shrink-0">
            {interest.count} team{interest.count > 1 ? "s" : ""} targeting {interest.mustHave > 0 ? "🔴" : "🟡"}
          </span>
        )}
      </div>
      <div className="px-4 py-1">
        {rows.map((r, i) => <Row key={i} {...r} />)}
      </div>
    </div>
  )
}