import { useMemo } from "react"
import { cn } from "../../../lib/utils"
import { Shield, Crosshair, Zap, AlertTriangle, Users, TrendingUp, Wallet } from "lucide-react"
import GradeBadge from "../../common/GradeBadge"
import { TeamLogoIcon } from "../../common/TeamLogo"
import { useTeams, useAuctionCurrent, useAuctionHistory } from "../../../lib/queries"

const GRADE_NUM = { S:4, A:3, B:2, C:1 }
const GRADES    = ["S","A","B","C"]
const MV_AVG    = { S:185, A:110, B:65, C:40 }

function formWinRate(form) {
  if (!form||!form.length) return 0
  return form.filter(f=>f==="W").length/form.length
}

// Feature 18: project win rate between two squads based on grade matchups
function projectWinRate(mySquad, rivalSquad) {
  if (!mySquad.length || !rivalSquad.length) return 50
  const sorted   = (s) => [...s].sort((a,b)=>(GRADE_NUM[b.grade]||1)-(GRADE_NUM[a.grade]||1))
  const mine     = sorted(mySquad)
  const theirs   = sorted(rivalSquad)
  const n        = Math.min(mine.length, theirs.length)
  let wins=0, draws=0
  for (let i=0;i<n;i++) {
    const mg = GRADE_NUM[mine[i]?.grade]||1
    const tg = GRADE_NUM[theirs[i]?.grade]||1
    const wr  = (formWinRate(mine[i]?.form||[]) + (mg-tg)*0.15 + 0.5) / 1
    if (wr > 0.55) wins++
    else if (wr >= 0.45) draws++
  }
  const pts = wins*3 + draws
  return Math.round(pts/(n*3)*100)
}

export default function RivalWatch({ myTeamId, allPlayers, targets, myPlayers }) {
  const { data: teams = [] }        = useTeams()
  const { data: auctionData }       = useAuctionCurrent()
  const { data: auctionHistory = [] } = useAuctionHistory()

  const targetedIds = new Set(targets.map(t=>t.playerId))
  const rivalTeams  = teams.filter(t=>t.id!==myTeamId)

  const rivalAnalysis = useMemo(()=>{
    return rivalTeams.map(team=>{
      const squad      = allPlayers.filter(p=>p.teamId===team.id)
      const gradeCounts= GRADES.reduce((acc,g)=>{acc[g]=squad.filter(p=>p.grade===g).length;return acc},{})
      const eliteCount = gradeCounts.S+gradeCounts.A
      const avgMV      = squad.length?Math.round(squad.reduce((a,p)=>a+(p.marketValue||0),0)/squad.length):0
      const avgForm    = squad.length?squad.reduce((a,p)=>a+formWinRate(p.form),0)/squad.length:0
      const primaryGap = gradeCounts.S===0?"S":gradeCounts.A<=1?"A":gradeCounts.B<=2?"B":"C"

      // Formation prediction
      const formationStyle =
        eliteCount>=3?"Elite-heavy — quality over quantity strategy"
        :gradeCounts.B>=5?"B-grade bulk — reliability and depth focus"
        :gradeCounts.C>=4?"Youth/budget build — rebuild mode"
        :"Balanced — no clear formation preference yet"

      // Threat score
      const teamRank=teams.findIndex(t=>t.id===team.id)+1
      const threatScore=Math.min(100,Math.round((1-(teamRank-1)/Math.max(teams.length,1))*40+Math.min(eliteCount,4)*10+avgForm*30))

      // Counter-picks
      const counterPicks=allPlayers.filter(p=>!p.teamId&&p.grade===primaryGap&&!p.isCaptain).map(p=>({...p,wr:formWinRate(p.form)})).sort((a,b)=>b.wr-a.wr).slice(0,2)

      // Feature 16: Rival budget from auctionData
      let remainingBudget = null
      if (auctionData?.session) {
        const budgetPerTeam = auctionData.session.budgetPerTeam || 0
        const teamAuctionInfo = auctionData.teams?.find(t=>t.id===team.id)
        remainingBudget = teamAuctionInfo?.budget ?? null
        if (remainingBudget === null) {
          // Compute from sales + retentions
          const spent = (auctionData.sales||[]).filter(s=>s.teamId===team.id).reduce((a,s)=>a+(s.price||0),0)
          const retained = (auctionData.retentions||[]).filter(r=>r.teamId===team.id).reduce((a,r)=>a+(r.price||0),0)
          remainingBudget = budgetPerTeam - spent - retained
        }
      }

      // Feature 18: Post-auction win projection
      const plannedSquad = [...squad] // their squad as-is
      const myPlannedSquad = [...(myPlayers||[]), ...targets.filter(t=>t.priority==="must_have").map(t=>({ grade:t.grade, form:t.form||[] }))]
      const winProjection = projectWinRate(myPlannedSquad, plannedSquad)

      return { team, squad, gradeCounts, eliteCount, avgMV, avgForm, primaryGap, threatScore, counterPicks, formationStyle, remainingBudget, winProjection }
    }).sort((a,b)=>b.threatScore-a.threatScore)
  }, [rivalTeams, allPlayers, teams, auctionData, targets, myPlayers])

  // Feature 17: Auction History — overpay patterns per team
  const historyByTeam = useMemo(()=>{
    if (!auctionHistory.length) return {}
    const byTeam = {}
    auctionHistory.forEach(row=>{
      if (!byTeam[row.teamId]) byTeam[row.teamId]={teamId:row.teamId,teamName:row.teamName,logoUrl:row.logoUrl,grades:{}}
      byTeam[row.teamId].grades[row.grade]={ avgPrice:row.avgPrice, avgMV:row.avgMV, overpayPct:row.overpayPct, count:row.count, maxPaid:row.maxPaid }
    })
    return byTeam
  }, [auctionHistory])

  // Alliance risks
  const allianceRisks = useMemo(()=>{
    const risks=[]
    for (let i=0;i<rivalAnalysis.length;i++)
      for (let j=i+1;j<rivalAnalysis.length;j++){
        const r1=rivalAnalysis[i],r2=rivalAnalysis[j]
        if (r1.primaryGap===r2.primaryGap){
          const available=allPlayers.filter(p=>!p.teamId&&p.grade===r1.primaryGap&&!p.isCaptain).length
          risks.push({team1:r1.team,team2:r2.team,grade:r1.primaryGap,available,severity:available<=2?"critical":available<=4?"warning":"info"})
        }
      }
    return risks.sort((a,b)=>(a.severity==="critical"?0:a.severity==="warning"?1:2)-(b.severity==="critical"?0:b.severity==="warning"?1:2))
  }, [rivalAnalysis, allPlayers])

  // Bidding war players
  const biddingWars = useMemo(()=>
    allPlayers.filter(p=>!p.teamId&&!p.isCaptain)
      .map(p=>{const n=rivalAnalysis.filter(r=>r.primaryGap===p.grade).length;return{...p,neededBy:n,wr:formWinRate(p.form),isTargeted:targetedIds.has(p.id)}})
      .filter(p=>p.neededBy>=2).sort((a,b)=>b.neededBy-a.neededBy||b.wr-a.wr).slice(0,6)
  , [allPlayers, rivalAnalysis, targetedIds])

  const threatColor = s=>s>=70?"text-rose-400 bg-rose-400/10 border-rose-400/25":s>=45?"text-amber-400 bg-amber-400/10 border-amber-400/25":"text-emerald-400 bg-emerald-400/10 border-emerald-400/25"
  const threatLabel = s=>s>=70?"⚠ High":s>=45?"Medium":"Low"
  const projColor   = p=>p>=60?"text-emerald-400":p>=40?"text-amber-400":"text-rose-400"

  return (
    <div className="space-y-4">

      {/* Alliance Risk */}
      {allianceRisks.length>0&&(
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-border">
            <Users className="w-4 h-4 text-rose-400"/>
            <h3 className="text-sm sm:text-sm font-bold text-white">Alliance Risk</h3>
            <span className="text-[10px] sm:text-sm text-slate-500 ml-1">— teams chasing the same grade</span>
          </div>
          <div className="divide-y divide-surface-border/50">
            {allianceRisks.map((r,i)=>(
              <div key={i} className={cn("px-4 py-3 border-l-2",r.severity==="critical"?"border-l-rose-400":r.severity==="warning"?"border-l-amber-400":"border-l-sky-400")}>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <TeamLogoIcon logoUrl={r.team1.logoUrl} name={r.team1.name} size="sm"/>
                  <span className="text-xs sm:text-sm text-white">{r.team1.name}</span>
                  <span className="text-[10px] sm:text-sm text-slate-500">+</span>
                  <TeamLogoIcon logoUrl={r.team2.logoUrl} name={r.team2.name} size="sm"/>
                  <span className="text-xs sm:text-sm text-white">{r.team2.name}</span>
                </div>
                <p className={cn("text-[11px] sm:text-sm",r.severity==="critical"?"text-rose-300":r.severity==="warning"?"text-amber-300":"text-sky-300")}>
                  Both need <span className="font-bold">{r.grade}-grade</span>. Only <span className="font-bold">{r.available}</span> available.
                  {r.severity==="critical"?" 🔥 Fierce bidding war expected.":r.severity==="warning"?" Expect competition.":""}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bidding War Players */}
      {biddingWars.length>0&&(
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-border">
            <Zap className="w-4 h-4 text-amber-400"/>
            <h3 className="text-sm sm:text-sm font-bold text-white">Bidding War Players</h3>
            <span className="text-[10px] sm:text-sm text-slate-500 ml-1">— wanted by 2+ teams</span>
          </div>
          <div className="divide-y divide-surface-border/50">
            {biddingWars.map(p=>(
              <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm sm:text-sm font-semibold text-white">{p.name}</span>
                    <GradeBadge grade={p.grade} size="sm"/>
                    {p.isTargeted&&<span className="text-[9px] sm:text-sm sm:text-sm font-bold text-accent bg-accent/10 border border-accent/25 px-1.5 py-0.5 rounded">★ Your Target</span>}
                  </div>
                  <p className="text-[10px] sm:text-sm text-slate-500">MV:{p.marketValue} · WR:{Math.round(p.wr*100)}%</p>
                </div>
                <div className="text-right"><p className="text-sm sm:text-sm font-bold text-amber-400">{p.neededBy} teams</p></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rival Threat + Budget + Projection */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-border">
          <Shield className="w-4 h-4 text-rose-400"/>
          <h3 className="text-sm sm:text-sm font-bold text-white">Rival Deep Analysis</h3>
          <span className="text-[10px] sm:text-sm text-slate-500 ml-1">— threat, budget, win projection</span>
        </div>
        <div className="divide-y divide-surface-border/40">
          {rivalAnalysis.map(({ team, gradeCounts, eliteCount, avgMV, primaryGap, threatScore, formationStyle, remainingBudget, winProjection })=>(
            <div key={team.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <TeamLogoIcon logoUrl={team.logoUrl} name={team.name} size="sm"/>
                  <span className="text-sm sm:text-sm font-semibold text-white truncate">{team.name}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className={cn("text-[9px] sm:text-sm sm:text-sm font-bold px-2 py-0.5 rounded-full border",threatColor(threatScore))}>{threatLabel(threatScore)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                {GRADES.map(g=><span key={g} className="text-[10px] sm:text-sm text-slate-500">{g}:<span className="text-white font-bold">{gradeCounts[g]}</span></span>)}
                <span className="text-[10px] sm:text-sm text-slate-600">·</span>
                <span className="text-[10px] sm:text-sm text-slate-500">AvgMV:<span className="text-white">{avgMV}</span></span>
                {/* Feature 16: Rival remaining budget */}
                {remainingBudget!==null&&<span className="text-[10px] sm:text-sm text-slate-500">Budget:<span className={cn("font-bold",remainingBudget>200?"text-emerald-400":remainingBudget>100?"text-amber-400":"text-rose-400")}>{remainingBudget}</span></span>}
              </div>
              <p className="text-[10px] sm:text-sm text-sky-300 mb-1">🏗 {formationStyle}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3 text-amber-400"/>
                  <span className="text-[10px] sm:text-sm text-amber-300">Needs {primaryGap}-grade</span>
                </div>
                {/* Feature 18: Win projection */}
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="w-3 h-3 text-slate-500"/>
                  <span className="text-[10px] sm:text-sm text-slate-500">Your win rate vs them:</span>
                  <span className={cn("text-[10px] sm:text-sm font-bold",projColor(winProjection))}>{winProjection}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Feature 17: Historical Auction Behaviour */}
      {Object.keys(historyByTeam).length>0&&(
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-border">
            <Wallet className="w-4 h-4 text-violet-400"/>
            <h3 className="text-sm sm:text-sm font-bold text-white">Historical Auction Behaviour</h3>
            <span className="text-[10px] sm:text-sm text-slate-500 ml-1">— overpay patterns per team</span>
          </div>
          <div className="divide-y divide-surface-border/40">
            {Object.values(historyByTeam).filter(t=>t.teamId!==myTeamId).map(team=>(
              <div key={team.teamId} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <TeamLogoIcon logoUrl={team.logoUrl} name={team.teamName} size="sm"/>
                  <span className="text-xs sm:text-sm font-semibold text-white">{team.teamName}</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {GRADES.map(g=>{
                    const d=team.grades[g]
                    if(!d) return <div key={g} className="bg-pitch-800 rounded-lg p-2 text-center border border-surface-border opacity-30"><GradeBadge grade={g} size="sm"/><p className="text-[9px] sm:text-sm sm:text-sm text-slate-600 mt-1">No data</p></div>
                    return (
                      <div key={g} className={cn("rounded-lg p-2 text-center border",d.overpayPct>=50?"bg-rose-400/5 border-rose-400/20":d.overpayPct>=25?"bg-amber-400/5 border-amber-400/20":"bg-emerald-400/5 border-emerald-400/20")}>
                        <GradeBadge grade={g} size="sm"/>
                        <p className="text-[10px] sm:text-sm font-bold text-white mt-1 font-mono">{d.avgPrice}</p>
                        <p className="text-[9px] sm:text-sm sm:text-sm text-slate-500">avg paid</p>
                        {d.overpayPct>0&&<p className={cn("text-[9px] sm:text-sm sm:text-sm font-bold",d.overpayPct>=50?"text-rose-400":d.overpayPct>=25?"text-amber-400":"text-emerald-400")}>+{d.overpayPct}% over MV</p>}
                      </div>
                    )
                  })}
                </div>
                {Object.entries(team.grades).some(([,d])=>d.overpayPct>=50)&&(
                  <p className="text-[10px] sm:text-sm text-rose-300 mt-2">⚠ Historically overbids for {Object.entries(team.grades).filter(([,d])=>d.overpayPct>=50).map(([g])=>g).join("/")} grade — expect inflated prices</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Counter-Pick */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-border">
          <Crosshair className="w-4 h-4 text-sky-400"/>
          <h3 className="text-sm sm:text-sm font-bold text-white">Counter-Pick Strategy</h3>
          <span className="text-[10px] sm:text-sm text-slate-500 ml-1">— deny rivals their priority</span>
        </div>
        <div className="divide-y divide-surface-border/40">
          {rivalAnalysis.filter(r=>r.counterPicks.length>0).slice(0,4).map(({team,primaryGap,counterPicks})=>(
            <div key={team.id} className="px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <TeamLogoIcon logoUrl={team.logoUrl} name={team.name} size="sm"/>
                <span className="text-xs sm:text-sm text-slate-300">{team.name} needs <span className="font-bold text-white">{primaryGap}</span></span>
              </div>
              {counterPicks.map(p=>(
                <div key={p.id} className="flex items-center gap-2 bg-sky-400/5 border border-sky-400/15 rounded-lg px-3 py-1.5 mb-1">
                  <Crosshair className="w-3 h-3 text-sky-400 flex-shrink-0"/>
                  <span className="text-xs sm:text-sm text-white flex-1">{p.name}</span>
                  <GradeBadge grade={p.grade} size="sm"/>
                  <span className="text-[10px] sm:text-sm text-emerald-400 font-mono">{Math.round(p.wr*100)}% WR</span>
                  <span className="text-[10px] sm:text-sm text-slate-500 font-mono">MV:{p.marketValue}</span>
                  {targetedIds.has(p.id)&&<span className="text-[8px] text-accent font-bold">★</span>}
                </div>
              ))}
            </div>
          ))}
          {rivalAnalysis.every(r=>r.counterPicks.length===0)&&<div className="p-6 text-center text-slate-500 text-xs">No free agents for counter-picks</div>}
        </div>
      </div>
    </div>
  )
}