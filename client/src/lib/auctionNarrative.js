// Narrative flavor-text generator for the live auction — ported from the
// original standalone app's phrase banks (trimmed to a representative
// set per storyline rather than all ~20 variants, easy to expand later).
// Pure presentation logic: every storyline is derived entirely from data
// GET /auction/current already returns, nothing here touches the backend.

const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)]

const homePhrases = (player, team) => [
  `🏠 <strong>He's going home!</strong> ${player} returns to <strong>${team}</strong> — back where it all began!`,
  `🏡 <strong>Full circle!</strong> ${player} is back with <strong>${team}</strong> — right where they belong!`,
  `💚 <strong>Welcome back!</strong> ${player} reunites with <strong>${team}</strong> — the old team is whole again!`,
  `🔄 <strong>A dream return!</strong> ${player} is heading back to <strong>${team}</strong> — nobody saw this coming!`,
  `🌟 <strong>They never really left!</strong> ${player} rejoins <strong>${team}</strong> — a perfect reunion!`,
]

const betrayalPhrases = (victim, stealer, player) => [
  `💔 <strong>Betrayal!</strong> <strong>${victim}</strong> loses ${player} to <strong>${stealer}</strong> — their own former player is gone!`,
  `😤 <strong>That stings!</strong> <strong>${victim}</strong> just watched ${player} walk straight to <strong>${stealer}</strong>. Ouch!`,
  `🔥 <strong>Poached!</strong> <strong>${stealer}</strong> rips ${player} away from <strong>${victim}</strong> — the ultimate theft!`,
  `😢 <strong>Heartbreak for ${victim}!</strong> ${player} leaves them for <strong>${stealer}</strong> — this one hurts!`,
  `⚡ <strong>Stolen!</strong> <strong>${victim}</strong> tried, but <strong>${stealer}</strong> takes ${player} right from them!`,
]

const redemptionPhrases = (player, amount) => [
  `📈 <strong>Redemption Arc!</strong> ${player} — from unsold to ₹${amount}!`,
  `🔥 <strong>Second chance, first-class result!</strong> ${player} finally finds a home for ₹${amount}!`,
  `💪 <strong>They believed!</strong> Passed over once, ${player} still lands ₹${amount} in Round 2!`,
  `🎯 <strong>Worth the wait!</strong> ${player} goes for ₹${amount} after going unsold in Round 1!`,
]

const milestonePhrases = (player, amount, team) => [
  `👑 <strong>New auction record!</strong> ${player} to <strong>${team}</strong> for ₹${amount} — the biggest sale of the day!`,
  `💰 <strong>Big money move!</strong> <strong>${team}</strong> smash the budget for ${player} at ₹${amount} — the new high-water mark!`,
]

const warPhrases = (t1, t2) => [
  `🔥 <strong>Bidding War!</strong> — <strong>${t1}</strong> vs <strong>${t2}</strong>!`,
  `⚔️ <strong>It's a battle!</strong> — <strong>${t1}</strong> and <strong>${t2}</strong> won't back down!`,
  `💰 <strong>Who wants it more?</strong> — <strong>${t1}</strong> vs <strong>${t2}</strong>!`,
]

const threeWayWarPhrases = (t1, t2, t3) => [
  `🔥 <strong>THREE-WAY WAR!</strong> — <strong>${t1}</strong>, <strong>${t2}</strong> and <strong>${t3}</strong>!`,
  `💥 <strong>Chaos!</strong> — <strong>${t1}</strong>, <strong>${t2}</strong> and <strong>${t3}</strong> all want it!`,
]

const fightbackPhrases = (b, i) => [
  `😤 <strong>${b}</strong> is NOT giving up that easy!`,
  `🔥 <strong>${b}</strong> fires back — <strong>${i}</strong>, you thought wrong!`,
  `💪 <strong>${b}</strong> says — I was here first!`,
]

const intruderPhrases = (n, t1, t2) => [
  `⚡ <strong>${n}</strong> enters the war! — ${t1} vs ${t2}, watch out!`,
  `🚨 Here comes <strong>${n}</strong>! — ${t1} & ${t2} have a new challenger!`,
]

const collectorPhrases = (buyer, club) => [
  `⚽ <strong>${buyer}</strong> is cornering the <strong>${club}</strong> market!`,
  `🛒 <strong>${buyer}</strong> has 2 from <strong>${club}</strong> — shopping smart!`,
]

/**
 * Detects the live bidding pattern from the current player's recent bid
 * history (oldest-first array of {teamId, teamName}) — a war, a fightback,
 * an intruder joining an existing war. Returns null if nothing notable is
 * happening. Needs real bid-log data (not just the current winning bid),
 * since these patterns are about the back-and-forth sequence.
 */
export function detectBidPattern(recentBids) {
  if (!recentBids || recentBids.length < 2) return null
  const recent = recentBids.slice(-6)
  const uniqueTeamIds = [...new Set(recent.map(b => b.teamId))]
  const nameOf = (id) => recent.find(b => b.teamId === id)?.teamName

  if (uniqueTeamIds.length === 2) {
    const counts = {}
    recent.forEach(b => { counts[b.teamId] = (counts[b.teamId] || 0) + 1 })
    if (Object.values(counts).every(c => c >= 2)) {
      const [a, b] = uniqueTeamIds
      return { type: "war", html: rnd(warPhrases(nameOf(a), nameOf(b))) }
    }
    if (recent.length >= 3) {
      const last = recent[recent.length - 1].teamId
      const prev = recent[recent.length - 2].teamId
      const before = recent[recent.length - 3]?.teamId
      if (last === before && last !== prev) {
        return { type: "fightback", html: rnd(fightbackPhrases(nameOf(last), nameOf(prev))) }
      }
    }
  }

  if (uniqueTeamIds.length === 3) {
    return { type: "threeWayWar", html: rnd(threeWayWarPhrases(...uniqueTeamIds.map(nameOf))) }
  }

  if (uniqueTeamIds.length > 2) {
    const last = recent[recent.length - 1].teamId
    const before = recent.slice(0, -1)
    const beforeUnique = [...new Set(before.map(b => b.teamId))]
    if (beforeUnique.length === 2 && !beforeUnique.includes(last)) {
      return { type: "intruder", html: rnd(intruderPhrases(nameOf(last), ...beforeUnique.map(id => before.find(b => b.teamId === id)?.teamName))) }
    }
  }

  return null
}

/**
 * "Collector" — the buying team now has 2 (or more) players who
 * previously belonged to the SAME prior team, right after this sale
 * pushed them to that count. Fires exactly once, the moment they hit 2.
 */
export function detectCollector({ sale, poolEntry, sales, pool, teamNameById }) {
  if (!poolEntry?.prevTeamId) return null
  const matching = sales.filter(s => {
    if (s.teamId !== sale.teamId) return false
    const entry = pool.find(p => p.playerId === s.playerId)
    return entry?.prevTeamId === poolEntry.prevTeamId
  })
  if (matching.length !== 2) return null // only fire the instant it becomes exactly 2
  const buyer = teamNameById[sale.teamId]
  const club = teamNameById[poolEntry.prevTeamId]
  return rnd(collectorPhrases(buyer, club))
}

/**
 * Periodic mid-auction scoreboard — strongest squad (by card-tier
 * weighted count), richest remaining budget, most players bought.
 * Call this after every sale; it only actually returns something once
 * `sales.length` hits a multiple of `every` (default every 5 sales).
 */
export function getMvpCheckpoint(sales, teams, pool, every = 5) {
  if (sales.length === 0 || sales.length % every !== 0) return null
  const cardWeight = { silver: 1, gold: 3, purple: 5 }

  let strongest = null, strongestScore = -1
  teams.forEach(t => {
    const score = sales.filter(s => s.teamId === t.id).reduce((sum, s) => {
      const entry = pool.find(p => p.playerId === s.playerId)
      return sum + (cardWeight[entry?.cardType] || 1)
    }, 0)
    if (score > strongestScore) { strongestScore = score; strongest = t.name }
  })

  const richest = [...teams].sort((a, b) => b.budget - a.budget)[0]
  const withCounts = teams.map(t => ({ name: t.name, count: sales.filter(s => s.teamId === t.id).length }))
  const mostPlayers = withCounts.sort((a, b) => b.count - a.count)[0]

  return {
    salesCount: sales.length,
    html: `📊 <strong>${sales.length} Sales Checkpoint!</strong><br>`
      + `💪 Strongest squad: <strong>${strongest}</strong> (${strongestScore}pts) · `
      + `💸 Budget king: <strong>${richest?.name}</strong> (₹${richest?.budget}) · `
      + `👥 Most players: <strong>${mostPlayers?.name}</strong> (${mostPlayers?.count})`,
  }
}

/** "Final 5" / "Last Player Standing" milestone, based on how many pool
 * entries are still pending after the current sale/skip. */
export function getPoolMilestone(pool) {
  const pending = pool.filter(p => p.status === "pending").length
  if (pending === 0) return { type: "lastPlayer", title: "🎬 LAST PLAYER STANDING", subtitle: "This is it — the final player of the auction!" }
  if (pending === 4) return { type: "final5", title: "⚡ FINAL 5 PLAYERS", subtitle: "Only 5 players remain — every bid counts now!" }
  return null
}

/**
 * Given the sale that just happened, the pool entry it came from (for
 * prevTeamId/roundSeen), the team names involved, and the running
 * mostExpensiveSale so far, returns an array of narrative HTML strings
 * that apply — usually 0 or 1, occasionally 2 if it's both a homecoming
 * AND a new record, say.
 */
export function generateSaleNarratives({ sale, poolEntry, teamNameById, mostExpensiveSoFar }) {
  const stories = []
  const buyerName = teamNameById[sale.teamId]

  if (poolEntry?.prevTeamId) {
    const prevTeamName = teamNameById[poolEntry.prevTeamId]
    if (poolEntry.prevTeamId === sale.teamId) {
      stories.push(rnd(homePhrases(sale.playerName, buyerName)))
    } else {
      stories.push(rnd(betrayalPhrases(prevTeamName, buyerName, sale.playerName)))
    }
  }

  if (poolEntry?.roundSeen === 2) {
    stories.push(rnd(redemptionPhrases(sale.playerName, sale.price)))
  }

  if (!mostExpensiveSoFar || sale.price > mostExpensiveSoFar.price) {
    stories.push(rnd(milestonePhrases(sale.playerName, sale.price, buyerName)))
  }

  return stories
}

/** Walks the full sales list to find the single most expensive sale so far. */
export function findMostExpensiveSale(sales) {
  if (!sales.length) return null
  return sales.reduce((max, s) => (s.price > max.price ? s : max), sales[0])
}

/** Consecutive-win streak for a team: how many of their most recent
 * purchases (in chronological order) were won back-to-back without
 * another team's sale in between. */
export function getConsecutiveWinStreak(sales, teamId) {
  // sales is newest-first (matches GET /current's ORDER BY sold_at DESC)
  let streak = 0
  for (const s of sales) {
    if (s.teamId === teamId) streak++
    else break
  }
  return streak
}