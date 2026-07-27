import { useState, useMemo } from "react"
import { Shield, AlertTriangle, CheckCircle, Swords, TrendingUp, Target, ChevronDown, X, Search, Trophy, Zap, Brain, Check, Info, TrendingDown, BarChart2, RefreshCw, Star, ArrowRightLeft } from "lucide-react"
import { useScoutingReport } from "../../lib/queries"
import { cn } from "../../lib/utils"
import PlayerAvatarIcon from "../common/PlayerAvatarIcon"
import GradeBadge from "../common/GradeBadge"
import { TeamLogoIcon } from "../common/TeamLogo"

// ─────────────────────────────────────────────────────────────────────────────
// Smart Lineup Algorithm
// ─────────────────────────────────────────────────────────────────────────────

const GRADE_NUM = { S: 4, A: 3, B: 2, C: 1 }

// Form score from last 5 matches: W=+1, D=0, L=-1, normalised to -1→+1
function calcFormScore(form) {
  if (!form || form.length === 0) return 0
  const recent = form.slice(0, 5)
  const sum = recent.reduce((acc, f) => acc + (f === "W" ? 1 : f === "L" ? -1 : 0), 0)
  return sum / recent.length  // -1 to +1
}

// Score a single pairing. Higher = better chance of winning.
// H2H  : (wins - losses) / total × 2   → -2  to +2   (strongest signal)
// Grade: grade diff × 0.4              → -1.2 to +1.2 (structural edge)
// Form : recent form × 0.6             → -0.6 to +0.6 (momentum tiebreaker)
function pairScore(myPlayer, oppPlayer, h2hLookup) {
  const h2h   = h2hLookup?.[myPlayer.id]?.[oppPlayer.id] || { wins: 0, draws: 0, losses: 0 }
  const total = h2h.wins + h2h.draws + h2h.losses
  const h2hScore   = total > 0 ? ((h2h.wins - h2h.losses) / total) * 2 : 0
  const gradeScore = ((GRADE_NUM[myPlayer.grade] ?? 1) - (GRADE_NUM[oppPlayer.grade] ?? 1)) * 0.4
  const formScore  = calcFormScore(myPlayer.form) * 0.6
  return h2hScore + gradeScore + formScore
}

// Build a score matrix and greedily assign best unmatched pairs.
// Best for LOW target wins — isolates the N easiest wins.
// ─────────────────────────────────────────────────────────────────────────────
// Assignment Algorithms
// ─────────────────────────────────────────────────────────────────────────────

// ── Shared helpers ────────────────────────────────────────────────────────────

function _winRate(p) {
  const t = (p.wins || 0) + (p.draws || 0) + (p.losses || 0)
  return t > 0 ? (p.wins || 0) / t : (calcFormScore(p.form) + 1) / 2
}

// Sort strongest first — used to split WIN vs SACRIFICE players
// (top N strongest = WIN candidates, rest = SACRIFICE)
function _strengthSort(a, b) {
  const gd = (GRADE_NUM[b.grade] ?? 1) - (GRADE_NUM[a.grade] ?? 1)
  if (gd !== 0) return gd
  const wd = _winRate(b) - _winRate(a)
  if (Math.abs(wd) > 0.05) return wd
  return calcFormScore(b.form) - calcFormScore(a.form)
}

// Sort weakest first within tier — used for within-tier picking order
// Weakest player picks first and gets the easiest available opponent.
// Strongest player picks last and absorbs whatever remains.
function _tierSort(a, b) {
  const gd = (GRADE_NUM[b.grade] ?? 1) - (GRADE_NUM[a.grade] ?? 1)
  if (gd !== 0) return gd
  const wd = _winRate(a) - _winRate(b)                  // asc — weakest first
  if (Math.abs(wd) > 0.05) return wd
  return calcFormScore(a.form) - calcFormScore(b.form)   // asc
}

function _pickBest(mp, pool, h2hLookup) {
  return pool.reduce((best, op) =>
    pairScore(mp, op, h2hLookup) > pairScore(mp, best, h2hLookup) ? op : best
  )
}

function _removeFrom(arr, item) {
  const i = arr.indexOf(item)
  if (i !== -1) arr.splice(i, 1)
}

// Valid opponent pool per grade — grade ceiling with one-tier fallback:
//   S  → non-S opponents (highest available = A). Fallback: anything.
//   C  → C first, fallback B (never A/S in WIN slots unless nothing else)
//   B  → B/C first, fallback A only if B/C exhausted (never S)
//   A  → A/B/C first, fallback S only if nothing else remains
function _validPool(mp, pool) {
  const g = mp.grade
  if (g === "S") {
    const nonS = pool.filter(op => op.grade !== "S")
    return nonS.length > 0 ? nonS : pool
  }
  if (g === "C") {
    const c = pool.filter(op => op.grade === "C")
    if (c.length > 0) return c
    const b = pool.filter(op => op.grade === "B")
    return b.length > 0 ? b : pool
  }
  if (g === "B") {
    const bc = pool.filter(op => op.grade === "B" || op.grade === "C")
    if (bc.length > 0) return bc
    const a = pool.filter(op => op.grade === "A")
    return a.length > 0 ? a : pool
  }
  // A grade: prefer equal/lower, fallback S
  const abc = pool.filter(op => (GRADE_NUM[op.grade] ?? 1) <= (GRADE_NUM[g] ?? 1))
  return abc.length > 0 ? abc : pool
}

// ── Greedy assignment (used when target < half) ───────────────────────────────
// Finds the N easiest wins for a small target. Grade ceiling enforced.
function buildGreedyAssignment(myPlayers, oppPlayers, h2hLookup) {
  const allPairs = []
  for (const mp of myPlayers) {
    const pool = _validPool(mp, oppPlayers)
    for (const op of pool) {
      allPairs.push({
        myPlayer:  mp,
        oppPlayer: op,
        score:     pairScore(mp, op, h2hLookup),
        h2h:       h2hLookup?.[mp.id]?.[op.id] || { wins: 0, draws: 0, losses: 0 },
      })
    }
  }
  allPairs.sort((a, b) => b.score - a.score)

  const usedMy  = new Set()
  const usedOpp = new Set()
  const result  = []

  for (const pair of allPairs) {
    if (usedMy.has(pair.myPlayer.id) || usedOpp.has(pair.oppPlayer.id)) continue
    result.push(pair)
    usedMy.add(pair.myPlayer.id)
    usedOpp.add(pair.oppPlayer.id)
    if (result.length === Math.min(myPlayers.length, oppPlayers.length)) break
  }

  return result
}

// ── Cascade assignment (used when target >= half) ─────────────────────────────
//
// All rules in one clean pass:
//
// WIN phase (top `target` strongest players):
//   1. MY S player  → opponent A grade only (never S vs S). Picks highest
//      non-S opponent; if none, falls back to lowest available.
//   2. MY C players → C opponents only (HARD ceiling). Fallback: B.
//      Never A/S in WIN slots for C grade players.
//   3. MY B players → B/C opponents (HARD ceiling). Fallback: A.
//      Never S in WIN slots for B grade players.
//   4. MY A players → remaining opponents. Can absorb slightly negative
//      score matchups — they are strong enough to handle it.
//   Bottom-up order (C runs before B, B before A) prevents A/B stealing
//   C-grade opponents that weaker players need.
//
// SACRIFICE phase (weakest remaining players):
//   • Face opponent S/A grade players ONLY — these are the toughest
//     remaining opponents. Opponent B/C never get free wins.
//   • Fallback to B if not enough S/A remain, then C as last resort.
//
function buildCascadeAssignment(myPlayers, oppPlayers, h2hLookup, targetWins) {
  const total  = Math.min(myPlayers.length, oppPlayers.length)
  const target = Math.min(targetWins ?? total, total)

  // Split: strongest target players = WIN candidates, rest = SACRIFICE
  const allSorted        = [...myPlayers].sort(_strengthSort)
  const winCandidates    = allSorted.slice(0, target)
  const sacrificePlayers = allSorted.slice(target)

  const remainingOpp = [...oppPlayers]
  const winPairs     = []
  const sacrificePairs = []

  // Helper: assign one player from a sorted list to their best valid opponent
  function assign(mp) {
    if (remainingOpp.length === 0) return
    const pool = _validPool(mp, remainingOpp)
    if (pool.length === 0) return
    // For S: from the valid (non-S) pool, only look at the highest grade tier
    if (mp.grade === "S") {
      const maxG = Math.max(...pool.map(op => GRADE_NUM[op.grade] ?? 1))
      const top  = pool.filter(op => (GRADE_NUM[op.grade] ?? 1) === maxG)
      const best = _pickBest(mp, top, h2hLookup)
      winPairs.push({ myPlayer: mp, oppPlayer: best, score: pairScore(mp, best, h2hLookup), h2h: h2hLookup?.[mp.id]?.[best.id] || { wins: 0, draws: 0, losses: 0 } })
      _removeFrom(remainingOpp, best)
    } else {
      const best = _pickBest(mp, pool, h2hLookup)
      winPairs.push({ myPlayer: mp, oppPlayer: best, score: pairScore(mp, best, h2hLookup), h2h: h2hLookup?.[mp.id]?.[best.id] || { wins: 0, draws: 0, losses: 0 } })
      _removeFrom(remainingOpp, best)
    }
  }

  // ── WIN phase ──────────────────────────────────────────────────────────────

  // 1. S players first (they skip opponent S)
  winCandidates
    .filter(p => p.grade === "S")
    .sort(_tierSort)
    .forEach(assign)

  // 2. Bottom-up: C → B → A
  //    C runs first to claim C opponents before B/A can take them.
  //    B runs next to claim B opponents before A can take them.
  //    A runs last and takes whatever remains (can handle tough matchups).
  //    Within each tier: weakest picks first → gets easiest available opponent.
  for (const grade of ["C", "B", "A"]) {
    winCandidates
      .filter(p => p.grade === grade)
      .sort(_tierSort)
      .forEach(assign)
  }

  // ── SACRIFICE phase ────────────────────────────────────────────────────────
  // Opponent S/A grade players absorb sacrifice matches — their weak B/C
  // players never get free wins.
  // Build sacrifice opponent pool: S first, then A, then B fallback, then C last resort.
  const saPool = [
    ...remainingOpp.filter(op => op.grade === "S"),
    ...remainingOpp.filter(op => op.grade === "A"),
    ...remainingOpp.filter(op => op.grade === "B"),
    ...remainingOpp.filter(op => op.grade === "C"),
  ]

  sacrificePlayers
    .sort(_strengthSort)
    .forEach((mp, i) => {
      const op = saPool[i]
      if (!op) return
      sacrificePairs.push({
        myPlayer:  mp,
        oppPlayer: op,
        score:     pairScore(mp, op, h2hLookup),
        h2h:       h2hLookup?.[mp.id]?.[op.id] || { wins: 0, draws: 0, losses: 0 },
      })
    })

  // WIN pairs sorted by score (best first), then SACRIFICE pairs appended.
  // Modal reads first `target` entries as WIN, rest as SACRIFICE.
  return [
    ...winPairs.sort((a, b) => b.score - a.score),
    ...sacrificePairs,
  ]
}

// Legacy alias — keeps SmartLineupModal's smartTarget calc on greedy
function buildOptimalAssignment(myPlayers, oppPlayers, h2hLookup) {
  return buildGreedyAssignment(myPlayers, oppPlayers, h2hLookup)
}



function sacrificePrediction(score) {
  if (score >  0.2) return { label: "Mostly Win", cls: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" }
  if (score > -0.3) return { label: "50-50",       cls: "text-amber-400  bg-amber-400/10  border-amber-400/20"  }
  return               { label: "Likely Loss",  cls: "text-rose-400   bg-rose-400/10   border-rose-400/20"   }
}

function scoreToPrediction(score) {
  if (score >  0.8) return { label: "Strong Win",   cls: "text-emerald-300 bg-emerald-400/15 border-emerald-400/30" }
  if (score >  0.1) return { label: "Likely Win",   cls: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" }
  if (score > -0.2) return { label: "Contested",    cls: "text-amber-400  bg-amber-400/10  border-amber-400/20"  }
  if (score > -0.6) return { label: "Tough",        cls: "text-orange-400 bg-orange-400/10 border-orange-400/20" }
  return               { label: "Likely Loss",  cls: "text-rose-400   bg-rose-400/10   border-rose-400/20"   }
}

// ─────────────────────────────────────────────────────────────────────────────
// Opponent Weakness Spotter
// ─────────────────────────────────────────────────────────────────────────────

function analyseWeaknesses(oppPlayers, myPlayers, h2hLookup, oppTeamName) {
  const insights = []
  const GRADE_NUM = { S: 4, A: 3, B: 2, C: 1 }
  const gradeGroups = { S: [], A: [], B: [], C: [] }
  for (const p of oppPlayers) gradeGroups[p.grade]?.push(p)

  // No elite players
  const myS = myPlayers.filter(p => p.grade === "S").map(p => p.name)
  if (gradeGroups.S.length === 0 && gradeGroups.A.length === 0) {
    insights.push({ type: "exploit", icon: "Trophy", title: "No Elite Players",
      detail: `${oppTeamName} has zero S or A grade players. Grade advantage across every matchup.` })
  } else if (gradeGroups.S.length === 0 && myS.length > 0) {
    insights.push({ type: "exploit", icon: "Star", title: "No S-Grade Threat",
      detail: `They have no S-grade player. ${myS.join(", ")} can dominate without fear of a grade counter.` })
  }

  // Players on cold streak (3+ losses)
  const coldPlayers = oppPlayers.filter(p => {
    const f = p.form || []
    return f.length >= 3 && f.slice(0, 3).every(x => x === "L")
  })
  if (coldPlayers.length > 0) {
    insights.push({ type: "exploit", icon: "TrendingDown", title: "Cold Streak Targets",
      detail: `${coldPlayers.map(p => p.name).join(", ")} ${coldPlayers.length > 1 ? "are" : "is"} on a 3+ match losing streak — assign strong players here for easy wins.` })
  }

  // Players my squad dominates (H2H ≥60% win rate, min 2 games)
  const dominated = []
  for (const op of oppPlayers) {
    for (const mp of myPlayers) {
      const h2h = h2hLookup[mp.id]?.[op.id]
      if (!h2h) continue
      const total = h2h.wins + h2h.draws + h2h.losses
      if (total < 2) continue
      const wr = h2h.wins / total
      if (wr >= 0.6) dominated.push({ opp: op, mp, wr: Math.round(wr * 100) })
    }
  }
  if (dominated.length > 0) {
    dominated.sort((a, b) => b.wr - a.wr)
    insights.push({ type: "exploit", icon: "Zap", title: "Historically Dominated",
      items: dominated.slice(0, 3).map(d => `${d.mp.name} wins ${d.wr}% vs ${d.opp.name}`) })
  }

  // Low win rate players (potential easy wins)
  const weak = oppPlayers.filter(p => parseInt(p.totalMatches) >= 3 && parseInt(p.winRate) < 30)
  if (weak.length >= 2) {
    insights.push({ type: "exploit", icon: "Target", title: "Low Win-Rate Players",
      detail: `${weak.map(p => p.name).join(", ")} have under 30% win rate — safe targets for your B/C players.` })
  }

  // Grade-thin squad
  const lowG = (gradeGroups.B?.length || 0) + (gradeGroups.C?.length || 0)
  const highG = (gradeGroups.S?.length || 0) + (gradeGroups.A?.length || 0)
  if (lowG > highG + 3) {
    insights.push({ type: "exploit", icon: "BarChart2", title: "Grade-Thin Squad",
      detail: `${oppTeamName} fields ${lowG} B/C players vs only ${highG} S/A. Your A-grade players should dominate the majority of matchups.` })
  }

  // Danger: hot streak players
  const hot = oppPlayers.filter(p => {
    const f = p.form || []
    return f.length >= 3 && f.slice(0, 3).every(x => x === "W")
  })
  if (hot.length > 0) {
    insights.push({ type: "danger", icon: "AlertTriangle", title: "Hot Streak Danger",
      detail: `${hot.map(p => p.name).join(", ")} ${hot.length > 1 ? "are" : "is"} on a 3+ win streak — avoid weak matchups against ${hot.length > 1 ? "them" : "this player"}.` })
  }

  // Danger: high overall win rate
  const elite = oppPlayers.filter(p => parseInt(p.winRate) >= 70 && parseInt(p.totalMatches) >= 3)
  if (elite.length > 0) {
    insights.push({ type: "danger", icon: "Shield", title: "Elite Performers",
      detail: `${elite.map(p => `${p.name} (${p.winRate}% WR)`).join(", ")} — only deploy your best against ${elite.length > 1 ? "these players" : "this player"}.` })
  }

  return insights
}

// ─────────────────────────────────────────────────────────────────────────────
// Lineup Confidence Score  (0–100)
// ─────────────────────────────────────────────────────────────────────────────

const GRADE_NUM_LC = { S: 4, A: 3, B: 2, C: 1 }

function calcFormScoreLC(form) {
  if (!form || form.length === 0) return 0
  const r = form.slice(0, 5)
  return r.reduce((a, f) => a + (f === "W" ? 1 : f === "L" ? -1 : 0), 0) / r.length
}

function pairScoreLC(mp, op, h2hLookup) {
  const h2h   = h2hLookup?.[mp.id]?.[op.id] || { wins: 0, draws: 0, losses: 0 }
  const total = h2h.wins + h2h.draws + h2h.losses
  const h2hS  = total > 0 ? ((h2h.wins - h2h.losses) / total) * 2 : 0
  const gradeS = ((GRADE_NUM_LC[mp.grade] ?? 1) - (GRADE_NUM_LC[op.grade] ?? 1)) * 0.4
  const formS  = calcFormScoreLC(mp.form) * 0.6
  return h2hS + gradeS + formS
}

function computeLineupScore(savedLineup, myPlayers, oppPlayers, h2hLookup) {
  if (!savedLineup || savedLineup.length === 0) return null
  const myById  = Object.fromEntries(myPlayers.map(p  => [String(p.id),  p]))
  const oppById = Object.fromEntries(oppPlayers.map(p => [String(p.id),  p]))

  const slots = []
  for (const s of savedLineup) {
    const mp = myById[String(s.myPlayerId)]
    const op = oppById[String(s.oppPlayerId)]
    if (!mp || !op) continue
    const score = pairScoreLC(mp, op, h2hLookup)
    const norm  = Math.max(0, Math.min(10, ((score + 3.2) / 6.4) * 10))
    slots.push({ slot: s.slot, myPlayer: mp, oppPlayer: op, score, norm,
      h2h: h2hLookup?.[mp.id]?.[op.id] || { wins: 0, draws: 0, losses: 0 } })
  }
  if (slots.length === 0) return null

  const confidence = Math.round((slots.reduce((a, s) => a + s.norm, 0) / slots.length) * 10)
  return { confidence, slots }
}

// ─────────────────────────────────────────────────────────────────────────────
// Alternative Swap Suggester
// ─────────────────────────────────────────────────────────────────────────────

function findAlternativeSwaps(slots, h2hLookup) {
  if (!slots || slots.length < 2) return []
  const improvements = []

  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i], b = slots[j]
      const current  = a.score + b.score
      const newA     = pairScoreLC(a.myPlayer, b.oppPlayer, h2hLookup)
      const newB     = pairScoreLC(b.myPlayer, a.oppPlayer, h2hLookup)
      const gain     = newA + newB - current
      if (gain > 0.15) {
        improvements.push({
          slotA: a.slot, slotB: b.slot,
          playerA: a.myPlayer.name, playerB: b.myPlayer.name,
          oppA: a.oppPlayer.name,   oppB: b.oppPlayer.name,
          gain: Math.round(gain * 8),  // scaled to 0-100 pts
          gradeA: a.myPlayer.grade,    gradeB: b.myPlayer.grade,
        })
      }
    }
  }

  improvements.sort((a, b) => b.gain - a.gain)
  return improvements.slice(0, 2)
}

// ─────────────────────────────────────────────────────────────────────────────
// Smart Lineup Modal
// ─────────────────────────────────────────────────────────────────────────────
// Smart Lineup Modal
// ─────────────────────────────────────────────────────────────────────────────
function SmartLineupModal({ myPlayers, oppPlayers, h2hLookup, oppTeamName, onApply, onClose }) {
  const total = Math.min(myPlayers.length, oppPlayers.length)

  // Greedy: best for isolating a few easy wins (low target < half)
  const greedyPairs = useMemo(
    () => buildGreedyAssignment(myPlayers, oppPlayers, h2hLookup),
    [myPlayers, oppPlayers, h2hLookup]
  )

  // Smart suggestion: count greedy pairs with positive score (realistic wins)
  const smartTarget = useMemo(
    () => Math.max(1, greedyPairs.filter(p => p.score > 0.1).length),
    [greedyPairs]
  )

  // State must come before effectiveTarget so it is defined in time
  const [strategy,   setStrategy]   = useState("smart")   // "full" | "target" | "smart"
  const [targetWins, setTargetWins] = useState(smartTarget)

  // effectiveTarget must be declared BEFORE cascadePairs (which references it)
  const effectiveTarget =
    strategy === "full"   ? total :
    strategy === "target" ? targetWins :
    smartTarget

  // Cascade: two-phase assignment, needs effectiveTarget to split WIN vs SACRIFICE
  const cascadePairs = useMemo(
    () => buildCascadeAssignment(myPlayers, oppPlayers, h2hLookup, effectiveTarget),
    [myPlayers, oppPlayers, h2hLookup, effectiveTarget]
  )

  // Switch strategy: cascade when target is half or more
  const activePairs = effectiveTarget >= Math.ceil(total / 2) ? cascadePairs : greedyPairs

  const preview = useMemo(() =>
    activePairs.map((pair, i) => ({
      ...pair,
      intent: i < effectiveTarget ? "win" : "sacrifice",
    })),
    [activePairs, effectiveTarget]
  )

  const handleApply = () => {
    onApply(preview.map(p => ({
      myPlayerId:  p.myPlayer.id,
      oppPlayerId: p.oppPlayer.id,
    })))
  }

  const STRATEGIES = [
    {
      id:    "full",
      icon:  Trophy,
      label: "Full Fix Win",
      sub:   "Maximise wins across all matchups",
      color: "text-gold border-gold/30 bg-gold/10",
      activeColor: "border-gold/60 bg-gold/15",
    },
    {
      id:    "target",
      icon:  Target,
      label: "Target Wins",
      sub:   "Choose how many wins to secure",
      color: "text-accent border-accent/30 bg-accent/10",
      activeColor: "border-accent/60 bg-accent/15",
    },
    {
      id:    "smart",
      icon:  Brain,
      label: "Smart Fix",
      sub:   "System suggests the optimal split",
      color: "text-violet-400 border-violet-400/30 bg-violet-400/10",
      activeColor: "border-violet-400/60 bg-violet-400/15",
    },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-pitch-800 border border-surface-border rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-gold" />
            <span className="text-sm font-bold text-white">Smart Lineup Planner</span>
            <span className="text-xs text-slate-500">vs {oppTeamName}</span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg hover:bg-surface flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* Strategy selector */}
          <div className="p-4 border-b border-surface-border">
            <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-3">Choose strategy</p>
            <div className="grid grid-cols-3 gap-1.5">
              {STRATEGIES.map(s => {
                const Icon = s.icon
                const isActive = strategy === s.id
                return (
                  <button
                    key={s.id}
                    onClick={() => setStrategy(s.id)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border transition-all text-center",
                      isActive ? s.color + " " + s.activeColor : "border-surface-border text-slate-400 hover:border-slate-600 hover:text-slate-300"
                    )}
                  >
                    <Icon className={cn("w-3.5 h-3.5", isActive ? "" : "text-slate-500")} />
                    <span className="text-[10px] font-bold leading-tight">{s.label}</span>
                    <span className="text-[9px] text-slate-500 leading-tight hidden sm:block">{s.sub}</span>
                  </button>
                )
              })}
            </div>

            {/* Target slider — only for "target" strategy */}
            {strategy === "target" && (
              <div className="mt-4 bg-pitch-900/60 rounded-xl p-4 border border-surface-border">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-slate-400 font-medium">Target wins</span>
                  <span className="text-lg font-extrabold font-mono text-accent">
                    {targetWins}
                    <span className="text-sm text-slate-500 font-normal ml-1">/ {total}</span>
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={total}
                  value={targetWins}
                  onChange={e => setTargetWins(parseInt(e.target.value))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer accent-accent bg-pitch-700"
                />
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-slate-600">1</span>
                  <span className="text-[10px] text-slate-600">{total}</span>
                </div>
                <p className="text-xs text-slate-500 mt-2 text-center">
                  {targetWins} hard-assigned wins · {total - targetWins} competitive sacrifice{total - targetWins !== 1 ? "s" : ""}
                </p>
              </div>
            )}

            {/* Smart fix info pill */}
            {strategy === "smart" && (
              <div className="mt-3 flex items-center gap-2 bg-violet-400/5 border border-violet-400/20 rounded-xl px-4 py-2.5">
                <Info className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
                <p className="text-xs text-violet-300">
                  System found <span className="font-bold">{smartTarget} realistic win{smartTarget !== 1 ? "s" : ""}</span> based on H2H records and grade advantages
                </p>
              </div>
            )}

            {strategy === "full" && (
              <div className="mt-3 flex items-center gap-2 bg-gold/5 border border-gold/20 rounded-xl px-4 py-2.5">
                <Info className="w-3.5 h-3.5 text-gold flex-shrink-0" />
                <p className="text-xs text-amber-200">
                  All {total} matchups assigned to maximise win probability — no sacrifice slots
                </p>
              </div>
            )}
          </div>

          {/* Lineup preview */}
          <div className="p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Lineup preview</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn(
                  "text-[9px] font-bold px-2 py-0.5 rounded-full border",
                  effectiveTarget >= Math.ceil(total / 2)
                    ? "text-violet-300 bg-violet-400/10 border-violet-400/20"
                    : "text-sky-300 bg-sky-400/10 border-sky-400/20"
                )}>
                  {effectiveTarget >= Math.ceil(total / 2) ? "⚡ Grade Cascade" : "🎯 Greedy Pick"}
                </span>
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Win</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400 inline-block" /> Sacrifice</span>
                </div>
              </div>
            </div>

            {/* Matchup cards — stacked layout works on all screen sizes */}
            <div className="space-y-2">
              {preview.map((pair, i) => {
                const pred   = scoreToPrediction(pair.score)
                const isWin  = pair.intent === "win"
                const badge  = isWin ? pred : sacrificePrediction(pair.score)
                const hasH2H = pair.h2h.wins + pair.h2h.draws + pair.h2h.losses > 0
                return (
                  <div
                    key={i}
                    className={cn(
                      "rounded-xl border-l-2 bg-pitch-900/60 px-3 py-2.5 space-y-1.5",
                      isWin ? "border-l-emerald-400/60" : "border-l-rose-400/40"
                    )}
                  >
                    {/* Top row: slot + intent + prediction */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-600 font-mono">#{i + 1}</span>
                        <span className={cn(
                          "text-[9px] font-bold px-2 py-0.5 rounded border",
                          isWin
                            ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/25"
                            : "text-rose-400 bg-rose-400/10 border-rose-400/20"
                        )}>
                          {isWin ? "🎯 WIN" : "⚡ SACRIFICE"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {hasH2H && (
                          <span className="text-[9px] text-slate-500 font-mono">
                            {pair.h2h.wins}W {pair.h2h.draws}D {pair.h2h.losses}L
                          </span>
                        )}
                        <span className={cn(
                          "text-[9px] font-bold px-2 py-0.5 rounded border",
                          badge.cls
                        )}>
                          {badge.label}
                        </span>
                      </div>
                    </div>

                    {/* Bottom row: my player vs opp player */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <span className="text-sm font-semibold text-white truncate">{pair.myPlayer.name}</span>
                        <GradeBadge grade={pair.myPlayer.grade} size="sm" />
                      </div>
                      <span className="text-[10px] text-slate-500 flex-shrink-0 font-medium">vs</span>
                      <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                        <GradeBadge grade={pair.oppPlayer.grade} size="sm" />
                        <span className="text-sm font-semibold text-white truncate">{pair.oppPlayer.name}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Summary bar */}
            <div className="mt-4 flex items-center gap-3 bg-pitch-900/80 rounded-xl px-4 py-3 border border-surface-border">
              <div className="flex-1">
                <div className="flex gap-1 mb-1.5">
                  {preview.map((p, i) => (
                    <div
                      key={i}
                      className={cn(
                        "h-1.5 rounded-full flex-1 transition-all",
                        p.intent === "win" ? "bg-emerald-400" : "bg-rose-400/50"
                      )}
                    />
                  ))}
                </div>
                <p className="text-xs text-slate-400">
                  <span className="text-emerald-400 font-semibold">{effectiveTarget} target wins</span>
                  {strategy !== "full" && (
                    <span className="text-slate-500"> + {total - effectiveTarget} competitive sacrifice{total - effectiveTarget !== 1 ? "s" : ""}</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-5 py-4 border-t border-surface-border flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl border border-surface-border text-slate-400 hover:text-white text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="flex-1 py-2 rounded-xl bg-accent hover:bg-accent-dim text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" /> Apply Lineup
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components (unchanged from original)
// ─────────────────────────────────────────────────────────────────────────────

function ThreatBadge({ level }) {
  const cfg = {
    high:   { label: "HIGH",   cls: "text-rose-400 bg-rose-400/15 border-rose-400/30" },
    medium: { label: "MEDIUM", cls: "text-amber-400 bg-amber-400/15 border-amber-400/30" },
    low:    { label: "LOW",    cls: "text-emerald-400 bg-emerald-400/15 border-emerald-400/30" },
  }
  const c = cfg[level] || cfg.low
  return <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", c.cls)}>{c.label}</span>
}

function FormDisplay({ form }) {
  if (!form || form.length === 0) return <span className="text-slate-600 text-xs">—</span>
  return (
    <div className="flex gap-0.5">
      {form.slice(0, 5).map((f, i) => (
        <span key={i} className={cn(
          "w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center",
          f === "W" ? "bg-emerald-400/20 text-emerald-400" :
          f === "D" ? "bg-amber-400/20 text-amber-400" :
                      "bg-rose-400/20 text-rose-400"
        )}>{f}</span>
      ))}
    </div>
  )
}

function H2HCell({ h2h }) {
  if (!h2h || (h2h.wins === 0 && h2h.losses === 0 && h2h.draws === 0)) {
    return <span className="text-slate-600 text-xs">No matches</span>
  }
  const dominant = h2h.wins > h2h.losses ? "win" : h2h.losses > h2h.wins ? "loss" : "even"
  return (
    <span className={cn(
      "text-xs font-bold px-2 py-1 rounded-lg border",
      dominant === "win"  ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/25" :
      dominant === "loss" ? "text-rose-400 bg-rose-400/10 border-rose-400/25" :
                            "text-amber-400 bg-amber-400/10 border-amber-400/25"
    )}>
      {h2h.wins}W {h2h.draws}D {h2h.losses}L
    </span>
  )
}

function WarningCard({ warning }) {
  const isDanger = warning.type === "danger"
  return (
    <div className={cn(
      "flex items-start gap-2.5 px-4 py-3 rounded-xl border text-sm",
      isDanger ? "bg-rose-400/5 border-rose-400/20" : "bg-emerald-400/5 border-emerald-400/20"
    )}>
      {isDanger
        ? <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
        : <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
      }
      <span className={isDanger ? "text-rose-300" : "text-emerald-300"}>{warning.text}</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export default function ScoutingReport({ myTeamId, oppTeamId, oppTeamName, onClose, onApplyRecommendations, savedLineup = [] }) {
  const { data: report, isLoading, isError } = useScoutingReport(myTeamId, oppTeamId)
  const [expandedPlayer,  setExpandedPlayer]  = useState(null)
  const [showSmartModal,  setShowSmartModal]  = useState(false)

  const weaknesses = useMemo(() => {
    if (!report) return []
    return analyseWeaknesses(report.oppPlayers, report.myPlayers, report.h2hLookup, report.oppTeam?.name || oppTeamName)
  }, [report, oppTeamName])

  const lineupAnalysis = useMemo(() => {
    if (!report || savedLineup.length === 0) return null
    return computeLineupScore(savedLineup, report.myPlayers, report.oppPlayers, report.h2hLookup)
  }, [report, savedLineup])

  const swapSuggestions = useMemo(() => {
    if (!lineupAnalysis || !report) return []
    return findAlternativeSwaps(lineupAnalysis.slots, report.h2hLookup)
  }, [lineupAnalysis, report])

  if (isLoading) {
    return (
      <div className="card p-8 text-center">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-500">Generating scouting report...</p>
      </div>
    )
  }

  if (isError || !report) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm text-slate-500">Unable to generate report</p>
      </div>
    )
  }

  const { oppTeam, oppPlayers, myPlayers, h2hLookup, teamFixtures, recommendations, warnings } = report

  const handleSmartApply = (matchups) => {
    setShowSmartModal(false)
    onApplyRecommendations?.(matchups)
  }

  return (
    <div className="space-y-5">

      {/* Smart Lineup Modal */}
      {showSmartModal && (
        <SmartLineupModal
          myPlayers={myPlayers}
          oppPlayers={oppPlayers}
          h2hLookup={h2hLookup}
          oppTeamName={oppTeam.name}
          onApply={handleSmartApply}
          onClose={() => setShowSmartModal(false)}
        />
      )}

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
          <div className="flex items-center gap-3">
            <Search className="w-5 h-5 text-accent" />
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-widest">Scouting Report</p>
              <h2 className="text-lg font-bold text-white">{oppTeam.name}</h2>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-surface flex items-center justify-center text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Team stats */}
        <div className="grid grid-cols-4 gap-px bg-surface-border/50">
          {[
            { label: "Points",        value: oppTeam.points || 0 },
            { label: "Record",        value: `${oppTeam.wins || 0}W ${oppTeam.draws || 0}D ${oppTeam.losses || 0}L` },
            { label: "Goals For",     value: oppTeam.gf || 0 },
            { label: "Goals Against", value: oppTeam.ga || 0 },
          ].map(s => (
            <div key={s.label} className="bg-pitch-900 px-4 py-3 text-center">
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className="text-sm font-bold text-white mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Key Alerts ────────────────────────────────────────────────────── */}
      {warnings.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-surface-border">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">Key Intel</h3>
          </div>
          <div className="p-4 space-y-2">
            {warnings.map((w, i) => <WarningCard key={i} warning={w} />)}
          </div>
        </div>
      )}

      {/* ── Opponent Weakness Spotter ────────────────────────────────────────── */}
      {weaknesses.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-border">
            <TrendingDown className="w-4 h-4 text-rose-400" />
            <h3 className="text-sm font-semibold text-white">Weakness Spotter</h3>
            <span className="text-[10px] text-slate-500 ml-1">— exploit these gaps</span>
          </div>
          <div className="p-3 space-y-2">
            {weaknesses.map((w, i) => {
              const isExploit = w.type === "exploit"
              return (
                <div key={i} className={cn(
                  "rounded-xl px-3 py-2.5 border",
                  isExploit ? "bg-emerald-400/5 border-emerald-400/20" : "bg-rose-400/5 border-rose-400/20"
                )}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn("text-xs font-bold", isExploit ? "text-emerald-400" : "text-rose-400")}>
                      {isExploit ? "⚡ EXPLOIT" : "⚠ DANGER"}
                    </span>
                    <span className="text-xs font-semibold text-white">{w.title}</span>
                  </div>
                  {w.detail && <p className="text-[11px] text-slate-400 leading-relaxed">{w.detail}</p>}
                  {w.items && (
                    <ul className="space-y-0.5 mt-1">
                      {w.items.map((item, ii) => (
                        <li key={ii} className="text-[11px] text-slate-400 flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-emerald-400 flex-shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Threat Assessment ─────────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-surface-border">
          <Target className="w-4 h-4 text-rose-400" />
          <h3 className="text-sm font-semibold text-white">Opponent Players — Threat Assessment</h3>
        </div>
        <div className="divide-y divide-surface-border/50">
          {oppPlayers.map(p => {
            const isExpanded = expandedPlayer === p.id
            return (
              <div key={p.id}>
                <button
                  onClick={() => setExpandedPlayer(isExpanded ? null : p.id)}
                  className="w-full flex items-center gap-2 px-4 py-3 hover:bg-surface-hover transition-colors text-left"
                >
                  <PlayerAvatarIcon player={p} />
                  <div className="flex-1 min-w-0">
                    {/* Row 1: name + grade + threat */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-semibold text-white truncate max-w-[120px]">{p.name}</span>
                      <GradeBadge grade={p.grade} size="sm" />
                      <ThreatBadge level={p.threatLevel} />
                    </div>
                    {/* Row 2: stats + form */}
                    <div className="flex items-center justify-between mt-1.5 gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] text-slate-500">MV: <span className="text-slate-300">{p.market_value}</span></span>
                        <span className="text-[10px] text-slate-500">Win: <span className="text-slate-300">{p.winRate}%</span></span>
                        <span className="text-[10px] text-slate-500">GPM: <span className="text-slate-300">{p.goalsPerMatch}</span></span>
                      </div>
                      <FormDisplay form={p.form} />
                    </div>
                  </div>
                  <ChevronDown className={cn("w-4 h-4 text-slate-500 flex-shrink-0 transition-transform", isExpanded && "rotate-180")} />
                </button>

                {isExpanded && (
                  <div className="bg-pitch-900/60 px-5 py-4 border-t border-surface-border/30">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                      <div className="bg-pitch-800 rounded-xl p-3 text-center">
                        <p className="text-lg font-bold text-white">{p.totalMatches}</p>
                        <p className="text-xs text-slate-500">Matches</p>
                      </div>
                      <div className="bg-pitch-800 rounded-xl p-3 text-center">
                        <p className="text-lg font-bold text-emerald-400">{p.wins}</p>
                        <p className="text-xs text-slate-500">Wins</p>
                      </div>
                      <div className="bg-pitch-800 rounded-xl p-3 text-center">
                        <p className="text-lg font-bold text-amber-400">{p.draws}</p>
                        <p className="text-xs text-slate-500">Draws</p>
                      </div>
                      <div className="bg-pitch-800 rounded-xl p-3 text-center">
                        <p className="text-lg font-bold text-rose-400">{p.losses}</p>
                        <p className="text-xs text-slate-500">Losses</p>
                      </div>
                    </div>

                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Your players vs {p.name}</p>
                    <div className="space-y-1.5">
                      {myPlayers.map(my => {
                        const h2h = h2hLookup[my.id]?.[p.id]
                        if (!h2h || (h2h.wins === 0 && h2h.losses === 0 && h2h.draws === 0)) return null
                        return (
                          <div key={my.id} className="flex items-center justify-between bg-pitch-800 rounded-lg px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-white">{my.name}</span>
                              <GradeBadge grade={my.grade} size="sm" />
                            </div>
                            <H2HCell h2h={h2h} />
                          </div>
                        )
                      })}
                      {myPlayers.every(my => {
                        const h2h = h2hLookup[my.id]?.[p.id]
                        return !h2h || (h2h.wins === 0 && h2h.losses === 0 && h2h.draws === 0)
                      }) && (
                        <p className="text-xs text-slate-600 py-2">No head-to-head history with any of your players</p>
                      )}
                    </div>

                    {p.imageUrl && (
                      <div className="mt-4">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{p.name}'s Squad</p>
                        <img src={p.imageUrl} alt={`${p.name} squad`}
                          className="w-full max-w-md aspect-[20/9] object-cover rounded-xl border border-surface-border" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Recommended Matchups + Smart Lineup CTA ───────────────────────── */}
      {recommendations.length > 0 && (
        <div className="card overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-surface-border space-y-2">
            {/* Row 1: icon + title */}
            <div className="flex items-center gap-2">
              <Swords className="w-4 h-4 text-accent flex-shrink-0" />
              <h3 className="text-sm font-semibold text-white">Recommended Matchups</h3>
            </div>
            {/* Row 2: subtitle + button side by side */}
            <div className="flex items-center justify-between gap-2 ml-6">
              <p className="text-[10px] text-slate-500 leading-tight">Based on H2H records &amp; grade advantage</p>
              {onApplyRecommendations && (
                <button
                  onClick={() => setShowSmartModal(true)}
                  className="flex items-center gap-1 text-[10px] font-semibold text-white bg-accent hover:bg-accent-dim px-2 py-1 rounded-md transition-all flex-shrink-0"
                >
                  <Zap className="w-2.5 h-2.5" /> Smart Lineup
                </button>
              )}
            </div>
          </div>

          <div className="divide-y divide-surface-border/50">
            {recommendations.map((rec, i) => {
              const h2h    = rec.h2h
              const hasH2H = h2h.wins + h2h.losses + h2h.draws > 0
              return (
                <div key={i} className="px-4 py-2.5 space-y-1.5">

                  {/* Line 1: slot · reason · threat · H2H */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[10px] text-slate-600 font-mono flex-shrink-0">#{i + 1}</span>
                      <span className="text-[10px] text-slate-400 truncate">{rec.reason}</span>
                      <ThreatBadge level={rec.oppPlayer.threatLevel} />
                    </div>
                    {hasH2H && <H2HCell h2h={h2h} />}
                  </div>

                  {/* Line 2: MyPlayer [Grade]  vs  [Grade] OppPlayer — names get full space */}
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <span className="text-sm font-semibold text-white truncate">{rec.myPlayer.name}</span>
                      <GradeBadge grade={rec.myPlayer.grade} size="sm" />
                    </div>
                    <span className="text-[10px] text-slate-500 flex-shrink-0 px-1">vs</span>
                    <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                      <GradeBadge grade={rec.oppPlayer.grade} size="sm" />
                      <span className="text-sm font-semibold text-white truncate">{rec.oppPlayer.name}</span>
                    </div>
                  </div>

                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Lineup Confidence Score + Swap Suggester ──────────────────────── */}
      {lineupAnalysis && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-border">
            <BarChart2 className="w-4 h-4 text-violet-400" />
            <h3 className="text-sm font-semibold text-white">Lineup Confidence</h3>
            <span className="text-[10px] text-slate-500 ml-1">— based on saved lineup</span>
          </div>

          {/* Score headline */}
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-end justify-between mb-2">
              <div>
                <span className={cn(
                  "text-4xl font-black font-mono",
                  lineupAnalysis.confidence >= 70 ? "text-emerald-400" :
                  lineupAnalysis.confidence >= 50 ? "text-amber-400" : "text-rose-400"
                )}>
                  {lineupAnalysis.confidence}
                </span>
                <span className="text-lg text-slate-500 ml-1">/100</span>
              </div>
              <span className={cn(
                "text-xs font-bold px-3 py-1 rounded-full border",
                lineupAnalysis.confidence >= 70 ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/25" :
                lineupAnalysis.confidence >= 55 ? "text-amber-400 bg-amber-400/10 border-amber-400/25" :
                                                   "text-rose-400 bg-rose-400/10 border-rose-400/25"
              )}>
                {lineupAnalysis.confidence >= 70 ? "Strong" :
                 lineupAnalysis.confidence >= 55 ? "Decent" :
                 lineupAnalysis.confidence >= 40 ? "Risky" : "Weak"}
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full h-2 bg-pitch-700 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  lineupAnalysis.confidence >= 70 ? "bg-emerald-400" :
                  lineupAnalysis.confidence >= 50 ? "bg-amber-400" : "bg-rose-400"
                )}
                style={{ width: `${lineupAnalysis.confidence}%` }}
              />
            </div>
          </div>

          {/* Per-slot breakdown */}
          <div className="px-4 pb-3 space-y-1.5">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-2">Matchup breakdown</p>
            {lineupAnalysis.slots.map((s, i) => {
              const pct = Math.round(s.norm * 10)
              const hasH2H = s.h2h.wins + s.h2h.draws + s.h2h.losses > 0
              return (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[10px] text-slate-600 font-mono w-5">#{s.slot}</span>
                      <span className="text-[11px] font-medium text-white truncate max-w-[80px]">{s.myPlayer.name}</span>
                      <GradeBadge grade={s.myPlayer.grade} size="sm" />
                      <span className="text-[9px] text-slate-600">vs</span>
                      <span className="text-[11px] text-slate-300 truncate max-w-[80px]">{s.oppPlayer.name}</span>
                      <GradeBadge grade={s.oppPlayer.grade} size="sm" />
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {hasH2H && (
                        <span className="text-[9px] text-slate-500 font-mono">{s.h2h.wins}W{s.h2h.draws}D{s.h2h.losses}L</span>
                      )}
                      <span className={cn(
                        "text-[9px] font-bold w-8 text-right",
                        pct >= 70 ? "text-emerald-400" : pct >= 45 ? "text-amber-400" : "text-rose-400"
                      )}>{pct}%</span>
                    </div>
                  </div>
                  <div className="ml-5 h-1 bg-pitch-700 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        pct >= 70 ? "bg-emerald-400" : pct >= 45 ? "bg-amber-400" : "bg-rose-400"
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Swap suggestions */}
          {swapSuggestions.length > 0 && (
            <div className="border-t border-surface-border px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <ArrowRightLeft className="w-3.5 h-3.5 text-sky-400" />
                <p className="text-xs font-semibold text-white">Suggested Swaps</p>
                <span className="text-[10px] text-slate-500">— improve your score</span>
              </div>
              <div className="space-y-2">
                {swapSuggestions.map((sw, i) => (
                  <div key={i} className="bg-sky-400/5 border border-sky-400/20 rounded-xl px-3 py-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-sky-400">SWAP #{i + 1}</span>
                      <span className="text-[10px] font-bold text-emerald-400">+{sw.gain} pts</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-semibold text-white">{sw.playerA}</span>
                      <GradeBadge grade={sw.gradeA} size="sm" />
                      <ArrowRightLeft className="w-2.5 h-2.5 text-sky-400 flex-shrink-0" />
                      <span className="text-[11px] font-semibold text-white">{sw.playerB}</span>
                      <GradeBadge grade={sw.gradeB} size="sm" />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {sw.playerA} → {sw.oppB} · {sw.playerB} → {sw.oppA}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Past Meetings ─────────────────────────────────────────────────── */}
      {teamFixtures.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-surface-border">
            <Shield className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-semibold text-white">Past Meetings</h3>
          </div>
          <div className="divide-y divide-surface-border/50">
            {teamFixtures.map((f, i) => {
              const myScore  = f.isHome ? f.homeScore : f.awayScore
              const oppScore = f.isHome ? f.awayScore : f.homeScore
              const result = myScore > oppScore ? "win" : oppScore > myScore ? "loss" : "draw"
              return (
                <div key={i} className="flex items-center gap-3 px-5 py-3">
                  <span className="text-xs text-slate-600 w-20 flex-shrink-0">
                    {f.date ? new Date(f.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : `R${f.round}`}
                  </span>
                  <span className="text-sm text-slate-400 flex-1">{f.homeTeam} vs {f.awayTeam}</span>
                  <span className="text-sm font-mono font-bold text-white">
                    {f.homeScore ?? "?"} - {f.awayScore ?? "?"}
                  </span>
                  <span className={cn(
                    "text-xs font-bold px-2 py-0.5 rounded border",
                    result === "win"  ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/25" :
                    result === "loss" ? "text-rose-400 bg-rose-400/10 border-rose-400/25" :
                                        "text-amber-400 bg-amber-400/10 border-amber-400/25"
                  )}>
                    {result.toUpperCase()}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}