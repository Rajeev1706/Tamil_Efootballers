import { useState, useEffect, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Users, Shuffle, Trophy, ChevronDown, ChevronUp, Save, Trash2, X, Download, Upload, Pencil, Check } from "lucide-react"
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
  const [patchingId, setPatchingId]   = useState(null)
  const [editingPairId, setEditingId] = useState(null)
  const [editP1, setEditP1]           = useState("")
  const [editP2, setEditP2]           = useState("")
  const [editLogoPreview, setEditLP]  = useState(null)
  const [editUploading, setEditUL]    = useState(false)
  const logoInputRef                  = useRef(null)
  const patchInputRef                 = useRef(null)
  const editLogoRef                   = useRef(null)

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

  const editPairMut = useMutation({
    mutationFn: ({ id, set1PlayerId, set2PlayerId }) =>
      api.patch(`/duo/pairs/${id}`, { set1PlayerId, set2PlayerId }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["duo-pairs", season] })
      setEditingId(null)
    },
    onError: (err) => alert(err?.response?.data?.error || "Failed to update pair"),
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

  function openEdit(pair) {
    setEditingId(pair.id)
    setEditP1(String(pair.set1Id))
    setEditP2(String(pair.set2Id))
    setEditLP(pair.logoUrl || null)
  }

  async function handleEditLogoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setEditUL(true)
    try {
      const url = await uploadTeamLogo("duo-" + editingPairId, file)
      setEditLP(url)
    } catch (err) {
      alert("Logo upload failed: " + (err?.message || ""))
    } finally {
      setEditUL(false)
      e.target.value = ""
    }
  }

  async function saveEdit(pair) {
    // Save logo if changed
    if (editLogoPreview !== pair.logoUrl) {
      await patchLogoMut.mutateAsync({ id: pair.id, logoUrl: editLogoPreview || "" }).catch(() => {})
    }
    // Save players if changed
    if (String(editP1) !== String(pair.set1Id) || String(editP2) !== String(pair.set2Id)) {
      editPairMut.mutate({ id: pair.id, set1PlayerId: Number(editP1), set2PlayerId: Number(editP2) })
    } else {
      qc.invalidateQueries({ queryKey: ["duo-pairs", season] })
      setEditingId(null)
    }
  }

  const usedIds = new Set(pairs.flatMap(p => [p.set1Id, p.set2Id]))
  const canAdd = name.trim().length > 0 && player1Id && player2Id && player1Id !== player2Id

  return (
    <div className="space-y-4">
      {!locked && (
        <div className="card p-5 space-y-4">
          <h3 className="text-sm font-bold text-white">Add Duo Pair</h3>

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

          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Team Name</p>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Thunder Bolt"
              className="w-full bg-pitch-800 border border-surface-border rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-accent/40" />
          </div>

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

      <div className="space-y-2">
        {pairsLoading && <p className="text-slate-500 text-sm text-center py-4">Loading…</p>}
        {!pairsLoading && pairs.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No pairs yet — add your first duo above</p>
          </div>
        )}
        {pairs.map((pair, idx) => {
          const isEditing = editingPairId === pair.id
          // players available for edit dropdowns: exclude used except current pair's own players
          const usedExcludePair = new Set(pairs.flatMap(p => p.id === pair.id ? [] : [p.set1Id, p.set2Id]))

          return (
            <div key={pair.id} className="bg-pitch-800 rounded-xl border border-surface-border overflow-hidden">
              {/* Row */}
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="text-xs text-slate-600 w-5 flex-shrink-0 font-mono">{idx + 1}</span>
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
                {!locked && (
                  <>
                    <button
                      onClick={() => isEditing ? setEditingId(null) : openEdit(pair)}
                      className={cn(
                        "p-1.5 rounded-lg border transition-colors flex-shrink-0",
                        isEditing
                          ? "text-accent border-accent/40 bg-accent/10"
                          : "text-slate-400 border-surface-border hover:text-accent hover:border-accent/40"
                      )}>
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => { if (window.confirm("Delete this pair?")) deleteMut.mutate(pair.id) }}
                      className="text-slate-600 hover:text-rose-400 transition-colors p-1 flex-shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>

              {/* Inline Edit Panel */}
              {isEditing && (
                <div className="border-t border-surface-border px-4 py-4 space-y-3 bg-pitch-900/60">
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest">Edit Pair</p>

                  {/* Logo */}
                  <div className="flex items-center gap-3">
                    {editLogoPreview ? (
                      <img src={editLogoPreview} alt="logo" className="w-10 h-10 rounded-lg object-cover border border-surface-border flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-pitch-800 border border-dashed border-surface-border flex items-center justify-center flex-shrink-0">
                        <Upload className="w-3.5 h-3.5 text-slate-600" />
                      </div>
                    )}
                    <div className="flex flex-col gap-0.5">
                      <button type="button" onClick={() => editLogoRef.current?.click()}
                        disabled={editUploading}
                        className="text-xs text-accent hover:text-accent/80 transition-colors disabled:opacity-50 text-left">
                        {editUploading ? "Uploading…" : editLogoPreview ? "Change logo" : "Upload logo"}
                      </button>
                      {editLogoPreview && (
                        <button type="button" onClick={() => setEditLP(null)}
                          className="text-xs text-rose-400 hover:text-rose-300 transition-colors text-left">
                          Remove logo
                        </button>
                      )}
                    </div>
                    <input ref={editLogoRef} type="file" accept="image/*" onChange={handleEditLogoUpload} className="hidden" />
                  </div>

                  {/* Players */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Player 1", val: editP1, set: setEditP1, otherId: editP2 },
                      { label: "Player 2", val: editP2, set: setEditP2, otherId: editP1 },
                    ].map(({ label, val, set, otherId }) => (
                      <div key={label}>
                        <p className="text-[10px] text-slate-500 mb-1">{label}</p>
                        <select value={val} onChange={e => set(e.target.value)}
                          className="w-full bg-pitch-800 border border-surface-border rounded-lg px-2 py-1.5 text-xs text-white">
                          <option value="">Pick player…</option>
                          {allPlayers
                            .filter(p => !usedExcludePair.has(p.id) || String(p.id) === val)
                            .map(p => (
                              <option key={p.id} value={p.id} disabled={String(p.id) === otherId}>
                                {p.name} ({p.grade})
                              </option>
                            ))}
                        </select>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => saveEdit(pair)}
                      disabled={!editP1 || !editP2 || editP1 === editP2 || editPairMut.isPending || editUploading}
                      className="flex items-center gap-1.5 bg-accent text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-accent/90 disabled:opacity-50 transition-all">
                      <Check className="w-3 h-3" />
                      {editPairMut.isPending ? "Saving…" : "Save"}
                    </button>
                    <button onClick={() => setEditingId(null)}
                      className="flex items-center gap-1.5 text-slate-400 border border-surface-border px-3 py-1.5 rounded-lg text-xs hover:text-white transition-colors">
                      <X className="w-3 h-3" />
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {!locked && pairs.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-slate-600 text-center">{pairs.length} pair{pairs.length !== 1 ? "s" : ""} ready — use "Start Draw" above when done</p>
          {pairs.length < 24 && (
            <p className="text-xs text-amber-400/80 text-center">
              ⚠️ Need at least 24 pairs for the draw ({24 - pairs.length} more needed — minimum 3 per group × 8 groups)
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Player Setup Entry — admin picks which player from each duo plays Set 1 ───
function PlayerSetupEntry({ fixture, onSetup, setupMutPending }) {
  const homePlayers = [
    { id: fixture.homeSet1Id, name: fixture.homeSet1Name },
    { id: fixture.homeSet2Id, name: fixture.homeSet2Name },
  ].filter(p => p.id)
  const awayPlayers = [
    { id: fixture.awaySet1Id, name: fixture.awaySet1Name },
    { id: fixture.awaySet2Id, name: fixture.awaySet2Name },
  ].filter(p => p.id)

  const [selHome, setSelHome] = useState("")
  const [selAway, setSelAway] = useState("")

  const set2Home = homePlayers.find(p => p.id !== Number(selHome))
  const set2Away = awayPlayers.find(p => p.id !== Number(selAway))
  const canConfirm = selHome && selAway

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">Set Players</span>
        <span className="text-[10px] text-slate-600">— pick Set 1 players, Set 2 auto-fills</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] text-slate-500 mb-1">{fixture.homeDuoName} — Set 1</p>
          <select value={selHome} onChange={e => setSelHome(e.target.value)}
            className="w-full bg-pitch-800 border border-surface-border rounded-lg px-2 py-1.5 text-sm text-white">
            <option value="">Pick player…</option>
            {homePlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <p className="text-[10px] text-slate-500 mb-1">{fixture.awayDuoName} — Set 1</p>
          <select value={selAway} onChange={e => setSelAway(e.target.value)}
            className="w-full bg-pitch-800 border border-surface-border rounded-lg px-2 py-1.5 text-sm text-white">
            <option value="">Pick player…</option>
            {awayPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      {selHome && selAway && (
        <div className="text-[11px] text-slate-400 bg-pitch-800 rounded-lg px-3 py-2 space-y-1">
          <div className="flex gap-2">
            <span className="text-slate-600 w-10 flex-shrink-0">Set 1:</span>
            <span className="text-white font-semibold">{homePlayers.find(p => p.id === Number(selHome))?.name}</span>
            <span className="text-slate-600">vs</span>
            <span className="text-white font-semibold">{awayPlayers.find(p => p.id === Number(selAway))?.name}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-slate-600 w-10 flex-shrink-0">Set 2:</span>
            <span className="text-white font-semibold">{set2Home?.name}</span>
            <span className="text-slate-600">vs</span>
            <span className="text-white font-semibold">{set2Away?.name}</span>
          </div>
        </div>
      )}

      <button
        onClick={() => onSetup(fixture.id, Number(selHome), Number(selAway))}
        disabled={!canConfirm || setupMutPending}
        className="w-full bg-blue-500/20 border border-blue-400/40 text-blue-300 text-sm font-semibold py-2 rounded-lg disabled:opacity-40 hover:bg-blue-500/30 transition-colors"
      >
        {setupMutPending ? "Saving…" : "Confirm Players"}
      </button>
    </div>
  )
}

// ── Score Entry ───────────────────────────────────────────────────────────────
function ScoreEntry({ fixture, onSave, onPlayerSetup, playerSetupPending, saving }) {
  const isKnockout = !!fixture.knockout_round
  // For group: decider done if decider_home_score is set; for knockout: done if koDeciderId is set
  const deciderCompleted = isKnockout
    ? fixture.status === "completed" && fixture.koDeciderId != null
    : fixture.status === "completed" && fixture.decider_home_score != null
  const playersSet = !!(fixture.set1_home_player_id && fixture.set1_away_player_id)

  // Knockout uses a single homeScore/awayScore; group stage uses 4 set scores
  const [scores, setScores] = useState(
    isKnockout
      ? {
          homeScore: fixture.set1_home_score ?? "",
          awayScore: fixture.set1_away_score ?? "",
        }
      : {
          set1HomeScore: fixture.set1_home_score ?? "",
          set1AwayScore: fixture.set1_away_score ?? "",
          set2HomeScore: fixture.set2_home_score ?? "",
          set2AwayScore: fixture.set2_away_score ?? "",
        }
  )
  const set = (k, v) => setScores(s => ({ ...s, [k]: v }))

  // Resolved player names
  const set1HomeName = fixture.set1HomePlayerName || fixture.homeSet1Name
  const set1AwayName = fixture.set1AwayPlayerName || fixture.awaySet1Name
  const set2HomeName = fixture.set2HomePlayerName || fixture.homeSet2Name
  const set2AwayName = fixture.set2AwayPlayerName || fixture.awaySet2Name

  // For group stage only: show player setup if players not yet assigned
  if (!isKnockout && !playersSet && fixture.status !== "completed") {
    return (
      <div className="mt-3 p-3 bg-pitch-900 rounded-xl border border-blue-400/20">
        <PlayerSetupEntry
          fixture={fixture}
          onSetup={onPlayerSetup}
          setupMutPending={playerSetupPending}
        />
      </div>
    )
  }

  return (
    <div className="mt-3 p-3 bg-pitch-900 rounded-xl border border-surface-border space-y-3">
      {/* ── Knockout: random draw banner + single score input ── */}
      {isKnockout ? (
        <>
          <div className="text-[10px] text-violet-400 bg-violet-400/5 border border-violet-400/15 rounded-lg px-3 py-2 space-y-1">
            <div className="flex items-center gap-1.5 mb-1">
              <Shuffle className="w-3 h-3" />
              <span className="font-semibold">🎲 Random Draw — Assigned Matchup</span>
            </div>
            <div className="text-slate-300 font-medium">
              <span className="text-white">{set1HomeName}</span>
              <span className="text-slate-500 mx-1.5">vs</span>
              <span className="text-white">{set1AwayName}</span>
            </div>
          </div>

          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Match Score</p>
            <p className="text-xs text-slate-400 mb-1.5">{set1HomeName} vs {set1AwayName}</p>
            <div className="flex items-center gap-2">
              <input type="number" min="0" value={scores.homeScore} onChange={e => set("homeScore", e.target.value)}
                disabled={deciderCompleted}
                className="w-12 text-center bg-pitch-800 border border-surface-border rounded-lg py-1 text-sm text-white disabled:opacity-40 disabled:cursor-not-allowed" />
              <span className="text-slate-500">–</span>
              <input type="number" min="0" value={scores.awayScore} onChange={e => set("awayScore", e.target.value)}
                disabled={deciderCompleted}
                className="w-12 text-center bg-pitch-800 border border-surface-border rounded-lg py-1 text-sm text-white disabled:opacity-40 disabled:cursor-not-allowed" />
            </div>
          </div>

          {(() => {
            const hs = Number(scores.homeScore) || 0
            const as_ = Number(scores.awayScore) || 0
            let label = "", color = "text-slate-400"
            if (hs > as_)       { label = `${fixture.homeDuoName} wins`; color = "text-emerald-400" }
            else if (as_ > hs)  { label = `${fixture.awayDuoName} wins`; color = "text-emerald-400" }
            else if (hs + as_ > 0) { label = "Draw — Decider match required"; color = "text-orange-400" }
            return label ? (
              <div className="flex items-center justify-end px-3 py-2 bg-pitch-800 rounded-lg">
                <span className={`text-sm font-bold ${color}`}>{label}</span>
              </div>
            ) : null
          })()}
        </>
      ) : (
        /* ── Group stage: two-set score inputs ── */
        <>
          {playersSet && (
            <div className="text-[10px] text-blue-400 bg-blue-400/5 border border-blue-400/15 rounded-lg px-3 py-1.5 flex items-center justify-between">
              <span>Players assigned</span>
              {fixture.status !== "completed" && (
                <button
                  onClick={() => onPlayerSetup(fixture.id, null, null)}
                  className="text-slate-500 hover:text-white transition-colors text-[10px]"
                >
                  Reset
                </button>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Set 1 Match", homeK: "set1HomeScore", awayK: "set1AwayScore", homeName: set1HomeName, awayName: set1AwayName },
              { label: "Set 2 Match", homeK: "set2HomeScore", awayK: "set2AwayScore", homeName: set2HomeName, awayName: set2AwayName },
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
            const s1h = Number(scores.set1HomeScore) || 0
            const s1a = Number(scores.set1AwayScore) || 0
            const s2h = Number(scores.set2HomeScore) || 0
            const s2a = Number(scores.set2AwayScore) || 0
            const homeSets = (s1h > s1a ? 1 : 0) + (s2h > s2a ? 1 : 0)
            const awaySets = (s1a > s1h ? 1 : 0) + (s2a > s2h ? 1 : 0)
            let resultLabel = "", resultColor = "text-amber-400"
            if (homeSets > awaySets)      { resultLabel = `${fixture.homeDuoName} wins 2-0`; resultColor = "text-emerald-400" }
            else if (awaySets > homeSets) { resultLabel = `${fixture.awayDuoName} wins 2-0`; resultColor = "text-emerald-400" }
            else if (homeSets + awaySets > 0) { resultLabel = "1-1 — Draw (1 pt each)"; resultColor = "text-amber-400" }
            return resultLabel ? (
              <div className="flex items-center justify-between px-3 py-2 bg-pitch-800 rounded-lg">
                <span className="text-xs text-slate-400">Sets: {homeSets} – {awaySets}</span>
                <span className={`text-sm font-bold ${resultColor}`}>{resultLabel}</span>
              </div>
            ) : null
          })()}
        </>
      )}

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

// ── Knockout Decider Entry — single-step: pick players + enter score ──────────
function KnockoutDeciderEntry({ fixture, onDecider, pending }) {
  const deciderDone = fixture.koDeciderId != null
  const [editing, setEditing] = useState(false)

  const homePlayers = [
    { id: fixture.homeSet1Id, name: fixture.homeSet1Name },
    { id: fixture.homeSet2Id, name: fixture.homeSet2Name },
  ].filter(p => p.id)
  const awayPlayers = [
    { id: fixture.awaySet1Id, name: fixture.awaySet1Name },
    { id: fixture.awaySet2Id, name: fixture.awaySet2Name },
  ].filter(p => p.id)

  const [selHome, setSelHome] = useState("")
  const [selAway, setSelAway] = useState("")
  const [homeScore, setHomeScore] = useState("")
  const [awayScore, setAwayScore] = useState("")

  const isDraw = homeScore !== "" && awayScore !== "" && homeScore === awayScore
  const canSubmit = selHome && selAway && homeScore !== "" && awayScore !== "" && !isDraw

  // Show result if decider is done and not editing
  if (deciderDone && !editing) {
    const homeWon = fixture.koDeciderHomeScore > fixture.koDeciderAwayScore
    return (
      <div className="mt-2 p-3 bg-emerald-400/5 border border-emerald-400/20 rounded-xl space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest">⚡ Decider Result</p>
          <button onClick={() => setEditing(true)} className="text-xs text-slate-400 hover:text-white transition-colors">Edit</button>
        </div>
        <div className="flex items-center justify-center gap-3">
          <span className={cn("text-sm font-semibold truncate", homeWon ? "text-emerald-400" : "text-slate-400")}>
            {fixture.koDeciderHomePlayerName}
          </span>
          <span className="font-mono font-bold text-white bg-pitch-800 px-2 py-0.5 rounded text-sm">
            {fixture.koDeciderHomeScore} – {fixture.koDeciderAwayScore}
          </span>
          <span className={cn("text-sm font-semibold truncate", !homeWon ? "text-emerald-400" : "text-slate-400")}>
            {fixture.koDeciderAwayPlayerName}
          </span>
        </div>
        <p className="text-[10px] text-center text-slate-600">
          {homeWon ? fixture.koDeciderHomePlayerName : fixture.koDeciderAwayPlayerName} wins the tie
        </p>
      </div>
    )
  }

  return (
    <div className="mt-2 p-3 bg-orange-400/5 border border-orange-400/30 rounded-xl space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-orange-400 uppercase tracking-widest">⚡ Decider Match</p>
        {editing && <button onClick={() => setEditing(false)} className="text-xs text-slate-400 hover:text-white">Cancel</button>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] text-slate-500 mb-1">{fixture.homeDuoName}</p>
          <select value={selHome} onChange={e => setSelHome(e.target.value)}
            className="w-full bg-pitch-900 border border-surface-border rounded-lg px-2 py-1.5 text-sm text-white">
            <option value="">Pick player…</option>
            {homePlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <p className="text-[10px] text-slate-500 mb-1">{fixture.awayDuoName}</p>
          <select value={selAway} onChange={e => setSelAway(e.target.value)}
            className="w-full bg-pitch-900 border border-surface-border rounded-lg px-2 py-1.5 text-sm text-white">
            <option value="">Pick player…</option>
            {awayPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      {selHome && selAway && (
        <p className="text-xs text-slate-400 text-center">
          {homePlayers.find(p => p.id === Number(selHome))?.name} vs {awayPlayers.find(p => p.id === Number(selAway))?.name}
        </p>
      )}

      <div className="flex items-center gap-3 justify-center">
        <input type="number" min="0" value={homeScore} onChange={e => setHomeScore(e.target.value)}
          className="w-16 text-center bg-pitch-800 border border-surface-border rounded-lg py-1.5 text-sm text-white" />
        <span className="text-slate-500 font-bold">–</span>
        <input type="number" min="0" value={awayScore} onChange={e => setAwayScore(e.target.value)}
          className="w-16 text-center bg-pitch-800 border border-surface-border rounded-lg py-1.5 text-sm text-white" />
      </div>

      {isDraw && (
        <p className="text-xs text-rose-400 text-center">Decider must have a winner — scores cannot be equal</p>
      )}

      <button
        onClick={() => onDecider(fixture.id, Number(selHome), Number(selAway), Number(homeScore), Number(awayScore))}
        disabled={!canSubmit || pending}
        className="w-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-sm font-semibold py-2 rounded-lg disabled:opacity-40 hover:bg-emerald-500/30 transition-colors"
      >
        {pending ? "Saving…" : "Save Decider Result"}
      </button>
    </div>
  )
}

function FixtureRow({ fixture, onSave, onPlayerSetup, playerSetupPending, onDecider, knockoutDeciderPending, saving }) {
  const [open, setOpen] = useState(false)
  const isCompleted  = fixture.status === "completed"
  const needsDecider = fixture.status === "needs_decider"
  const isKnockout   = !!fixture.knockout_round

  const homeSets = ((fixture.set1_home_score > fixture.set1_away_score ? 1 : 0) +
                    (fixture.set2_home_score > fixture.set2_away_score ? 1 : 0))
  const awaySets = ((fixture.set1_away_score > fixture.set1_home_score ? 1 : 0) +
                    (fixture.set2_away_score > fixture.set2_home_score ? 1 : 0))

  // hasDecider: knockout uses koDeciderId, group stage uses decider_home_score
  const hasDecider = isKnockout
    ? isCompleted && fixture.koDeciderId != null
    : isCompleted && homeSets === awaySets && fixture.decider_home_score != null

  const homeWon = isCompleted && fixture.winner_pair_id === fixture.home_pair_id
  const awayWon = isCompleted && fixture.winner_pair_id === fixture.away_pair_id

  // Use admin-selected names for display
  const set1HomeName = fixture.set1HomePlayerName || fixture.homeSet1Name
  const set1AwayName = fixture.set1AwayPlayerName || fixture.awaySet1Name
  const set2HomeName = fixture.set2HomePlayerName || fixture.homeSet2Name
  const set2AwayName = fixture.set2AwayPlayerName || fixture.awaySet2Name
  const playersSet   = !!(fixture.set1_home_player_id && fixture.set1_away_player_id)

  // Decider scores: knockout uses koDecider fields, group stage uses old fields
  const deciderHomeScore = isKnockout ? fixture.koDeciderHomeScore : fixture.decider_home_score
  const deciderAwayScore = isKnockout ? fixture.koDeciderAwayScore : fixture.decider_away_score

  return (
    <div className={cn("border rounded-xl overflow-hidden",
      needsDecider ? "border-orange-400/40" : "border-surface-border")}>
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors">
        <div className="flex-1 flex items-center justify-between min-w-0">
          <div className="text-left min-w-0">
            <p className="text-sm font-semibold text-white truncate">{fixture.homeDuoName}</p>
            <p className="text-xs text-slate-500 truncate">{set1HomeName} & {set2HomeName}</p>
          </div>
          {isCompleted ? (
            hasDecider ? (
              <div className="flex flex-col items-center gap-0.5 mx-4">
                <div className="flex items-center gap-1.5">
                  <span className={cn("text-base font-bold font-mono", homeWon ? "text-emerald-400" : "text-slate-400")}>{deciderHomeScore}</span>
                  <span className="text-slate-600 text-xs">–</span>
                  <span className={cn("text-base font-bold font-mono", awayWon ? "text-emerald-400" : "text-slate-400")}>{deciderAwayScore}</span>
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
          ) : !playersSet && !isKnockout ? (
            <span className="text-[10px] text-blue-400 font-semibold mx-4 bg-blue-400/10 border border-blue-400/20 px-2 py-0.5 rounded-lg">Setup needed</span>
          ) : (
            <span className="text-xs text-slate-500 mx-4">vs</span>
          )}
          <div className="text-right min-w-0">
            <p className="text-sm font-semibold text-white truncate">{fixture.awayDuoName}</p>
            <p className="text-xs text-slate-500 truncate">{set1AwayName} & {set2AwayName}</p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          <ScoreEntry
            fixture={fixture}
            onSave={onSave}
            onPlayerSetup={onPlayerSetup}
            playerSetupPending={playerSetupPending}
            saving={saving}
          />
          {(needsDecider || hasDecider) && isKnockout && (
            <KnockoutDeciderEntry
              fixture={fixture}
              onDecider={onDecider}
              pending={knockoutDeciderPending}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ── Duo Export Card ───────────────────────────────────────────────────────────
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
      <img src={logoUrl} alt="" style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: 320, height: 320, objectFit: "contain", opacity: 0.04, pointerEvents: "none",
      }} />
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32, position: "relative" }}>
        <img src={logoUrl} alt="TEC" style={{ width: 48, height: 48, objectFit: "contain" }} />
        <div>
          <p style={{ color: "#64748b", fontSize: 12, textTransform: "uppercase", letterSpacing: 2, margin: 0 }}>
            Tamil Efootballers · Duo Tournament S{season}
          </p>
          <p style={{ color: "#ffffff", fontSize: 26, fontWeight: 800, margin: 0 }}>Round {round} Fixtures</p>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 28px", position: "relative" }}>
        {groupEntries.map(([groupName, gFixtures]) => (
          <div key={groupName}>
            <p style={{ color: "#22d3ee", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, marginBottom: 8, margin: "0 0 8px 0" }}>
              {groupName}
            </p>
            {gFixtures.map(f => {
              const homeSets = ((f.set1_home_score > f.set1_away_score ? 1 : 0) + (f.set2_home_score > f.set2_away_score ? 1 : 0))
              const awaySets = ((f.set1_away_score > f.set1_home_score ? 1 : 0) + (f.set2_away_score > f.set2_home_score ? 1 : 0))
              const done     = f.status === "completed"
              const homeWon  = homeSets > awaySets
              const awayWon  = awaySets > homeSets
              return (
                <div key={f.id} style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 10, padding: "10px 16px", marginBottom: 7,
                  display: "flex", alignItems: "center",
                }}>
                  {/* Home team */}
                  <div style={{ flex: 1, textAlign: "right" }}>
                    <span style={{ color: homeWon ? "#f1f5f9" : "#94a3b8", fontSize: 14, fontWeight: homeWon ? 700 : 500 }}>
                      {f.homeDuoName}
                    </span>
                  </div>

                  {/* Score / vs */}
                  <div style={{ padding: "0 16px", textAlign: "center", flexShrink: 0, minWidth: 64 }}>
                    {done
                      ? <span style={{ color: "#e2e8f0", fontSize: 15, fontWeight: 800, fontFamily: "monospace" }}>
                          {homeSets} – {awaySets}
                        </span>
                      : <span style={{ color: "#334155", fontSize: 12, fontWeight: 600 }}>vs</span>
                    }
                  </div>

                  {/* Away team */}
                  <div style={{ flex: 1 }}>
                    <span style={{ color: awayWon ? "#f1f5f9" : "#94a3b8", fontSize: 14, fontWeight: awayWon ? 700 : 500 }}>
                      {f.awayDuoName}
                    </span>
                  </div>
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
          // Knockout: single randomly-assigned matchup (set1 player names)
          const assignedHomeName = f.set1HomePlayerName || f.homeSet1Name
          const assignedAwayName = f.set1AwayPlayerName || f.awaySet1Name
          const homeWinsMatch = (f.set1_home_score ?? 0) > (f.set1_away_score ?? 0)
          const awayWinsMatch = (f.set1_away_score ?? 0) > (f.set1_home_score ?? 0)
          const done = f.status === "completed" || f.status === "needs_decider"
          const deciderDone = f.koDeciderId != null
          return (
            <div key={f.id} style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10, padding: "10px 16px", marginBottom: 7,
            }}>
              {/* Team names header */}
              <p style={{ color: "#64748b", fontSize: 10, fontWeight: 700, margin: "0 0 8px 0" }}>
                {f.homeDuoName} vs {f.awayDuoName}
              </p>
              {/* Assigned player matchup */}
              <div style={{ display: "flex", alignItems: "center", marginBottom: deciderDone ? 6 : 0 }}>
                <div style={{ flex: 1, textAlign: "right" }}>
                  <span style={{ color: homeWinsMatch ? "#f1f5f9" : "#94a3b8", fontSize: 13, fontWeight: homeWinsMatch ? 700 : 400 }}>
                    {assignedHomeName}
                  </span>
                </div>
                <div style={{ padding: "0 12px", textAlign: "center", flexShrink: 0, minWidth: 52 }}>
                  {done
                    ? <span style={{ color: f.status === "needs_decider" ? "#fb923c" : "#94a3b8", fontSize: 13, fontWeight: 800, fontFamily: "monospace" }}>
                        {f.status === "needs_decider" ? "DRAW" : `${f.set1_home_score ?? 0} – ${f.set1_away_score ?? 0}`}
                      </span>
                    : <span style={{ color: "#334155", fontSize: 11, fontWeight: 600 }}>vs</span>
                  }
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ color: awayWinsMatch ? "#f1f5f9" : "#94a3b8", fontSize: 13, fontWeight: awayWinsMatch ? 700 : 400 }}>
                    {assignedAwayName}
                  </span>
                </div>
              </div>
              {/* Decider result if applicable */}
              {deciderDone && (
                <>
                  <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "6px 0" }} />
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <div style={{ flex: 1, textAlign: "right" }}>
                      <span style={{ color: "#94a3b8", fontSize: 12, fontWeight: 400 }}>{f.koDeciderHomePlayerName}</span>
                    </div>
                    <div style={{ padding: "0 12px", textAlign: "center", flexShrink: 0, minWidth: 52 }}>
                      <span style={{ color: "#f59e0b", fontSize: 12, fontWeight: 800, fontFamily: "monospace" }}>
                        ⚡ {f.koDeciderHomeScore} – {f.koDeciderAwayScore}
                      </span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ color: "#94a3b8", fontSize: 12, fontWeight: 400 }}>{f.koDeciderAwayPlayerName}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}


function FixturesByRound({ fixtures, onSave, onPlayerSetup, playerSetupPending, saving, season }) {
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
              {gFixtures.map(f => (
                <FixtureRow
                  key={f.id}
                  fixture={f}
                  onSave={onSave}
                  onPlayerSetup={onPlayerSetup}
                  playerSetupPending={playerSetupPending}
                  saving={saving}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── KnockoutTab ───────────────────────────────────────────────────────────────
function KnockoutTab({ fixtures, rounds, season, scoreMut, playerSetupMut, knockoutDeciderMut }) {
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
      <div className="space-y-2">
        {roundFixtures.map(f => (
          <FixtureRow key={f.id} fixture={f}
            onSave={(id, scores) => scoreMut.mutate({ id, scores, isKnockout: true })}
            saving={scoreMut.isPending}
            onPlayerSetup={(id, hp, ap) => playerSetupMut.mutate({ id, set1HomePlayerId: hp, set1AwayPlayerId: ap })}
            playerSetupPending={playerSetupMut.isPending}
            onDecider={(id, hp, ap, hs, as_) => knockoutDeciderMut.mutate({ id, homePlayerId: hp, awayPlayerId: ap, homeScore: hs, awayScore: as_ })}
            knockoutDeciderPending={knockoutDeciderMut.isPending}
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

  const { data: statusData, refetch: refetchStatus } = useQuery({
    queryKey: ["duo-draw-status", season],
    queryFn:  () => api.get(`/duo/draw-status?season=${season}`).then(r => r.data),
    enabled:  !!season,
  })
  const drawStatus = statusData?.drawStatus || "pending"

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

  // ── Player setup mutation (group stage) ───────────────────────────────────
  const playerSetupMut = useMutation({
    mutationFn: ({ id, set1HomePlayerId, set1AwayPlayerId }) =>
      api.post(`/duo/fixtures/${id}/player-setup`, { set1HomePlayerId, set1AwayPlayerId }).then(r => r.data),
    onSuccess: () => invalidate(),
    onError: (err) => alert(err?.response?.data?.error || "Failed to set players"),
  })

  // ── Knockout decider mutation (single-step: players + score in one call) ──
  const knockoutDeciderMut = useMutation({
    mutationFn: ({ id, homePlayerId, awayPlayerId, homeScore, awayScore }) =>
      api.post(`/duo/fixtures/${id}/knockout-decider`, { homePlayerId, awayPlayerId, homeScore, awayScore }).then(r => r.data),
    onSuccess: () => invalidate(),
    onError: (err) => alert(err?.response?.data?.error || "Failed to save decider result"),
  })

  const scoreMut = useMutation({
    mutationFn: ({ id, scores, isKnockout }) => api.post(`/duo/fixtures/${id}/score`,
      isKnockout
        ? { homeScore: Number(scores.homeScore), awayScore: Number(scores.awayScore) }
        : {
            set1HomeScore: Number(scores.set1HomeScore), set1AwayScore: Number(scores.set1AwayScore),
            set2HomeScore: Number(scores.set2HomeScore), set2AwayScore: Number(scores.set2AwayScore),
          }
    ).then(r => r.data),
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-bold text-white">Duo Tournament</h2>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">Season</label>
            <input type="number" value={season ?? ""} onChange={e => setSeason(Number(e.target.value))}
              className="w-16 bg-pitch-900 border border-surface-border rounded-lg px-2 py-1 text-sm text-white text-center" />
          </div>
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
          {isPending && (
            <button onClick={() => { if (window.confirm("Start the draw? This will randomly assign pairs to groups.")) drawMut.mutate() }}
              disabled={drawMut.isPending}
              className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-accent/90 disabled:opacity-50">
              <Shuffle className="w-4 h-4" /> {drawMut.isPending ? "Drawing…" : "Start Draw"}
            </button>
          )}
          {isDrawn && (
            <button onClick={() => navigate(`/duo/draw/${season}`)}
              className="flex items-center gap-2 bg-amber-400/20 text-amber-400 border border-amber-400/30 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-amber-400/30">
              <Shuffle className="w-4 h-4" /> View Draw
            </button>
          )}
          {isDrawn && (
            <button onClick={() => { if (window.confirm("Re-draw? This will shuffle groups again (pairs stay).")) drawMut.mutate() }}
              disabled={drawMut.isPending}
              className="flex items-center gap-2 bg-slate-700/50 text-slate-300 border border-slate-600 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-700">
              Re-draw
            </button>
          )}
          {(isDrawn || isRevealed) && (
            <button onClick={() => { if (window.confirm(`Delete all Season ${season} duo data?`)) deleteMut.mutate(season) }}
              disabled={deleteMut.isPending}
              className="flex items-center gap-2 bg-rose-500/20 text-rose-400 border border-rose-500/30 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-rose-500/30 disabled:opacity-50">
              <Trash2 className="w-4 h-4" /> Delete Season
            </button>
          )}
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
              {activeTab === "fixtures" && (
                <FixturesByRound
                  fixtures={groupFixtures}
                  onSave={(id, scores) => scoreMut.mutate({ id, scores })}
                  onPlayerSetup={(id, hp, ap) => playerSetupMut.mutate({ id, set1HomePlayerId: hp, set1AwayPlayerId: ap })}
                  playerSetupPending={playerSetupMut.isPending}
                  saving={scoreMut.isPending}
                  season={season}
                />
              )}
              {activeTab === "knockout" && (
                <KnockoutTab
                  fixtures={knockoutFixtures}
                  rounds={knockoutRounds}
                  season={season}
                  scoreMut={scoreMut}
                  playerSetupMut={playerSetupMut}
                  knockoutDeciderMut={knockoutDeciderMut}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}