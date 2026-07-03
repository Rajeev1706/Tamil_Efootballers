import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Trophy, Trash2, ChevronRight, Zap, CheckCircle, Clock } from "lucide-react"
import { useUclKnockoutList, useCreateUclKnockout, useDeleteUclKnockout } from "../../lib/queries"
import { cn } from "../../lib/utils"

const STATUS_CONFIG = {
  draw:      { label: "Draw Ready", color: "text-amber-400",   bg: "bg-amber-400/15 border border-amber-400/30" },
  active:    { label: "Active",     color: "text-emerald-400", bg: "bg-emerald-400/15 border border-emerald-400/30" },
  completed: { label: "Completed",  color: "text-accent",      bg: "bg-accent/15 border border-accent/30" },
}

export default function UclKnockoutAdmin() {
  const navigate = useNavigate()
  const { data: tournaments = [], isLoading } = useUclKnockoutList()
  const createTournament = useCreateUclKnockout()
  const deleteTournament = useDeleteUclKnockout()
  const [name, setName]         = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [confirmDel, setConfirmDel] = useState(null)

  async function handleCreate() {
    if (!name.trim()) return
    const t = await createTournament.mutateAsync(name.trim())
    setName("")
    setShowCreate(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-white">UCL Knockout Stage</h2>
        </div>
        {!showCreate && (
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-accent text-white border border-accent/50 hover:bg-accent-dim transition-colors">
            <Zap className="w-3.5 h-3.5" /> Generate Knockout
          </button>
        )}
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="card p-5 space-y-4">
          <p className="text-sm font-semibold text-white">Generate UCL Knockout</p>
          <p className="text-xs text-slate-400">Top 4 players from each UCL group will be automatically seeded. Groups A&B, C&D, E&F, G&H are paired — no same-group matchups in R32.</p>
          <div>
            <label className="text-xs text-slate-500 block mb-1.5">Tournament Name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCreate()}
              placeholder="e.g. UCL Knockout 2025"
              className="w-full bg-pitch-800 border border-surface-border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent/40" />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg border border-surface-border text-slate-400 text-sm">Cancel</button>
            <button onClick={handleCreate} disabled={!name.trim() || createTournament.isPending}
              className="flex-1 px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold disabled:opacity-40">
              {createTournament.isPending ? "Generating…" : "Generate Draw →"}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500 text-center py-6">Loading…</p>
      ) : tournaments.length === 0 && !showCreate ? (
        <div className="card px-5 py-10 text-center">
          <Trophy className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No UCL Knockout tournament yet</p>
          <p className="text-slate-600 text-xs mt-1">Generate one after UCL group stage is complete</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tournaments.map(t => {
            const cfg = STATUS_CONFIG[t.status] || STATUS_CONFIG.draw
            return (
              <div key={t.id} className="card flex items-center gap-4 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{t.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-lg", cfg.bg, cfg.color)}>
                      {cfg.label}
                    </span>
                    <span className="text-xs text-slate-600">
                      {new Date(t.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {confirmDel === t.id ? (
                    <>
                      <button onClick={() => setConfirmDel(null)} className="text-xs px-3 py-1.5 rounded-lg border border-surface-border text-slate-400">Cancel</button>
                      <button onClick={() => { deleteTournament.mutate(t.id); setConfirmDel(null) }}
                        className="text-xs px-3 py-1.5 rounded-lg bg-rose-500 text-white font-semibold">Delete</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => setConfirmDel(t.id)}
                        className="w-7 h-7 rounded-lg hover:bg-rose-400/10 flex items-center justify-center text-slate-500 hover:text-rose-400">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      {t.status === "draw" && (
                        <button onClick={() => navigate(`/ucl-knockout/draw/${t.id}`)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400/15 text-amber-400 border border-amber-400/30 text-xs font-semibold">
                          View Draw <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {(t.status === "active" || t.status === "completed") && (
                        <button onClick={() => navigate(`/ucl-knockout/bracket/${t.id}`)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/15 text-accent border border-accent/25 text-xs font-semibold">
                          View Bracket <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}