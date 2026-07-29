import { useMemo, useState } from "react"
import { cn } from "../../../lib/utils"
import { Gem, TrendingUp, Star, Eye, Award, Sword, BarChart2, ChevronDown, ChevronUp } from "lucide-react"
import GradeBadge from "../../common/GradeBadge"
import PlayerAvatarIcon from "../../common/PlayerAvatarIcon"
import { usePlayerGradeMatrix, usePlayerNemesis, useH2HVsSquad, useMVTrajectory } from "../../../lib/queries"

const GRADE_NUM   = { S: 4, A: 3, B: 2, C: 1 }
const MV_EXPECTED = { S: 185, A: 110, B: 65, C: 40 }
const GRADES      = ["S","A","B","C"]

function formWinRate(form) {
  if (!form || !form.length) return 0
  return form.filter(f => f === "W").length / form.length
}
function formTrend(form) {
  if (!form || form.length < 4) return "neutral"
  const recent = form.slice(0,3).filter(f=>f==="W").length/3
  const older  = form.slice(3,6).length ? form.slice(3,6).filter(f=>f==="W").length/form.slice(3,6).length : 0
  return recent - older > 0.25 ? "rising" : older - recent > 0.25 ? "falling" : "steady"
}
function FormDots({ form }) {
  if (!form || !form.length) return <span className="text-slate-600 text-[10px] sm:text-sm">—</span>
  return (
    <div className="flex gap-0.5">
      {form.slice(0,5).map((f,i)=>(
        <span key={i} className={cn("w-3.5 h-3.5 rounded text-[8px] font-bold flex items-center justify-center",
          f==="W"?"bg-emerald-400/20 text-emerald-400":f==="D"?"bg-amber-400/20 text-amber-400":"bg-rose-400/20 text-rose-400"
        )}>{f}</span>
      ))}
    </div>
  )
}

// ── Deep Player Card — shown when a player is expanded ───────────────────────
function MVMiniChart({ data }) {
  if (!data || data.length < 2) return (
    <p className="text-[10px] sm:text-sm text-slate-600">Not enough season data for trajectory</p>
  )
  const vals = data.map(d => d.market_value)
  const min  = Math.min(...vals) * 0.9
  const max  = Math.max(...vals) * 1.1
  const W = 280, H = 60, pad = 10
  const points = data.map((d, i) => {
    const x = pad + (i / Math.max(data.length - 1, 1)) * (W - pad * 2)
    const y = H - pad - ((d.market_value - min) / Math.max(max - min, 1)) * (H - pad * 2)
    return `${x},${y}`
  }).join(" ")
  const latest = data[data.length - 1]
  const first  = data[0]
  const delta  = latest.market_value - first.market_value
  const rising = delta >= 0
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex gap-2 flex-wrap">
          {data.map((d, i) => (
            <span key={i} className="text-[9px] sm:text-sm sm:text-sm text-slate-500">S{d.season_number}: <span className="text-white font-mono">{d.market_value}</span></span>
          ))}
        </div>
        <span className={cn("text-[10px] sm:text-sm font-bold", rising ? "text-emerald-400" : "text-rose-400")}>
          {rising ? "+" : ""}{delta} {rising ? "📈" : "📉"}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-12 overflow-visible">
        <polyline points={points} fill="none" stroke={rising ? "#34d399" : "#f87171"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        {data.map((d, i) => {
          const x = pad + (i / Math.max(data.length - 1, 1)) * (W - pad * 2)
          const y = H - pad - ((d.market_value - min) / Math.max(max - min, 1)) * (H - pad * 2)
          return <circle key={i} cx={x} cy={y} r="3" fill={rising ? "#34d399" : "#f87171"}/>
        })}
      </svg>
    </div>
  )
}

function DeepPlayerCard({ player, myTeamId }) {
  const { data: matrix = [] }     = usePlayerGradeMatrix(player.id)
  const { data: nemData }         = usePlayerNemesis(player.id)
  const { data: h2hSquad = [] }   = useH2HVsSquad(player.id, myTeamId)
  const { data: mvHistory = [] }  = useMVTrajectory(player.id)

  const dominates = nemData?.dominates || []
  const nemesis   = nemData?.nemesis   || []

  const winPctColor = (pct) => pct >= 60 ? "text-emerald-400" : pct >= 40 ? "text-amber-400" : "text-rose-400"

  return (
    <div className="bg-pitch-900 border-t border-surface-border p-4 space-y-4">

      {/* Feature 11: Grade vs Grade Matrix */}
      {matrix.length > 0 && (
        <div>
          <p className="text-[10px] sm:text-sm text-slate-500 uppercase tracking-widest font-semibold mb-2">Grade vs Grade Performance</p>
          <div className="grid grid-cols-4 gap-1.5">
            {GRADES.map(g => {
              const row = matrix.find(m => m.opp_grade === g)
              if (!row || row.total === 0) return (
                <div key={g} className="bg-pitch-800 rounded-xl p-2 text-center border border-surface-border">
                  <GradeBadge grade={g} size="sm" />
                  <p className="text-[10px] sm:text-sm text-slate-600 mt-1">No data</p>
                </div>
              )
              const pct = Math.round(row.wins / row.total * 100)
              return (
                <div key={g} className={cn("rounded-xl p-2 text-center border",
                  pct>=60?"bg-emerald-400/5 border-emerald-400/20":pct>=40?"bg-amber-400/5 border-amber-400/20":"bg-rose-400/5 border-rose-400/20"
                )}>
                  <div className="flex justify-center mb-1"><GradeBadge grade={g} size="sm"/></div>
                  <p className={cn("text-sm sm:text-sm font-black font-mono", winPctColor(pct))}>{pct}%</p>
                  <p className="text-[9px] sm:text-sm sm:text-sm text-slate-500">{row.wins}W {row.draws}D {row.losses}L</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Feature 10: H2H vs My Squad */}
      {h2hSquad.length > 0 && (
        <div>
          <p className="text-[10px] sm:text-sm text-slate-500 uppercase tracking-widest font-semibold mb-2">H2H vs Your Squad</p>
          <div className="space-y-1">
            {h2hSquad.map(m => (
              <div key={m.myPlayerId} className="flex items-center gap-2 bg-pitch-800 rounded-lg px-3 py-1.5">
                <GradeBadge grade={m.myPlayerGrade} size="sm"/>
                <span className="text-xs sm:text-sm text-white flex-1 truncate">{m.myPlayerName}</span>
                <span className={cn("text-[10px] sm:text-sm font-bold font-mono", winPctColor(m.winPct))}>{m.winPct}%</span>
                <span className="text-[10px] sm:text-sm text-slate-500 font-mono">{m.wins}W {m.draws}D {m.losses}L</span>
              </div>
            ))}
            {h2hSquad.length === 0 && <p className="text-[10px] sm:text-sm text-slate-600">No prior matches vs your squad</p>}
          </div>
        </div>
      )}
      {h2hSquad.length === 0 && (
        <div>
          <p className="text-[10px] sm:text-sm text-slate-500 uppercase tracking-widest font-semibold mb-1">H2H vs Your Squad</p>
          <p className="text-[10px] sm:text-sm text-slate-600">No prior matches recorded vs your squad</p>
        </div>
      )}

      {/* Feature 14: Nemesis & Dominance */}
      {/* Feature 15: MV Trajectory */}
      <div>
        <p className="text-[10px] sm:text-sm text-slate-500 uppercase tracking-widest font-semibold mb-2">Market Value Trajectory</p>
        <MVMiniChart data={mvHistory} />
      </div>

      {(dominates.length > 0 || nemesis.length > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {dominates.length > 0 && (
            <div>
              <p className="text-[10px] sm:text-sm text-emerald-400 font-semibold uppercase tracking-widest mb-1.5">Dominates</p>
              {dominates.map(p=>(
                <div key={p.opp_id} className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] sm:text-sm text-white truncate flex-1">{p.name}</span>
                  <GradeBadge grade={p.grade} size="sm"/>
                  <span className="text-[9px] sm:text-sm sm:text-sm text-emerald-400 font-mono">{p.winPct}%</span>
                </div>
              ))}
            </div>
          )}
          {nemesis.length > 0 && (
            <div>
              <p className="text-[10px] sm:text-sm text-rose-400 font-semibold uppercase tracking-widest mb-1.5">Struggles vs</p>
              {nemesis.map(p=>(
                <div key={p.opp_id} className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] sm:text-sm text-white truncate flex-1">{p.name}</span>
                  <GradeBadge grade={p.grade} size="sm"/>
                  <span className="text-[9px] sm:text-sm sm:text-sm text-rose-400 font-mono">{100-(p.winPct||0)}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function PlayerIntelligence({ allPlayers, myTeamId, targets }) {
  const [gradeFilter, setGradeFilter] = useState("all")
  const [search,      setSearch]      = useState("")
  const [sortBy,      setSortBy]      = useState("sleeper")
  const [expanded,    setExpanded]    = useState(null) // expanded player id

  const targetedIds = new Set(targets.map(t => t.playerId))
  const pool = useMemo(() =>
    allPlayers.filter(p => p.teamId !== myTeamId && !p.isCaptain)
  , [allPlayers, myTeamId])

  const sleeperPicks = useMemo(() =>
    pool.map(p => {
      const wr     = formWinRate(p.form)
      const mvExp  = MV_EXPECTED[p.grade] || 80
      const mvRatio = p.marketValue > 0 ? p.marketValue / mvExp : 1
      const trend  = formTrend(p.form)
      const score  = wr > 0 ? (wr / Math.max(mvRatio,0.1)) + (trend==="rising"?0.3:0) : 0
      const trophies = (p.trophy1Count||0)+(p.trophy2Count||0)+(p.trophy3Count||0)+(p.trophy4Count||0)
      return { ...p, wr, mvRatio, sleeperScore:score, trend, trophies, undervalued:mvRatio<0.85&&wr>=0.5 }
    })
    .filter(p => p.undervalued)
    .sort((a,b)=>b.sleeperScore-a.sleeperScore)
    .slice(0,8)
  , [pool])

  const trophyStars = useMemo(() =>
    pool.map(p=>{
      const t=(p.trophy1Count||0)+(p.trophy2Count||0)+(p.trophy3Count||0)+(p.trophy4Count||0)
      return t>0?{...p,trophies:t,efficiency:t/(GRADE_NUM[p.grade]||1),wr:formWinRate(p.form)}:null
    }).filter(Boolean).sort((a,b)=>b.efficiency-a.efficiency||b.trophies-a.trophies).slice(0,6)
  , [pool])

  const formTrendPlayers = useMemo(()=>
    pool.filter(p=>p.form&&p.form.length>=4)
      .map(p=>({...p,wr:formWinRate(p.form),trend:formTrend(p.form)}))
      .filter(p=>p.trend!=="steady")
      .sort((a,b)=>(a.trend==="rising"&&b.trend!=="rising"?-1:b.trend==="rising"&&a.trend!=="rising"?1:b.wr-a.wr))
      .slice(0,8)
  , [pool])

  const browsed = useMemo(()=>{
    let list = pool
      .filter(p=>gradeFilter==="all"||p.grade===gradeFilter)
      .filter(p=>!search||p.name.toLowerCase().includes(search.toLowerCase()))
      .map(p=>({...p,wr:formWinRate(p.form),trend:formTrend(p.form),
        trophies:(p.trophy1Count||0)+(p.trophy2Count||0)+(p.trophy3Count||0)+(p.trophy4Count||0),
        undervalued:formWinRate(p.form)>=0.5&&p.marketValue<(MV_EXPECTED[p.grade]||80)*0.85}))
    if (sortBy==="winrate") list=list.sort((a,b)=>b.wr-a.wr)
    else if (sortBy==="mv") list=list.sort((a,b)=>a.marketValue-b.marketValue)
    else if (sortBy==="bdr") list=list.sort((a,b)=>b.bdrPoints-a.bdrPoints)
    else list=list.sort((a,b)=>(b.undervalued?1:0)-(a.undervalued?1:0)||b.wr-a.wr)
    return list
  }, [pool,gradeFilter,search,sortBy])

  const tIcon = t=>t==="rising"?"📈":t==="falling"?"📉":"→"
  const tCls  = t=>t==="rising"?"text-emerald-400":t==="falling"?"text-rose-400":"text-slate-500"

  return (
    <div className="space-y-4">

      {/* Hidden Gems */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-border">
          <Gem className="w-4 h-4 text-violet-400"/>
          <h3 className="text-sm sm:text-sm font-bold text-white">Hidden Gems 💎</h3>
          <span className="text-[10px] sm:text-sm text-slate-500 ml-1">— high form, below MV benchmark</span>
        </div>
        {!sleeperPicks.length
          ?<div className="p-6 text-center text-slate-500 text-xs">No undervalued players detected</div>
          :<div className="divide-y divide-surface-border/50">
            {sleeperPicks.map(p=>(
              <div key={p.id}>
                <div className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-surface-hover/20" onClick={()=>setExpanded(expanded===p.id?null:p.id)}>
                  <PlayerAvatarIcon player={p} size="w-8 h-8"/>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm sm:text-sm font-semibold text-white truncate">{p.name}</span>
                      <GradeBadge grade={p.grade} size="sm"/>
                      <span className={cn("text-[9px] sm:text-sm sm:text-sm font-bold",tCls(p.trend))}>{tIcon(p.trend)}</span>
                      {targetedIds.has(p.id)&&<span className="text-[9px] sm:text-sm sm:text-sm font-bold text-accent bg-accent/10 border border-accent/25 px-1.5 py-0.5 rounded">★</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <FormDots form={p.form}/>
                      <span className="text-[10px] sm:text-sm text-emerald-400 font-bold">{Math.round(p.wr*100)}% WR</span>
                      {p.trophies>0&&<span className="text-[10px] sm:text-sm text-gold">🏆×{p.trophies}</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm sm:text-sm font-bold text-violet-400 font-mono">{p.marketValue}</p>
                    <p className="text-[9px] sm:text-sm sm:text-sm text-emerald-400">-{Math.round((1-p.mvRatio)*100)}% below exp</p>
                  </div>
                  {expanded===p.id?<ChevronUp className="w-3.5 h-3.5 text-slate-500"/>:<ChevronDown className="w-3.5 h-3.5 text-slate-500"/>}
                </div>
                {expanded===p.id&&<DeepPlayerCard player={p} myTeamId={myTeamId}/>}
              </div>
            ))}
          </div>
        }
      </div>

      {/* Form Trend */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-border">
          <TrendingUp className="w-4 h-4 text-emerald-400"/>
          <h3 className="text-sm sm:text-sm font-bold text-white">Form Trend Analysis</h3>
          <span className="text-[10px] sm:text-sm text-slate-500 ml-1">— rising vs falling players</span>
        </div>
        {!formTrendPlayers.length
          ?<div className="p-4 text-center text-slate-500 text-xs">Not enough form data</div>
          :<div className="divide-y divide-surface-border/50">
            {formTrendPlayers.map(p=>(
              <div key={p.id}>
                <div className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-surface-hover/20" onClick={()=>setExpanded(expanded===p.id?null:p.id)}>
                  <PlayerAvatarIcon player={p} size="w-7 h-7"/>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs sm:text-sm font-semibold text-white truncate">{p.name}</span>
                      <GradeBadge grade={p.grade} size="sm"/>
                      {targetedIds.has(p.id)&&<span className="text-[8px] text-accent font-bold">★</span>}
                    </div>
                    <FormDots form={p.form}/>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-right">
                      <p className={cn("text-xs sm:text-sm font-bold",tCls(p.trend))}>{p.trend==="rising"?"Rising 🔥":"Falling 📉"}</p>
                      <p className="text-[9px] sm:text-sm sm:text-sm text-slate-500">{Math.round(p.wr*100)}% WR · MV:{p.marketValue}</p>
                    </div>
                    {expanded===p.id?<ChevronUp className="w-3.5 h-3.5 text-slate-500"/>:<ChevronDown className="w-3.5 h-3.5 text-slate-500"/>}
                  </div>
                </div>
                {expanded===p.id&&<DeepPlayerCard player={p} myTeamId={myTeamId}/>}
              </div>
            ))}
          </div>
        }
      </div>

      {/* Trophy Efficiency */}
      {trophyStars.length>0&&(
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-border">
            <Award className="w-4 h-4 text-gold"/>
            <h3 className="text-sm sm:text-sm font-bold text-white">Trophy Efficiency</h3>
            <span className="text-[10px] sm:text-sm text-slate-500 ml-1">— overachievers relative to grade</span>
          </div>
          <div className="divide-y divide-surface-border/50">
            {trophyStars.map((p,i)=>(
              <div key={p.id}>
                <div className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-surface-hover/20" onClick={()=>setExpanded(expanded===p.id?null:p.id)}>
                  <span className="text-[10px] sm:text-sm text-slate-600 w-4">#{i+1}</span>
                  <PlayerAvatarIcon player={p} size="w-7 h-7"/>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs sm:text-sm font-semibold text-white truncate">{p.name}</span>
                      <GradeBadge grade={p.grade} size="sm"/>
                      {targetedIds.has(p.id)&&<span className="text-[8px] text-accent font-bold">★</span>}
                    </div>
                    <p className="text-[10px] sm:text-sm text-slate-500">MV:{p.marketValue} · WR:{Math.round(p.wr*100)}%</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm sm:text-sm font-bold text-gold">🏆 ×{p.trophies}</p>
                    {(p.grade==="C"||p.grade==="B")&&<p className="text-[9px] sm:text-sm sm:text-sm text-emerald-400">Clutch overachiever</p>}
                  </div>
                  {expanded===p.id?<ChevronUp className="w-3.5 h-3.5 text-slate-500"/>:<ChevronDown className="w-3.5 h-3.5 text-slate-500"/>}
                </div>
                {expanded===p.id&&<DeepPlayerCard player={p} myTeamId={myTeamId}/>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full Intelligence Browser */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-border">
          <Eye className="w-4 h-4 text-sky-400"/>
          <h3 className="text-sm sm:text-sm font-bold text-white">Full Intelligence View</h3>
          <span className="text-[10px] sm:text-sm text-slate-500 ml-1">— click any player for deep analysis</span>
        </div>
        <div className="px-4 py-2 border-b border-surface-border flex gap-2 flex-wrap">
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." className="flex-1 min-w-0 bg-pitch-800 border border-surface-border rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-accent"/>
          <select value={gradeFilter} onChange={e=>setGradeFilter(e.target.value)} className="bg-pitch-800 border border-surface-border rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-accent">
            <option value="all">All</option>{GRADES.map(g=><option key={g} value={g}>{g}</option>)}
          </select>
          <select value={sortBy} onChange={e=>setSortBy(e.target.value)} className="bg-pitch-800 border border-surface-border rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-accent">
            <option value="sleeper">💎 Sleeper</option>
            <option value="winrate">📈 Win Rate</option>
            <option value="mv">💰 MV Low→High</option>
            <option value="bdr">⭐ BDR</option>
          </select>
        </div>
        <div className="overflow-y-auto max-h-96">
          {browsed.map(p=>(
            <div key={p.id}>
              <div className="flex items-center gap-2 px-4 py-2 border-b border-surface-border/40 cursor-pointer hover:bg-surface-hover/20" onClick={()=>setExpanded(expanded===p.id?null:p.id)}>
                <PlayerAvatarIcon player={p} size="w-7 h-7"/>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs sm:text-sm text-white truncate">{p.name}</span>
                    <GradeBadge grade={p.grade} size="sm"/>
                    {p.undervalued&&<Gem className="w-3 h-3 text-violet-400"/>}
                    <span className={cn("text-[9px] sm:text-sm sm:text-sm",tCls(p.trend))}>{tIcon(p.trend)}</span>
                    {targetedIds.has(p.id)&&<span className="text-[8px] text-accent font-bold">★</span>}
                  </div>
                </div>
                <FormDots form={p.form}/>
                <span className="text-[10px] sm:text-sm font-bold text-emerald-400 w-8 text-right">{Math.round(p.wr*100)}%</span>
                <span className="text-[10px] sm:text-sm text-slate-500 w-8 text-right font-mono">{p.marketValue}</span>
                {p.trophies>0&&<span className="text-[9px] sm:text-sm sm:text-sm text-gold">🏆{p.trophies}</span>}
                {expanded===p.id?<ChevronUp className="w-3 h-3 text-slate-500"/>:<ChevronDown className="w-3 h-3 text-slate-500"/>}
              </div>
              {expanded===p.id&&<DeepPlayerCard player={p} myTeamId={myTeamId}/>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}