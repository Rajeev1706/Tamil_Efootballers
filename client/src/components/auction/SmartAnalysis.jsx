import { useMemo } from "react"
import { Brain, TrendingUp, Users, Target, AlertTriangle, CheckCircle, Crosshair } from "lucide-react"
import { cn } from "../../lib/utils"

// ── helpers ──────────────────────────────────────────────────────────────────

function gradeRank(g) { return { S: 5, "A+": 4, A: 3, B: 2, C: 1 }[g] ?? 0 }

function formSummary(form = []) {
  if (!form?.length) return null
  const w = form.filter(r => r === "W").length
  const d = form.filter(r => r === "D").length
  const l = form.filter(r => r === "L").length
  return { w, d, l, pct: Math.round((w / form.length) * 100), total: form.length }
}

const MV_BENCH = { S: 180, "A+": 140, A: 110, B: 65, C: 40 }

function squadFitScore(player, myPlayers = []) {
  const gradeCounts = myPlayers.reduce((acc, p) => { acc[p.grade] = (acc[p.grade] || 0) + 1; return acc }, {})
  const has       = gradeCounts[player?.grade] || 0
  const gapScore  = has === 0 ? 40 : has <= 2 ? 20 : 0
  const form      = player?.form || []
  const fwr       = form.length ? form.filter(f => f === "W").length / form.length : 0
  const formScore = Math.round(fwr * 30)
  const mv        = player?.marketValue ?? 0
  const mvEff     = mv > 0 ? Math.min(1, (MV_BENCH[player?.grade] || 80) / mv) : 0.5
  return Math.min(100, gapScore + formScore + Math.round(mvEff * 30))
}

function richTeamBudgets(teams, sales, myTeamId) {
  return teams
    .filter(t => t.id !== myTeamId && t.budget > 0)
    .sort((a, b) => b.budget - a.budget)
}

// ── analysis engine ──────────────────────────────────────────────────────────

function buildAnalysis({ session, pool, sales, teams, retentions, recentBids, currentPlayer, myTeamId, targets, myPlayers }) {
  if (!session?.currentPlayerId || !myTeamId) return []

  const insights      = []
  const currentId     = session.currentPlayerId
  const myTeam        = teams.find(t => t.id === myTeamId)
  const myBudget      = myTeam?.budget ?? 0
  const currentBid    = session.currentBid ?? 25
  const playerGrade   = session.currentPlayerGrade
  const playerName    = session.currentPlayerName
  const playerMV      = session.currentPlayerMarketValue ?? currentPlayer?.marketValue ?? 0
  const playerBDR     = currentPlayer?.bdrPoints ?? session.currentPlayerBdrPoints ?? 0
  const budgetPerTeam = session.budgetPerTeam ?? 1100

  // My target for this specific player
  const myTarget      = targets?.find(t => t.playerId === currentId)
  const isTarget      = !!myTarget
  const priority      = myTarget?.priority
  const maxBid        = myTarget?.maxBid

  // My squad
  const myWins        = sales.filter(s => s.teamId === myTeamId)
  const myRetentions  = retentions.filter(r => r.teamId === myTeamId)
  const myPlayerCount = myWins.length + myRetentions.length
  const mySpent       = myWins.reduce((s, w) => s + w.price, 0) +
                        myRetentions.reduce((s, r) => s + r.price, 0)
  const myAvgSpent    = myPlayerCount > 0 ? Math.round(mySpent / myPlayerCount) : 0

  // Pool stats
  const pendingPool      = pool.filter(p => p.status === "pending")
  const pendingAfter     = pendingPool.length - 1
  const sGradePending    = pendingPool.filter(p => p.grade === "S" && p.playerId !== currentId).length
  const aGradePending    = pendingPool.filter(p => (p.grade === "A" || p.grade === "A+") && p.playerId !== currentId).length
  const highGradePending = sGradePending + aGradePending
  const totalSold        = pool.filter(p => p.status === "sold").length

  // Budget
  const budgetIfWin    = myBudget - currentBid
  const perPlayerLeft  = pendingAfter > 0 ? Math.floor(budgetIfWin / pendingAfter) : budgetIfWin
  const canAfford      = currentBid <= myBudget
  const budgetTight    = perPlayerLeft < 25 && pendingAfter > 0
  const budgetHealthy  = perPlayerLeft >= 100
  const isOverpriced   = playerMV > 0 && currentBid > playerMV
  const valuePct       = playerMV > 0 ? Math.round(((playerMV - currentBid) / playerMV) * 100) : 0
  const isGoodValue    = valuePct >= 30
  const isExcellentValue = valuePct >= 60
  const exceedsMaxBid  = maxBid != null && currentBid > maxBid
  const maxBidHeadroom = maxBid != null ? maxBid - currentBid : null

  // Squad fit
  const fitScore       = squadFitScore(
    currentPlayer ?? { grade: playerGrade, marketValue: playerMV, form: [] },
    myPlayers
  )
  const myGradeCounts  = myPlayers.reduce((acc, p) => { acc[p.grade] = (acc[p.grade] || 0) + 1; return acc }, {})
  const gradeCount     = myGradeCounts[playerGrade] || 0

  // Backup
  const backupTarget   = myTarget?.backupForPlayerId
    ? targets?.find(t => t.playerId === myTarget.backupForPlayerId)
    : targets?.find(t => t.backupForPlayerId === currentId)

  // Competition
  const recentBidTeams = recentBids?.length > 1
    ? [...new Set(recentBids.slice(-6).map(b => b.teamId))].filter(id => id !== myTeamId)
    : []
  const activeBidders  = recentBidTeams.length
  const rivalTeams     = richTeamBudgets(teams, sales, myTeamId)
  const richRivals     = rivalTeams.filter(t => t.budget >= currentBid * 3).length
  const lastBidTeam    = recentBids?.length ? teams.find(t => t.id === recentBids[recentBids.length - 1]?.teamId) : null

  // Form
  const form = formSummary(currentPlayer?.form)

  // ── Section 1: Your Target ─────────────────────────────────────────────────
  const targetItems = []

  if (isTarget) {
    const priorityLabels = { must_have: "Must Have", want: "Want", backup: "Backup" }
    const priorityTypes  = { must_have: "good", want: "info", backup: "info" }

    targetItems.push({
      type: priorityTypes[priority] || "info",
      text: `${playerName} is on your list as a "${priorityLabels[priority] || priority}" — this is a planned pick`
    })

    if (maxBid != null) {
      if (exceedsMaxBid) {
        targetItems.push({
          type: "warn",
          text: `Current bid ₹${currentBid} has already crossed your max bid of ₹${maxBid} — you set this limit for a reason`
        })
      } else if (maxBidHeadroom > 200) {
        targetItems.push({
          type: "good",
          text: `Lot of room left — current bid ₹${currentBid} vs your max ₹${maxBid} (₹${maxBidHeadroom} still available to push)`
        })
      } else if (maxBidHeadroom > 50) {
        targetItems.push({
          type: "good",
          text: `Bid is within limit — ₹${maxBidHeadroom} headroom before you hit your max of ₹${maxBid}`
        })
      } else {
        targetItems.push({
          type: "warn",
          text: `Getting close to your max — only ₹${maxBidHeadroom} left before hitting your ₹${maxBid} ceiling`
        })
      }
    } else {
      targetItems.push({
        type: "info",
        text: `No max bid set for this player — bid carefully based on your budget`
      })
    }

    if (myTarget?.notes) {
      targetItems.push({ type: "info", text: `Your scouting note: "${myTarget.notes}"` })
    }

    if (backupTarget) {
      targetItems.push({
        type: "info",
        text: `If you miss ${playerName}, your backup is ${backupTarget.name} (Grade ${backupTarget.grade}, MV ₹${backupTarget.marketValue})`
      })
    } else if (priority === "must_have") {
      targetItems.push({
        type: "warn",
        text: `No backup set for this Must Have — if you lose the bidding, you have no fallback plan`
      })
    }

  } else {
    targetItems.push({
      type: "info",
      text: `${playerName} is not on your target list — this would be an unplanned pick`
    })
    if (isGoodValue && fitScore >= 60) {
      targetItems.push({
        type: "info",
        text: `Even though not targeted, the value and squad fit make this worth considering`
      })
    } else if (!isGoodValue) {
      targetItems.push({
        type: "warn",
        text: `Picking untargeted players at full price can hurt your budget planning — bid carefully`
      })
    }
  }

  insights.push({ section: "Your Target", icon: "crosshair", items: targetItems })

  // ── Section 2: Squad Fit ───────────────────────────────────────────────────
  const fitItems = []

  const fitLabel = fitScore >= 80 ? "Excellent" : fitScore >= 60 ? "Good" : fitScore >= 40 ? "Average" : "Poor"
  const fitType  = fitScore >= 60 ? "good" : fitScore >= 40 ? "info" : "warn"
  fitItems.push({
    type: fitType,
    text: `Squad fit score ${fitScore}/100 — ${fitLabel} fit for your current squad`
  })

  if (gradeCount === 0) {
    fitItems.push({
      type: "good",
      text: `You have zero Grade ${playerGrade} players — ${playerName} fills a clear gap in your squad`
    })
  } else if (gradeCount === 1) {
    fitItems.push({
      type: "info",
      text: `You already have 1 Grade ${playerGrade} player — adding ${playerName} gives you depth at this tier`
    })
  } else {
    fitItems.push({
      type: "warn",
      text: `You already have ${gradeCount} Grade ${playerGrade} players — squad may be unbalanced if you add another`
    })
  }

  if (form) {
    if (form.pct >= 80) {
      fitItems.push({
        type: "good",
        text: `On fire right now — ${form.w}W ${form.d}D ${form.l}L in last ${form.total} games (${form.pct}% win rate). Peak form`
      })
    } else if (form.pct >= 60) {
      fitItems.push({
        type: "good",
        text: `Solid recent form — ${form.w}W ${form.d}D ${form.l}L in last ${form.total} games. Performing well`
      })
    } else if (form.pct >= 40) {
      fitItems.push({
        type: "info",
        text: `Mixed form — ${form.w}W ${form.d}D ${form.l}L in last ${form.total} games. Playing average lately`
      })
    } else {
      fitItems.push({
        type: "warn",
        text: `Poor recent form — only ${form.w}W in last ${form.total} games. In a bad run right now`
      })
    }
  }

  if (playerBDR > 0) {
    const bdrLabel = playerBDR >= 15 ? "elite" : playerBDR >= 10 ? "strong" : playerBDR >= 5 ? "decent" : "low"
    fitItems.push({
      type: playerBDR >= 10 ? "good" : "info",
      text: `BDR points: ${playerBDR} — ${bdrLabel} ranking, ${playerBDR >= 10 ? "proven performer" : "still developing"} in the league`
    })
  }

  insights.push({ section: "Squad Fit", icon: "users", items: fitItems })

  // ── Section 3: Budget & Value ──────────────────────────────────────────────
  const budgetItems = []

  budgetItems.push({
    type: "info",
    text: `You have ₹${myBudget} left${myPlayerCount > 0 ? ` after buying ${myPlayerCount} player${myPlayerCount > 1 ? "s" : ""} for avg ₹${myAvgSpent} each` : " — haven't bought anyone yet"}`
  })

  if (!canAfford) {
    budgetItems.push({
      type: "warn",
      text: `You can't bid right now — current bid ₹${currentBid} exceeds your ₹${myBudget} remaining budget`
    })
  } else if (isOverpriced) {
    const overBy = currentBid - playerMV
    budgetItems.push({
      type: "warn",
      text: `Bid has gone ₹${overBy} above market value — you'd be overpaying for ${playerName} at this price`
    })
  } else if (isExcellentValue) {
    budgetItems.push({
      type: "good",
      text: `Exceptional value — ${playerName}'s market value is ₹${playerMV} but current bid is just ₹${currentBid} (${valuePct}% below MV)`
    })
  } else if (isGoodValue) {
    budgetItems.push({
      type: "good",
      text: `Good deal — ₹${valuePct}% below market value. You're paying ₹${playerMV - currentBid} less than what ${playerName} is worth`
    })
  } else {
    budgetItems.push({
      type: "info",
      text: `Fair price — bid is ₹${valuePct}% below market value of ₹${playerMV}. Not a steal but reasonable`
    })
  }

  if (canAfford) {
    if (pendingAfter === 0) {
      budgetItems.push({
        type: budgetIfWin > 0 ? "info" : "good",
        text: `This is the last player — your remaining ₹${budgetIfWin > 0 ? budgetIfWin : myBudget} would be unspent after this`
      })
    } else if (budgetTight) {
      budgetItems.push({
        type: "warn",
        text: `Tight budget alert — if you win this at ₹${currentBid}, you'll only have ₹${perPlayerLeft} per player for the remaining ${pendingAfter} players`
      })
    } else if (budgetHealthy) {
      budgetItems.push({
        type: "good",
        text: `Budget stays healthy — ₹${perPlayerLeft} per player for ${pendingAfter} remaining. You can still bid well on future players`
      })
    } else {
      budgetItems.push({
        type: "info",
        text: `After this you'd have ₹${perPlayerLeft}/player for ${pendingAfter} remaining players — manageable but watch your spending`
      })
    }
  }

  insights.push({ section: "Budget & Value", icon: "trending", items: budgetItems })

  // ── Section 4: Pool & Competition ─────────────────────────────────────────
  const poolItems = []

  const soldPct = pool.length > 0 ? Math.round((totalSold / pool.length) * 100) : 0
  poolItems.push({
    type: "info",
    text: `${pendingPool.length} players still in the pool (${soldPct}% of auction complete). ${pendingAfter} more players after this`
  })

  if (gradeRank(playerGrade) >= 5) {
    if (sGradePending === 0) {
      poolItems.push({
        type: "warn",
        text: `This is the LAST Grade S in the pool — once this player goes, there are no more premium players available`
      })
    } else {
      poolItems.push({
        type: "info",
        text: `${sGradePending} more Grade S player${sGradePending > 1 ? "s" : ""} still coming — so you have alternatives if you miss this`
      })
    }
  } else if (gradeRank(playerGrade) >= 4) {
    if (aGradePending === 0) {
      poolItems.push({
        type: "warn",
        text: `No more A/A+ players after this — this is the last high-grade option in the pool`
      })
    } else {
      poolItems.push({
        type: "info",
        text: `${aGradePending} more A/A+ player${aGradePending > 1 ? "s" : ""} remaining in pool after this`
      })
    }
  }

  if (richRivals > 2) {
    poolItems.push({
      type: "warn",
      text: `${richRivals} other teams still have big budgets — expect fierce competition, especially for premium players`
    })
  } else if (richRivals > 0) {
    poolItems.push({
      type: "info",
      text: `${richRivals} rival team${richRivals > 1 ? "s have" : " has"} strong budget remaining — they can outbid if they want`
    })
  }

  if (activeBidders > 1) {
    const bidderNames = recentBidTeams
      .map(id => teams.find(t => t.id === id)?.name)
      .filter(Boolean)
      .slice(0, 2)
      .join(", ")
    poolItems.push({
      type: "warn",
      text: `Bidding war brewing — ${activeBidders} teams competing (${bidderNames || "multiple teams"}). Price may keep rising`
    })
  } else if (lastBidTeam && lastBidTeam.id !== myTeamId) {
    poolItems.push({
      type: "info",
      text: `Currently led by ${lastBidTeam.name} at ₹${currentBid} — you'll need to go higher to take it`
    })
  } else if (activeBidders === 0 && recentBids?.length > 0) {
    poolItems.push({
      type: "good",
      text: `No active competition right now — you might win this at the current price if no one else bids`
    })
  }

  insights.push({ section: "Pool & Competition", icon: "target", items: poolItems })

  // ── Section 5: Recommendation ─────────────────────────────────────────────
  const rec = []

  if (!canAfford) {
    rec.push({
      type: "warn",
      text: `You cannot bid — your budget of ₹${myBudget} is less than the current bid of ₹${currentBid}. Skip this player`
    })
  } else if (priority === "must_have" && !exceedsMaxBid && !budgetTight) {
    rec.push({
      type: "good",
      text: `BID — This is your Must Have target, bid is under your max, and budget is fine. Don't let this one go`
    })
    if (maxBid) {
      rec.push({
        type: "good",
        text: `You can push up to ₹${maxBid} if needed. Stay in the bidding until then`
      })
    }
  } else if (priority === "must_have" && exceedsMaxBid) {
    rec.push({
      type: "warn",
      text: `TOUGH CALL — This is your Must Have but bid has crossed your planned limit of ₹${maxBid}. Decide if ${playerName} is worth the extra spend`
    })
    rec.push({
      type: "info",
      text: `Consider: will missing ${playerName} hurt your squad badly? If yes, stretch the budget. If backup exists, let it go`
    })
  } else if (priority === "must_have" && budgetTight) {
    rec.push({
      type: "warn",
      text: `Must Have target but budget is getting tight. Winning this leaves only ₹${perPlayerLeft}/player — weigh it carefully`
    })
  } else if (priority === "want" && !exceedsMaxBid && !budgetTight && isGoodValue) {
    rec.push({
      type: "good",
      text: `BID — Wanted player at good value with healthy budget. This is a solid opportunity`
    })
  } else if (priority === "want" && exceedsMaxBid) {
    rec.push({
      type: "info",
      text: `CONSIDER STEPPING BACK — Bid exceeded your planned max of ₹${maxBid} for a "Want" player. May not be worth overpaying`
    })
  } else if (priority === "backup" && highGradePending > 2) {
    rec.push({
      type: "info",
      text: `WAIT — This is a backup pick and better options are still in the pool. Save budget for higher priority players`
    })
  } else if (priority === "backup" && highGradePending === 0) {
    rec.push({
      type: "info",
      text: `No better options left — your backup pick may now be worth getting since premium players are gone`
    })
  } else if (!isTarget && isExcellentValue && fitScore >= 70) {
    rec.push({
      type: "info",
      text: `OPPORTUNISTIC BID — Not planned but the value is excellent and squad fit is strong. Reasonable to jump in at this price`
    })
  } else if (!isTarget && !isGoodValue) {
    rec.push({
      type: "warn",
      text: `SKIP — Not in your plans and not a great deal. Stick to your target list and save the budget`
    })
  } else if (isOverpriced && budgetTight) {
    rec.push({
      type: "warn",
      text: `SKIP — Bid is above market value AND budget is tight. Not worth it at this price`
    })
  } else if (budgetTight) {
    rec.push({
      type: "warn",
      text: `CAREFUL — Budget is getting thin. Think twice before committing ₹${currentBid} here`
    })
  } else if (sGradePending === 0 && gradeRank(playerGrade) >= 5) {
    rec.push({
      type: "good",
      text: `LAST CHANCE — Final Grade S in the pool. If you need a top-tier player, now or never`
    })
  } else {
    rec.push({
      type: "info",
      text: `No strong signal either way — use your team strategy and judgment to decide`
    })
  }

  insights.push({ section: "Recommendation", icon: "brain", items: rec })

  return insights
}

// ── sub-components ────────────────────────────────────────────────────────────

const ICON_MAP = {
  trending:  TrendingUp,
  users:     Users,
  target:    Target,
  brain:     Brain,
  crosshair: Crosshair,
}

function InsightItem({ type, text }) {
  const styles = { good: "text-emerald-400", warn: "text-amber-400", info: "text-slate-300" }
  const icons  = {
    good: <CheckCircle   className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />,
    warn: <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />,
    info: <span className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
          </span>,
  }
  return (
    <div className="flex items-start gap-2">
      {icons[type] || icons.info}
      <span className={cn("text-xs leading-relaxed", styles[type] || styles.info)}>{text}</span>
    </div>
  )
}

// ── main export ───────────────────────────────────────────────────────────────

export default function SmartAnalysis({ session, pool, sales, teams, retentions, recentBids, currentPlayer, myTeamId, targets, myPlayers }) {
  const insights = useMemo(() => buildAnalysis({
    session, pool, sales, teams, retentions, recentBids, currentPlayer, myTeamId, targets, myPlayers
  }), [session?.currentPlayerId, session?.currentBid, myTeamId, currentPlayer?.id, targets?.length, recentBids?.length])

  if (!session?.currentPlayerId || !insights.length) return null

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-surface-border">
        <Brain className="w-4 h-4 text-accent" />
        <h2 className="text-sm font-semibold text-white">Smart Analysis</h2>
        <span className="ml-auto text-[10px] text-slate-600 uppercase tracking-widest font-semibold">Live</span>
      </div>
      <div className="divide-y divide-surface-border/50">
        {insights.map((section, i) => {
          const Icon = ICON_MAP[section.icon] || Brain
          return (
            <div key={i} className="px-5 py-4">
              <div className="flex items-center gap-1.5 mb-2.5">
                <Icon className="w-3.5 h-3.5 text-slate-500" />
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{section.section}</p>
              </div>
              <div className="space-y-2">
                {section.items.map((item, j) => (
                  <InsightItem key={j} type={item.type} text={item.text} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}