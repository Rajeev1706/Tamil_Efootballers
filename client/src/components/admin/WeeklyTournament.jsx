import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Plus, Trophy, Trash2, ChevronRight, Calendar, CheckCircle, Clock } from "lucide-react"
import { useWeeklyTournaments, useCreateWeeklyTournament, useSetWeeklyPlayers, useDeleteWeeklyTournament } from "../../lib/queries"
import { usePlayers } from "../../lib/queries"
import { cn } from "../../lib/utils"

const STATUS_CONFIG = {
  setup:     { label: "Setup",      color: "text-slate-400",   bg: "bg-slate-700"            },
  draw:      { label: "Draw Ready", color: "text-amber-400",   bg: "bg-amber-400/15 border border-amber-400/30" },
  active:    { label: "Active",     color: "text-emerald-400", bg: "bg-emerald-400/15 border border-emerald-400/30" },
  completed: { label: "Completed",  color: "text-accent",      bg: "bg-accent/15 border border-accent/30" },
}

function CreateForm({ onClose }) {
  const navigate = useNavigate()
  const { data: players = [] } = usePlayers()
  const createTournament = useCreateWeeklyTournament()
  const setPlayers      = useSetWeeklyPlayers()

  const [name, setName]                 = useState("")
  const [selected, setSelected]         = useState([])
  const [search, setSearch]             = useState("")
  const [step, setStep]                 = useState("name") // name | players

  const filtered = players.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) && !selected.includes(p.id)
  )

  function togglePlayer(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function handleCreate() {
    if (!name.trim() || selected.length < 2) return
    const t = await createTournament.mutateAsync(name.trim())
    await setPlayers.mutateAsync({ id: t.id, playerIds: selected })
    navigate(`/weekly/draw/${t.id}`)
  }

  return (
    <div className="card p-5 space-y-4 mb-5">
      <h3 className="text-sm font-semibold text-white">Create Weekly Tournament</h3>

      {step === "name" && (
        <>
          <div>
            <label className="text-xs text-slate-500 block mb-1.5">Tournament Name</label>
            <input
              value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && name.trim() && setStep("players")}
              placeholder="e.g. Week 5 Knockout"
              className="w-full bg-pitch-800 border border-surface-border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent/40"
            />
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-lg border border-surface-border text-slate-400 text-sm">Cancel</button>
            <button onClick={() => setStep("players")} disabled={!name.trim()}
              className="px-4 py-2 rounded-lg bg-accent/15 text-accent border border-accent/25 text-sm font-semibold disabled:opacity-40">
              Next: Add Players
            </button>
          </div>
        </>
      )}

      {step === "players" && (
        <>
          <div>
            <p className="text-xs text-slate-500 mb-2">
              Select players for <span className="text-white font-medium">"{name}"</span> — {selected.length} selected
            </p>
            {/* Selected chips */}
            {selected.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {selected.map(id => {
                  const p = players.find(pl => pl.id === id)
                  return (
                    <button key={id} onClick={() => togglePlayer(id)}
                      className="flex items-center gap-1 px-2 py-1 bg-accent/15 border border-accent/25 rounded-lg text-xs text-accent">
                      {p?.name} ✕
                    </button>
                  )
                })}
              </div>
            )}
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search players…"
              className="w-full bg-pitch-800 border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/40 mb-2"
            />
            <div className="max-h-48 overflow-y-auto space-y-1">
              {filtered.map(p => (
                <div key={p.id} onClick={() => togglePlayer(p.id)}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-pitch-800 cursor-pointer transition-colors">
                  <div className="w-4 h-4 rounded border border-surface-border flex items-center justify-center flex-shrink-0">
                    {selected.includes(p.id) && <div className="w-2 h-2 rounded-sm bg-accent" />}
                  </div>
                  <span className="text-sm text-white">{p.name}</span>
                  <span className="text-xs text-slate-500 ml-auto">{p.team ?? "Free"}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep("name")} className="px-4 py-2 rounded-lg border border-surface-border text-slate-400 text-sm">Back</button>
            <button onClick={onClose} className="px-4 py-2 rounded-lg border border-surface-border text-slate-400 text-sm">Cancel</button>
            <button
              onClick={handleCreate}
              disabled={selected.length < 2 || createTournament.isPending || setPlayers.isPending}
              className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold disabled:opacity-40">
              {createTournament.isPending || setPlayers.isPending ? "Creating…" : "Create Draw →"}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default function WeeklyAdmin() {
  const navigate = useNavigate()
  const { data: tournaments = [], isLoading } = useWeeklyTournaments()
  const deleteTournament = useDeleteWeeklyTournament()
  const [showCreate, setShowCreate] = useState(false)
  const [confirmDel, setConfirmDel] = useState(null)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-white">Weekly Tournaments</h2>
        </div>
        {!showCreate && (
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-accent/15 text-accent border border-accent/25 hover:bg-accent/25 transition-colors">
            <Plus className="w-3.5 h-3.5" /> New Tournament
          </button>
        )}
      </div>

      {showCreate && <CreateForm onClose={() => setShowCreate(false)} />}

      {isLoading ? (
        <p className="text-sm text-slate-500 text-center py-6">Loading…</p>
      ) : tournaments.length === 0 && !showCreate ? (
        <div className="card px-5 py-10 text-center">
          <Trophy className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No weekly tournaments yet</p>
          <p className="text-slate-600 text-xs mt-1">Click "New Tournament" to create one</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tournaments.map(t => {
            const cfg = STATUS_CONFIG[t.status] || STATUS_CONFIG.setup
            return (
              <div key={t.id} className="card flex items-center gap-4 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{t.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-lg", cfg.bg, cfg.color)}>
                      {cfg.label}
                    </span>
                    {t.player_count && (
                      <span className="text-xs text-slate-500">{t.player_count} players</span>
                    )}
                    <span className="text-xs text-slate-600">
                      {new Date(t.created_at).toLocaleDateString("en-GB", { day:"numeric", month:"short" })}
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
                        <button onClick={() => navigate(`/weekly/draw/${t.id}`)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400/15 text-amber-400 border border-amber-400/30 text-xs font-semibold">
                          View Draw <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {(t.status === "active" || t.status === "completed") && (
                        <button onClick={() => navigate(`/weekly/bracket/${t.id}`)}
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