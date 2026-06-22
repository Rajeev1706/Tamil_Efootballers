import { useState } from "react"
import { Plus, CheckCircle, ArrowRight, Trash2, Pencil, X, Save } from "lucide-react"
import GradeBadge from "../common/GradeBadge"
import { useLogRecord, useDeleteRecord, useEditRecord } from "../../lib/queries"
import { cn } from "../../lib/utils"

const MATCH_TYPES = [
  { value: "league", label: "Team League" },
  { value: "ucl",    label: "UCL"         },
  { value: "weekly", label: "Weekly"      },
]

const MATCH_TYPE_COLORS = {
  league: "text-accent bg-accent/10 border-accent/25",
  ucl:    "text-violet-400 bg-violet-400/10 border-violet-400/25",
  weekly: "text-amber-400 bg-amber-400/10 border-amber-400/25",
}

function ToggleBtn({ value, selected, onChange, label, color }) {
  return (
    <button onClick={() => onChange(value)}
      className={cn(
        "flex-1 py-2 rounded-xl border text-xs font-bold transition-all",
        selected === value
          ? cn("border-2", color)
          : "border-surface-border text-slate-500 hover:text-slate-300 hover:border-slate-600"
      )}>
      {label}
    </button>
  )
}

function RecordRow({ record, onDeleted, onEdited }) {
  const [confirmDel, setConfirmDel] = useState(false)
  const [editing, setEditing]       = useState(false)
  const [editResult, setEditResult] = useState(record.result)
  const [editPS, setEditPS]         = useState(record.playerScore ?? "")
  const [editOS, setEditOS]         = useState(record.opponentScore ?? "")
  const deleteRecord                = useDeleteRecord()
  const editRecord                  = useEditRecord()

  const hasScore = record.playerScore !== null && record.playerScore !== undefined &&
                   record.opponentScore !== null && record.opponentScore !== undefined

  const handleDelete = () => {
    deleteRecord.mutate(record.id, {
      onSuccess: () => { onDeleted(record.id); setConfirmDel(false) },
      onError:   (err) => alert(err.response?.data?.error || "Failed to delete record"),
    })
  }

  const handleEdit = () => {
    editRecord.mutate({
      id: record.id,
      result: editResult,
      playerScore:   editPS !== "" ? parseInt(editPS)   : undefined,
      opponentScore: editOS !== "" ? parseInt(editOS) : undefined,
    }, {
      onSuccess: () => {
        onEdited(record.id, {
          result: editResult,
          playerScore:   editPS !== "" ? parseInt(editPS)   : null,
          opponentScore: editOS !== "" ? parseInt(editOS) : null,
        })
        setEditing(false)
      },
      onError: (err) => alert(err.response?.data?.error || "Failed to edit record"),
    })
  }

  if (confirmDel) {
    return (
      <div className="flex items-center gap-3 px-5 py-3.5 bg-rose-400/5">
        <p className="text-sm text-rose-400 flex-1">Delete this match record? Market value will recalculate.</p>
        <button onClick={() => setConfirmDel(false)}
          className="text-xs px-3 py-1.5 rounded-lg border border-surface-border text-slate-400 hover:text-white">
          Cancel
        </button>
        <button onClick={handleDelete} disabled={deleteRecord.isPending}
          className="text-xs px-3 py-1.5 rounded-lg bg-rose-500 text-white font-semibold disabled:opacity-50">
          {deleteRecord.isPending ? "Deleting…" : "Yes, delete"}
        </button>
      </div>
    )
  }

  if (editing) {
    return (
      <div className="px-5 py-3.5 bg-pitch-800/50 space-y-3">
        <p className="text-xs text-slate-400 font-medium">
          Edit: <span className="text-white">{record.playerName}</span> vs <span className="text-white">{record.opponentName}</span>
        </p>
        <div className="flex gap-2">
          {["win", "draw", "loss"].map(r => (
            <button key={r} onClick={() => setEditResult(r)}
              className={cn(
                "flex-1 py-1.5 rounded-lg border text-xs font-bold transition-all capitalize",
                editResult === r
                  ? r === "win"  ? "border-emerald-400 text-emerald-400 bg-emerald-400/10"
                  : r === "draw" ? "border-amber-400 text-amber-400 bg-amber-400/10"
                  :                "border-rose-400 text-rose-400 bg-rose-400/10"
                  : "border-surface-border text-slate-500"
              )}>
              {r}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Score:</span>
          <input type="number" min="0" value={editPS} onChange={e => setEditPS(e.target.value)} placeholder="0"
            className="w-16 text-center bg-pitch-800 border border-surface-border rounded-lg py-1 text-xs text-white focus:outline-none focus:border-accent/40" />
          <span className="text-slate-600 text-xs">–</span>
          <input type="number" min="0" value={editOS} onChange={e => setEditOS(e.target.value)} placeholder="0"
            className="w-16 text-center bg-pitch-800 border border-surface-border rounded-lg py-1 text-xs text-white focus:outline-none focus:border-accent/40" />
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditing(false)}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-surface-border text-slate-400 hover:text-white">
            <X className="w-3 h-3" /> Cancel
          </button>
          <button onClick={handleEdit} disabled={editRecord.isPending}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-accent text-white font-semibold disabled:opacity-50">
            <Save className="w-3 h-3" /> {editRecord.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-hover transition-colors group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white truncate">{record.playerName}</span>
          {hasScore ? (
            <span className="text-sm font-mono font-bold text-white px-2 py-0.5 rounded bg-pitch-800 border border-surface-border flex-shrink-0">
              {record.playerScore} - {record.opponentScore}
            </span>
          ) : (
            <ArrowRight className="w-3 h-3 text-slate-600 flex-shrink-0" />
          )}
          <span className="text-sm text-slate-400 truncate">{record.opponentName}</span>
          <GradeBadge grade={record.opponentGrade} />
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-xs text-slate-600">
            {record.date ? new Date(record.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "Today"}
          </p>
          {record.matchType && (
            <span className={cn(
              "text-xs font-semibold px-1.5 py-0.5 rounded border",
              MATCH_TYPE_COLORS[record.matchType] || "text-slate-400 bg-surface-border border-surface-border"
            )}>
              {MATCH_TYPES.find(t => t.value === record.matchType)?.label || record.matchType}
            </span>
          )}
        </div>
      </div>
      <span className={cn(
        "text-xs font-bold px-2 py-0.5 rounded border flex-shrink-0",
        record.result === "win"  ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/25"
        : record.result === "draw" ? "bg-amber-400/10 text-amber-400 border-amber-400/25"
        : "bg-rose-400/10 text-rose-400 border-rose-400/25"
      )}>{record.result.toUpperCase()}</span>
      <button onClick={() => setEditing(true)}
        className="w-7 h-7 rounded-lg hover:bg-accent/10 flex items-center justify-center text-slate-500 hover:text-accent transition-colors opacity-0 group-hover:opacity-100"
        title="Edit record">
        <Pencil className="w-3.5 h-3.5" />
      </button>
      <button onClick={() => setConfirmDel(true)}
        className="w-7 h-7 rounded-lg hover:bg-rose-400/10 flex items-center justify-center text-slate-500 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100"
        title="Delete record">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

export default function MatchRecordEntry({ players, initialRecords }) {
  const [records, setRecords]         = useState(initialRecords)
  const [playerId, setPlayerId]       = useState("")
  const [oppId, setOppId]             = useState("")
  const [result, setResult]           = useState("")
  const [matchType, setMatchType]     = useState("league")
  const [playerScore, setPlayerScore] = useState("")
  const [oppScore, setOppScore]       = useState("")
  const [saved, setSaved]             = useState(false)
  const logRecord                     = useLogRecord()

  const selectedOpp = players.find(p => p.id === parseInt(oppId))
  const canSave      = playerId && oppId && result

  const handleSave = () => {
    if (!canSave) return

    const payload = {
      playerId: parseInt(playerId),
      opponentId: parseInt(oppId),
      result,
      matchType,
    }
    if (playerScore !== "" && oppScore !== "") {
      payload.playerScore   = parseInt(playerScore)
      payload.opponentScore = parseInt(oppScore)
    }

    logRecord.mutate(payload, {
      onSuccess: (data) => {
        setRecords(prev => [{
          id:            data.record.id,
          playerName:    players.find(p => p.id === parseInt(playerId))?.name || "",
          opponentName:  selectedOpp?.name || "",
          opponentGrade: selectedOpp?.grade || "",
          result,
          matchType,
          playerScore:   payload.playerScore ?? null,
          opponentScore: payload.opponentScore ?? null,
          date:          data.record.recorded_at,
        }, ...prev])
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
        setPlayerId(""); setOppId(""); setResult("")
        setMatchType("league"); setPlayerScore(""); setOppScore("")
      },
      onError: (err) => alert(err.response?.data?.error || "Failed to log record"),
    })
  }

  const handleDeleted = (id) => {
    setRecords(prev => prev.filter(r => r.id !== id))
  }

  const handleEdited = (id, updates) => {
    setRecords(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r))
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
      {/* Form */}
      <div className="xl:col-span-2">
        <div className="card p-5 space-y-5">
          <p className="section-label">Log match result</p>

          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">Player</label>
            <select value={playerId} onChange={e => { setPlayerId(e.target.value); setOppId("") }}
              className="w-full bg-pitch-800 border border-surface-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent/40">
              <option value="">Select player…</option>
              {players.map(p => <option key={p.id} value={p.id}>{p.name} ({p.team})</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">Competition</label>
            <div className="flex gap-2">
              {MATCH_TYPES.map(t => (
                <ToggleBtn
                  key={t.value}
                  value={t.value}
                  selected={matchType}
                  onChange={setMatchType}
                  label={t.label}
                  color={MATCH_TYPE_COLORS[t.value]}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">Result</label>
            <div className="flex gap-2">
              <ToggleBtn value="win"  selected={result} onChange={setResult} label="Win"  color="border-emerald-400 text-emerald-400" />
              <ToggleBtn value="draw" selected={result} onChange={setResult} label="Draw" color="border-amber-400 text-amber-400"   />
              <ToggleBtn value="loss" selected={result} onChange={setResult} label="Loss" color="border-rose-400 text-rose-400"     />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">Opponent</label>
            <select value={oppId} onChange={e => setOppId(e.target.value)} disabled={!playerId}
              className="w-full bg-pitch-800 border border-surface-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent/40 disabled:opacity-50">
              <option value="">Select opponent…</option>
              {players.filter(p => p.id !== parseInt(playerId)).map(p => (
                <option key={p.id} value={p.id}>{p.name} — {p.grade} ({p.team})</option>
              ))}
            </select>
          </div>

          {/* Optional score */}
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">
              Match score <span className="text-slate-600"></span>
            </label>
            <div className="flex items-center gap-2">
              <input type="number" min="0" value={playerScore}
                onChange={e => setPlayerScore(e.target.value)}
                placeholder="0"
                className="w-full bg-pitch-800 border border-surface-border rounded-xl px-3 py-2.5 text-sm text-white text-center font-mono focus:outline-none focus:border-accent/40" />
              <span className="text-slate-600 font-bold flex-shrink-0">–</span>
              <input type="number" min="0" value={oppScore}
                onChange={e => setOppScore(e.target.value)}
                placeholder="0"
                className="w-full bg-pitch-800 border border-surface-border rounded-xl px-3 py-2.5 text-sm text-white text-center font-mono focus:outline-none focus:border-accent/40" />
            </div>
            <p className="text-xs text-slate-600 mt-1">For reference only — doesn't affect market value</p>
          </div>

          {selectedOpp && (
            <div className="bg-pitch-800 rounded-xl p-4 border border-surface-border">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Opponent grade</span>
                <GradeBadge grade={selectedOpp.grade} size="md" />
              </div>
            </div>
          )}

          <button onClick={handleSave} disabled={!canSave || logRecord.isPending}
            className={cn("w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all",
              canSave ? "bg-accent hover:bg-accent-dim text-white" : "bg-surface-border text-slate-600 cursor-not-allowed")}>
            {saved
              ? <><CheckCircle className="w-4 h-4" /> Saved!</>
              : <><Plus className="w-4 h-4" /> {logRecord.isPending ? "Saving…" : "Log result"}</>
            }
          </button>
        </div>
      </div>

      {/* Records list */}
      <div className="xl:col-span-3">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
            <h2 className="text-sm font-semibold text-white">Match records</h2>
            <span className="text-xs text-slate-500">{records.length} logged</span>
          </div>
          <div className="divide-y divide-surface-border/60 max-h-[540px] overflow-y-auto">
            {records.length === 0
              ? <div className="px-5 py-10 text-center text-slate-500 text-sm">No records yet.</div>
              : records.map(r => <RecordRow key={r.id} record={r} onDeleted={handleDeleted} onEdited={handleEdited} />)
            }
          </div>
        </div>
      </div>
    </div>
  )
}