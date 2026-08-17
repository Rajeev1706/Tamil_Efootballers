import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Trophy, Plus, Trash2, TrendingDown, ChevronDown, ChevronUp, History } from "lucide-react"
import api from "../../lib/api"
import { cn } from "../../lib/utils"

const teamTrophyApi = {
  list:          ()       => api.get("/team-trophies").then(r => r.data),
  create:        (data)   => api.post("/team-trophies", data).then(r => r.data),
  remove:        (id)     => api.delete(`/team-trophies/${id}`).then(r => r.data),
  getHistory:    (teamId) => api.get(`/team-trophies/${teamId}`).then(r => r.data),
  upsertHistory: (data)   => api.post("/team-trophies/history", data).then(r => r.data),
  removeHistory: (id)     => api.delete(`/team-trophies/history/${id}`).then(r => r.data),
}

function ordinal(n) {
  if (!n) return "—"
  const s = ["th","st","nd","rd"]
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

// ── Per-team expanded section ──────────────────────────────────────────────────
function TeamHistorySection({ team }) {
  const qc = useQueryClient()
  const [expanded, setExpanded]         = useState(false)
  const [seasonNumber, setSeasonNumber] = useState("")
  const [leaguePos, setLeaguePos]       = useState("")
  const [champPos, setChampPos]         = useState("")
  const [relegated, setRelegated]       = useState(false)

  const { data } = useQuery({
    queryKey: ["team-history", String(team.id)],
    queryFn:  () => teamTrophyApi.getHistory(team.id),
    enabled:  expanded,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["team-trophies"] })
    qc.invalidateQueries({ queryKey: ["team-history", String(team.id)] })
  }

  const upsertMut = useMutation({
    mutationFn: teamTrophyApi.upsertHistory,
    onSuccess: () => {
      invalidate()
      setSeasonNumber(""); setLeaguePos(""); setChampPos(""); setRelegated(false)
    },
  })

  const deleteTrophyMut = useMutation({
    mutationFn: teamTrophyApi.remove,
    onSuccess: invalidate,
  })

  const deleteHistoryMut = useMutation({
    mutationFn: teamTrophyApi.removeHistory,
    onSuccess: invalidate,
  })

  const history = data?.history || []
  const trophies = data?.trophies || []

  return (
    <div className="card overflow-hidden">
      {/* Team header row — click to expand */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors"
      >
        {team.logoUrl
          ? <img src={team.logoUrl} alt={team.name} className="w-8 h-8 rounded-lg object-cover border border-surface-border flex-shrink-0" />
          : <div className="w-8 h-8 rounded-lg bg-pitch-800 border border-surface-border flex items-center justify-center text-xs font-bold text-slate-400 flex-shrink-0">
              {team.name?.slice(0, 2).toUpperCase()}
            </div>
        }
        <span className="font-bold text-white flex-1 text-left">{team.name}</span>
        <div className="flex items-center gap-3">
          {team.totalTrophies > 0 && (
            <span className="flex items-center gap-1 text-xs text-gold font-semibold">
              <Trophy className="w-3 h-3" /> {team.totalTrophies}
            </span>
          )}
          {team.relegationCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-rose-400 font-semibold">
              <TrendingDown className="w-3 h-3" /> {team.relegationCount}×
            </span>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-surface-border px-4 py-4 space-y-5">

          {/* ── Team League Trophies ── */}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-2 flex items-center gap-2">
              <Trophy className="w-3.5 h-3.5 text-gold" /> Dshann League Titles
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              {trophies.length === 0
                ? <span className="text-xs text-slate-600">No titles yet</span>
                : trophies.map(t => (
                  <div key={t.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gold/30 bg-gold/10">
                    <span className="text-gold text-xs font-bold">Season {t.season_number}{t.year ? ` · ${t.year}` : ""}</span>
                    <button onClick={() => deleteTrophyMut.mutate(t.id)}
                      className="text-slate-500 hover:text-rose-400 transition-colors ml-1">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))
              }
            </div>
          </div>

          {/* ── Season History Records ── */}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-2 flex items-center gap-2">
              <History className="w-3.5 h-3.5 text-accent" /> Season History
            </p>

            {/* Add/edit season form */}
            <div className="bg-pitch-900 border border-surface-border rounded-xl p-3 mb-3 space-y-3">
              <p className="text-xs text-slate-400 font-semibold">Add / Update Season Record</p>
              <div className="flex flex-wrap gap-2">
                <input
                  type="number" placeholder="Season #" value={seasonNumber}
                  onChange={e => setSeasonNumber(e.target.value)}
                  className="bg-pitch-800 border border-surface-border rounded-lg px-3 py-1.5 text-sm text-white w-24"
                />
                <input
                  type="number" placeholder="League pos" value={leaguePos}
                  onChange={e => setLeaguePos(e.target.value)}
                  className="bg-pitch-800 border border-surface-border rounded-lg px-3 py-1.5 text-sm text-white w-28"
                />
                <input
                  type="number" placeholder="Team of Champions pos" value={champPos}
                  onChange={e => setChampPos(e.target.value)}
                  className="bg-pitch-800 border border-surface-border rounded-lg px-3 py-1.5 text-sm text-white w-36"
                />
                <label className="flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-lg border border-surface-border bg-pitch-800">
                  <input
                    type="checkbox" checked={relegated} onChange={e => setRelegated(e.target.checked)}
                    className="accent-rose-500 w-3.5 h-3.5"
                  />
                  <span className="text-xs text-slate-400">Relegated</span>
                </label>
              </div>
              <button
                onClick={() => upsertMut.mutate({
                  teamId: team.id,
                  seasonNumber: Number(seasonNumber),
                  teamLeaguePos: leaguePos ? Number(leaguePos) : null,
                  championshipPos: champPos ? Number(champPos) : null,
                  relegated,
                })}
                disabled={!seasonNumber || upsertMut.isPending}
                className="flex items-center gap-2 bg-accent text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-accent/90 disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" /> Save Record
              </button>
            </div>

            {/* History table */}
            {history.length === 0 ? (
              <p className="text-xs text-slate-600 py-2">No history records yet</p>
            ) : (
              <div className="divide-y divide-surface-border/40 rounded-xl border border-surface-border overflow-hidden">
                <div className="grid grid-cols-[60px_1fr_1fr_90px_32px] gap-2 px-3 py-2 bg-pitch-800/50 text-[10px] text-slate-600 uppercase tracking-wide font-semibold">
                  <span>Season</span><span>League</span><span>Team of Champions</span><span>Status</span><span></span>
                </div>
                {history.map(h => (
                  <div key={h.id} className={cn(
                    "grid grid-cols-[60px_1fr_1fr_90px_32px] gap-2 items-center px-3 py-2 text-sm",
                    h.relegated ? "bg-rose-950/10" : ""
                  )}>
                    <span className="text-slate-400 font-mono font-bold text-xs">S{h.season_number}</span>
                    <span className={cn("font-bold text-xs", h.team_league_pos === 1 ? "text-gold" : "text-slate-300")}>
                      {h.team_league_pos ? ordinal(h.team_league_pos) : "—"}
                    </span>
                    <span className={cn("font-bold text-xs", h.championship_pos === 1 ? "text-gold" : "text-slate-300")}>
                      {h.championship_pos ? ordinal(h.championship_pos) : "—"}
                    </span>
                    <span className={cn("text-[10px] font-semibold", h.relegated ? "text-rose-400" : "text-slate-600")}>
                      {h.relegated ? "🔻 Relegated" : "—"}
                    </span>
                    <button onClick={() => deleteHistoryMut.mutate(h.id)}
                      className="text-slate-600 hover:text-rose-400 transition-colors">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main admin component ───────────────────────────────────────────────────────
export default function AdminTeamTrophies() {
  const qc = useQueryClient()
  const [teamId, setTeamId]         = useState("")
  const [seasonNumber, setSeasonNumber] = useState("")

  const { data: teams = [] } = useQuery({
    queryKey: ["team-trophies"],
    queryFn:  teamTrophyApi.list,
  })

  const createMut = useMutation({
    mutationFn: teamTrophyApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-trophies"] })
      setTeamId(""); setSeasonNumber("")
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Trophy className="w-5 h-5 text-gold" />
        <h2 className="text-lg font-bold text-white">Team Trophy Cabinet</h2>
      </div>

      {/* Quick-award trophy form */}
      <div className="card p-4">
        <p className="text-sm font-semibold text-white mb-3">Award Dshann League Title</p>
        <div className="flex gap-3 flex-wrap">
          <select value={teamId} onChange={e => setTeamId(e.target.value)}
            className="bg-pitch-900 border border-surface-border rounded-lg px-3 py-2 text-sm text-white flex-1 min-w-[160px]">
            <option value="">Select team...</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <input type="number" placeholder="Season #" value={seasonNumber}
            onChange={e => setSeasonNumber(e.target.value)}
            className="bg-pitch-900 border border-surface-border rounded-lg px-3 py-2 text-sm text-white w-28" />
          <button
            onClick={() => createMut.mutate({ teamId: Number(teamId), seasonNumber: Number(seasonNumber) })}
            disabled={!teamId || !seasonNumber || createMut.isPending}
            className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-accent/90 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> Award Title
          </button>
        </div>
      </div>

      {/* Per-team expandable sections */}
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-3">All Teams — click to manage history</p>
        <div className="space-y-2">
          {teams.map(team => <TeamHistorySection key={team.id} team={team} />)}
        </div>
      </div>
    </div>
  )
}