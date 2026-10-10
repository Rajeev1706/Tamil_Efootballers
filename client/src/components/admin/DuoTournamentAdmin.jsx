import { useState, useEffect, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Users, Shuffle, Trophy, ChevronDown, ChevronUp, Save, Trash2, X, Download, Upload } from "lucide-react"
import { useNavigate } from "react-router-dom"
import api from "../../lib/api"
import { useSettings } from "../../lib/queries"
import { toPng } from "html-to-image"
import logoUrl from "../../../images/logo.png"
import { cn } from "../../lib/utils"
import { uploadTeamLogo } from "../../lib/supabase"

const ROUND_LABELS = { r16: "Round of 16", qf: "Quarter Finals", sf: "Semi Finals", final: "Final" }

const GRADE_COLORS = {
  S:    "bg-gold/20 text-gold border-gold/40",
  "A+": "bg-blue-400/20 text-blue-400 border-blue-400/40",
  A:    "bg-blue-400/20 text-blue-400 border-blue-400/40",
  B:    "bg-emerald-400/20 text-emerald-400 border-emerald-400/40",
  C:    "bg-slate-500/20 text-slate-400 border-slate-500/40",
}

// ── Pair Creator — admin manually creates pairs ───────────────────────────────
function PairCreator({ season, drawStatus }) {
  const qc = useQueryClient()
  const [name, setName]               = useState("")
  const [player1Id, setP1]            = useState("")
  const [player2Id, setP2]            = useState("")
  const [error, setError]             = useState("")
  const [logoPreview, setLogoPreview] = useState(null)
  const [uploadingLogo, setUL]        = useState(false)
  const [patchingId, setPatchingId]   = useState(null)   // pair id being logo-patched
  const logoInputRef                  = useRef(null)
  const patchInputRef                 = useRef(null)

  const locked = drawStatus === "drawn" || drawStatus === "revealed"

  const { data: allPlayers = [] } = useQuery({
    queryKey: ["players"],
    queryFn:  () => api.get("/players").then(r => r.data),
  })

  const { data: pairs = [], isLoading: pairsLoading } = useQuery({
    queryKey: ["duo-pairs", season],
    queryFn:  () => api.get(`/duo/pairs?season=${season}`).then(r => r.data),
    enabled:  !!season,
  })

  const addMut = useMutation({
    mutationFn: () => api.post("/duo/pairs", {
      seasonNumber: season,
      player1Id: Number(player1Id),
      player2Id: Number(player2Id),
      duoName: name.trim(),
      logoUrl: logoPreview || null,
    }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["duo-pairs", season] })
      setName(""); setP1(""); setP2(""); setError("")
      setLogoPreview(null)
    },
    onError: (err) => setError(err?.response?.data?.error || "Failed to add pair"),
  })

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/duo/pairs/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["duo-pairs", season] }),
    onError: (err) => alert(err?.response?.data?.error || "Failed to delete pair"),
  })

  const patchLogoMut = useMutation({
    mutationFn: ({ id, logoUrl }) => api.patch(`/duo/pairs/${id}/logo`, { logoUrl }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["duo-pairs", season] }),
    onError: (err) => alert(err?.response?.data?.error || "Logo update failed"),
  })

  async function handleLogoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUL(true)
    try {
      const url = await uploadTeamLogo("duo-" + Date.now(), file)
      setLogoPreview(url)
    } catch (err) {
      setError("Logo upload failed: " + (err?.message || ""))
    } finally {
      setUL(false)
      e.target.value = ""
    }
  }

  async function handlePatchLogo(pairId, e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPatchingId(pairId)
    try {
      const url = await uploadTeamLogo("duo-" + pairId, file)
      patchLogoMut.mutate({ id: pairId, logoUrl: url })
    } catch (err) {
      alert("Logo upload failed: " + (err?.message || ""))
    } finally {
      setPatchingId(null)
      e.target.value = ""
    }
  }

  // Build set of player IDs already used so they can't be double-picked
  const usedIds = new Set(pairs.flatMap(p => [p.set1Id, p.set2Id]))

  const canAdd = name.trim().length > 0 && player1Id && player2Id && player1Id !== player2Id

  return (
    <div className="space-y-4">
      {/* Create form — hidden once draw is done */}
      {!locked && (
        <div className="card p-5 space-y-4">
          <h3 className="text-sm font-bold text-white">Add Duo Pair</h3>

          {/* Logo upload */}
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Team Logo <span className="normal-case">(optional)</span></p>
            <div className="flex items-center gap-3">
              {logoPreview ? (
                <img src={logoPreview} alt="logo" className="w-12 h-12 rounded-xl object-cover border border-surface-border flex-shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-pitch-800 border border-dashed border-surface-border flex items-center justify-center flex-shrink-0">
                  <Upload className="w-4 h-4 text-slate-600" />
                </div>
              )}
              <div className="flex flex-col gap-1">
                <button type="button" onClick={() => logoInputRef.current?.click()}
                  disabled={uploadingLogo}
                  className="text-xs text-accent hover:text-accent/80 transition-colors disabled:opacity-50">
                  {uploadingLogo ? "Uploading…" : logoPreview ? "Change logo" : "Upload logo"}
                </button>
                {logoPreview && (
                  <button type="button" onClick={() => setLogoPreview(null)}
                    className="text-xs text-rose-400 hover:text-rose-300 transition-colors">
                    Remove
                  </button>
                )}
              </div>
              <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
            </div>
          </div>

          {/* Team name */}
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Team Name</p>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Thunder Bolt"
              className="w-full bg-pitch-800 border border-surface-border rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-accent/40" />
          </div>

          {/* Two player selects */}
          <div className="grid grid-cols-2 gap-3">
            {[{ label: "Player 1", val: player1Id, set: setP1 },
              { label: "Player 2", val: player2Id, set: setP2 }].map(({ label, val, set }) => (
              <div key={label}>
                <p className="text-[10px] text-slate-500 mb-1">{label}</p>
                <select value={val} onChange={e => set(e.target.value)}
                  className="w-full bg-pitch-800 border border-surface-border rounded-xl px-2 py-2 text-sm text-white">
                  <option value="">Pick player…</option>
                  {allPlayers
                    .filter(p => !usedIds.has(p.id) || p.id === Number(val))
                    .map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.grade})</option>
                    ))}
                </select>
              </div>
            ))}
          </div>

          {player1Id && player2Id && player1Id === player2Id && (
            <p className="text-xs text-rose-400">Player 1 and Player 2 must be different</p>
          )}
          {error && <p className="text-xs text-rose-400">{error}</p>}

          <button onClick={() => addMut.mutate()} disabled={!canAdd || addMut.isPending || uploadingLogo}
            className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-accent/90 disabled:opacity-50 transition-all">
            <Users className="w-4 h-4" />
            {addMut.isPending ? "Adding…" : "Add Pair"}
          </button>
        </div>
      )}

      {/* Pairs list */}
      <div className="space-y-2">
        {pairsLoading && <p className="text-slate-500 text-sm text-center py-4">Loading…</p>}
        {!pairsLoading && pairs.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No pairs yet — add your first duo above</p>
          </div>
        )}
        {pairs.map((pair, idx) => (
          <div key={pair.id} className="flex items-center gap-3 px-4 py-3 bg-pitch-800 rounded-xl border border-surface-border">
            <span className="text-xs text-slate-600 w-5 flex-shrink-0 font-mono">{idx + 1}</span>
            {/* Logo thumbnail */}
            {pair.logoUrl ? (
              <img src={pair.logoUrl} alt={pair.duoName} className="w-8 h-8 rounded-lg object-cover border border-surface-border flex-shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-pitch-900 border border-surface-border flex items-center justify-center flex-shrink-0">
                <span className="text-[9px] font-bold text-slate-600">{pair.duoName?.slice(0,2).toUpperCase()}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{pair.duoName}</p>
              <p className="text-xs text-slate-500 truncate">{pair.set1Name} & {pair.set2Name}</p>
            </div>
            {pair.groupName && (
              <span className="text-xs font-bold text-accent bg-accent/10 border border-accent/25 px-2 py-0.5 rounded-lg flex-shrink-0">
                {pair.groupName}
              </span>
            )}
            {/* Logo upload button for existing pairs */}
            {!locked && (
              <>
                <label className={cn(
                  "text-xs px-2 py-1 rounded-lg border cursor-pointer transition-colors flex-shrink-0",
                  patchingId === pair.id
                    ? "text-slate-500 border-slate-700 cursor-not-allowed"
                    : "text-slate-400 border-surface-border hover:text-accent hover:border-accent/40"
                )}>
                  {patchingId === pair.id ? "…" : <Upload className="w-3 h-3" />}
                  <input type="file" accept="image/*" className="hidden"
                    disabled={patchingId === pair.id}
                    onChange={(e) => handlePatchLogo(pair.id, e)} />
                </label>
                <button onClick={() => { if (window.confirm("Delete this pair?")) deleteMut.mutate(pair.id) }}
                  className="text-slate-600 hover:text-rose-400 transition-colors p-1 flex-shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {!locked && pairs.length > 0 && (
        <p className="text-xs text-slate-600 text-center">{pairs.length} pair{pairs.length !== 1 ? "s" : ""} ready — use "Start Draw" above when done</p>
      )}
    </div>
  )
}

// ── Score Entry + Fixture Row (unchanged) ─────────────────────────────────────
function ScoreEntry({ fixture, onSave, saving }) {
  // Lock set score inputs when decider result is already saved — prevent accidental overwrite
  const deciderCompleted = fixture.status === "completed" && fixture.decider_home_score != null

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
                disabled={deciderCompleted}
                className="w-12 text-center bg-pitch-800 border border-surface-border rounded-lg py-1 text-sm text-white disabled:opacity-40 disabled:cursor-not-allowed" />
              <span className="text-slate-500">–</span>
              <input type="number" min="0" value={scores[awayK]} onChange={e => set(awayK, e.target.value)}
                disabled={deciderCompleted}
                className="w-12 text-center bg-pitch-800 border border-surface-border rounded-lg py-1 text-sm text-white disabled:opacity-40 disabled:cursor-not-allowed" />
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
        else if (fixture.knockout_round && homeSets + awaySets > 0) { resultLabel = "1-1 — Decider match required"; resultColor = "text-orange-400" }
        else if (!fixture.knockout_round && homeSets + awaySets > 0) { resultLabel = "1-1 — Draw (1 pt each)"; resultColor = "text-amber-400" }
        return (
          <div className="flex items-center justify-between px-3 py-2 bg-pitch-800 rounded-lg">
            <span className="text-xs text-slate-400">Sets: {homeSets} – {awaySets}</span>
            <span className={`text-sm font-bold ${resultColor}`}>{resultLabel}</span>
          </div>
        )
      })()}
      {deciderCompleted ? (
        <p className="text-xs text-center text-orange-400 bg-orange-400/5 border border-orange-400/20 rounded-lg py-2">
          ⚡ Decided via decider match — edit via the Decider section below
        </p>
      ) : (
        <button onClick={() => onSave(fixture.id, scores)} disabled={saving}
          className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-lg text-sm font-semibold w-full justify-center hover:bg-accent/90 disabled:opacity-60 disabled:cursor-not-allowed transition-all active:scale-95">
          <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save Result"}
        </button>
      )}
    </div>
  )
}

// ── Decider Entry — shown when knockout fixture is 1-1 with equal aggregate ──
function DeciderEntry({ fixture, onSetup, onResult }) {
  const hasPlayers   = fixture.decider_home_player_id && fixture.decider_away_player_id
  const deciderDone  = fixture.decider_home_score != null && fixture.decider_away_score != null
  const [editing, setEditing]     = useState(false)
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

  // Show completed decider result with edit option
  if (deciderDone && !editing) {
    const homeWon = fixture.decider_home_score > fixture.decider_away_score
    return (
      <div className="mt-2 p-3 bg-emerald-400/5 border border-emerald-400/20 rounded-xl space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest">⚡ Decider Result</p>
          <button onClick={() => setEditing(true)} className="text-xs text-slate-400 hover:text-white transition-colors">Edit</button>
        </div>
        <div className="flex items-center justify-center gap-3">
          <span className={cn("text-sm font-semibold truncate", homeWon ? "text-emerald-400" : "text-slate-400")}>{homeName}</span>
          <span className="font-mono font-bold text-white bg-pitch-800 px-2 py-0.5 rounded text-sm">
            {fixture.decider_home_score} – {fixture.decider_away_score}
          </span>
          <span className={cn("text-sm font-semibold truncate", !homeWon ? "text-emerald-400" : "text-slate-400")}>{awayName}</span>
        </div>
        <p className="text-[10px] text-center text-slate-600">
          {homeWon ? homeName : awayName} wins the tie
        </p>
      </div>
    )
  }

  return (
    <div className="mt-2 p-3 bg-orange-400/5 border border-orange-400/30 rounded-xl space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-orange-400 uppercase tracking-widest">⚡ Decider Match — Pick one player from each pair</p>
        {editing && <button onClick={() => setEditing(false)} className="text-xs text-slate-400 hover:text-white">Cancel</button>}
      </div>

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

function FixtureRow({ fixture, onSave, onDeciderSetup, onDeciderResult, saving }) {
  const [open, setOpen] = useState(false)
  const isCompleted    = fixture.status === "completed"
  const needsDecider   = fixture.status === "needs_decider"

  // Set wins from stored scores
  const homeSets = ((fixture.set1_home_score > fixture.set1_away_score ? 1 : 0) +
                    (fixture.set2_home_score > fixture.set2_away_score ? 1 : 0))
  const awaySets = ((fixture.set1_away_score > fixture.set1_home_score ? 1 : 0) +
                    (fixture.set2_away_score > fixture.set2_home_score ? 1 : 0))

  const hasDecider = isCompleted && homeSets === awaySets && fixture.decider_home_score != null
  const homeWon    = isCompleted && fixture.winner_pair_id === fixture.home_pair_id
  const awayWon    = isCompleted && fixture.winner_pair_id === fixture.away_pair_id

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
            hasDecider ? (
              <div className="flex flex-col items-center gap-0.5 mx-4">
                <div className="flex items-center gap-1.5">
                  <span className={cn("text-base font-bold font-mono", homeWon ? "text-emerald-400" : "text-slate-400")}>{fixture.decider_home_score}</span>
                  <span className="text-slate-600 text-xs">–</span>
                  <span className={cn("text-base font-bold font-mono", awayWon ? "text-emerald-400" : "text-slate-400")}>{fixture.decider_away_score}</span>
                </div>
                <span className="text-[9px] text-orange-400 font-bold">DECIDER</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 mx-4">
                <span className={cn("text-lg font-bold font-mono", homeSets > awaySets ? "text-emerald-400" : "text-slate-400")}>{homeSets}</span>
                <span className="text-slate-600">–</span>
                <span className={cn("text-lg font-bold font-mono", awaySets > homeSets ? "text-emerald-400" : "text-slate-400")}>{awaySets}</span>
              </div>
            )
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
          <ScoreEntry fixture={fixture} onSave={onSave} saving={saving} />
          {(needsDecider || hasDecider) && fixture.knockout_round && (
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

// ── Duo Export Card (hidden off-screen, rendered to PNG) ─────────────────────
function DuoExportCard({ round, fixtures, exportRef, visible, season }) {
  const roundFixtures = fixtures.filter(f => f.round_number === round)
  const byGroup = roundFixtures.reduce((acc, f) => {
    (acc[f.groupName] = acc[f.groupName] || []).push(f); return acc
  }, {})
  const groupEntries = Object.entries(byGroup)

  return (
    <div ref={exportRef} style={{
      position: "fixed", left: visible ? 0 : "-9999px", top: 0,
      width: 1400, background: "#050810", padding: "36px 40px",
      fontFamily: "system-ui, sans-serif", overflow: "visible",
      zIndex: visible ? 9999 : -1, opacity: visible ? 1 : 0, pointerEvents: "none",
    }}>
      {/* Watermark */}
      <img src={logoUrl} alt="" style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: 320, height: 320, objectFit: "contain", opacity: 0.04, pointerEvents: "none",
      }} />
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32, position: "relative" }}>
        <img src={logoUrl} alt="TEC" style={{ width: 48, height: 48, objectFit: "contain" }} />
        <div>
          <p style={{ color: "#64748b", fontSize: 12, textTransform: "uppercase", letterSpacing: 2, margin: 0 }}>
            Tamil Efootballers · Duo Tournament S{season}
          </p>
          <p style={{ color: "#ffffff", fontSize: 26, fontWeight: 800, margin: 0 }}>Round {round} Fixtures</p>
        </div>
      </div>
      {/* Groups — 2 columns */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 28px", position: "relative" }}>
        {groupEntries.map(([groupName, gFixtures]) => (
          <div key={groupName}>
            <p style={{ color: "#22d3ee", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, marginBottom: 8, margin: "0 0 8px 0" }}>
              {groupName}
            </p>
            {gFixtures.map(f => {
              const homeSets = ((f.set1_home_score > f.set1_away_score ? 1 : 0) + (f.set2_home_score > f.set2_away_score ? 1 : 0))
              const awaySets = ((f.set1_away_score > f.set1_home_score ? 1 : 0) + (f.set2_away_score > f.set2_home_score ? 1 : 0))
              const done = f.status === "completed"
              const set1HomeWins = (f.set1_home_score ?? 0) > (f.set1_away_score ?? 0)
              const set2HomeWins = (f.set2_home_score ?? 0) > (f.set2_away_score ?? 0)
              const set1AwayWins = (f.set1_away_score ?? 0) > (f.set1_home_score ?? 0)
              const set2AwayWins = (f.set2_away_score ?? 0) > (f.set2_home_score ?? 0)
              return (
                <div key={f.id} style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 10, padding: "10px 16px", marginBottom: 7,
                }}>
                  {/* Set 1 row */}
                  <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ flex: 1, textAlign: "right" }}>
                      <span style={{ color: set1HomeWins ? "#f1f5f9" : "#64748b", fontSize: 13, fontWeight: set1HomeWins ? 700 : 400 }}>{f.homeSet1Name}</span>
                    </div>
                    <div style={{ padding: "0 12px", textAlign: "center", flexShrink: 0, minWidth: 52 }}>
                      {done
                        ? <span style={{ color: "#94a3b8", fontSize: 13, fontWeight: 800, fontFamily: "monospace" }}>{f.set1_home_score ?? 0} – {f.set1_away_score ?? 0}</span>
                        : <span style={{ color: "#334155", fontSize: 11, fontWeight: 600 }}>vs</span>
                      }
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ color: set1AwayWins ? "#f1f5f9" : "#64748b", fontSize: 13, fontWeight: set1AwayWins ? 700 : 400 }}>{f.awaySet1Name}</span>
                    </div>
                  </div>
                  {/* Divider */}
                  <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "0 0 6px 0" }} />
                  {/* Set 2 row */}
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <div style={{ flex: 1, textAlign: "right" }}>
                      <span style={{ color: set2HomeWins ? "#f1f5f9" : "#64748b", fontSize: 13, fontWeight: set2HomeWins ? 700 : 400 }}>{f.homeSet2Name}</span>
                    </div>
                    <div style={{ padding: "0 12px", textAlign: "center", flexShrink: 0, minWidth: 52 }}>
                      {done
                        ? <span style={{ color: "#94a3b8", fontSize: 13, fontWeight: 800, fontFamily: "monospace" }}>{f.set2_home_score ?? 0} – {f.set2_away_score ?? 0}</span>
                        : <span style={{ color: "#334155", fontSize: 11, fontWeight: 600 }}>vs</span>
                      }
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ color: set2AwayWins ? "#f1f5f9" : "#64748b", fontSize: 13, fontWeight: set2AwayWins ? 700 : 400 }}>{f.awaySet2Name}</span>
                    </div>
                  </div>
                  {/* Match result badge */}
                  {done && (
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
                        background: homeSets > awaySets ? "rgba(34,197,94,0.15)" : awaySets > homeSets ? "rgba(239,68,68,0.15)" : "rgba(234,179,8,0.15)",
                        color: homeSets > awaySets ? "#4ade80" : awaySets > homeSets ? "#f87171" : "#facc15",
                        border: `1px solid ${homeSets > awaySets ? "rgba(34,197,94,0.3)" : awaySets > homeSets ? "rgba(239,68,68,0.3)" : "rgba(234,179,8,0.3)"}`,
                      }}>
                        {homeSets > awaySets ? `${f.homeDuoName} wins ${homeSets}-${awaySets}` : awaySets > homeSets ? `${f.awayDuoName} wins ${awaySets}-${homeSets}` : "Draw 1-1"}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}


// ── Knockout Export Card ──────────────────────────────────────────────────────
function KnockoutExportCard({ round, fixtures, exportRef, visible, season }) {
  const roundFixtures = fixtures.filter(f => f.knockout_round === round)
  return (
    <div ref={exportRef} style={{
      position: "fixed", left: visible ? 0 : "-9999px", top: 0,
      width: 1400, background: "#050810", padding: "36px 40px",
      fontFamily: "system-ui, sans-serif", overflow: "visible",
      zIndex: visible ? 9999 : -1, opacity: visible ? 1 : 0, pointerEvents: "none",
    }}>
      <img src={logoUrl} alt="" style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: 320, height: 320, objectFit: "contain", opacity: 0.04, pointerEvents: "none",
      }} />
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
        <img src={logoUrl} alt="TEC" style={{ width: 48, height: 48, objectFit: "contain" }} />
        <div>
          <p style={{ color: "#64748b", fontSize: 12, textTransform: "uppercase", letterSpacing: 2, margin: 0 }}>
            Tamil Efootballers · Duo Tournament S{season}
          </p>
          <p style={{ color: "#ffffff", fontSize: 26, fontWeight: 800, margin: 0 }}>
            {ROUND_LABELS[round] || round} Fixtures
          </p>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 28px" }}>
        {roundFixtures.map(f => {
          const set1HomeWins = (f.set1_home_score ?? 0) > (f.set1_away_score ?? 0)
          const set2HomeWins = (f.set2_home_score ?? 0) > (f.set2_away_score ?? 0)
          const set1AwayWins = (f.set1_away_score ?? 0) > (f.set1_home_score ?? 0)
          const set2AwayWins = (f.set2_away_score ?? 0) > (f.set2_home_score ?? 0)
          const done = f.status === "completed"
          return (
            <div key={f.id} style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10, padding: "10px 16px", marginBottom: 7,
            }}>
              <p style={{ color: "#64748b", fontSize: 10, fontWeight: 700, margin: "0 0 8px 0" }}>
                {f.homeDuoName} vs {f.awayDuoName}
              </p>
              {/* Set 1 */}
              <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
                <div style={{ flex: 1, textAlign: "right" }}>
                  <span style={{ color: set1HomeWins ? "#f1f5f9" : "#64748b", fontSize: 13, fontWeight: set1HomeWins ? 700 : 400 }}>{f.homeSet1Name}</span>
                </div>
                <div style={{ padding: "0 12px", textAlign: "center", flexShrink: 0, minWidth: 52 }}>
                  {done
                    ? <span style={{ color: "#94a3b8", fontSize: 13, fontWeight: 800, fontFamily: "monospace" }}>{f.set1_home_score ?? 0} – {f.set1_away_score ?? 0}</span>
                    : <span style={{ color: "#334155", fontSize: 11, fontWeight: 600 }}>vs</span>
                  }
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ color: set1AwayWins ? "#f1f5f9" : "#64748b", fontSize: 13, fontWeight: set1AwayWins ? 700 : 400 }}>{f.awaySet1Name}</span>
                </div>
              </div>
              <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "0 0 6px 0" }} />
              {/* Set 2 */}
              <div style={{ display: "flex", alignItems: "center" }}>
                <div style={{ flex: 1, textAlign: "right" }}>
                  <span style={{ color: set2HomeWins ? "#f1f5f9" : "#64748b", fontSize: 13, fontWeight: set2HomeWins ? 700 : 400 }}>{f.homeSet2Name}</span>
                </div>
                <div style={{ padding: "0 12px", textAlign: "center", flexShrink: 0, minWidth: 52 }}>
                  {done
                    ? <span style={{ color: "#94a3b8", fontSize: 13, fontWeight: 800, fontFamily: "monospace" }}>{f.set2_home_score ?? 0} – {f.set2_away_score ?? 0}</span>
                    : <span style={{ color: "#334155", fontSize: 11, fontWeight: 600 }}>vs</span>
                  }
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ color: set2AwayWins ? "#f1f5f9" : "#64748b", fontSize: 13, fontWeight: set2AwayWins ? 700 : 400 }}>{f.awaySet2Name}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}


function FixturesByRound({ fixtures, onSave, saving, season }) {
  const rounds = [...new Set(fixtures.map(f => f.round_number).filter(Boolean))].sort((a,b) => a-b)
  const [activeRound, setActiveRound] = useState(rounds[0] || 1)
  const [exporting, setExporting] = useState(false)
  const [showExportCard, setShowExportCard] = useState(false)
  const exportRef = useRef(null)

  if (rounds.length === 0) return <p className="text-slate-500 text-sm text-center py-8">No fixtures yet — generate a draw first.</p>
  const byGroup = fixtures.filter(f => f.round_number === activeRound).reduce((acc, f) => {
    (acc[f.groupName] = acc[f.groupName]||[]).push(f); return acc
  }, {})

  async function handleExport() {
    if (!exportRef.current) return
    setShowExportCard(true)
    setExporting(true)
    await new Promise(r => setTimeout(r, 400))
    try {
      const el = exportRef.current
      const dataUrl = await toPng(el, {
        cacheBust: true, pixelRatio: 2, backgroundColor: "#050810",
        width: el.scrollWidth, height: el.scrollHeight,
      })
      const link = document.createElement("a")
      link.download = `Duo-Round-${activeRound}-Fixtures.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      alert("Export failed: " + (err?.message || "Could not generate image"))
    } finally {
      setExporting(false)
      setShowExportCard(false)
    }
  }

  return (
    <div className="space-y-4">
      <DuoExportCard round={activeRound} fixtures={fixtures} exportRef={exportRef} visible={showExportCard} season={season} />
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {rounds.map(r => (
            <button key={r} onClick={() => setActiveRound(r)}
              className={cn("px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all",
                activeRound === r ? "bg-accent text-white border-accent" : "bg-pitch-800 text-slate-400 border-surface-border hover:text-white")}>
              Round {r}
            </button>
          ))}
        </div>
        <button onClick={handleExport} disabled={exporting}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent/15 text-accent border border-accent/25 text-xs font-semibold hover:bg-accent/25 transition-colors disabled:opacity-50">
          <Download className="w-3.5 h-3.5" />
          {exporting ? "Exporting…" : "Export PNG"}
        </button>
      </div>
      <div className="space-y-6">
        {Object.entries(byGroup).map(([groupName, gFixtures]) => (
          <div key={groupName}>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">{groupName}</h3>
            <div className="space-y-2">
              {gFixtures.map(f => <FixtureRow key={f.id} fixture={f} onSave={onSave} saving={saving} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
// ── KnockoutTab — shows knockout rounds with per-round Export PNG ─────────────
function KnockoutTab({ fixtures, rounds, season, scoreMut, deciderSetupMut, deciderResultMut }) {
  const [activeRound, setActiveRound] = useState(rounds[0] || "r16")
  const [exporting, setExporting]     = useState(false)
  const [showExport, setShowExport]   = useState(false)
  const exportRef = useRef(null)

  if (rounds.length === 0) return <p className="text-slate-500 text-sm text-center py-8">Knockout not generated yet.</p>

  async function handleExport() {
    if (!exportRef.current) return
    setShowExport(true); setExporting(true)
    await new Promise(r => setTimeout(r, 400))
    try {
      const el = exportRef.current
      const { toPng } = await import("html-to-image")
      const dataUrl = await toPng(el, {
        cacheBust: true, pixelRatio: 2, backgroundColor: "#050810",
        width: el.scrollWidth, height: el.scrollHeight,
      })
      const link = document.createElement("a")
      link.download = `Duo-${ROUND_LABELS[activeRound] || activeRound}-Fixtures.png`
      link.href = dataUrl; link.click()
    } catch (err) { alert("Export failed: " + (err?.message || "")) }
    finally { setExporting(false); setShowExport(false) }
  }

  const roundFixtures = fixtures.filter(f => f.knockout_round === activeRound)

  return (
    <div className="space-y-4">
      <KnockoutExportCard round={activeRound} fixtures={fixtures} exportRef={exportRef} visible={showExport} season={season} />
      {/* Round tabs + Export */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {rounds.map(r => (
            <button key={r} onClick={() => setActiveRound(r)}
              className={cn("px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all",
                activeRound === r ? "bg-accent text-white border-accent" : "bg-pitch-800 text-slate-400 border-surface-border hover:text-white")}>
              {ROUND_LABELS[r] || r}
            </button>
          ))}
        </div>
        <button onClick={handleExport} disabled={exporting}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent/15 text-accent border border-accent/25 text-xs font-semibold hover:bg-accent/25 transition-colors disabled:opacity-50">
          <Download className="w-3.5 h-3.5" />
          {exporting ? "Exporting…" : "Export PNG"}
        </button>
      </div>
      {/* Fixtures */}
      <div className="space-y-2">
        {roundFixtures.map(f => (
          <FixtureRow key={f.id} fixture={f}
            onSave={(id, scores) => scoreMut.mutate({ id, scores })}
            saving={scoreMut.isPending}
            onDeciderSetup={(id, hp, ap) => deciderSetupMut.mutate({ id, homePlayerId: hp, awayPlayerId: ap })}
            onDeciderResult={(id, hs, as_) => deciderResultMut.mutate({ id, homeScore: hs, awayScore: as_ })}
          />
        ))}
      </div>
    </div>
  )
}


export default function DuoTournamentAdmin() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { data: settings = {} } = useSettings()
  const currentSeason = settings.current_season ? parseInt(settings.current_season) : null
  const [season, setSeason] = useState(null)
  const [activeTab, setActiveTab] = useState("pairs")

  useEffect(() => {
    if (currentSeason && season === null) setSeason(currentSeason)
  }, [currentSeason])

  // Admin-only draw status (always visible to admin regardless of public status)
  const { data: statusData, refetch: refetchStatus } = useQuery({
    queryKey: ["duo-draw-status", season],
    queryFn:  () => api.get(`/duo/draw-status?season=${season}`).then(r => r.data),
    enabled:  !!season,
  })
  const drawStatus = statusData?.drawStatus || "pending"

  // Public data (groups/fixtures only appear after revealed)
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["duo", season],
    queryFn:  () => api.get(`/duo/current?season=${season}`).then(r => r.data),
    enabled:  !!season,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["duo"] })
    qc.invalidateQueries({ queryKey: ["duo-draw-status", season] })
    qc.invalidateQueries({ queryKey: ["duo-pairs", season] })
    refetch()
    refetchStatus()
  }

  const drawMut = useMutation({
    mutationFn: () => api.post("/duo/generate", { seasonNumber: season }).then(r => r.data),
    onSuccess:  () => { invalidate() },
    onError: (err) => alert(err?.response?.data?.error || "Failed to start draw"),
  })

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
    onSuccess:  () => { invalidate(); setActiveTab("pairs") },
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

  const isRevealed = drawStatus === "revealed"
  const isDrawn    = drawStatus === "drawn"
  const isPending  = drawStatus === "pending"

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-bold text-white">Duo Tournament</h2>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">Season</label>
            <input type="number" value={season ?? ""} onChange={e => setSeason(Number(e.target.value))}
              className="w-16 bg-pitch-900 border border-surface-border rounded-lg px-2 py-1 text-sm text-white text-center" />
          </div>
          {/* Draw status badge */}
          {season && (
            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border",
              isPending  ? "bg-slate-700/50 text-slate-400 border-slate-600"  :
              isDrawn    ? "bg-amber-400/15 text-amber-400 border-amber-400/30" :
              "bg-emerald-400/15 text-emerald-400 border-emerald-400/30"
            )}>
              {isPending ? "SETUP" : isDrawn ? "DRAWN — HIDDEN" : "REVEALED"}
            </span>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Start Draw — only in pending phase */}
          {isPending && (
            <button onClick={() => { if (window.confirm("Start the draw? This will randomly assign pairs to groups.")) drawMut.mutate() }}
              disabled={drawMut.isPending}
              className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-accent/90 disabled:opacity-50">
              <Shuffle className="w-4 h-4" /> {drawMut.isPending ? "Drawing…" : "Start Draw"}
            </button>
          )}
          {/* Reveal Draw — only in drawn phase */}
          {isDrawn && (
            <button onClick={() => navigate(`/duo/draw/${season}`)}
              className="flex items-center gap-2 bg-amber-400/20 text-amber-400 border border-amber-400/30 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-amber-400/30">
              <Shuffle className="w-4 h-4" /> Reveal Draw
            </button>
          )}
          {/* Re-draw — only in drawn phase */}
          {isDrawn && (
            <button onClick={() => { if (window.confirm("Re-draw? This will shuffle groups again (pairs stay).")) drawMut.mutate() }}
              disabled={drawMut.isPending}
              className="flex items-center gap-2 bg-slate-700/50 text-slate-300 border border-slate-600 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-700">
              Re-draw
            </button>
          )}
          {/* Delete season */}
          {(isDrawn || isRevealed) && (
            <button onClick={() => { if (window.confirm(`Delete all Season ${season} duo data?`)) deleteMut.mutate(season) }}
              disabled={deleteMut.isPending}
              className="flex items-center gap-2 bg-rose-500/20 text-rose-400 border border-rose-500/30 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-rose-500/30 disabled:opacity-50">
              <Trash2 className="w-4 h-4" /> Delete Season
            </button>
          )}
          {/* Generate Knockout */}
          {isRevealed && knockoutRounds.length === 0 && (
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

      {/* Phase: pending or drawn — show pairs (with create form if pending) */}
      {(isPending || isDrawn) && (
        <>
          {isDrawn && (
            <div className="flex items-center gap-3 px-4 py-3 bg-amber-400/5 border border-amber-400/20 rounded-xl">
              <Shuffle className="w-5 h-5 text-amber-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-amber-400">Draw complete — groups assigned</p>
                <p className="text-xs text-slate-400">Groups are hidden from the public until you reveal the draw. Click <strong>Reveal Draw</strong> to launch the live reveal screen.</p>
              </div>
            </div>
          )}
          <PairCreator season={season} drawStatus={drawStatus} />
        </>
      )}

      {/* Phase: revealed — full tabs */}
      {isRevealed && (
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
              {activeTab === "pairs" && <PairCreator season={season} drawStatus={drawStatus} />}
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
              {activeTab === "fixtures" && <FixturesByRound fixtures={groupFixtures} onSave={(id, scores) => scoreMut.mutate({ id, scores })} saving={scoreMut.isPending} season={season} />}
              {activeTab === "knockout" && (
                <KnockoutTab
                  fixtures={knockoutFixtures}
                  rounds={knockoutRounds}
                  season={season}
                  scoreMut={scoreMut}
                  deciderSetupMut={deciderSetupMut}
                  deciderResultMut={deciderResultMut}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}