import { useMemo } from "react"
import { Brain, TrendingUp, Users, Target, AlertTriangle, CheckCircle, Crosshair, Zap, Shield, BarChart2, Swords, Gauge } from "lucide-react"
import { cn } from "../../lib/utils"
import { usePlayerTargetInterest } from "../../lib/queries"

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

  // Similar players in pool — used in Your Target section
  const poolWinRate = (p) => {
    const f = p.form || []
    return f.length ? Math.round(f.filter(r => r === "W").length / f.length * 100) : 0
  }

  const similarInPool = pendingPool
    .filter(p => {
      if (p.playerId === currentId) return false
      return p.grade === playerGrade || gradeRank(p.grade) === gradeRank(playerGrade) - 1
    })
    .sort((a, b) => poolWinRate(b) - poolWinRate(a))
    .slice(0, 3)

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

    // Similar players still available in pool
    if (similarInPool.length > 0) {
      const names = similarInPool
        .map(p => {
          const wr = poolWinRate(p)
          return `${p.name} (${p.grade}${wr > 0 ? `, ${wr}% WR` : ""}, MV ₹${p.marketValue ?? "?"})`
        })
        .join(" · ")
      targetItems.push({
        type: "info",
        text: `Similar Grade ${playerGrade} players still in pool: ${names}`
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

    // Still show similar alternatives
    if (similarInPool.length > 0) {
      const names = similarInPool
        .map(p => {
          const wr = poolWinRate(p)
          return `${p.name} (${p.grade}${wr > 0 ? `, ${wr}% WR` : ""}, MV ₹${p.marketValue ?? "?"})`
        })
        .join(" · ")
      targetItems.push({
        type: "info",
        text: `Other Grade ${playerGrade} players still available: ${names}`
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

  // ── Section: Spend Rate Warning ────────────────────────────────────────────
  const totalPlayers   = pool.length
  const soldCount      = pool.filter(p => p.status !== "pending").length
  const auctionPct     = totalPlayers > 0 ? soldCount / totalPlayers : 0
  const spentPct       = budgetPerTeam > 0 ? mySpent / budgetPerTeam : 0
  const spendRateItems = []

  if (auctionPct > 0.1 && spentPct > auctionPct + 0.25) {
    spendRateItems.push({
      type: "warn",
      text: `You've spent ${Math.round(spentPct * 100)}% of budget but only ${Math.round(auctionPct * 100)}% of the auction is done — you're burning budget faster than the auction progresses. Slow down or you'll have nothing left for late picks.`
    })
  } else if (auctionPct > 0.5 && spentPct < auctionPct - 0.3) {
    spendRateItems.push({
      type: "info",
      text: `You've been conservative — spent only ${Math.round(spentPct * 100)}% of budget with ${Math.round(auctionPct * 100)}% of the auction done. You have room to push harder on remaining players.`
    })
  } else if (spentPct > 0) {
    spendRateItems.push({
      type: "good",
      text: `Spend rate is healthy — ${Math.round(spentPct * 100)}% of budget used with ${Math.round(auctionPct * 100)}% of auction complete. On track.`
    })
  }

  const avgSpentPerPlayer = myPlayerCount > 0 ? Math.round(mySpent / myPlayerCount) : 0
  if (avgSpentPerPlayer > 0) {
    spendRateItems.push({
      type: "info",
      text: `Your average spend per player so far: ₹${avgSpentPerPlayer}. Remaining budget: ₹${myBudget} across ~${pendingAfter} players.`
    })
  }

  if (spendRateItems.length) insights.push({ section: "Spend Rate", icon: "trending", items: spendRateItems })

  // ── Section: Opponent Purse Tracker ───────────────────────────────────────
  const purseItems  = []
  const sortedTeams = [...teams]
    .filter(t => t.id !== myTeamId)
    .sort((a, b) => (b.budget ?? 0) - (a.budget ?? 0))

  const richest  = sortedTeams[0]
  const poorest  = sortedTeams[sortedTeams.length - 1]
  const myBudgetRank = [...teams].sort((a, b) => (b.budget ?? 0) - (a.budget ?? 0)).findIndex(t => t.id === myTeamId) + 1

  purseItems.push({
    type: myBudgetRank <= 2 ? "good" : myBudgetRank >= teams.length - 1 ? "warn" : "info",
    text: `Your budget rank: #${myBudgetRank} of ${teams.length} teams. You have ₹${myBudget} remaining.`
  })
  if (richest) purseItems.push({ type: "info", text: `Richest rival: ${richest.name} with ₹${richest.budget ?? 0} — they can outbid almost anyone.` })
  if (poorest && (poorest.budget ?? 0) < 50) purseItems.push({ type: "good", text: `${poorest.name} is nearly broke (₹${poorest.budget ?? 0}) — no competition from them on this player.` })

  const brokeTeams = sortedTeams.filter(t => (t.budget ?? 0) < 50)
  if (brokeTeams.length > 0) purseItems.push({ type: "good", text: `${brokeTeams.length} team${brokeTeams.length > 1 ? "s are" : " is"} effectively out of budget: ${brokeTeams.map(t => t.name).join(", ")}.` })

  insights.push({ section: "Purse Tracker", icon: "shield", items: purseItems })

  // ── Section: Opponent Weakness Detector ───────────────────────────────────
  const weaknessItems = []
  const teamSquads    = teams
    .filter(t => t.id !== myTeamId)
    .map(t => {
      const won       = sales.filter(s => s.teamId === t.id)
      const retained  = retentions.filter(r => r.teamId === t.id)
      const players   = [...won, ...retained]
      const grades    = players.map(p => p.grade || p.playerGrade).filter(Boolean)
      const hasS      = grades.filter(g => g === "S").length
      const hasA      = grades.filter(g => g === "A" || g === "A+").length
      const hasB      = grades.filter(g => g === "B").length
      const total     = players.length
      return { team: t, hasS, hasA, hasB, total }
    })

  const needsS = teamSquads.filter(ts => ts.hasS === 0 && ts.total > 0)
  const needsA = teamSquads.filter(ts => ts.hasA === 0 && ts.total > 1)

  if (needsS.length > 0) weaknessItems.push({ type: "info", text: `Teams with NO S-grade yet: ${needsS.map(ts => ts.team.name).join(", ")} — they'll bid desperately on any S player.` })
  if (needsA.length > 0) weaknessItems.push({ type: "info", text: `Teams with NO A-grade: ${needsA.map(ts => ts.team.name).join(", ")} — vulnerable on A-grade bids.` })
  if (needsS.length === 0 && needsA.length === 0) weaknessItems.push({ type: "good", text: `All teams have coverage across grades — no obvious squad gaps to exploit.` })

  // Current player match
  const wantCurrentGrade = teamSquads.filter(ts => {
    if (playerGrade === "S") return ts.hasS === 0
    if (playerGrade === "A" || playerGrade === "A+") return ts.hasA <= 1
    return false
  })
  if (wantCurrentGrade.length > 0) weaknessItems.push({ type: "warn", text: `${wantCurrentGrade.length} rival team${wantCurrentGrade.length > 1 ? "s need" : " needs"} exactly this grade — expect fierce bidding from: ${wantCurrentGrade.map(ts => ts.team.name).join(", ")}.` })

  if (weaknessItems.length) insights.push({ section: "Opponent Weaknesses", icon: "crosshair", items: weaknessItems })

  // ── Section: Bluff Detector ───────────────────────────────────────────────
  const bluffItems   = []
  if (recentBids && recentBids.length >= 4) {
    const last6        = recentBids.slice(-6)
    const bidderCounts = last6.reduce((acc, b) => { acc[b.teamId] = (acc[b.teamId] || 0) + 1; return acc }, {})
    const aggressors   = Object.entries(bidderCounts)
      .filter(([id, count]) => count >= 3 && Number(id) !== myTeamId)
      .map(([id]) => teams.find(t => t.id === Number(id)))
      .filter(Boolean)

    if (aggressors.length > 0) {
      aggressors.forEach(aggressor => {
        const aggrSquad  = teamSquads.find(ts => ts.team.id === aggressor.id)
        const needsThisGrade = playerGrade === "S" ? (aggrSquad?.hasS ?? 0) === 0
          : (playerGrade === "A" || playerGrade === "A+") ? (aggrSquad?.hasA ?? 0) === 0
          : false
        if (!needsThisGrade && (aggressor.budget ?? 0) < currentBid * 2) {
          bluffItems.push({ type: "warn", text: `POSSIBLE BLUFF — ${aggressor.name} is bidding aggressively but doesn't strongly need this grade and is low on budget (₹${aggressor.budget ?? 0}). They may be trying to drain your purse.` })
        } else if (!needsThisGrade) {
          bluffItems.push({ type: "info", text: `${aggressor.name} has bid ${bidderCounts[aggressor.id]}x recently but this grade doesn't match their squad needs — possible block bid.` })
        }
      })
    }
    if (bluffItems.length === 0) bluffItems.push({ type: "good", text: `No suspicious bidding patterns detected — all active bidders appear to genuinely need this player.` })
  } else {
    bluffItems.push({ type: "info", text: `Not enough bid history yet to detect patterns.` })
  }
  insights.push({ section: "Bluff Detector", icon: "swords", items: bluffItems })

  // ── Section: Threat Level per Team ────────────────────────────────────────
  const threatItems  = []
  const teamStrength = teams
    .filter(t => t.id !== myTeamId)
    .map(t => {
      const won      = sales.filter(s => s.teamId === t.id)
      const retained = retentions.filter(r => r.teamId === t.id)
      const players  = [...won, ...retained]
      const mvTotal  = players.reduce((s, p) => s + (p.price || 0), 0)
      const gradeScore = players.reduce((s, p) => {
        const g = p.grade || p.playerGrade
        return s + (g === "S" ? 5 : g === "A" || g === "A+" ? 3 : g === "B" ? 2 : 1)
      }, 0)
      const budgetScore = Math.round((t.budget ?? 0) / 100)
      const total = mvTotal / 10 + gradeScore * 5 + budgetScore * 3
      return { name: t.name, score: Math.round(total), players: players.length, budget: t.budget ?? 0 }
    })
    .sort((a, b) => b.score - a.score)

  if (teamStrength.length > 0) {
    const tier1 = teamStrength.filter((_, i) => i < 2)
    const tier2 = teamStrength.filter((_, i) => i >= 2 && i < Math.ceil(teamStrength.length / 2))
    const tier3 = teamStrength.filter((_, i) => i >= Math.ceil(teamStrength.length / 2))

    if (tier1.length) threatItems.push({ type: "warn",  text: `🔴 Tier 1 (Most Dangerous): ${tier1.map(t => `${t.name} (${t.players} players, ₹${t.budget} left)`).join(", ")}` })
    if (tier2.length) threatItems.push({ type: "info",  text: `🟡 Tier 2 (Mid Threat): ${tier2.map(t => t.name).join(", ")}` })
    if (tier3.length) threatItems.push({ type: "good",  text: `🟢 Tier 3 (Low Threat): ${tier3.map(t => `${t.name} (₹${t.budget} left)`).join(", ")}` })
  }
  insights.push({ section: "Threat Levels", icon: "barchart", items: threatItems })

  // ── Section: Captain Dependency Score ─────────────────────────────────────
  const captainItems  = []
  const myCaptain     = myPlayers.find(p => p.isCaptain)
  const captainWin    = myWins.find(s => s.playerId === (myCaptain?.id ?? -1))

  if (myCaptain) {
    const captainMV   = myCaptain.marketValue ?? 0
    const squadMVTotal = myWins.reduce((s, w) => s + (w.price || 0), 0)
    const captainPct  = squadMVTotal > 0 ? Math.round((captainWin?.price ?? 0) / squadMVTotal * 100) : 0
    const captainBDR  = myCaptain.bdrPoints ?? 0
    const avgBDR      = myPlayers.length > 0 ? Math.round(myPlayers.reduce((s, p) => s + (p.bdrPoints ?? 0), 0) / myPlayers.length) : 0
    const bdrDep      = avgBDR > 0 ? Math.round(captainBDR / avgBDR * 100) : 0

    if (captainPct > 40) captainItems.push({ type: "warn", text: `HIGH dependency — your captain represents ${captainPct}% of squad spend. Your team's success is heavily tied to one player.` })
    else if (captainPct > 25) captainItems.push({ type: "info", text: `MODERATE dependency — captain is ${captainPct}% of squad spend. Manageable but worth building depth.` })
    else captainItems.push({ type: "good", text: `LOW dependency — captain is only ${captainPct}% of squad spend. Well-balanced squad.` })

    if (bdrDep > 200) captainItems.push({ type: "warn", text: `Captain's BDR (${captainBDR}) is ${Math.round(bdrDep / 100)}× the squad average — your performance depends heavily on them.` })
  } else {
    captainItems.push({ type: "info", text: `No captain signed yet. Your rival captains are already locked in.` })
  }
  insights.push({ section: "Captain Dependency", icon: "users", items: captainItems })

  // ── Section: Predicted Final Squad Strength ───────────────────────────────
  const predictItems  = []
  const avgPoolMV     = pendingPool.length > 0
    ? Math.round(pendingPool.reduce((s, p) => s + (p.marketValue ?? 0), 0) / pendingPool.length)
    : 0
  const myProjected   = mySpent + Math.min(myBudget * 0.8, pendingAfter * avgPoolMV * 0.7)

  const teamProjections = teams.map(t => {
    const won      = sales.filter(s => s.teamId === t.id)
    const retained = retentions.filter(r => r.teamId === t.id)
    const spent    = won.reduce((s, w) => s + w.price, 0) + retained.reduce((s, r) => s + r.price, 0)
    const projected = spent + Math.min((t.budget ?? 0) * 0.8, pendingAfter * avgPoolMV * 0.7)
    return { name: t.name, projected: Math.round(projected), isMe: t.id === myTeamId }
  }).sort((a, b) => b.projected - a.projected)

  const myRank = teamProjections.findIndex(t => t.isMe) + 1
  predictItems.push({
    type: myRank <= 2 ? "good" : myRank >= teams.length - 1 ? "warn" : "info",
    text: `Projected squad strength rank: #${myRank} of ${teams.length}. Estimated final squad value: ₹${Math.round(myProjected)}.`
  })

  const leader = teamProjections[0]
  if (leader && !leader.isMe) {
    predictItems.push({ type: "info", text: `Projected strongest squad: ${leader.name} at ₹${leader.projected}. You need to outbid them on key remaining players to close the gap.` })
  } else if (leader?.isMe) {
    predictItems.push({ type: "good", text: `You're projected to build the strongest squad. Protect your lead by not overspending on remaining players.` })
  }
  insights.push({ section: "Predicted Strength", icon: "trending", items: predictItems })

  // ── Section 13: Should I Bid Calculator ───────────────────────────────────
  const bidCalcItems = []
  // Three signals: value, squad need, budget impact
  const valueSignal  = isGoodValue ? 2 : isOverpriced ? -2 : 0
  const needSignal   = gradeCount === 0 ? 2 : gradeCount <= 2 ? 1 : -1
  const budgetSignal = budgetHealthy ? 1 : budgetTight ? -2 : 0
  const targetSignal = priority === "must_have" ? 2 : priority === "want" ? 1 : priority === "backup" ? 0 : -1
  const totalSignal  = valueSignal + needSignal + budgetSignal + targetSignal

  const decision = totalSignal >= 3 ? "BID ✅" : totalSignal >= 0 ? "CAUTION ⚠️" : "PASS ❌"
  const decisionType = totalSignal >= 3 ? "good" : totalSignal >= 0 ? "warn" : "warn"

  bidCalcItems.push({ type: decisionType, text: `${decision}  —  Value: ${valueSignal > 0 ? "✅" : valueSignal < 0 ? "❌" : "—"}  |  Squad Need: ${needSignal > 0 ? "✅" : needSignal < 0 ? "❌" : "—"}  |  Budget: ${budgetSignal > 0 ? "✅" : budgetSignal < 0 ? "❌" : "—"}  |  Target: ${targetSignal > 0 ? "✅" : targetSignal < 0 ? "❌" : "—"}` })
  bidCalcItems.push({ type: "info", text: `Score: ${totalSignal > 0 ? "+" : ""}${totalSignal} out of +7 possible. ${totalSignal >= 3 ? "Multiple green signals — worth bidding." : totalSignal >= 0 ? "Mixed signals — proceed carefully." : "Too many red flags — consider walking away."}` })
  insights.push({ section: "Should I Bid?", icon: "gauge", items: bidCalcItems })

  // ── Section 14: What If I Win This ────────────────────────────────────────
  const whatIfItems  = []
  const budgetAfter  = myBudget - currentBid
  const playersLeft  = pendingAfter
  const perPlayerAfter = playersLeft > 0 ? Math.floor(budgetAfter / playersLeft) : budgetAfter
  const canStillBid  = perPlayerAfter >= 25

  whatIfItems.push({
    type: budgetAfter < 0 ? "warn" : canStillBid ? "good" : "warn",
    text: `If you win at ₹${currentBid}: ₹${Math.max(0, budgetAfter)} remaining for ${playersLeft} more player${playersLeft !== 1 ? "s" : ""}.`
  })
  whatIfItems.push({
    type: canStillBid ? "info" : "warn",
    text: canStillBid
      ? `That's ~₹${perPlayerAfter} per remaining player — ${perPlayerAfter >= 80 ? "plenty to work with" : perPlayerAfter >= 40 ? "tight but manageable" : "very tight, budget nearly exhausted"}.`
      : `You would have less than ₹25 per remaining slot — effectively ending your ability to compete for any more players.`
  })
  if (budgetAfter >= 0 && highGradePending > 0) {
    whatIfItems.push({
      type: "info",
      text: `${highGradePending} S/A-grade player${highGradePending !== 1 ? "s" : ""} still in pool — winning this player at ₹${currentBid} leaves you ₹${budgetAfter} to compete for them.`
    })
  }
  insights.push({ section: "What If I Win This?", icon: "zap", items: whatIfItems })

  // ── Section 15: Grade Balance Meter ───────────────────────────────────────
  const balanceItems = []
  const IDEAL = { S: 2, A: 3, B: 4, C: 2 }
  const leagueSquadSize = teams.length > 0
    ? Math.round((sales.length + retentions.length) / teams.length)
    : 10
  const myGrades = { S: 0, A: 0, B: 0, C: 0 }
  myPlayers.forEach(p => {
    const g = p.grade === "A+" ? "A" : p.grade
    if (myGrades[g] !== undefined) myGrades[g]++
  })
  const totalMyPlayers = Object.values(myGrades).reduce((s, v) => s + v, 0)

  if (totalMyPlayers > 0) {
    const imbalances = []
    Object.entries(myGrades).forEach(([g, count]) => {
      const idealCount = Math.round((IDEAL[g] ?? 2) / 11 * Math.max(totalMyPlayers, leagueSquadSize))
      if (count > idealCount + 1) imbalances.push(`heavy on ${g}-grade (${count}, ideal ~${idealCount})`)
      if (count < idealCount - 1 && idealCount > 1) imbalances.push(`light on ${g}-grade (${count}, ideal ~${idealCount})`)
    })
    if (imbalances.length > 0) {
      balanceItems.push({ type: "warn", text: `Squad imbalance detected: ${imbalances.join("; ")}.` })
    } else {
      balanceItems.push({ type: "good", text: `Grade distribution is well balanced across S/A/B/C.` })
    }
    balanceItems.push({
      type: "info",
      text: `Your squad: S×${myGrades.S} A×${myGrades.A} B×${myGrades.B} C×${myGrades.C}. Signing this ${playerGrade}-grade player ${myGrades[playerGrade === "A+" ? "A" : playerGrade] >= (IDEAL[playerGrade === "A+" ? "A" : playerGrade] ?? 2) ? "would further tilt the balance" : "would help fill a gap"}.`
    })
  } else {
    balanceItems.push({ type: "info", text: `No players won yet — any grade is currently fine to target.` })
  }
  insights.push({ section: "Grade Balance", icon: "barchart", items: balanceItems })

  // ── Section 16: When To Walk Away ─────────────────────────────────────────
  const walkItems    = []
  const mvWalkaway   = playerMV > 0 ? Math.round(playerMV * 1.15) : null
  const budgetWalk   = pendingAfter > 0 ? Math.max(25, myBudget - pendingAfter * 25) : myBudget
  const targetWalk   = maxBid ?? null
  const walkawayPrice = Math.min(
    ...[mvWalkaway, budgetWalk, targetWalk].filter(v => v !== null && v > 0)
  )

  if (walkawayPrice && walkawayPrice > currentBid) {
    walkItems.push({
      type: currentBid >= walkawayPrice * 0.85 ? "warn" : "good",
      text: `Walk away at ₹${walkawayPrice}. ${currentBid >= walkawayPrice * 0.85 ? "⚠️ You are approaching this limit now." : `You have ₹${walkawayPrice - currentBid} more room before the walkaway point.`}`
    })
  } else if (walkawayPrice && currentBid >= walkawayPrice) {
    walkItems.push({ type: "warn", text: `⛔ Current bid (₹${currentBid}) has already crossed your walkaway threshold of ₹${walkawayPrice}. Drop out now.` })
  }

  const reasons = []
  if (mvWalkaway) reasons.push(`MV limit: ₹${mvWalkaway} (15% over MV)`)
  if (targetWalk) reasons.push(`Your max bid: ₹${targetWalk}`)
  if (budgetWalk < (mvWalkaway ?? 9999)) reasons.push(`Budget constraint: ₹${budgetWalk}`)
  if (reasons.length) walkItems.push({ type: "info", text: `Walkaway based on: ${reasons.join(" · ")}` })

  insights.push({ section: "Walk Away At", icon: "shield", items: walkItems })

  // ── Section 18: Auction Momentum Score ────────────────────────────────────
  const momentumItems = []
  const totalTargets  = targets?.length ?? 0
  const targetsWon    = myWins.filter(w => targets?.some(t => t.playerId === w.playerId)).length
  const targetHitRate = totalTargets > 0 ? targetsWon / Math.min(totalTargets, myWins.length || 1) : 0.5
  const budgetEff     = budgetPerTeam > 0 ? 1 - (mySpent / budgetPerTeam) : 0.5
  const squadMV       = myWins.reduce((s, w) => s + (w.price || 0), 0)
  const avgLeagueMV   = teams.length > 0
    ? teams.reduce((s, t) => s + (t.budget != null ? budgetPerTeam - t.budget : 0), 0) / teams.length
    : squadMV
  const strengthScore = avgLeagueMV > 0 ? Math.min(1, squadMV / avgLeagueMV) : 0.5

  const momentum = Math.round(
    (targetHitRate * 40) + (budgetEff * 30) + (strengthScore * 30)
  )
  const momentumLabel = momentum >= 75 ? "🔥 Excellent" : momentum >= 55 ? "✅ On Track" : momentum >= 35 ? "⚠️ Behind" : "❌ Struggling"
  const momentumType  = momentum >= 75 ? "good" : momentum >= 55 ? "good" : momentum >= 35 ? "warn" : "warn"

  momentumItems.push({ type: momentumType, text: `Momentum: ${momentumLabel} — ${momentum}/100` })
  momentumItems.push({ type: "info", text: `Target hit rate: ${Math.round(targetHitRate * 100)}%  |  Budget remaining: ${Math.round(budgetEff * 100)}%  |  Squad strength vs league: ${Math.round(strengthScore * 100)}%` })
  if (momentum < 50 && auctionPct > 0.3) {
    momentumItems.push({ type: "warn", text: `Your auction is underperforming with ${Math.round((1 - auctionPct) * 100)}% of players still available — push harder on the remaining targets.` })
  } else if (momentum >= 75) {
    momentumItems.push({ type: "good", text: `You're having a strong auction — maintain discipline and don't overpay chasing perfection.` })
  }
  insights.push({ section: "Auction Momentum", icon: "gauge", items: momentumItems })

  return insights
}

// ── sub-components ────────────────────────────────────────────────────────────

const ICON_MAP = {
  trending:  TrendingUp,
  users:     Users,
  target:    Target,
  brain:     Brain,
  crosshair: Crosshair,
  shield:    Shield,
  barchart:  BarChart2,
  swords:    Swords,
  zap:       Zap,
  gauge:     Gauge,
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

export default function SmartAnalysis({ session, pool, sales, teams, retentions, recentBids, currentPlayer, myTeamId, targets, myPlayers, isAdmin }) {
  const currentPlayerId = session?.currentPlayerId
  const { data: interest } = usePlayerTargetInterest(currentPlayerId)

  const insights = useMemo(() => buildAnalysis({
    session, pool, sales, teams, retentions, recentBids,
    currentPlayer, myTeamId, targets, myPlayers,
  }), [session, pool, sales, teams, retentions, recentBids, currentPlayer, myTeamId, targets, myPlayers])

  if (!session?.currentPlayerId || !myTeamId) return null

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-3 border-b border-surface-border">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-accent" />
          <span className="text-sm font-semibold text-white">Smart Analysis</span>
        </div>
      </div>

      {/* ── Section 16: Opponents Who Want This ─────────────────────────── */}
      {interest && (
        <div className="px-5 py-3 border-b border-surface-border bg-pitch-800/30">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">🎯 Opponent Interest</p>
          {interest.count === 0 ? (
            <p className="text-xs text-slate-500">No other team has this player as a target — less competition expected.</p>
          ) : (
            <div className="space-y-1">
              <p className="text-xs text-amber-400 font-semibold">
                {interest.count} team{interest.count !== 1 ? "s have" : " has"} this player as a target
                {interest.mustHave > 0 ? ` · ${interest.mustHave} as Must Have 🔴` : ""}
                {interest.want > 0 ? ` · ${interest.want} as Want 🟡` : ""}
              </p>
              {/* Admin view — show team names */}
              {isAdmin && interest.teams && interest.teams.map(t => (
                <div key={t.teamId} className="flex items-center gap-2">
                  <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded",
                    t.priority === "must_have" ? "bg-rose-400/15 text-rose-400" :
                    t.priority === "want"      ? "bg-accent/15 text-accent" :
                                                 "bg-slate-500/15 text-slate-400"
                  )}>
                    {t.priority === "must_have" ? "MUST HAVE" : t.priority === "want" ? "WANT" : "BACKUP"}
                  </span>
                  <span className="text-xs text-white">{t.teamName}</span>
                  {t.maxBid && <span className="text-xs text-slate-500">max ₹{t.maxBid}</span>}
                </div>
              ))}
              {!isAdmin && (
                <p className="text-xs text-slate-500">Expect competitive bidding — plan your max bid before it heats up.</p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="divide-y divide-surface-border/30">
        {insights.map((section, i) => {
          const Icon = ICON_MAP[section.icon] || Brain
          return (
            <div key={i} className="px-5 py-3">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{section.section}</span>
              </div>
              <div className="space-y-1.5">
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
