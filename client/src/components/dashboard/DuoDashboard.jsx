import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Swords } from "lucide-react"
import duoTrophy  from "../../../images/duo.png"
import duoBoot    from "../../../images/duoboot.png"
import api from "../../lib/api"
import { cn } from "../../lib/utils"

const ROUND_LABELS = { r16: "Round of 16", qf: "Quarter Finals", sf: "Semi Finals", final: "Final" }

export default function DuoDashboard() {
  const [view, setView]               = useState("table")   // table | fixtures | knockout
  const [activeGroup, setActiveGroup] = useState(0)
  const [activeRound, setActiveRound] = useState(1)
  const [activeKoRound, setActiveKoRound] = useState("r16")

  const { data, isLoading } = useQuery({
    queryKey: ["duo", "public"],
    queryFn:  () => api.get("/duo/current").then(r => r.data).catch(() => null),
    staleTime: 60 * 1000,
  })

  if (isLoading) return <p className="text-sm text-slate-500 text-center py-8">Loading…</p>

  if (!data || !data.groups?.length) return (
    <div className="card px-6 py-14 text-center">
      <img src={duoTrophy} alt="Duo Tournament" className="w-12 h-12 object-contain mx-auto mb-3 opacity-30" />
      <p className="text-slate-400 font-medium">Duo Tournament not set up yet</p>
      <p className="text-sm text-slate-600 mt-1">Check back once the admin creates the group stage</p>
    </div>
  )

  // Build group map: { "Group A": [member, member, ...] }
  const groupMap = {}
  data.groups.forEach(row => {
    if (!groupMap[row.name]) groupMap[row.name] = []
    groupMap[row.name].push(row)
  })
  const groupNames = Object.keys(groupMap).sort()
  const selectedGroupName = groupNames[activeGroup]
  const selectedMembers   = (groupMap[selectedGroupName] || [])
    .sort((a, b) => b.points - a.points || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf)

  // Group fixtures
  const groupFixtures = (data.fixtures || []).filter(f => !f.knockout_round && f.groupName === selectedGroupName)
  const roundsByNumber = groupFixtures.reduce((acc, f) => {
    const r = f.round_number || 1;
    (acc[r] = acc[r] || []).push(f)
    return acc
  }, {})
  const allRounds = Object.keys(roundsByNumber).map(Number).sort((a, b) => a - b)
  const firstIncomplete = allRounds.find(r => roundsByNumber[r].some(f => f.status !== "completed"))
  const unlockedRounds  = firstIncomplete != null
    ? allRounds.filter(r => r <= firstIncomplete)
    : allRounds
  const currentRound   = unlockedRounds.includes(activeRound) ? activeRound : (unlockedRounds[unlockedRounds.length - 1] ?? 1)
  const visibleFixtures = roundsByNumber[currentRound] || []

  // Knockout fixtures
  const knockoutFixtures = (data.fixtures || []).filter(f => f.knockout_round)
  const koRounds = [...new Set(knockoutFixtures.map(f => f.knockout_round))].sort()
  const currentKoRound = koRounds.includes(activeKoRound) ? activeKoRound : koRounds[0]
  const koMatches = knockoutFixtures.filter(f => f.knockout_round === currentKoRound)

  const headerTitle = view === "table"
    ? `${selectedGroupName} — Standings`
    : view === "fixtures"
    ? `${selectedGroupName} — Fixtures`
    : view === "golden-boot"
    ? "Golden Boot"
    : "Knockout Stage"

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src={view === "golden-boot" ? duoBoot : duoTrophy}
            alt={view === "golden-boot" ? "Golden Boot" : "Duo Tournament"}
            className="w-9 h-9 object-contain flex-shrink-0"
          />
          <div>
            <p className="section-label mb-0.5">Duo Tournament · Season {data.seasonNumber}</p>
            <h2 className="text-base font-semibold text-white">{headerTitle}</h2>
          </div>
        </div>
        <select
          value={view}
          onChange={e => setView(e.target.value)}
          className="bg-pitch-800 border border-surface-border rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-accent/40 transition-colors"
        >
          <option value="table">Group table</option>
          <option value="fixtures">Fixtures</option>
          <option value="knockout">Knockout</option>
          <option value="golden-boot">Golden Boot</option>
        </select>
      </div>

      {/* Group tabs — for table and fixtures views */}
      {(view === "table" || view === "fixtures") && (
        <div className="flex gap-1.5 px-5 py-3 overflow-x-auto border-b border-surface-border/60">
          {groupNames.map((name, i) => (
            <button key={name} onClick={() => setActiveGroup(i)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors",
                i === activeGroup ? "bg-accent text-white" : "bg-pitch-800 text-slate-500 hover:text-white"
              )}>
              {name}
            </button>
          ))}
        </div>
      )}

      {/* TABLE view */}
      {view === "table" && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border">
                {["#", "Duo", "P", "W", "D", "L", "GF", "GA", "GD", "Pts"].map(h => (
                  <th key={h} className={cn("py-2.5 text-xs font-semibold text-slate-500 tracking-wide",
                    h === "Duo" ? "text-left px-4" : "text-center px-2"
                  )}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {selectedMembers.map((m, i) => (
                <tr key={m.duoPairId}
                  className={cn("border-b border-surface-border/50 transition-colors",
                    i < 2 ? "bg-emerald-500/5" : ""
                  )}>
                  <td className="py-3 px-2 text-center">
                    <span className={cn("text-sm font-medium", i < 2 ? "text-emerald-400" : "text-slate-500")}>{i + 1}</span>
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-medium text-white">{m.duoName}</p>
                    <p className="text-xs text-slate-500">{m.set1Name} + {m.set2Name}</p>
                  </td>
                  <td className="py-3 px-2 text-center text-slate-400">{m.played}</td>
                  <td className="py-3 px-2 text-center text-emerald-400 font-semibold">{m.won}</td>
                  <td className="py-3 px-2 text-center text-amber-400 font-semibold">{m.drawn}</td>
                  <td className="py-3 px-2 text-center text-rose-400 font-semibold">{m.lost}</td>
                  <td className="py-3 px-2 text-center text-slate-400">{m.gf}</td>
                  <td className="py-3 px-2 text-center text-slate-400">{m.ga}</td>
                  <td className={cn("py-3 px-2 text-center font-medium",
                    (m.gf - m.ga) > 0 ? "text-emerald-400" : (m.gf - m.ga) < 0 ? "text-rose-400" : "text-slate-400")}>
                    {(m.gf - m.ga) > 0 ? "+" + (m.gf - m.ga) : (m.gf - m.ga)}
                  </td>
                  <td className="py-3 px-2 text-center font-bold text-white">{m.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-5 py-3 border-t border-surface-border/60 flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400/60" /> Top 2 advance</span>
          </div>
        </div>
      )}

      {/* FIXTURES view */}
      {view === "fixtures" && (
        allRounds.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-slate-500">No fixtures for this group yet</p>
          </div>
        ) : (
          <>
            {/* Round tabs */}
            <div className="flex gap-1.5 px-5 py-3 overflow-x-auto border-b border-surface-border/60">
              {unlockedRounds.map(r => (
                <button key={r} onClick={() => setActiveRound(r)}
                  className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors",
                    r === currentRound ? "bg-accent text-white" : "bg-pitch-800 text-slate-500 hover:text-white"
                  )}>
                  Round {r}
                </button>
              ))}
            </div>
            {/* Fixtures list */}
            <div>
              {visibleFixtures.map(f => {
                const isCompleted = f.status === "completed"
                const homeWon = isCompleted && f.home_agg > f.away_agg
                const awayWon = isCompleted && f.away_agg > f.home_agg
                return (
                  <div key={f.id} className="border-b border-surface-border/50">
                    {/* Aggregate row */}
                    <div className="flex items-center justify-between px-5 py-3">
                      <span className={cn("flex-1 min-w-0 truncate font-medium text-right pr-3",
                        homeWon ? "text-emerald-400" : "text-white")}>
                        {f.homeDuoName}
                      </span>
                      <span className="flex-shrink-0 text-xs px-2">
                        {isCompleted ? (
                          <span className="font-mono font-bold text-white bg-pitch-800 px-2 py-0.5 rounded">
                            {f.home_agg} – {f.away_agg}
                          </span>
                        ) : (
                          <span className="text-slate-600">vs</span>
                        )}
                      </span>
                      <span className={cn("flex-1 min-w-0 truncate font-medium pl-3",
                        awayWon ? "text-emerald-400" : "text-white")}>
                        {f.awayDuoName}
                      </span>
                    </div>
                    {/* Individual scores */}
                    {isCompleted && (
                      <div className="flex items-center justify-between px-5 pb-2.5 gap-4 text-xs text-slate-500">
                        <span className="flex-1 text-right">{f.homeSet1Name}</span>
                        <span className="font-mono text-slate-400">{f.set1_home_score}–{f.set1_away_score}</span>
                        <span className="flex-1">{f.awaySet1Name}</span>
                      </div>
                    )}
                    {isCompleted && (
                      <div className="flex items-center justify-between px-5 pb-3 gap-4 text-xs text-slate-500">
                        <span className="flex-1 text-right">{f.homeSet2Name}</span>
                        <span className="font-mono text-slate-400">{f.set2_home_score}–{f.set2_away_score}</span>
                        <span className="flex-1">{f.awaySet2Name}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )
      )}

      {/* KNOCKOUT view */}
      {view === "knockout" && (
        koRounds.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Swords className="w-6 h-6 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Knockout stage hasn't started yet</p>
          </div>
        ) : (
          <>
            {/* Round tabs */}
            <div className="flex gap-1.5 px-5 py-3 overflow-x-auto border-b border-surface-border/60">
              {koRounds.map(r => (
                <button key={r} onClick={() => setActiveKoRound(r)}
                  className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors",
                    r === currentKoRound ? "bg-accent text-white" : "bg-pitch-800 text-slate-500 hover:text-white"
                  )}>
                  {ROUND_LABELS[r] || r}
                </button>
              ))}
            </div>
            {/* Matches */}
            {koMatches.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm text-slate-500">No fixtures in this round yet</p>
              </div>
            ) : (
              <div>
                {koMatches.map(f => {
                  const isCompleted = f.status === "completed"
                  const homeWon = isCompleted && f.home_agg > f.away_agg
                  const awayWon = isCompleted && f.away_agg > f.home_agg
                  return (
                    <div key={f.id} className="border-b border-surface-border/50">
                      <div className="flex items-center px-5 py-3.5">
                        <span className="text-xs text-slate-600 font-mono w-9 flex-shrink-0">#{f.match_number}</span>
                        <span className={cn("flex-1 min-w-0 truncate font-medium",
                          homeWon ? "text-emerald-400" : "text-white")}>
                          {f.homeDuoName ?? "TBD"}
                        </span>
                        <div className="px-4 flex-shrink-0">
                          {isCompleted
                            ? <span className="font-mono font-bold text-white bg-pitch-800 px-2 py-0.5 rounded text-xs">{f.home_agg} – {f.away_agg}</span>
                            : <span className="text-xs text-slate-600">vs</span>
                          }
                        </div>
                        <span className={cn("flex-1 min-w-0 truncate font-medium text-right",
                          awayWon ? "text-emerald-400" : "text-white")}>
                          {f.awayDuoName ?? "TBD"}
                        </span>
                      </div>
                      {isCompleted && (
                        <div className="px-5 pb-3 space-y-1">
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span className="flex-1 text-right">{f.homeSet1Name}</span>
                            <span className="font-mono px-3">{f.set1_home_score}–{f.set1_away_score}</span>
                            <span className="flex-1">{f.awaySet1Name}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span className="flex-1 text-right">{f.homeSet2Name}</span>
                            <span className="font-mono px-3">{f.set2_home_score}–{f.set2_away_score}</span>
                            <span className="flex-1">{f.awaySet2Name}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )
      )}
      {/* GOLDEN BOOT view */}
      {view === "golden-boot" && (
        !(data.topScorers?.length > 0) ? (
          <div className="px-5 py-10 text-center">
            <img src={duoBoot} alt="Golden Boot" className="w-10 h-10 object-contain mx-auto mb-3 opacity-30" />
            <p className="text-sm text-slate-500">No goals scored yet</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-border/50">
            {data.topScorers.map((p, i) => (
              <div key={p.id} className="flex items-center gap-4 px-5 py-3">
                <span className={cn("text-sm font-bold font-mono w-6 text-center flex-shrink-0",
                  i === 0 ? "text-gold" : "text-slate-500"
                )}>{i + 1}</span>
                {i === 0 && (
                  <img src={duoBoot} alt="Golden Boot" className="w-7 h-7 object-contain flex-shrink-0" />
                )}
                <div className={cn("flex-1 min-w-0", i !== 0 && "ml-9")}>
                  <p className={cn("font-semibold text-sm", i === 0 ? "text-gold" : "text-white")}>{p.name}</p>
                  <p className="text-xs text-slate-500">{p.grade} grade</p>
                </div>
                <span className={cn("font-extrabold font-mono text-lg flex-shrink-0",
                  i === 0 ? "text-gold" : "text-slate-300"
                )}>{p.goals}</span>
                <span className="text-xs text-slate-500 flex-shrink-0">goals</span>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}