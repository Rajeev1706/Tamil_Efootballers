import { useState, useMemo } from "react"
import { cn } from "../../../lib/utils"
import { useTeams, useFixtures } from "../../../lib/queries"
import { AlertTriangle, CheckCircle, TrendingUp, TrendingDown, Wallet, Target, Zap, BarChart2, ArrowUp, Trophy } from "lucide-react"
import GradeBadge from "../../common/GradeBadge"

const GRADE_NUM   = { S: 4, A: 3, B: 2, C: 1 }
const GRADES      = ["S","A","B","C"]
const GRADE_COLOR = { S: "text-gold", A: "text-emerald-400", B: "text-sky-400", C: "text-slate-400" }
const MV_AVG      = { S: 185, A: 110, B: 65, C: 40 }


// ─────────────────────────────────────────────────────────────────────────────
// Feature 8: Season Simulation
// ─────────────────────────────────────────────────────────────────────────────

function simulateSeason(teams, allPlayers, fixtures, myTeamId, myPlayers, targets) {
  if (!teams.length || !fixtures.length) return []

  // Grade strength per team (avg GRADE_NUM of squad)
  const strength = {}
  for (const t of teams) {
    const squad = allPlayers.filter(p => p.teamId === t.id)
    strength[t.id] = squad.length
      ? squad.reduce((a, p) => a + (GRADE_NUM[p.grade]||1), 0) / squad.length
      : 2
  }

  // Boost my team with planned targets (must_haves + wants)
  if (myTeamId && targets.length > 0) {
    const planned = [...myPlayers, ...targets.map(t => ({ grade: t.grade }))]
    strength[myTeamId] = planned.reduce((a, p) => a + (GRADE_NUM[p.grade]||1), 0) / planned.length
  }

  // Current points as baseline
  const pts = {}
  for (const t of teams) pts[t.id] = Number(t.points) || 0

  // Project remaining fixtures
  const remaining = fixtures.filter(f => f.status !== "completed")
  for (const f of remaining) {
    const hs = strength[f.homeTeamId] || 2
    const as_ = strength[f.awayTeamId] || 2
    const diff = hs - as_
    // Logistic win prob
    const homeWin = 1 / (1 + Math.exp(-diff * 1.8))
    const awayWin = 1 - homeWin
    const drawP   = 0.18
    const homeAdj = (homeWin - drawP / 2) * 0.85
    const awayAdj = (awayWin - drawP / 2) * 0.85
    pts[f.homeTeamId] = (pts[f.homeTeamId] || 0) + homeAdj * 3 + drawP * 1
    pts[f.awayTeamId] = (pts[f.awayTeamId] || 0) + awayAdj * 3 + drawP * 1
  }

  return teams
    .map(t => ({ ...t, projectedPts: Math.round(pts[t.id] || 0), currentPts: Number(t.points) || 0 }))
    .sort((a, b) => b.projectedPts - a.projectedPts)
    .map((t, i) => ({ ...t, projectedPosition: i + 1 }))
}

function formWinRate(form) {
  if (!form || !form.length) return 0
  return form.filter(f => f === "W").length / form.length
}

// Squad theoretical win score (avg grade × win rate blend)
function squadWinScore(players) {
  if (!players.length) return 0
  const avgGrade = players.reduce((a,p) => a + (GRADE_NUM[p.grade]||1), 0) / players.length
  const avgWR    = players.reduce((a,p) => a + formWinRate(p.form), 0) / players.length
  return Math.round((avgGrade / 4 * 60 + avgWR * 40) * 100) / 100
}

export default function SquadPlanning({ myPlayers, allPlayers, myTeamId, totalBudget, targets }) {
  const { data: allTeams  = [] } = useTeams()
  const { data: allFixtures = [] } = useFixtures()
  const [ideal, setIdeal] = useState({ S: 1, A: 3, B: 4, C: 2 })

  const current  = useMemo(() => GRADES.reduce((acc,g) => { acc[g]=myPlayers.filter(p=>p.grade===g).length; return acc }, {}), [myPlayers])
  const targeted = useMemo(() => GRADES.reduce((acc,g) => { acc[g]=targets.filter(t=>t.grade===g).length; return acc }, {}), [targets])
  const gap      = useMemo(() => GRADES.reduce((acc,g) => { acc[g]=Math.max(0,ideal[g]-current[g]-targeted[g]); return acc }, {}), [ideal,current,targeted])
  const currentScore = useMemo(() => squadWinScore(myPlayers), [myPlayers])

  // Feature 8: Season simulation
  const simulation = useMemo(() =>
    simulateSeason(allTeams, allPlayers, allFixtures, myTeamId, myPlayers, targets)
  , [allTeams, allPlayers, allFixtures, myTeamId, myPlayers, targets])

  const mySimRow = simulation.find(t => t.id === myTeamId)
  const myCurrentPos = allTeams.findIndex(t => t.id === myTeamId) + 1

  // ── Feature 6: Optimal Squad Builder ──────────────────────────────────────
  const optimalCombos = useMemo(() => {
    if (!totalBudget) return []
    const combos = []
    for (let s = 0; s <= 2; s++)
      for (let a = 1; a <= 5; a++)
        for (let b = 1; b <= 6; b++) {
          const c = 10 - s - a - b
          if (c < 0 || c > 5) continue
          const estCost = s*MV_AVG.S + a*MV_AVG.A + b*MV_AVG.B + c*MV_AVG.C
          // Adjust for current squad (only budget needed players)
          const toAcquire = { S: Math.max(0,s-current.S), A: Math.max(0,a-current.A), B: Math.max(0,b-current.B), C: Math.max(0,c-current.C) }
          const auctionCost = toAcquire.S*MV_AVG.S + toAcquire.A*MV_AVG.A + toAcquire.B*MV_AVG.B + toAcquire.C*MV_AVG.C
          if (auctionCost > totalBudget * 1.1) continue
          const gradeScore = (s*4 + a*3 + b*2 + c*1) / 10
          combos.push({ s, a, b, c, auctionCost, gradeScore, toAcquire })
        }
    return combos.sort((x,y) => y.gradeScore - x.gradeScore).slice(0, 3)
  }, [totalBudget, current])

  // ── Feature 7: Grade Upgrade Impact ───────────────────────────────────────
  const upgradeImpact = useMemo(() => {
    return GRADES.slice(1).map(g => {
      const prev    = GRADES[GRADES.indexOf(g)-1]
      const current_wr = myPlayers.length ? myPlayers.reduce((a,p)=>a+formWinRate(p.form),0)/myPlayers.length : 0
      // Simulate replacing worst player of grade g with grade prev
      const worstOfGrade = myPlayers.filter(p=>p.grade===g).sort((a,b)=>formWinRate(a.form)-formWinRate(b.form))[0]
      if (!worstOfGrade) return null
      const without = myPlayers.filter(p=>p.id!==worstOfGrade.id)
      const withUpgrade = [...without, { grade: prev, form: ["W","W","D","W","L"] }]
      const newScore = squadWinScore(withUpgrade)
      const gain = +(newScore - currentScore).toFixed(2)
      return { from: g, to: prev, player: worstOfGrade, gain, costEst: MV_AVG[prev] - MV_AVG[g] }
    }).filter(Boolean).sort((a,b)=>b.gain-a.gain)
  }, [myPlayers, currentScore])

  // ── Feature 9: Budget Efficiency Score ────────────────────────────────────
  const efficiencyRanking = useMemo(() => {
    return targets
      .filter(t => t.maxBid && t.maxBid > 0)
      .map(t => {
        const wr = formWinRate(t.form)
        const efficiency = (wr * 100) / t.maxBid * 10
        const mvRatio = t.maxBid / (MV_AVG[t.grade]||80)
        return { ...t, wr, efficiency: +efficiency.toFixed(2), mvRatio: +mvRatio.toFixed(2) }
      })
      .sort((a,b) => b.efficiency - a.efficiency)
  }, [targets])

  // ── Squad Gap Analyser ─────────────────────────────────────────────────────
  const weaknesses = useMemo(() => {
    const issues = []
    if (current.S === 0) issues.push({ type:"critical", msg:"No S-grade player — priority target. Without one you lose every top matchup." })
    if ((current.C/Math.max(myPlayers.length,1)) > 0.4) issues.push({ type:"warning", msg:`${current.C} C-grade players (${Math.round(current.C/myPlayers.length*100)}% of squad) — high vulnerability to A-grade opponents.` })
    if (current.A+current.S < 2) issues.push({ type:"warning", msg:"Fewer than 2 elite (S/A) players — you'll struggle against strong squads in must-win fixtures." })
    GRADES.forEach(g => { if (ideal[g]>0 && current[g]===0 && gap[g]>0) issues.push({ type:"info", msg:`Need ${gap[g]} ${g}-grade player${gap[g]>1?"s":""} for your ideal formation.` }) })
    const avgFormWR = myPlayers.length ? myPlayers.reduce((a,p)=>a+formWinRate(p.form),0)/myPlayers.length : 0
    if (avgFormWR < 0.4) issues.push({ type:"warning", msg:`Squad average form win rate is only ${Math.round(avgFormWR*100)}% — multiple players are cold. Prioritise form in auction picks.` })
    if (issues.length === 0) issues.push({ type:"success", msg:"Squad composition looks healthy based on your formation plan." })
    return issues
  }, [current, ideal, gap, myPlayers])

  // ── Budget Allocation Advisor ──────────────────────────────────────────────
  const allocation = useMemo(() => {
    if (!totalBudget) return null
    const mustTotal = targets.filter(t=>t.priority==="must_have").reduce((a,t)=>a+(t.maxBid||MV_AVG[t.grade]||80),0)
    const wantTotal = targets.filter(t=>t.priority==="want").reduce((a,t)=>a+(t.maxBid||MV_AVG[t.grade]||80),0)
    return { mustTotal, wantTotal, eliteBudget: Math.round(totalBudget*.55), midBudget: Math.round(totalBudget*.30), buffer: Math.round(totalBudget*.15) }
  }, [totalBudget, targets])

  return (
    <div className="space-y-4">

      {/* Feature 8: Season Simulation */}
      {mySimRow && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-border">
            <Trophy className="w-4 h-4 text-gold" />
            <h3 className="text-sm sm:text-sm font-bold text-white">Season Position Simulation</h3>
            <span className="text-[10px] sm:text-sm text-slate-500 ml-1">— projected final standing with planned squad</span>
          </div>
          <div className="p-4">
            {/* My projected position highlight */}
            <div className="flex items-center gap-4 mb-4 bg-pitch-900/60 rounded-xl p-3 border border-surface-border">
              <div className="text-center">
                <p className="text-[10px] sm:text-sm text-slate-500">Current</p>
                <p className="text-2xl font-black text-slate-400">#{myCurrentPos}</p>
              </div>
              <div className="flex-1 flex items-center justify-center gap-2">
                {mySimRow.projectedPosition < myCurrentPos
                  ? <TrendingUp className="w-5 h-5 text-emerald-400"/>
                  : mySimRow.projectedPosition > myCurrentPos
                  ? <TrendingDown className="w-5 h-5 text-rose-400"/>
                  : <span className="text-slate-500 text-lg">→</span>
                }
              </div>
              <div className="text-center">
                <p className="text-[10px] sm:text-sm text-slate-500">Projected</p>
                <p className={cn("text-2xl font-black",
                  mySimRow.projectedPosition <= 2 ? "text-gold" :
                  mySimRow.projectedPosition <= 4 ? "text-emerald-400" : "text-slate-300"
                )}>#{mySimRow.projectedPosition}</p>
              </div>
              <div className="text-center ml-2">
                <p className="text-[10px] sm:text-sm text-slate-500">Proj pts</p>
                <p className="text-lg font-bold text-white font-mono">{mySimRow.projectedPts}</p>
              </div>
            </div>

            {/* Full projected table */}
            <div className="space-y-1">
              {simulation.map((t, i) => {
                const isMe = t.id === myTeamId
                const moved = t.projectedPosition - (allTeams.findIndex(at => at.id === t.id) + 1)
                return (
                  <div key={t.id} className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg",
                    isMe ? "bg-accent/10 border border-accent/25" : "bg-pitch-900/40"
                  )}>
                    <span className={cn("text-xs sm:text-sm font-bold w-5 text-center",
                      i===0?"text-gold":i<=3?"text-emerald-400":"text-slate-500"
                    )}>#{i+1}</span>
                    <span className={cn("text-xs sm:text-sm flex-1 truncate", isMe?"text-white font-semibold":"text-slate-300")}>{t.name}</span>
                    {moved < 0 && <span className="text-[9px] sm:text-sm sm:text-sm text-emerald-400 font-bold">▲{Math.abs(moved)}</span>}
                    {moved > 0 && <span className="text-[9px] sm:text-sm sm:text-sm text-rose-400 font-bold">▼{moved}</span>}
                    <span className={cn("text-xs sm:text-sm font-mono font-bold", isMe?"text-accent":"text-slate-400")}>{t.projectedPts}pts</span>
                  </div>
                )
              })}
            </div>
            <p className="text-[9px] sm:text-sm sm:text-sm text-slate-600 mt-2 text-center">Simulation based on squad grade strength vs remaining fixtures · Not a guarantee</p>
          </div>
        </div>
      )}

      {/* Formation Planner */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-border">
          <Target className="w-4 h-4 text-accent" />
          <h3 className="text-sm sm:text-sm font-bold text-white">Formation Planner</h3>
          <span className="text-[10px] sm:text-sm text-slate-500 ml-auto">Squad score: <span className="text-white font-bold">{currentScore.toFixed(1)}</span>/100</span>
        </div>
        <div className="p-4 space-y-3">
          {GRADES.map(g => (
            <div key={g} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GradeBadge grade={g} size="sm" />
                  <span className="text-xs sm:text-sm text-slate-400">
                    Have <span className={cn("font-bold", GRADE_COLOR[g])}>{current[g]}</span>
                    {" · "}Target <span className="font-bold text-accent">{targeted[g]}</span>
                    {gap[g] > 0 && <span className="text-rose-400 font-bold"> · Need {gap[g]}</span>}
                    {gap[g] === 0 && current[g]+targeted[g] >= ideal[g] && <span className="text-emerald-400 font-bold"> ✓</span>}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={()=>setIdeal(p=>({...p,[g]:Math.max(0,p[g]-1)}))} className="w-6 h-6 rounded bg-pitch-700 text-slate-400 hover:text-white font-bold">−</button>
                  <span className={cn("text-sm sm:text-sm font-bold w-4 text-center", GRADE_COLOR[g])}>{ideal[g]}</span>
                  <button onClick={()=>setIdeal(p=>({...p,[g]:Math.min(6,p[g]+1)}))} className="w-6 h-6 rounded bg-pitch-700 text-slate-400 hover:text-white font-bold">+</button>
                </div>
              </div>
              <div className="flex gap-0.5 h-1.5">
                {Array.from({length:Math.max(ideal[g],current[g]+targeted[g])}).map((_,i)=>(
                  <div key={i} className={cn("flex-1 rounded-full",
                    i<current[g]?"bg-white/40":i<current[g]+targeted[g]?"bg-accent/60":i<ideal[g]?"bg-pitch-600 border border-dashed border-slate-700":"bg-rose-400/20"
                  )}/>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Feature 6: Optimal Squad Builder */}
      {optimalCombos.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-border">
            <Zap className="w-4 h-4 text-gold" />
            <h3 className="text-sm sm:text-sm font-bold text-white">Optimal Squad Builder</h3>
            <span className="text-[10px] sm:text-sm text-slate-500 ml-1">— best compositions within budget</span>
          </div>
          <div className="divide-y divide-surface-border/40">
            {optimalCombos.map((c,i) => (
              <div key={i} className="px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] sm:text-sm font-bold text-slate-500">Option {i+1}</span>
                    {GRADES.map(g=>c[g.toLowerCase()]>0&&<span key={g} className={cn("text-[10px] sm:text-sm font-bold", GRADE_COLOR[g])}>{c[g.toLowerCase()]}×{g}</span>)}
                  </div>
                  <span className="text-[10px] sm:text-sm font-mono text-slate-400">~{c.auctionCost}pts needed</span>
                </div>
                <div className="w-full h-1.5 bg-pitch-700 rounded-full overflow-hidden">
                  <div className="h-full bg-accent rounded-full" style={{width:`${c.gradeScore/4*100}%`}}/>
                </div>
                <div className="flex gap-2 mt-1.5 text-[10px] sm:text-sm text-slate-500 flex-wrap">
                  {["S","A","B","C"].map(g=>c.toAcquire[g]>0&&<span key={g}>Buy {c.toAcquire[g]}×{g}</span>)}
                  {Object.values(c.toAcquire).every(v=>v===0)&&<span className="text-emerald-400">No purchases needed ✓</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feature 7: Grade Upgrade Impact */}
      {upgradeImpact.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-border">
            <ArrowUp className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm sm:text-sm font-bold text-white">Grade Upgrade Impact</h3>
            <span className="text-[10px] sm:text-sm text-slate-500 ml-1">— what replacing weak links achieves</span>
          </div>
          <div className="divide-y divide-surface-border/40">
            {upgradeImpact.map((u,i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <GradeBadge grade={u.from} size="sm" />
                  <span className="text-[10px] sm:text-sm text-slate-500">→</span>
                  <GradeBadge grade={u.to} size="sm" />
                  <span className="text-xs sm:text-sm text-slate-300 truncate">(replace {u.player.name})</span>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm sm:text-sm font-bold text-emerald-400">+{u.gain} score</p>
                  <p className="text-[9px] sm:text-sm sm:text-sm text-slate-500">~{u.costEst}pts upgrade cost</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feature 9: Budget Efficiency */}
      {efficiencyRanking.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-border">
            <BarChart2 className="w-4 h-4 text-violet-400" />
            <h3 className="text-sm sm:text-sm font-bold text-white">Budget Efficiency Ranking</h3>
            <span className="text-[10px] sm:text-sm text-slate-500 ml-1">— win rate gain per pt spent</span>
          </div>
          <div className="divide-y divide-surface-border/40">
            {efficiencyRanking.map((t,i) => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-[10px] sm:text-sm text-slate-600 w-4">#{i+1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs sm:text-sm font-medium text-white truncate">{t.name}</span>
                    <GradeBadge grade={t.grade} size="sm" />
                  </div>
                  <p className="text-[10px] sm:text-sm text-slate-500">Max bid: {t.maxBid} · MV: {t.marketValue} · WR: {Math.round(t.wr*100)}%</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={cn("text-sm sm:text-sm font-bold font-mono", t.efficiency>0.5?"text-emerald-400":t.efficiency>0.25?"text-amber-400":"text-rose-400")}>{t.efficiency}</p>
                  <p className="text-[9px] sm:text-sm sm:text-sm text-slate-500">eff score</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Squad Gap Analyser */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-border">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm sm:text-sm font-bold text-white">Squad Gap Analyser</h3>
        </div>
        <div className="p-3 space-y-2">
          {weaknesses.map((w,i)=>(
            <div key={i} className={cn("flex items-start gap-2.5 rounded-xl px-3 py-2.5 border",
              w.type==="critical"?"bg-rose-400/5 border-rose-400/20":w.type==="warning"?"bg-amber-400/5 border-amber-400/20":w.type==="success"?"bg-emerald-400/5 border-emerald-400/20":"bg-sky-400/5 border-sky-400/20"
            )}>
              {w.type==="critical"&&<AlertTriangle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5"/>}
              {w.type==="warning"&&<AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5"/>}
              {w.type==="success"&&<CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5"/>}
              {w.type==="info"&&<TrendingUp className="w-3.5 h-3.5 text-sky-400 flex-shrink-0 mt-0.5"/>}
              <p className={cn("text-[11px] sm:text-sm leading-relaxed",
                w.type==="critical"?"text-rose-300":w.type==="warning"?"text-amber-300":w.type==="success"?"text-emerald-300":"text-sky-300"
              )}>{w.msg}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Budget Allocation Advisor */}
      {allocation && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-border">
            <Wallet className="w-4 h-4 text-gold" />
            <h3 className="text-sm sm:text-sm font-bold text-white">Budget Allocation Advisor</h3>
          </div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {[
                {label:"Elite (S/A)",val:allocation.eliteBudget,pct:55,cls:"text-gold bg-gold/10 border-gold/25"},
                {label:"Mid (B/C)",  val:allocation.midBudget,  pct:30,cls:"text-sky-400 bg-sky-400/10 border-sky-400/25"},
                {label:"Buffer",     val:allocation.buffer,     pct:15,cls:"text-emerald-400 bg-emerald-400/10 border-emerald-400/25"},
              ].map(s=>(
                <div key={s.label} className={cn("rounded-xl p-3 text-center border",s.cls)}>
                  <p className="text-lg font-black font-mono">{s.val}</p>
                  <p className="text-[10px] sm:text-sm opacity-70">{s.label}</p>
                  <p className="text-[9px] sm:text-sm sm:text-sm font-bold">{s.pct}%</p>
                </div>
              ))}
            </div>
            {targets.length>0&&(
              <p className={cn("text-[11px] sm:text-sm px-3 py-2.5 rounded-xl border",
                allocation.mustTotal+allocation.wantTotal>totalBudget?"bg-rose-400/5 border-rose-400/20 text-rose-300":"bg-emerald-400/5 border-emerald-400/20 text-emerald-300"
              )}>
                Must-haves ~{allocation.mustTotal}pts + wants ~{allocation.wantTotal}pts = {allocation.mustTotal+allocation.wantTotal}pts total.{" "}
                {allocation.mustTotal+allocation.wantTotal>totalBudget?"⚠ Exceeds budget — reprioritise.":"Budget covers all targets ✓"}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}