import { useState, useMemo } from "react"
import { Shield, AlertTriangle, CheckCircle, Swords, TrendingUp, Target, ChevronDown, X, Search, Trophy, Zap, Brain, Check, Info } from "lucide-react"
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
function buildGreedyAssignment(myPlayers, oppPlayers, h2hLookup) {
  // Grade ceiling: prefer equal/lower grade opponents; fallback to lowest available
  const allPairs = []
  for (const mp of myPlayers) {
    const myG        = GRADE_NUM[mp.grade] ?? 1
    const validOpps  = oppPlayers.filter(op => (GRADE_NUM[op.grade] ?? 1) <= myG)
    const pool       = validOpps.length > 0 ? validOpps : oppPlayers // fallback
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

  return result // sorted best → worst
}

// Grade-cascade assignment (used when target >= half).
//
// TWO-PHASE assignment based on targetWins:
//
// Phase 1 — WIN players (top `targetWins` strongest):
//   • S first → strongest available opponent (A grade)
//   • Then bottom-up: C claims C, B claims B/C, A claims A/B
//   • Grade ceiling enforced (no player faces higher grade)
//   → High scores → WIN slots
//
// Phase 2 — SACRIFICE players (remaining weakest):
//   • Assigned to the STRONGEST remaining opponents (grade ceiling lifted)
//   • Opponent's tough A/B players absorb the sacrifice matches
//   • Opp's weak C players never get free wins from sacrifice slots
//   → Low scores → SACRIFICE slots
function buildCascadeAssignment(myPlayers, oppPlayers, h2hLookup, targetWins) {

  function myWinRate(p) {
    const total = (p.wins || 0) + (p.draws || 0) + (p.losses || 0)
    if (total > 0) return (p.wins || 0) / total
    return (calcFormScore(p.form) + 1) / 2
  }

  function strengthSort(a, b) {
    const gd = (GRADE_NUM[b.grade] ?? 1) - (GRADE_NUM[a.grade] ?? 1)
    if (gd !== 0) return gd
    const wd = myWinRate(b) - myWinRate(a)
    if (Math.abs(wd) > 0.05) return wd
    return calcFormScore(b.form) - calcFormScore(a.form)
  }

  function pickBest(mp, pool) {
    return pool.reduce((best, op) =>
      pairScore(mp, op, h2hLookup) > pairScore(mp, best, h2hLookup) ? op : best
    )
  }

  function removeFrom(arr, item) {
    const i = arr.indexOf(item); if (i !== -1) arr.splice(i, 1)
  }

  const total  = Math.min(myPlayers.length, oppPlayers.length)
  const target = Math.min(targetWins ?? total, total)

  // Split players: strongest `target` = WIN, weakest rest = SACRIFICE
  const allSorted      = [...myPlayers].sort(strengthSort)
  const winPlayers     = allSorted.slice(0, target)
  const sacrificePlayers = allSorted.slice(target)

  const remainingOpp = [...oppPlayers]
  const winPairs     = []

  // ── Phase 1: WIN assignments (bottom-up tier, grade ceiling) ─────────────

  function assignWinGroup(players) {
    const sorted = [...players].sort(strengthSort)
    for (const mp of sorted) {
      if (remainingOpp.length === 0) break
      const myG   = GRADE_NUM[mp.grade] ?? 1
      const valid = remainingOpp.filter(op => (GRADE_NUM[op.grade] ?? 1) <= myG)
      const pool  = valid.length > 0 ? valid : (() => {
        const minG = Math.min(...remainingOpp.map(op => GRADE_NUM[op.grade] ?? 1))
        return remainingOpp.filter(op => (GRADE_NUM[op.grade] ?? 1) === minG)
      })()
      const best = pickBest(mp, pool)
      winPairs.push({
        myPlayer:  mp,
        oppPlayer: best,
        score:     pairScore(mp, best, h2hLookup),
        h2h:       h2hLookup?.[mp.id]?.[best.id] || { wins: 0, draws: 0, losses: 0 },
      })
      removeFrom(remainingOpp, best)
    }
  }

  // S win players: strongest available opponent
  const sWin = winPlayers.filter(p => p.grade === "S").sort(strengthSort)
  for (const mp of sWin) {
    if (remainingOpp.length === 0) break
    const maxG   = Math.max(...remainingOpp.map(op => GRADE_NUM[op.grade] ?? 1))
    const topOpp = remainingOpp.filter(op => (GRADE_NUM[op.grade] ?? 1) === maxG)
    const best   = pickBest(mp, topOpp)
    winPairs.push({
      myPlayer:  mp,
      oppPlayer: best,
      score:     pairScore(mp, best, h2hLookup),
      h2h:       h2hLookup?.[mp.id]?.[best.id] || { wins: 0, draws: 0, losses: 0 },
    })
    removeFrom(remainingOpp, best)
  }

  // C → B → A win players (bottom-up so C claims C first)
  for (const grade of ["C", "B", "A"]) {
    const tier = winPlayers.filter(p => p.grade === grade)
    if (tier.length > 0) assignWinGroup(tier)
  }

  // ── Phase 2: SACRIFICE assignments (strongest remaining opp, no grade ceiling)
  // Opp sorted strongest first — tough A/B players absorb sacrifice matches,
  // their weak C players don't get free wins.
  const sacrificePairs = []
  const sortedRemainingOpp = [...remainingOpp].sort((a, b) =>
    (GRADE_NUM[b.grade] ?? 1) - (GRADE_NUM[a.grade] ?? 1)
  )
  const sacrificeSorted = [...sacrificePlayers].sort(strengthSort) // weakest last

  for (let i = 0; i < sacrificeSorted.length; i++) {
    const mp = sacrificeSorted[i]
    if (sortedRemainingOpp.length === 0) break
    // Pair with next strongest remaining opponent
    const op = sortedRemainingOpp.shift()
    sacrificePairs.push({
      myPlayer:  mp,
      oppPlayer: op,
      score:     pairScore(mp, op, h2hLookup),
      h2h:       h2hLookup?.[mp.id]?.[op.id] || { wins: 0, draws: 0, losses: 0 },
    })
  }

  // WIN pairs first (sorted by score desc), then SACRIFICE pairs
  // Modal reads first `target` as WIN, rest as SACRIFICE — order matters
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-pitch-800 border border-surface-border rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">

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
            <div className="grid grid-cols-3 gap-2">
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
                    <Icon className={cn("w-4 h-4", isActive ? "" : "text-slate-500")} />
                    <span className="text-xs font-bold leading-tight">{s.label}</span>
                    <span className="text-[10px] text-slate-500 leading-tight">{s.sub}</span>
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
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Lineup preview</p>
              <div className="flex items-center gap-3">
                <span className={cn(
                  "text-[9px] font-bold px-2 py-0.5 rounded-full border",
                  effectiveTarget >= Math.ceil(total / 2)
                    ? "text-violet-300 bg-violet-400/10 border-violet-400/20"
                    : "text-sky-300 bg-sky-400/10 border-sky-400/20"
                )}>
                  {effectiveTarget >= Math.ceil(total / 2) ? "⚡ Grade Cascade" : "🎯 Greedy Pick"}
                </span>
                <div className="flex items-center gap-3 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Win target</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400 inline-block" /> Sacrifice</span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              {preview.map((pair, i) => {
                const pred  = scoreToPrediction(pair.score)
                const isWin = pair.intent === "win"
                const hasH2H = pair.h2h.wins + pair.h2h.draws + pair.h2h.losses > 0
                return (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl border-l-2 bg-pitch-900/60",
                      isWin ? "border-l-emerald-400/60" : "border-l-rose-400/40"
                    )}
                  >
                    {/* Slot number */}
                    <span className="text-xs text-slate-600 font-mono w-5 flex-shrink-0">#{i + 1}</span>

                    {/* Intent badge */}
                    <span className={cn(
                      "text-[9px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 w-16 text-center",
                      isWin
                        ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/25"
                        : "text-rose-400 bg-rose-400/10 border-rose-400/20"
                    )}>
                      {isWin ? "🎯 WIN" : "⚡ SACRIFICE"}
                    </span>

                    {/* My player */}
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <span className="text-sm text-white font-medium truncate">{pair.myPlayer.name}</span>
                      <GradeBadge grade={pair.myPlayer.grade} size="sm" />
                    </div>

                    <span className="text-xs text-slate-600 flex-shrink-0">vs</span>

                    {/* Opp player */}
                    <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                      <GradeBadge grade={pair.oppPlayer.grade} size="sm" />
                      <span className="text-sm text-white font-medium truncate">{pair.oppPlayer.name}</span>
                    </div>

                    {/* H2H summary */}
                    {hasH2H && (
                      <span className="text-[10px] text-slate-500 flex-shrink-0 w-14 text-right font-mono">
                        {pair.h2h.wins}W {pair.h2h.draws}D {pair.h2h.losses}L
                      </span>
                    )}

                    {/* Prediction badge */}
                    {(() => {
                      const badge = isWin ? pred : sacrificePrediction(pair.score)
                      return (
                        <span className={cn(
                          "text-[9px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 w-20 text-center",
                          badge.cls
                        )}>
                          {badge.label}
                        </span>
                      )
                    })()}
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
export default function ScoutingReport({ myTeamId, oppTeamId, oppTeamName, onClose, onApplyRecommendations }) {
  const { data: report, isLoading, isError } = useScoutingReport(myTeamId, oppTeamId)
  const [expandedPlayer,  setExpandedPlayer]  = useState(null)
  const [showSmartModal,  setShowSmartModal]  = useState(false)

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
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-surface-hover transition-colors text-left"
                >
                  <PlayerAvatarIcon player={p} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{p.name}</span>
                      <GradeBadge grade={p.grade} size="sm" />
                      <ThreatBadge level={p.threatLevel} />
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-slate-500">MV: <span className="text-slate-300">{p.market_value}</span></span>
                      <span className="text-xs text-slate-500">Win: <span className="text-slate-300">{p.winRate}%</span></span>
                      <span className="text-xs text-slate-500">GPM: <span className="text-slate-300">{p.goalsPerMatch}</span></span>
                    </div>
                  </div>
                  <FormDisplay form={p.form} />
                  <ChevronDown className={cn("w-4 h-4 text-slate-500 transition-transform", isExpanded && "rotate-180")} />
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
          <div className="flex items-center gap-2 px-5 py-3 border-b border-surface-border">
            <Swords className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold text-white">Recommended Matchups</h3>
            <span className="text-xs text-slate-500 ml-1 flex-1">— based on H2H records & grade advantage</span>
            {onApplyRecommendations && (
              <button
                onClick={() => setShowSmartModal(true)}
                className="flex items-center gap-1.5 text-xs font-semibold text-white bg-accent hover:bg-accent-dim px-3 py-1.5 rounded-lg transition-all flex-shrink-0"
              >
                <Zap className="w-3 h-3" /> Smart Lineup
              </button>
            )}
          </div>
          <div className="divide-y divide-surface-border/50">
            {recommendations.map((rec, i) => {
              const h2h = rec.h2h
              const hasH2H = h2h.wins + h2h.losses + h2h.draws > 0
              return (
                <div key={i} className="flex items-center gap-3 px-5 py-3">
                  <span className="text-xs text-slate-600 font-mono w-6">#{i + 1}</span>
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <span className="text-sm font-medium text-white truncate">{rec.myPlayer.name}</span>
                    <GradeBadge grade={rec.myPlayer.grade} size="sm" />
                  </div>
                  <div className="flex flex-col items-center px-3">
                    <span className="text-xs text-slate-600">vs</span>
                    {hasH2H && <H2HCell h2h={h2h} />}
                  </div>
                  <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                    <span className="text-sm font-medium text-white truncate">{rec.oppPlayer.name}</span>
                    <GradeBadge grade={rec.oppPlayer.grade} size="sm" />
                    <ThreatBadge level={rec.oppPlayer.threatLevel} />
                  </div>
                  <span className="text-[10px] text-slate-500 w-28 text-right flex-shrink-0">{rec.reason}</span>
                </div>
              )
            })}
          </div>
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