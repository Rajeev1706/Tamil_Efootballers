import { useState } from "react"
import { Check, Lock, Pencil, Trash2, X, Save } from "lucide-react"
import { useSaveFixtureResult, useUpdateFixture, useDeleteFixture } from "../../lib/queries"
import { useTeams } from "../../lib/queries"
import { cn } from "../../lib/utils"

function ScoreInput({ value, onChange, disabled }) {
  return (
    <input
      type="number" min={0} max={20}
      value={value ?? ""}
      onChange={e => onChange(Math.max(0, parseInt(e.target.value) || 0))}
      disabled={disabled}
      className="w-12 text-center bg-pitch-800 border border-surface-border rounded-lg py-2 text-lg font-bold font-mono text-white focus:outline-none focus:border-accent/40 disabled:opacity-40 disabled:cursor-not-allowed"
    />
  )
}

function FixtureCard({ fixture }) {
  const { data: teams = [] } = useTeams()
  const saveResult   = useSaveFixtureResult()
  const updateFixture = useUpdateFixture()
  const deleteFixture = useDeleteFixture()

  const isCompleted = fixture.status === "completed"

  // Score state
  const [hs, setHs]       = useState(fixture.homeScore ?? "")
  const [as_, setAs]      = useState(fixture.awayScore ?? "")
  const [saved, setSaved] = useState(isCompleted)

  // Edit state
  const [editing, setEditing]     = useState(false)
  const [editRound, setEditRound] = useState(fixture.round)
  const [editDate, setEditDate]   = useState(
    fixture.date ? new Date(fixture.date).toISOString().slice(0, 10) : ""
  )
  const [editHome, setEditHome] = useState(fixture.homeTeamId)
  const [editAway, setEditAway] = useState(fixture.awayTeamId)

  // Delete confirm state
  const [confirmDel, setConfirmDel] = useState(false)

  const winner  = saved ? (hs > as_ ? "home" : hs < as_ ? "away" : "draw") : null
  const canSave = hs !== "" && as_ !== "" && !saved

  const handleSaveResult = () => {
    saveResult.mutate({ id: fixture.id, homeScore: parseInt(hs), awayScore: parseInt(as_) }, {
      onSuccess: () => setSaved(true),
      onError: (err) => alert(err.response?.data?.error || "Failed to save result"),
    })
  }

  const handleSaveEdit = () => {
    if (editHome === editAway) return alert("Home and away teams must differ")
    updateFixture.mutate({
      id: fixture.id,
      round:      parseInt(editRound),
      date:       editDate,
      homeTeamId: parseInt(editHome),
      awayTeamId: parseInt(editAway),
    }, {
      onSuccess: () => setEditing(false),
      onError:   (err) => alert(err.response?.data?.error || "Update failed"),
    })
  }

  const handleDelete = () => {
    deleteFixture.mutate(fixture.id, {
      onError: (err) => alert(err.response?.data?.error || "Delete failed"),
    })
  }

  const formattedDate = fixture.date
    ? new Date(fixture.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    : "—"

  return (
    <div className={cn("card p-5 transition-all", saved && "border-accent/20", confirmDel && "border-rose-500/30")}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Round {fixture.round}</span>
          <span className="text-slate-700">·</span>
          <span className="text-xs text-slate-500">{formattedDate}</span>
        </div>

        <div className="flex items-center gap-1.5">
          {saved
            ? <span className="flex items-center gap-1 text-xs font-semibold text-accent"><Check className="w-3 h-3" /> Saved</span>
            : <span className="text-xs text-amber-400 font-medium">Pending</span>
          }

          {/* Edit button — only for upcoming */}
          {!isCompleted && !confirmDel && (
            <button
              onClick={() => setEditing(e => !e)}
              className={cn(
                "w-7 h-7 rounded-lg flex items-center justify-center transition-colors ml-1",
                editing ? "bg-accent/15 text-accent" : "hover:bg-surface text-slate-500 hover:text-white"
              )}
              title="Edit fixture"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Delete button */}
          {!confirmDel ? (
            <button
              onClick={() => setConfirmDel(true)}
              className="w-7 h-7 rounded-lg hover:bg-rose-400/10 flex items-center justify-center text-slate-500 hover:text-rose-400 transition-colors"
              title="Delete fixture"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="flex items-center gap-1.5 ml-1">
              <span className="text-xs text-rose-400">Delete?</span>
              <button
                onClick={() => setConfirmDel(false)}
                className="text-xs px-2 py-1 rounded-lg border border-surface-border text-slate-400 hover:text-white"
              >
                No
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteFixture.isPending}
                className="text-xs px-2 py-1 rounded-lg bg-rose-500 text-white font-semibold disabled:opacity-50"
              >
                {deleteFixture.isPending ? "…" : "Yes"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Edit panel */}
      {editing && !isCompleted && (
        <div className="mb-4 p-3 bg-pitch-900/60 rounded-xl border border-surface-border space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Round</label>
              <input
                type="number" min={1}
                value={editRound}
                onChange={e => setEditRound(e.target.value)}
                className="w-full bg-pitch-800 border border-surface-border rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-accent/40"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Date</label>
              <input
                type="date"
                value={editDate}
                onChange={e => setEditDate(e.target.value)}
                className="w-full bg-pitch-800 border border-surface-border rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-accent/40"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Home team</label>
              <select
                value={editHome}
                onChange={e => setEditHome(e.target.value)}
                className="w-full bg-pitch-800 border border-surface-border rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-accent/40"
              >
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Away team</label>
              <select
                value={editAway}
                onChange={e => setEditAway(e.target.value)}
                className="w-full bg-pitch-800 border border-surface-border rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-accent/40"
              >
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setEditing(false)}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-surface-border text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-3 h-3" /> Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={updateFixture.isPending}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-accent text-white font-semibold disabled:opacity-50 transition-colors"
            >
              <Save className="w-3 h-3" /> {updateFixture.isPending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      )}

      {/* Score row */}
      <div className="flex items-center gap-3">
        <div className={cn("flex-1 text-right", winner === "home" && "text-white", winner === "away" && "text-slate-500")}>
          <p className="text-sm font-semibold">{fixture.home}</p>
          <p className="text-xs text-accent mt-0.5">Home</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <ScoreInput value={hs} onChange={setHs} disabled={saved} />
          <span className="text-slate-600 font-bold text-lg">–</span>
          <ScoreInput value={as_} onChange={setAs} disabled={saved} />
        </div>
        <div className={cn("flex-1", winner === "away" && "text-white", winner === "home" && "text-slate-500")}>
          <p className="text-sm font-semibold">{fixture.away}</p>
          <p className="text-xs text-slate-500 mt-0.5">Away</p>
        </div>
      </div>

      {/* Save result / locked */}
      {!saved ? (
        <button
          onClick={handleSaveResult}
          disabled={!canSave || saveResult.isPending}
          className={cn(
            "mt-4 w-full py-2 rounded-lg text-sm font-semibold transition-all",
            canSave ? "bg-accent hover:bg-accent-dim text-white" : "bg-surface-border text-slate-600 cursor-not-allowed"
          )}
        >
          {saveResult.isPending ? "Saving…" : "Save result"}
        </button>
      ) : (
        <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-600">
          <Lock className="w-3 h-3" /> Result locked
        </div>
      )}
    </div>
  )
}

export default function FixtureResults({ fixtures }) {
  const upcoming  = fixtures.filter(f => f.status === "upcoming")
  const completed = fixtures.filter(f => f.status === "completed")

  return (
    <div className="space-y-8">
      {upcoming.length > 0 && (
        <div>
          <p className="section-label mb-4">Upcoming fixtures</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {upcoming.map(f => <FixtureCard key={f.id} fixture={f} />)}
          </div>
        </div>
      )}
      {completed.length > 0 && (
        <div>
          <p className="section-label mb-4">Completed fixtures</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {completed.map(f => <FixtureCard key={f.id} fixture={f} />)}
          </div>
        </div>
      )}
      {fixtures.length === 0 && (
        <div className="card py-16 text-center text-slate-500 text-sm">No fixtures created yet.</div>
      )}
    </div>
  )
}