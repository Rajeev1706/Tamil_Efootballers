import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Trophy, Plus, Trash2 } from "lucide-react"
import api from "../../lib/api"
import { cn } from "../../lib/utils"

const teamTrophyApi = {
  list:   ()          => api.get("/team-trophies").then(r => r.data),
  create: (data)      => api.post("/team-trophies", data).then(r => r.data),
  remove: (id)        => api.delete(`/team-trophies/${id}`).then(r => r.data),
}

export default function AdminTeamTrophies() {
  const qc = useQueryClient()
  const [teamId, setTeamId]         = useState("")
  const [seasonNumber, setSeasonNumber] = useState("")

  const { data: teams = [] } = useQuery({
    queryKey: ["team-trophies"],
    queryFn:  teamTrophyApi.list,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ["team-trophies"] })

  const createMut = useMutation({
    mutationFn: teamTrophyApi.create,
    onSuccess: () => { invalidate(); setTeamId(""); setSeasonNumber("") }
  })

  const deleteMut = useMutation({
    mutationFn: teamTrophyApi.remove,
    onSuccess: invalidate
  })

  // Flatten all trophies for display
  const allTrophies = teams.flatMap(t =>
    (t.seasons || []).map((s, i) => ({
      teamId:   t.id,
      teamName: t.name,
      logoUrl:  t.logoUrl,
      season:   s,
      // We need actual trophy IDs — fetch per team if needed
    }))
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Trophy className="w-5 h-5 text-gold" />
        <h2 className="text-lg font-bold text-white">Team Trophy Cabinet</h2>
        <span className="text-xs text-slate-500">— Team League titles only</span>
      </div>

      {/* Add trophy form */}
      <div className="card p-4">
        <p className="text-sm font-semibold text-white mb-3">Award Team League Title</p>
        <div className="flex gap-3 flex-wrap">
          <select value={teamId} onChange={e => setTeamId(e.target.value)}
            className="bg-pitch-900 border border-surface-border rounded-lg px-3 py-2 text-sm text-white flex-1 min-w-[160px]">
            <option value="">Select team...</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <input type="number" placeholder="Season #" value={seasonNumber} onChange={e => setSeasonNumber(e.target.value)}
            className="bg-pitch-900 border border-surface-border rounded-lg px-3 py-2 text-sm text-white w-28" />
          <button
            onClick={() => createMut.mutate({ teamId: Number(teamId), seasonNumber: Number(seasonNumber) })}
            disabled={!teamId || !seasonNumber || createMut.isPending}
            className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-accent/90 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> Award
          </button>
        </div>
      </div>

      {/* Trophy list per team */}
      <div className="space-y-3">
        {teams.filter(t => t.totalTrophies > 0).map(team => (
          <div key={team.id} className="card p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-pitch-800 border border-surface-border flex items-center justify-center text-xs font-bold text-slate-400">
                {team.name?.slice(0, 2).toUpperCase()}
              </div>
              <p className="font-bold text-white">{team.name}</p>
              <span className="text-xs text-gold font-semibold">🏆 {team.totalTrophies}</span>
            </div>
            <TeamTrophyRows teamId={team.id} />
          </div>
        ))}
        {teams.every(t => !t.totalTrophies) && (
          <p className="text-slate-500 text-sm text-center py-8">No titles awarded yet. Use the form above to record a champion.</p>
        )}
      </div>
    </div>
  )
}

function TeamTrophyRows({ teamId }) {
  const qc = useQueryClient()
  const { data } = useQuery({
    queryKey: ["team-trophies", String(teamId)],
    queryFn:  () => api.get(`/team-trophies/${teamId}`).then(r => r.data),
  })

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/team-trophies/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team-trophies"] })
  })

  return (
    <div className="flex flex-wrap gap-2">
      {(data?.trophies || []).map(t => (
        <div key={t.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gold/30 bg-gold/10">
          <span className="text-gold text-xs font-bold">Season {t.season_number}</span>
          <button onClick={() => deleteMut.mutate(t.id)}
            className="text-slate-500 hover:text-rose-400 transition-colors ml-1">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  )
}