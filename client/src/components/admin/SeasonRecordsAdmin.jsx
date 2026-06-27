import { useState } from "react"
import { Plus, Pencil, Trash2, Trophy, ChevronDown, ChevronUp, Save, X } from "lucide-react"
import { useSeasonRecords, useCreateSeasonRecord, useUpdateSeasonRecord, useDeleteSeasonRecord } from "../../lib/queries"
import { cn } from "../../lib/utils"

const EMPTY = {
  seasonNumber: "", seasonName: "",
  championTeam: "", championPts: "",
  topScorer: "", topScorerGoals: "",
  highestMvPlayer: "", highestMv: "",
  longestStreakPlayer: "", longestStreak: "",
  ballondorWinner: "", teamLeagueWinner: "",
  uclWinner: "",
  weeklyWinners: ["", "", "", ""], // 4 weeks
  teamLeaguePlayers: [""], // players in the winning team league squad
  notes: ""
}

function Field({ label, value, onChange, type = "text", placeholder = "" }) {
  return (
    <div>
      <label className="text-xs text-slate-500 font-medium block mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-pitch-900 border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/40 transition-colors"
      />
    </div>
  )
}

function SeasonForm({ initial = EMPTY, onSave, onCancel, saving }) {
  const [form, setForm] = useState({
    ...EMPTY,
    ...initial,
    weeklyWinners: initial.weeklyWinners?.length ? initial.weeklyWinners : ["", "", "", ""]
  })
  const set = (key) => (val) => setForm(f => ({ ...f, [key]: val }))

  function setWeek(idx, val) {
    const updated = [...form.weeklyWinners]
    updated[idx] = val
    setForm(f => ({ ...f, weeklyWinners: updated }))
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Season Number" value={form.seasonNumber} onChange={set("seasonNumber")} type="number" placeholder="1" />
        <Field label="Season Name" value={form.seasonName} onChange={set("seasonName")} placeholder="Season 1 · 2024–25" />
      </div>

      <div className="border-t border-surface-border pt-3">
        <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-3">Team & Player Records</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Champion Team" value={form.championTeam} onChange={set("championTeam")} placeholder="Japan" />
          <Field label="Champion Points" value={form.championPts} onChange={set("championPts")} type="number" placeholder="64" />
          <Field label="Top Scorer" value={form.topScorer} onChange={set("topScorer")} placeholder="Sidhu" />
          <Field label="Goals Scored" value={form.topScorerGoals} onChange={set("topScorerGoals")} type="number" placeholder="14" />
          <Field label="Highest MV Player" value={form.highestMvPlayer} onChange={set("highestMvPlayer")} placeholder="Sidhu" />
          <Field label="Highest MV" value={form.highestMv} onChange={set("highestMv")} type="number" placeholder="95" />
          <Field label="Longest Win Streak Player" value={form.longestStreakPlayer} onChange={set("longestStreakPlayer")} placeholder="Sathyan" />
          <Field label="Win Streak (matches)" value={form.longestStreak} onChange={set("longestStreak")} type="number" placeholder="5" />
        </div>
      </div>

      <div className="border-t border-surface-border pt-3">
        <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-3">Trophy Winners</p>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Field label="Ballon d'Or Winner" value={form.ballondorWinner} onChange={set("ballondorWinner")} placeholder="Sidhu" />
          <Field label="UCL Winner" value={form.uclWinner} onChange={set("uclWinner")} placeholder="Gnana" />
        </div>

        {/* Team League — team name + squad players */}
        <div className="bg-pitch-800 border border-surface-border rounded-xl p-4 mb-4">
          <p className="text-xs text-slate-400 font-semibold mb-3">Team League Winner</p>
          <Field label="Winning Team Name" value={form.teamLeagueWinner} onChange={set("teamLeagueWinner")} placeholder="Japan" />
          <div className="mt-3">
            <p className="text-xs text-slate-500 font-medium mb-2">Squad Players</p>
            <div className="space-y-2">
              {(form.teamLeaguePlayers || [""]).map((player, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 w-5 flex-shrink-0">{idx + 1}.</span>
                  <input
                    type="text"
                    value={player}
                    onChange={e => {
                      const updated = [...(form.teamLeaguePlayers || [""])]
                      updated[idx] = e.target.value
                      set("teamLeaguePlayers")(updated)
                    }}
                    placeholder={`Player ${idx + 1} name`}
                    className="flex-1 bg-pitch-900 border border-surface-border rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-accent/40 transition-colors"
                  />
                  {(form.teamLeaguePlayers || [""]).length > 1 && (
                    <button
                      onClick={() => {
                        const updated = [...(form.teamLeaguePlayers || [""])]
                        updated.splice(idx, 1)
                        set("teamLeaguePlayers")(updated)
                      }}
                      className="text-slate-600 hover:text-rose-400 transition-colors px-1 flex-shrink-0"
                    >✕</button>
                  )}
                </div>
              ))}
              <button
                onClick={() => set("teamLeaguePlayers")([...(form.teamLeaguePlayers || [""]), ""])}
                className="text-xs text-accent hover:text-accent/80 transition-colors mt-1"
              >
                + Add player
              </button>
            </div>
          </div>
        </div>

        {/* Weekly — 4 separate week inputs */}
        <div className="bg-pitch-800 border border-surface-border rounded-xl p-4">
          <p className="text-xs text-slate-400 font-semibold mb-3">Weekly Trophy Winners</p>
          <div className="space-y-2">
            {form.weeklyWinners.map((winner, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <span className="text-xs text-slate-500 w-14 flex-shrink-0 font-medium">Week {idx + 1}</span>
                <input
                  type="text"
                  value={winner}
                  onChange={e => setWeek(idx, e.target.value)}
                  placeholder={`Week ${idx + 1} winner`}
                  className="flex-1 bg-pitch-900 border border-surface-border rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-accent/40 transition-colors"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className="text-xs text-slate-500 font-medium block mb-1">Notes (optional)</label>
        <textarea
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          placeholder="Any notable moments, upsets or records from this season..."
          rows={2}
          className="w-full bg-pitch-900 border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/40 transition-colors resize-none"
        />
      </div>

      <div className="flex gap-3 pt-1">
        <button onClick={onCancel}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-surface-border text-slate-400 hover:text-white text-sm transition-colors">
          <X className="w-3.5 h-3.5" /> Cancel
        </button>
        <button
          onClick={() => onSave(form)}
          disabled={saving || !form.seasonNumber || !form.seasonName}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold disabled:opacity-50 transition-colors"
        >
          <Save className="w-3.5 h-3.5" /> {saving ? "Saving…" : "Save Season Record"}
        </button>
      </div>
    </div>
  )
}

function SeasonCard({ record, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  const weeklyWinners = Array.isArray(record.weekly_winners)
    ? record.weekly_winners.filter(Boolean)
    : record.weekly_winner ? [record.weekly_winner] : []

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gold/15 text-gold flex items-center justify-center font-bold text-sm flex-shrink-0">
            S{record.season_number}
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-white">{record.season_name}</p>
            {record.champion_team && (
              <p className="text-xs text-slate-500">🏆 {record.champion_team} · {record.champion_pts} pts</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={e => { e.stopPropagation(); onEdit(record) }}
            className="w-7 h-7 rounded-lg hover:bg-accent/10 flex items-center justify-center text-slate-500 hover:text-accent transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={e => { e.stopPropagation(); setConfirmDel(true) }}
            className="w-7 h-7 rounded-lg hover:bg-rose-400/10 flex items-center justify-center text-slate-500 hover:text-rose-400 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </div>
      </button>

      {confirmDel && (
        <div className="px-5 py-3 border-t border-surface-border bg-rose-500/5 flex items-center gap-3">
          <p className="text-sm text-rose-400 flex-1">Delete {record.season_name}?</p>
          <button onClick={() => setConfirmDel(false)} className="text-xs px-3 py-1.5 rounded-lg border border-surface-border text-slate-400">Cancel</button>
          <button onClick={() => onDelete(record.id)} className="text-xs px-3 py-1.5 rounded-lg bg-rose-500 text-white font-semibold">Delete</button>
        </div>
      )}

      {expanded && (
        <div className="border-t border-surface-border px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            {[
              ["Top Scorer", record.top_scorer, `${record.top_scorer_goals ?? 0} goals`],
              ["Highest MV", record.highest_mv_player, `MV ${record.highest_mv ?? 0}`],
              ["Win Streak", record.longest_streak_player, `${record.longest_streak ?? 0} wins`],
              ["Ballon d'Or", record.ballondor_winner, "Winner"],
              ["Team League", record.team_league_winner, "Winner"],
              ["UCL", record.ucl_winner, "Winner"],
            ].filter(([, val]) => val).map(([label, val, sub]) => (
              <div key={label} className="bg-pitch-800 rounded-xl p-3 border border-surface-border">
                <p className="text-xs text-slate-500 mb-1">{label}</p>
                <p className="font-semibold text-white text-sm">{val}</p>
                <p className="text-xs text-slate-600">{sub}</p>
              </div>
            ))}
          </div>

          {/* Team League squad */}
          {record.team_league_winner && Array.isArray(record.team_league_players) && record.team_league_players.filter(Boolean).length > 0 && (
            <div className="bg-pitch-800 rounded-xl p-3 border border-surface-border">
              <p className="text-xs text-slate-500 mb-2">Team League Champions Squad — {record.team_league_winner}</p>
              <div className="flex flex-wrap gap-1.5">
                {record.team_league_players.filter(Boolean).map((p, i) => (
                  <span key={i} className="text-xs bg-pitch-900 border border-surface-border rounded-full px-2.5 py-1 text-slate-300">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Weekly winners */}
          {weeklyWinners.length > 0 && (
            <div className="bg-pitch-800 rounded-xl p-3 border border-surface-border">
              <p className="text-xs text-slate-500 mb-2">Weekly Trophy Winners</p>
              <div className="space-y-1">
                {weeklyWinners.map((w, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="text-xs text-slate-600 w-14">Week {i + 1}</span>
                    <span className="text-white font-medium">{w}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {record.notes && (
            <p className="text-xs text-slate-500 italic">"{record.notes}"</p>
          )}
        </div>
      )}
    </div>
  )
}

export default function SeasonRecordsAdmin() {
  const { data: records = [], isLoading } = useSeasonRecords()
  const createRecord = useCreateSeasonRecord()
  const updateRecord = useUpdateSeasonRecord()
  const deleteRecord = useDeleteSeasonRecord()

  const [showForm, setShowForm]       = useState(false)
  const [editingRecord, setEditingRecord] = useState(null)

  function buildBody(form) {
    return {
      seasonNumber:        parseInt(form.seasonNumber),
      seasonName:          form.seasonName,
      championTeam:        form.championTeam || null,
      championPts:         form.championPts ? parseInt(form.championPts) : null,
      topScorer:           form.topScorer || null,
      topScorerGoals:      form.topScorerGoals ? parseInt(form.topScorerGoals) : null,
      highestMvPlayer:     form.highestMvPlayer || null,
      highestMv:           form.highestMv ? parseInt(form.highestMv) : null,
      longestStreakPlayer:  form.longestStreakPlayer || null,
      longestStreak:       form.longestStreak ? parseInt(form.longestStreak) : null,
      ballondorWinner:     form.ballondorWinner || null,
      teamLeagueWinner:    form.teamLeagueWinner || null,
      teamLeaguePlayers:   form.teamLeaguePlayers || [],
      uclWinner:           form.uclWinner || null,
      weeklyWinners:       form.weeklyWinners || ["", "", "", ""],
      notes:               form.notes || null,
    }
  }

  function handleSave(form) {
    const body = buildBody(form)
    if (editingRecord) {
      updateRecord.mutate({ id: editingRecord.id, ...body }, {
        onSuccess: () => setEditingRecord(null),
        onError: (err) => alert(err?.response?.data?.error || "Failed to update"),
      })
    } else {
      createRecord.mutate(body, {
        onSuccess: () => setShowForm(false),
        onError: (err) => alert(err?.response?.data?.error || "Failed to save"),
      })
    }
  }

  function handleEdit(record) {
    setEditingRecord(record)
    setShowForm(false)
  }

  function handleDelete(id) {
    deleteRecord.mutate(id, {
      onError: (err) => alert(err?.response?.data?.error || "Failed to delete"),
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-gold" />
          <h2 className="text-sm font-semibold text-white">Season Records</h2>
          <span className="text-xs text-slate-500">— shown on Hall of Fame page</span>
        </div>
        {!showForm && !editingRecord && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-accent/15 text-accent border border-accent/25 hover:bg-accent/25 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Season
          </button>
        )}
      </div>

      {showForm && (
        <div className="card p-5">
          <p className="text-sm font-semibold text-white mb-4">Add New Season Record</p>
          <SeasonForm onSave={handleSave} onCancel={() => setShowForm(false)} saving={createRecord.isPending} />
        </div>
      )}

      {editingRecord && (
        <div className="card p-5 border-accent/20">
          <p className="text-sm font-semibold text-white mb-4">Edit: {editingRecord.season_name}</p>
          <SeasonForm
            initial={{
              seasonNumber:        editingRecord.season_number,
              seasonName:          editingRecord.season_name,
              championTeam:        editingRecord.champion_team ?? "",
              championPts:         editingRecord.champion_pts ?? "",
              topScorer:           editingRecord.top_scorer ?? "",
              topScorerGoals:      editingRecord.top_scorer_goals ?? "",
              highestMvPlayer:     editingRecord.highest_mv_player ?? "",
              highestMv:           editingRecord.highest_mv ?? "",
              longestStreakPlayer:  editingRecord.longest_streak_player ?? "",
              longestStreak:       editingRecord.longest_streak ?? "",
              ballondorWinner:     editingRecord.ballondor_winner ?? "",
              teamLeagueWinner:    editingRecord.team_league_winner ?? "",
              teamLeaguePlayers:   editingRecord.team_league_players?.length
                                     ? editingRecord.team_league_players
                                     : [""],
              uclWinner:           editingRecord.ucl_winner ?? "",
              weeklyWinners:       editingRecord.weekly_winners?.length
                                     ? editingRecord.weekly_winners
                                     : editingRecord.weekly_winner
                                       ? [editingRecord.weekly_winner, "", "", ""]
                                       : ["", "", "", ""],
              notes:               editingRecord.notes ?? "",
            }}
            onSave={handleSave}
            onCancel={() => setEditingRecord(null)}
            saving={updateRecord.isPending}
          />
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500 text-center py-6">Loading…</p>
      ) : records.length === 0 ? (
        <div className="card px-5 py-10 text-center">
          <Trophy className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No season records yet</p>
          <p className="text-slate-600 text-xs mt-1">Add a season record to populate the Hall of Fame</p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map(r => (
            <SeasonCard key={r.id} record={r} onEdit={handleEdit} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  )
}