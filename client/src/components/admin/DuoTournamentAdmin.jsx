import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Users, Shuffle, Trophy, ChevronDown, ChevronUp, Save, Trash2 } from "lucide-react"
import { useNavigate } from "react-router-dom"
import api from "../../lib/api"
import { cn } from "../../lib/utils"

const ROUND_LABELS = { r16: "Round of 16", qf: "Quarter Finals", sf: "Semi Finals", final: "Final" }


// ── Pairs View ────────────────────────────────────────────────────────────────
function PairsView({ season, groupMap }) {
  const { data: pairs = [] } = useQuery({
    queryKey: ["duo-pairs", season],
    queryFn:  () => api.get(`/duo/pairs?season=${season}`).then(r => r.data),
  })

  const GRADE_COLORS = {
    S:    "bg-gold/20 text-gold border-gold/40",
    "A+": "bg-blue-400/20 text-blue-400 border-blue-400/40",
    A:    "bg-blue-400/20 text-blue-400 border-blue-400/40",
    B:    "bg-emerald-400/20 text-emerald-400 border-emerald-400/40",
    C:    "bg-slate-500/20 text-slate-400 border-slate-500/40",
  }

  // Build pair → group map
  const pairGroupMap = {}
  Object.entries(groupMap).forEach(([groupName, members]) => {
    members.forEach(m => { pairGroupMap[m.duoPairId] = groupName })
  })

  if (pairs.length === 0) return (
    <div className="text-center py-12 text-slate-500 text-sm">
      No pairs generated yet.
    </div>
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-4 py-2 bg-pitch-800/50 rounded-lg border border-surface-border">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">SET 1 (S / A+ / A)</p>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">SET 2 (B / C)</p>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Group</p>
      </div>
      {pairs.map((pair, idx) => (
        <div key={pair.id}
          className="flex items-center gap-3 px-4 py-3 bg-pitch-800 rounded-xl border border-surface-border hover:border-accent/30 transition-colors">
          {/* Index */}
          <span className="text-xs text-slate-600 w-5 flex-shrink-0">{idx + 1}</span>

          {/* Set 1 player */}
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0", GRADE_COLORS[pair.set1Grade] || GRADE_COLORS.C)}>
              {pair.set1Grade}
            </span>
            <span className="text-sm font-semibold text-white truncate">{pair.set1Name}</span>
          </div>

          {/* Connector */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <div className="w-6 h-px bg-slate-600" />
            <span className="text-xs text-slate-500 font-bold">DUO</span>
            <div className="w-6 h-px bg-slate-600" />
          </div>

          {/* Set 2 player */}
          <div className="flex-1 flex items-center gap-2 min-w-0 justify-end">
            <span className="text-sm font-semibold text-white truncate">{pair.set2Name}</span>
            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0", GRADE_COLORS[pair.set2Grade] || GRADE_COLORS.C)}>
              {pair.set2Grade}
            </span>
          </div>

          {/* Group badge */}
          <div className="w-16 flex-shrink-0 text-right">
            {pairGroupMap[pair.id] ? (
              <span className="text-xs font-bold text-accent bg-accent/10 border border-accent/25 px-2 py-0.5 rounded-lg">
                {pairGroupMap[pair.id]}
              </span>
            ) : (
              <span className="text-xs text-slate-600">—</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}


// ── Fixtures By Round ─────────────────────────────────────────────────────────
function FixturesByRound({ fixtures, onSave }) {
  const rounds = [...new Set(fixtures.map(f => f.round_number).filter(Boolean))].sort((a,b) => a-b)
  const [activeRound, setActiveRound] = useState(rounds[0] || 1)

  if (rounds.length === 0) return (
    <p className="text-slate-500 text-sm text-center py-8">No fixtures yet — generate a draw first.</p>
  )

  const roundFixtures = fixtures.filter(f => f.round_number === activeRound)

  // Group by group name within this round
  const byGroup = roundFixtures.reduce((acc, f) => {
    (acc[f.groupName] = acc[f.groupName]||[]).push(f); return acc
  }, {})

  return (
    <div className="space-y-4">
      {/* Round selector */}
      <div className="flex gap-2 flex-wrap">
        {rounds.map(r => (
          <button key={r} onClick={() => setActiveRound(r)}
            className={cn("px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all",
              activeRound === r ? "bg-accent text-white border-accent" : "bg-pitch-800 text-slate-400 border-surface-border hover:text-white")}>
            Round {r}
          </button>
        ))}
      </div>
      {/* Fixtures for selected round grouped by group */}
      <div className="space-y-6">
        {Object.entries(byGroup).map(([groupName, gFixtures]) => (
          <div key={groupName}>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">{groupName}</h3>
            <div className="space-y-2">
              {gFixtures.map(f => (
                <FixtureRow key={f.id} fixture={f} onSave={onSave} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Score Entry ───────────────────────────────────────────────────────────────
function ScoreEntry({ fixture, onSave }) {
  const [scores, setScores] = useState({
    set1HomeScore: fixture.set1_home_score ?? "",
    set1AwayScore: fixture.set1_away_score ?? "",
    set2HomeScore: fixture.set2_home_score ?? "",
    set2AwayScore: fixture.set2_away_score ?? "",
  })
  const set = (k, v) => setScores(s => ({ ...s, [k]: v }))
  const homeAgg = (Number(scores.set1HomeScore) || 0) + (Number(scores.set2HomeScore) || 0)
  const awayAgg = (Number(scores.set1AwayScore) || 0) + (Number(scores.set2AwayScore) || 0)

  return (
    <div className="mt-3 p-3 bg-pitch-900 rounded-xl border border-surface-border space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Set 1 Match</p>
          <p className="text-xs text-slate-400 mb-1">{fixture.homeSet1Name} vs {fixture.awaySet1Name}</p>
          <div className="flex items-center gap-2">
            <input type="number" min="0" value={scores.set1HomeScore} onChange={e => set("set1HomeScore", e.target.value)}
              className="w-12 text-center bg-pitch-800 border border-surface-border rounded-lg py-1 text-sm text-white" />
            <span className="text-slate-500">–</span>
            <input type="number" min="0" value={scores.set1AwayScore} onChange={e => set("set1AwayScore", e.target.value)}
              className="w-12 text-center bg-pitch-800 border border-surface-border rounded-lg py-1 text-sm text-white" />
          </div>
        </div>
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Set 2 Match</p>
          <p className="text-xs text-slate-400 mb-1">{fixture.homeSet2Name} vs {fixture.awaySet2Name}</p>
          <div className="flex items-center gap-2">
            <input type="number" min="0" value={scores.set2HomeScore} onChange={e => set("set2HomeScore", e.target.value)}
              className="w-12 text-center bg-pitch-800 border border-surface-border rounded-lg py-1 text-sm text-white" />
            <span className="text-slate-500">–</span>
            <input type="number" min="0" value={scores.set2AwayScore} onChange={e => set("set2AwayScore", e.target.value)}
              className="w-12 text-center bg-pitch-800 border border-surface-border rounded-lg py-1 text-sm text-white" />
          </div>
        </div>
      </div>
      {/* Aggregate preview */}
      <div className="flex items-center justify-between px-3 py-2 bg-pitch-800 rounded-lg">
        <span className="text-xs text-slate-400">Aggregate</span>
        <span className={cn("text-sm font-bold",
          homeAgg > awayAgg ? "text-emerald-400" : homeAgg < awayAgg ? "text-rose-400" : "text-amber-400"
        )}>
          {homeAgg} – {awayAgg}
          {homeAgg > awayAgg ? ` → ${fixture.homeDuoName} wins` :
           homeAgg < awayAgg ? ` → ${fixture.awayDuoName} wins` : " → Draw"}
        </span>
      </div>
      <button onClick={() => onSave(fixture.id, scores)}
        className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-lg text-sm font-semibold w-full justify-center hover:bg-accent/90">
        <Save className="w-4 h-4" /> Save Result
      </button>
    </div>
  )
}

// ── Fixture Row ───────────────────────────────────────────────────────────────
function FixtureRow({ fixture, onSave }) {
  const [open, setOpen] = useState(false)
  const isCompleted = fixture.status === "completed"

  return (
    <div className="border border-surface-border rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors">
        <div className="flex-1 flex items-center justify-between min-w-0">
          <div className="text-left min-w-0">
            <p className="text-sm font-semibold text-white truncate">{fixture.homeDuoName}</p>
            <p className="text-xs text-slate-500 truncate">{fixture.homeSet1Name} & {fixture.homeSet2Name}</p>
          </div>
          {isCompleted ? (
            <div className="flex items-center gap-2 mx-4">
              <span className={cn("text-lg font-bold font-mono",
                fixture.home_agg > fixture.away_agg ? "text-emerald-400" : "text-slate-400")}>
                {fixture.home_agg}
              </span>
              <span className="text-slate-600">–</span>
              <span className={cn("text-lg font-bold font-mono",
                fixture.away_agg > fixture.home_agg ? "text-emerald-400" : "text-slate-400")}>
                {fixture.away_agg}
              </span>
            </div>
          ) : (
            <span className="text-xs text-slate-500 mx-4">vs</span>
          )}
          <div className="text-right min-w-0">
            <p className="text-sm font-semibold text-white truncate">{fixture.awayDuoName}</p>
            <p className="text-xs text-slate-500 truncate">{fixture.awaySet1Name} & {fixture.awaySet2Name}</p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
      </button>
      {open && <div className="px-4 pb-4"><ScoreEntry fixture={fixture} onSave={onSave} /></div>}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function DuoTournamentAdmin() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [season, setSeason] = useState(7)
  const [activeTab, setActiveTab] = useState("groups")

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["duo", season],
    queryFn:  () => api.get(`/duo/current?season=${season}`).then(r => r.data),
  })

  const invalidate = () => { qc.invalidateQueries({ queryKey: ["duo"] }); refetch() }

  const generateMut = useMutation({
    mutationFn: (sn) => api.post("/duo/generate", { seasonNumber: sn }).then(r => r.data),
    onSuccess:  () => { invalidate(); navigate(`/duo/draw/${season}`) }
  })

  const knockoutMut = useMutation({
    mutationFn: (sn) => api.post("/duo/knockout/generate", { seasonNumber: sn }).then(r => r.data),
    onSuccess:  invalidate
  })

  const advanceMut = useMutation({
    mutationFn: ({ seasonNumber, fromRound }) => api.post("/duo/knockout/advance", { seasonNumber, fromRound }).then(r => r.data),
    onSuccess:  invalidate
  })

  const deleteMut = useMutation({
    mutationFn: (sn) => api.delete(`/duo/season/${sn}`).then(r => r.data),
    onSuccess:  () => { invalidate(); setActiveTab("groups") }
  })

  const scoreMut = useMutation({
    mutationFn: ({ id, scores }) => api.post(`/duo/fixtures/${id}/score`, {
      set1HomeScore: Number(scores.set1HomeScore),
      set1AwayScore: Number(scores.set1AwayScore),
      set2HomeScore: Number(scores.set2HomeScore),
      set2AwayScore: Number(scores.set2AwayScore),
    }).then(r => r.data),
    onSuccess: invalidate
  })

  const groups = data?.groups || []
  const fixtures = data?.fixtures || []

  // Group fixtures by group name
  const groupFixtures = fixtures.filter(f => !f.knockout_round)
  const knockoutFixtures = fixtures.filter(f => f.knockout_round)

  // Build group standings map
  const groupMap = {}
  groups.forEach(row => {
    if (!groupMap[row.name]) groupMap[row.name] = []
    groupMap[row.name].push(row)
  })

  // Get knockout rounds present
  const knockoutRounds = [...new Set(knockoutFixtures.map(f => f.knockout_round))].sort()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-bold text-white">Duo Tournament</h2>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">Season</label>
            <input type="number" value={season} onChange={e => setSeason(Number(e.target.value))}
              className="w-16 bg-pitch-900 border border-surface-border rounded-lg px-2 py-1 text-sm text-white text-center" />
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => generateMut.mutate(season)}
            disabled={generateMut.isPending}
            className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-accent/90 disabled:opacity-50">
            <Shuffle className="w-4 h-4" />
            {groups.length > 0 ? "Re-draw" : "Generate Draw"}
          </button>
          {groups.length > 0 && (
            <button
              onClick={() => { if (window.confirm(`Delete all Season ${season} duo data? This cannot be undone.`)) deleteMut.mutate(season) }}
              disabled={deleteMut.isPending}
              className="flex items-center gap-2 bg-rose-500/20 text-rose-400 border border-rose-500/30 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-rose-500/30 disabled:opacity-50">
              <Trash2 className="w-4 h-4" /> Delete Season
            </button>
          )}
          {groups.length > 0 && knockoutRounds.length === 0 && (
            <button onClick={() => knockoutMut.mutate(season)}
              disabled={knockoutMut.isPending}
              className="flex items-center gap-2 bg-gold/20 text-gold border border-gold/30 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gold/30 disabled:opacity-50">
              <Trophy className="w-4 h-4" /> Generate Knockout
            </button>
          )}
          {knockoutRounds.map(round => {
            const allDone = knockoutFixtures.filter(f => f.knockout_round === round).every(f => f.status === "completed")
            const NEXT = { r16: "qf", qf: "sf", sf: "final" }
            if (!allDone || round === "final" || !NEXT[round]) return null
            return (
              <button key={round} onClick={() => advanceMut.mutate({ seasonNumber: season, fromRound: round })}
                className="flex items-center gap-2 bg-violet-500/20 text-violet-400 border border-violet-500/30 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-violet-500/30">
                Advance to {ROUND_LABELS[NEXT[round]]}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tabs */}
      {groups.length > 0 && (
        <div className="flex gap-1 border-b border-surface-border">
          {["pairs", "groups", "fixtures", "knockout"].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={cn("px-4 py-2 text-sm font-semibold capitalize transition-colors border-b-2 -mb-px",
                activeTab === tab ? "border-accent text-accent" : "border-transparent text-slate-400 hover:text-white")}>
              {tab}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-slate-500">Loading...</div>
      ) : groups.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No draw generated yet. Click "Generate Draw" to create duo pairs and groups.</p>
        </div>
      ) : (
        <>
          {/* Pairs tab */}
          {activeTab === "pairs" && (
            <PairsView season={season} groupMap={groupMap} />
          )}

          {/* Groups tab */}
          {activeTab === "groups" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(groupMap).map(([groupName, members]) => (
                <div key={groupName} className="card overflow-hidden">
                  <div className="px-4 py-3 border-b border-surface-border bg-pitch-800/50">
                    <h3 className="text-sm font-bold text-white">{groupName}</h3>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-500 border-b border-surface-border/50">
                        <th className="text-left px-4 py-2">Duo</th>
                        <th className="px-2 py-2">P</th>
                        <th className="px-2 py-2">W</th>
                        <th className="px-2 py-2">D</th>
                        <th className="px-2 py-2">L</th>
                        <th className="px-2 py-2">GD</th>
                        <th className="px-2 py-2 text-gold">Pts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-border/30">
                      {members.sort((a,b) => b.points - a.points || (b.gf-b.ga) - (a.gf-a.ga)).map((m, i) => (
                        <tr key={m.duoPairId} className={i < 2 ? "bg-emerald-500/5" : ""}>
                          <td className="px-4 py-2">
                            <p className="font-semibold text-white">{m.duoName}</p>
                            <p className="text-slate-500">{m.set1Name} & {m.set2Name}</p>
                          </td>
                          <td className="text-center px-2 py-2 text-slate-400">{m.played}</td>
                          <td className="text-center px-2 py-2 text-slate-400">{m.won}</td>
                          <td className="text-center px-2 py-2 text-slate-400">{m.drawn}</td>
                          <td className="text-center px-2 py-2 text-slate-400">{m.lost}</td>
                          <td className="text-center px-2 py-2 text-slate-400">{m.gf - m.ga}</td>
                          <td className="text-center px-2 py-2 font-bold text-gold">{m.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}

          {/* Fixtures tab */}
          {activeTab === "fixtures" && (
            <FixturesByRound fixtures={groupFixtures} onSave={(id, scores) => scoreMut.mutate({ id, scores })} />
          )}

          {/* Knockout tab */}
          {activeTab === "knockout" && (
            <div className="space-y-6">
              {knockoutRounds.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-8">Knockout not generated yet.</p>
              ) : (
                knockoutRounds.map(round => (
                  <div key={round}>
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">{ROUND_LABELS[round] || round}</h3>
                    <div className="space-y-2">
                      {knockoutFixtures.filter(f => f.knockout_round === round).map(f => (
                        <FixtureRow key={f.id} fixture={f} onSave={(id, scores) => scoreMut.mutate({ id, scores })} />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}