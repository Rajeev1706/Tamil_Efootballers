import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useDraftState } from "../../hooks/useDraftState"
import { Users, Shuffle, Trophy, ChevronDown, ChevronUp, Save, Trash2, Search, CheckCircle, X, Pencil } from "lucide-react"
import { useNavigate } from "react-router-dom"
import api from "../../lib/api"
import { cn } from "../../lib/utils"

const ROUND_LABELS = { r16: "Round of 16", qf: "Quarter Finals", sf: "Semi Finals", final: "Final" }

const GRADE_COLORS = {
  S:    "bg-gold/20 text-gold border-gold/40",
  "A+": "bg-blue-400/20 text-blue-400 border-blue-400/40",
  A:    "bg-blue-400/20 text-blue-400 border-blue-400/40",
  B:    "bg-emerald-400/20 text-emerald-400 border-emerald-400/40",
  C:    "bg-slate-500/20 text-slate-400 border-slate-500/40",
}

// ── Set Selection UI ──────────────────────────────────────────────────────────
function SetSelection({ season, onConfirmed }) {
  const qc = useQueryClient()
  const [step, setStep]       = useState(1) // 1 = pick Set 1, 2 = pick Set 2
  const [set1, setSet1, clearSet1Draft] = useDraftState(`draft_duo_set1_${season}`, [])
  const [set2, setSet2, clearSet2Draft] = useDraftState(`draft_duo_set2_${season}`, [])
  const [search, setSearch]   = useState("")

  const { data: allPlayers = [] } = useQuery({
    queryKey: ["players"],
    queryFn:  () => api.get("/players").then(r => r.data),
  })

  const { data: savedSets } = useQuery({
    queryKey: ["duo-sets", season],
    queryFn:  () => api.get(`/duo/sets?season=${season}`).then(r => r.data),
  })

  const saveMut = useMutation({
    mutationFn: ({ set1Ids, set2Ids }) => api.post("/duo/sets", {
      seasonNumber: season,
      set1PlayerIds: set1Ids,
      set2PlayerIds: set2Ids,
    }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["duo-sets", season] })
      onConfirmed()
    },
  })

  const clearMut = useMutation({
    mutationFn: () => api.delete(`/duo/sets?season=${season}`).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ["duo-sets", season] }),
  })

  // If sets already confirmed, show summary
  if (savedSets?.confirmed) {
    return (
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-white">Sets Confirmed</h3>
            <span className="text-xs text-slate-500">{savedSets.set1.length} pairs ready</span>
          </div>
          <button onClick={() => clearMut.mutate()}
            className="text-xs text-slate-500 hover:text-rose-400 transition-colors flex items-center gap-1">
            <X className="w-3 h-3" /> Edit selections
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[{ label: "Set 1", players: savedSets.set1, color: "text-accent" },
            { label: "Set 2", players: savedSets.set2, color: "text-emerald-400" }].map(({ label, players, color }) => (
            <div key={label}>
              <p className={cn("text-xs font-bold uppercase tracking-widest mb-2", color)}>{label} ({players.length})</p>
              <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                {players.map(p => (
                  <div key={p.id} className="flex items-center gap-2 text-xs text-slate-300 py-0.5">
                    <span className={cn("text-[9px] font-bold px-1 py-0.5 rounded border", GRADE_COLORS[p.grade] || GRADE_COLORS.C)}>
                      {p.grade}
                    </span>
                    {p.name}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const set1Ids = new Set(set1.map(p => p.id))
  const set2Ids = new Set(set2.map(p => p.id))

  const availableForStep = allPlayers.filter(p => {
    if (step === 1) return !set1Ids.has(p.id)
    return !set1Ids.has(p.id) && !set2Ids.has(p.id)
  })

  const filtered = availableForStep.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.grade?.toLowerCase().includes(search.toLowerCase())
  )

  const currentSet = step === 1 ? set1 : set2
  const setCurrentSet = step === 1 ? setSet1 : setSet2
  const currentIds = step === 1 ? set1Ids : set2Ids

  const togglePlayer = (player) => {
    setCurrentSet(prev =>
      prev.find(p => p.id === player.id)
        ? prev.filter(p => p.id !== player.id)
        : prev.length < 32 ? [...prev, player] : prev
    )
  }

  const canConfirm = set1.length > 0 && set1.length === set2.length

  return (
    <div className="card p-5 space-y-4">
      {/* Step header */}
      <div className="flex items-center gap-4">
        {[1, 2].map(s => (
          <button key={s} onClick={() => setStep(s)}
            className={cn("flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all border",
              step === s
                ? s === 1 ? "bg-accent/15 text-accent border-accent/30" : "bg-emerald-400/15 text-emerald-400 border-emerald-400/30"
                : "text-slate-500 border-surface-border hover:text-white"
            )}>
            Set {s}
            <span className="text-xs opacity-70">({s === 1 ? set1.length : set2.length}/32)</span>
          </button>
        ))}
        <span className="text-xs text-slate-600 ml-auto">
          {step === 1 ? "Pick high-grade players" : "Pick low-grade players (from remaining)"}
        </span>
      </div>

      {/* Validation hint */}
      {step === 2 && set2.length !== set1.length && set1.length > 0 && (
        <p className="text-xs text-amber-400">
          Select {set1.length} players for Set 2 to match Set 1 ({set2.length}/{set1.length})
        </p>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search players…"
          className="w-full pl-9 pr-4 py-2 bg-pitch-800 border border-surface-border rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-accent/40" />
      </div>

      {/* Current set pills */}
      {currentSet.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {currentSet.map(p => (
            <button key={p.id} onClick={() => togglePlayer(p)}
              className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-all",
                step === 1
                  ? "bg-accent/15 text-accent border-accent/30 hover:bg-accent/25"
                  : "bg-emerald-400/15 text-emerald-400 border-emerald-400/30 hover:bg-emerald-400/25"
              )}>
              {p.name} <X className="w-3 h-3" />
            </button>
          ))}
        </div>
      )}

      {/* Player list */}
      <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
        {filtered.length === 0 && (
          <p className="text-xs text-slate-600 text-center py-4">
            {step === 2 && set1.length === 0 ? "Select Set 1 first" : "No players available"}
          </p>
        )}
        {filtered.map(p => {
          const selected = currentIds.has(p.id)
          return (
            <button key={p.id} onClick={() => togglePlayer(p)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all border",
                selected
                  ? step === 1
                    ? "bg-accent/15 border-accent/30 text-white"
                    : "bg-emerald-400/15 border-emerald-400/30 text-white"
                  : "bg-pitch-800 border-surface-border text-slate-300 hover:border-slate-500"
              )}>
              <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0", GRADE_COLORS[p.grade] || GRADE_COLORS.C)}>
                {p.grade}
              </span>
              <span className="flex-1 text-left truncate">{p.name}</span>
              {p.team_name && <span className="text-xs text-slate-600 flex-shrink-0 truncate max-w-24">{p.team_name}</span>}
              {selected && <CheckCircle className="w-4 h-4 flex-shrink-0 text-accent" />}
            </button>
          )
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-surface-border">
        <div className="text-xs text-slate-500">
          Set 1: <span className="text-accent font-bold">{set1.length}</span> · Set 2: <span className="text-emerald-400 font-bold">{set2.length}</span>
          {set1.length > 0 && set2.length > 0 && set1.length !== set2.length && (
            <span className="text-amber-400 ml-2">⚠ Counts must match</span>
          )}
        </div>
        <div className="flex gap-2">
          {step === 1 && set1.length > 0 && (
            <button onClick={() => setStep(2)}
              className="px-4 py-2 rounded-xl bg-accent text-pitch-900 text-sm font-bold hover:bg-accent/90">
              Next → Set 2
            </button>
          )}
          {step === 2 && (
            <button onClick={() => setStep(1)}
              className="px-4 py-2 rounded-xl border border-surface-border text-slate-400 text-sm hover:text-white">
              ← Back
            </button>
          )}
          {canConfirm && (
            <button
              onClick={() => saveMut.mutate({ set1Ids: set1.map(p => p.id), set2Ids: set2.map(p => p.id) })}
              disabled={saveMut.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-500/90 disabled:opacity-50">
              <Save className="w-4 h-4" />
              {saveMut.isPending ? "Saving…" : `Confirm Sets (${set1.length} pairs)`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Pairs View ────────────────────────────────────────────────────────────────
function PairsView({ season, groupMap }) {
  const qc = useQueryClient()
  const { data: pairs = [] } = useQuery({
    queryKey: ["duo-pairs", season],
    queryFn:  () => api.get(`/duo/pairs?season=${season}`).then(r => r.data),
  })
  const { data: allPlayers = [] } = useQuery({
    queryKey: ["players"],
    queryFn:  () => api.get("/players").then(r => r.data),
  })

  const [editingPairId, setEditingPairId] = useState(null)
  const [editSet1, setEditSet1] = useState("")
  const [editSet2, setEditSet2] = useState("")

  const editMut = useMutation({
    mutationFn: ({ id, set1PlayerId, set2PlayerId }) =>
      api.patch(`/duo/pairs/${id}`, { set1PlayerId, set2PlayerId }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["duo-pairs"] })
      qc.invalidateQueries({ queryKey: ["duo", season] })
      setEditingPairId(null)
    },
    onError: (err) => alert(err?.response?.data?.error || "Failed to update pair"),
  })

  const set1Players = allPlayers.filter(p => ["S","A+","A"].includes(p.grade))
  const set2Players = allPlayers.filter(p => ["B","C"].includes(p.grade))

  const pairGroupMap = {}
  Object.entries(groupMap).forEach(([groupName, members]) => {
    members.forEach(m => { pairGroupMap[m.duoPairId] = groupName })
  })

  if (pairs.length === 0) return <div className="text-center py-12 text-slate-500 text-sm">No pairs generated yet.</div>

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-4 py-2 bg-pitch-800/50 rounded-lg border border-surface-border">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Set 1</p>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Set 2</p>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Group</p>
      </div>
      {pairs.map((pair, idx) => (
        <div key={pair.id} className="bg-pitch-800 rounded-xl border border-surface-border hover:border-accent/30 transition-colors overflow-hidden">
          {/* Pair row */}
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="text-xs text-slate-600 w-5 flex-shrink-0">{idx + 1}</span>
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0", GRADE_COLORS[pair.set1Grade] || GRADE_COLORS.C)}>{pair.set1Grade}</span>
              <span className="text-sm font-semibold text-white truncate">{pair.set1Name}</span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <div className="w-6 h-px bg-slate-600" />
              <span className="text-xs text-slate-500 font-bold">DUO</span>
              <div className="w-6 h-px bg-slate-600" />
            </div>
            <div className="flex-1 flex items-center gap-2 min-w-0 justify-end">
              <span className="text-sm font-semibold text-white truncate">{pair.set2Name}</span>
              <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0", GRADE_COLORS[pair.set2Grade] || GRADE_COLORS.C)}>{pair.set2Grade}</span>
            </div>
            <div className="w-20 flex-shrink-0 flex items-center justify-end gap-2">
              {pairGroupMap[pair.id]
                ? <span className="text-xs font-bold text-accent bg-accent/10 border border-accent/25 px-2 py-0.5 rounded-lg">{pairGroupMap[pair.id]}</span>
                : <span className="text-xs text-slate-600">—</span>}
              <button
                onClick={() => {
                  if (editingPairId === pair.id) { setEditingPairId(null); return }
                  setEditingPairId(pair.id)
                  setEditSet1(pair.set1Id)
                  setEditSet2(pair.set2Id)
                }}
                className="text-slate-500 hover:text-accent transition-colors p-1"
                title="Edit pair"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Edit panel */}
          {editingPairId === pair.id && (
            <div className="border-t border-surface-border px-4 pb-4 pt-3 bg-pitch-900/50 space-y-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Replace players</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-slate-500 mb-1">Set 1 (S/A+/A)</p>
                  <select value={editSet1} onChange={e => setEditSet1(Number(e.target.value))}
                    className="w-full bg-pitch-800 border border-surface-border rounded-lg px-2 py-1.5 text-sm text-white">
                    {set1Players.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.grade})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 mb-1">Set 2 (B/C)</p>
                  <select value={editSet2} onChange={e => setEditSet2(Number(e.target.value))}
                    className="w-full bg-pitch-800 border border-surface-border rounded-lg px-2 py-1.5 text-sm text-white">
                    {set2Players.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.grade})</option>
                    ))}
                  </select>
                </div>
              </div>
              {editSet1 === editSet2 && (
                <p className="text-xs text-rose-400">Set 1 and Set 2 must be different players</p>
              )}
              <div className="flex gap-2">
                <button onClick={() => setEditingPairId(null)}
                  className="px-3 py-1.5 rounded-lg border border-surface-border text-slate-400 text-xs hover:text-white transition-colors">
                  Cancel
                </button>
                <button
                  onClick={() => editMut.mutate({ id: pair.id, set1PlayerId: editSet1, set2PlayerId: editSet2 })}
                  disabled={editMut.isPending || editSet1 === editSet2}
                  className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold disabled:opacity-50 transition-colors"
                >
                  {editMut.isPending ? "Saving…" : "Save Changes"}
                </button>
              </div>
              <p className="text-[10px] text-slate-600">⚠ Any played fixtures for this pair will be reset to pending</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Score Entry + Fixture Row (unchanged) ─────────────────────────────────────
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
        {[{ label: "Set 1 Match", homeK: "set1HomeScore", awayK: "set1AwayScore", homeName: fixture.homeSet1Name, awayName: fixture.awaySet1Name },
          { label: "Set 2 Match", homeK: "set2HomeScore", awayK: "set2AwayScore", homeName: fixture.homeSet2Name, awayName: fixture.awaySet2Name }
        ].map(({ label, homeK, awayK, homeName, awayName }) => (
          <div key={label}>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">{label}</p>
            <p className="text-xs text-slate-400 mb-1">{homeName} vs {awayName}</p>
            <div className="flex items-center gap-2">
              <input type="number" min="0" value={scores[homeK]} onChange={e => set(homeK, e.target.value)}
                className="w-12 text-center bg-pitch-800 border border-surface-border rounded-lg py-1 text-sm text-white" />
              <span className="text-slate-500">–</span>
              <input type="number" min="0" value={scores[awayK]} onChange={e => set(awayK, e.target.value)}
                className="w-12 text-center bg-pitch-800 border border-surface-border rounded-lg py-1 text-sm text-white" />
            </div>
          </div>
        ))}
      </div>
      {(() => {
        const s1HomeScore = Number(scores.set1HomeScore) || 0
        const s1AwayScore = Number(scores.set1AwayScore) || 0
        const s2HomeScore = Number(scores.set2HomeScore) || 0
        const s2AwayScore = Number(scores.set2AwayScore) || 0
        const homeSets = (s1HomeScore > s1AwayScore ? 1 : 0) + (s2HomeScore > s2AwayScore ? 1 : 0)
        const awaySets = (s1AwayScore > s1HomeScore ? 1 : 0) + (s2AwayScore > s2HomeScore ? 1 : 0)
        const homeAggPrev = s1HomeScore + s2HomeScore
        const awayAggPrev = s1AwayScore + s2AwayScore
        let resultLabel = ""
        let resultColor = "text-amber-400"
        if (homeSets > awaySets) { resultLabel = `${fixture.homeDuoName} wins 2-0`; resultColor = "text-emerald-400" }
        else if (awaySets > homeSets) { resultLabel = `${fixture.awayDuoName} wins 2-0`; resultColor = "text-emerald-400" }
        else if (homeAggPrev > awayAggPrev) { resultLabel = `1-1 → ${fixture.homeDuoName} wins on agg`; resultColor = "text-blue-400" }
        else if (awayAggPrev > homeAggPrev) { resultLabel = `1-1 → ${fixture.awayDuoName} wins on agg`; resultColor = "text-blue-400" }
        else if (homeSets + awaySets > 0) { resultLabel = "1-1 — Decider needed"; resultColor = "text-orange-400" }
        return (
          <div className="flex items-center justify-between px-3 py-2 bg-pitch-800 rounded-lg">
            <span className="text-xs text-slate-400">Sets: {homeSets} – {awaySets}</span>
            <span className={`text-sm font-bold ${resultColor}`}>{resultLabel}</span>
          </div>
        )
      })()}
      <button onClick={() => onSave(fixture.id, scores)}
        className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-lg text-sm font-semibold w-full justify-center hover:bg-accent/90">
        <Save className="w-4 h-4" /> Save Result
      </button>
    </div>
  )
}

// ── Decider Entry — shown when knockout fixture is 1-1 with equal aggregate ──
function DeciderEntry({ fixture, onSetup, onResult }) {
  const hasPlayers = fixture.decider_home_player_id && fixture.decider_away_player_id
  const [homeScore, setHomeScore] = useState("")
  const [awayScore, setAwayScore] = useState("")

  // Build player options for each pair
  const homePlayers = [
    { id: fixture.homeSet1Id, name: fixture.homeSet1Name },
    { id: fixture.homeSet2Id, name: fixture.homeSet2Name },
  ].filter(p => p.id)
  const awayPlayers = [
    { id: fixture.awaySet1Id, name: fixture.awaySet1Name },
    { id: fixture.awaySet2Id, name: fixture.awaySet2Name },
  ].filter(p => p.id)

  const [selHome, setSelHome] = useState(fixture.decider_home_player_id || "")
  const [selAway, setSelAway] = useState(fixture.decider_away_player_id || "")

  const homeName = homePlayers.find(p => p.id === (fixture.decider_home_player_id || selHome))?.name
  const awayName = awayPlayers.find(p => p.id === (fixture.decider_away_player_id || selAway))?.name

  return (
    <div className="mt-2 p-3 bg-orange-400/5 border border-orange-400/30 rounded-xl space-y-3">
      <p className="text-xs font-bold text-orange-400 uppercase tracking-widest">⚡ Decider Match — Pick one player from each pair</p>

      {/* Player selection */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] text-slate-500 mb-1">{fixture.homeDuoName}</p>
          <select
            value={selHome}
            onChange={e => setSelHome(Number(e.target.value))}
            disabled={hasPlayers}
            className="w-full bg-pitch-900 border border-surface-border rounded-lg px-2 py-1.5 text-sm text-white disabled:opacity-60"
          >
            <option value="">Pick player…</option>
            {homePlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <p className="text-[10px] text-slate-500 mb-1">{fixture.awayDuoName}</p>
          <select
            value={selAway}
            onChange={e => setSelAway(Number(e.target.value))}
            disabled={hasPlayers}
            className="w-full bg-pitch-900 border border-surface-border rounded-lg px-2 py-1.5 text-sm text-white disabled:opacity-60"
          >
            <option value="">Pick player…</option>
            {awayPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      {!hasPlayers && (
        <button
          onClick={() => onSetup(fixture.id, selHome, selAway)}
          disabled={!selHome || !selAway}
          className="w-full bg-orange-500/20 border border-orange-400/40 text-orange-300 text-sm font-semibold py-2 rounded-lg disabled:opacity-40 hover:bg-orange-500/30 transition-colors"
        >
          Confirm Decider Players
        </button>
      )}

      {/* Score entry — only after players are set */}
      {hasPlayers && (
        <div className="space-y-2">
          <p className="text-xs text-slate-400 text-center">{homeName} vs {awayName}</p>
          <div className="flex items-center gap-3 justify-center">
            <input type="number" min="0" value={homeScore} onChange={e => setHomeScore(e.target.value)}
              className="w-16 text-center bg-pitch-800 border border-surface-border rounded-lg py-1.5 text-sm text-white" />
            <span className="text-slate-500 font-bold">–</span>
            <input type="number" min="0" value={awayScore} onChange={e => setAwayScore(e.target.value)}
              className="w-16 text-center bg-pitch-800 border border-surface-border rounded-lg py-1.5 text-sm text-white" />
          </div>
          {homeScore !== "" && awayScore !== "" && homeScore === awayScore && (
            <p className="text-xs text-rose-400 text-center">Decider must have a winner — scores cannot be equal</p>
          )}
          <button
            onClick={() => onResult(fixture.id, Number(homeScore), Number(awayScore))}
            disabled={homeScore === "" || awayScore === "" || homeScore === awayScore}
            className="w-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-sm font-semibold py-2 rounded-lg disabled:opacity-40 hover:bg-emerald-500/30 transition-colors"
          >
            Save Decider Result
          </button>
        </div>
      )}
    </div>
  )
}

function FixtureRow({ fixture, onSave, onDeciderSetup, onDeciderResult }) {
  const [open, setOpen] = useState(false)
  const isCompleted    = fixture.status === "completed"
  const needsDecider   = fixture.status === "needs_decider"

  // Set wins from stored scores
  const homeSets = ((fixture.set1_home_score > fixture.set1_away_score ? 1 : 0) +
                    (fixture.set2_home_score > fixture.set2_away_score ? 1 : 0))
  const awaySets = ((fixture.set1_away_score > fixture.set1_home_score ? 1 : 0) +
                    (fixture.set2_away_score > fixture.set2_home_score ? 1 : 0))

  return (
    <div className={cn("border rounded-xl overflow-hidden",
      needsDecider ? "border-orange-400/40" : "border-surface-border")}>
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors">
        <div className="flex-1 flex items-center justify-between min-w-0">
          <div className="text-left min-w-0">
            <p className="text-sm font-semibold text-white truncate">{fixture.homeDuoName}</p>
            <p className="text-xs text-slate-500 truncate">{fixture.homeSet1Name} & {fixture.homeSet2Name}</p>
          </div>
          {isCompleted ? (
            <div className="flex items-center gap-2 mx-4">
              <span className={cn("text-lg font-bold font-mono", homeSets > awaySets ? "text-emerald-400" : "text-slate-400")}>{homeSets}</span>
              <span className="text-slate-600">–</span>
              <span className={cn("text-lg font-bold font-mono", awaySets > homeSets ? "text-emerald-400" : "text-slate-400")}>{awaySets}</span>
            </div>
          ) : needsDecider ? (
            <span className="text-xs text-orange-400 font-bold mx-4">1-1 DECIDER</span>
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
      {open && (
        <div className="px-4 pb-4 space-y-3">
          <ScoreEntry fixture={fixture} onSave={onSave} />
          {needsDecider && (
            <DeciderEntry
              fixture={fixture}
              onSetup={onDeciderSetup}
              onResult={onDeciderResult}
            />
          )}
        </div>
      )}
    </div>
  )
}

function FixturesByRound({ fixtures, onSave }) {
  const rounds = [...new Set(fixtures.map(f => f.round_number).filter(Boolean))].sort((a,b) => a-b)
  const [activeRound, setActiveRound] = useState(rounds[0] || 1)
  if (rounds.length === 0) return <p className="text-slate-500 text-sm text-center py-8">No fixtures yet — generate a draw first.</p>
  const byGroup = fixtures.filter(f => f.round_number === activeRound).reduce((acc, f) => {
    (acc[f.groupName] = acc[f.groupName]||[]).push(f); return acc
  }, {})
  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {rounds.map(r => (
          <button key={r} onClick={() => setActiveRound(r)}
            className={cn("px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all",
              activeRound === r ? "bg-accent text-white border-accent" : "bg-pitch-800 text-slate-400 border-surface-border hover:text-white")}>
            Round {r}
          </button>
        ))}
      </div>
      <div className="space-y-6">
        {Object.entries(byGroup).map(([groupName, gFixtures]) => (
          <div key={groupName}>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">{groupName}</h3>
            <div className="space-y-2">
              {gFixtures.map(f => <FixtureRow key={f.id} fixture={f} onSave={onSave} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function DuoTournamentAdmin() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [season, setSeason]   = useState(7)
  const [activeTab, setActiveTab] = useState("groups")
  const [setsConfirmed, setSetsConfirmed] = useState(false)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["duo", season],
    queryFn:  () => api.get(`/duo/current?season=${season}`).then(r => r.data),
  })

  const { data: savedSets } = useQuery({
    queryKey: ["duo-sets", season],
    queryFn:  () => api.get(`/duo/sets?season=${season}`).then(r => r.data),
  })

  const invalidate = () => { qc.invalidateQueries({ queryKey: ["duo"] }); refetch() }

  const knockoutMut = useMutation({
    mutationFn: (sn) => api.post("/duo/knockout/generate", { seasonNumber: sn }).then(r => r.data),
    onSuccess:  invalidate,
  })

  const advanceMut = useMutation({
    mutationFn: ({ seasonNumber, fromRound }) => api.post("/duo/knockout/advance", { seasonNumber, fromRound }).then(r => r.data),
    onSuccess:  invalidate,
  })

  const deleteMut = useMutation({
    mutationFn: (sn) => api.delete(`/duo/season/${sn}`).then(r => r.data),
    onSuccess:  () => { invalidate(); setActiveTab("groups") },
  })

  const deciderSetupMut = useMutation({
    mutationFn: ({ id, homePlayerId, awayPlayerId }) =>
      api.post(`/duo/fixtures/${id}/decider/setup`, { homePlayerId, awayPlayerId }).then(r => r.data),
    onSuccess: () => invalidate(),
    onError: (err) => alert(err?.response?.data?.error || "Failed to set decider players"),
  })

  const deciderResultMut = useMutation({
    mutationFn: ({ id, homeScore, awayScore }) =>
      api.post(`/duo/fixtures/${id}/decider/result`, { homeScore, awayScore }).then(r => r.data),
    onSuccess: () => invalidate(),
    onError: (err) => alert(err?.response?.data?.error || "Failed to save decider result"),
  })

  const scoreMut = useMutation({
    mutationFn: ({ id, scores }) => api.post(`/duo/fixtures/${id}/score`, {
      set1HomeScore: Number(scores.set1HomeScore), set1AwayScore: Number(scores.set1AwayScore),
      set2HomeScore: Number(scores.set2HomeScore), set2AwayScore: Number(scores.set2AwayScore),
    }).then(r => r.data),
    onSuccess: invalidate,
  })

  const groups = data?.groups || []
  const fixtures = data?.fixtures || []
  const groupFixtures = fixtures.filter(f => !f.knockout_round)
  const knockoutFixtures = fixtures.filter(f => f.knockout_round)
  const knockoutRounds = [...new Set(knockoutFixtures.map(f => f.knockout_round))].sort()

  const groupMap = {}
  groups.forEach(row => {
    if (!groupMap[row.name]) groupMap[row.name] = []
    groupMap[row.name].push(row)
  })

  const setsReady = savedSets?.confirmed
  const drawDone  = groups.length > 0

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
          {/* Draw button — only after sets confirmed */}
          {setsReady && !drawDone && (
            <button onClick={() => navigate(`/duo/draw/${season}`)}
              className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-accent/90">
              <Shuffle className="w-4 h-4" /> Draw Pairs
            </button>
          )}
          {/* Re-draw after draw is done */}
          {drawDone && (
            <button onClick={() => navigate(`/duo/draw/${season}`)}
              className="flex items-center gap-2 bg-accent/20 text-accent border border-accent/30 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-accent/30">
              <Shuffle className="w-4 h-4" /> Re-draw
            </button>
          )}
          {drawDone && (
            <button onClick={() => { if (window.confirm(`Delete all Season ${season} duo data?`)) deleteMut.mutate(season) }}
              disabled={deleteMut.isPending}
              className="flex items-center gap-2 bg-rose-500/20 text-rose-400 border border-rose-500/30 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-rose-500/30 disabled:opacity-50">
              <Trash2 className="w-4 h-4" /> Delete Season
            </button>
          )}
          {drawDone && knockoutRounds.length === 0 && (
            <button onClick={() => knockoutMut.mutate(season)} disabled={knockoutMut.isPending}
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

      {/* Set Selection — shown when draw not done yet */}
      {!drawDone && (
        <SetSelection season={season} onConfirmed={() => setSetsConfirmed(true)} />
      )}

      {/* Tabs */}
      {drawDone && (
        <>
          <div className="flex gap-1 border-b border-surface-border">
            {["pairs", "groups", "fixtures", "knockout"].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={cn("px-4 py-2 text-sm font-semibold capitalize transition-colors border-b-2 -mb-px",
                  activeTab === tab ? "border-accent text-accent" : "border-transparent text-slate-400 hover:text-white")}>
                {tab}
              </button>
            ))}
          </div>
          {isLoading ? <div className="text-center py-12 text-slate-500">Loading...</div> : (
            <>
              {activeTab === "pairs"    && <PairsView season={season} groupMap={groupMap} />}
              {activeTab === "groups"   && (
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
                            <th className="px-2 py-2">P</th><th className="px-2 py-2">W</th>
                            <th className="px-2 py-2">D</th><th className="px-2 py-2">L</th>
                            <th className="px-2 py-2">GD</th><th className="px-2 py-2 text-gold">Pts</th>
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
              {activeTab === "fixtures" && <FixturesByRound fixtures={groupFixtures} onSave={(id, scores) => scoreMut.mutate({ id, scores })} />}
              {activeTab === "knockout" && (
                <div className="space-y-6">
                  {knockoutRounds.length === 0
                    ? <p className="text-slate-500 text-sm text-center py-8">Knockout not generated yet.</p>
                    : knockoutRounds.map(round => (
                        <div key={round}>
                          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">{ROUND_LABELS[round] || round}</h3>
                          <div className="space-y-2">
                            {knockoutFixtures.filter(f => f.knockout_round === round).map(f => (
                              <FixtureRow key={f.id} fixture={f}
                                onSave={(id, scores) => scoreMut.mutate({ id, scores })}
                                onDeciderSetup={(id, homePlayerId, awayPlayerId) => deciderSetupMut.mutate({ id, homePlayerId, awayPlayerId })}
                                onDeciderResult={(id, homeScore, awayScore) => deciderResultMut.mutate({ id, homeScore, awayScore })}
                              />
                            ))}
                          </div>
                        </div>
                      ))
                  }
                </div>
              )}
            </>
          )}
        </>
      )}

      {!drawDone && !setsReady && !isLoading && (
        <div className="text-center py-8 text-slate-500">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Select Set 1 and Set 2 players above, then confirm to enable the Draw button.</p>
        </div>
      )}
    </div>
  )
}