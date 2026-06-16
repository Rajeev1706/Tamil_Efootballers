import { useState } from "react"
import { Pencil, Trash2, Check, X, AlertTriangle, ChevronDown, ChevronRight, Users, KeyRound } from "lucide-react"
import { useTeams, useDeleteTeam, useUpdateTeam, useDeletePlayer, useChangeTeamPassword } from "../../lib/queries"
import PlayerAvatar from "../common/PlayerAvatar"
import GradeBadge from "../common/GradeBadge"
import { cn } from "../../lib/utils"

function RosterPlayerRow({ player }) {
  const [confirmDel, setConfirmDel] = useState(false)
  const deletePlayer                = useDeletePlayer()

  const handleDelete = () => {
    deletePlayer.mutate(player.id, {
      onSuccess: () => setConfirmDel(false),
      onError:   (err) => alert(err.response?.data?.error || "Delete failed"),
    })
  }

  if (confirmDel) {
    return (
      <div className="flex items-center gap-3 px-4 py-2.5 bg-rose-400/5 rounded-lg">
        <p className="text-xs text-rose-400 flex-1">
          Delete <span className="font-semibold">{player.name}</span>? Removes their match records too.
        </p>
        <button onClick={() => setConfirmDel(false)}
          className="text-xs px-2.5 py-1 rounded-lg border border-surface-border text-slate-400 hover:text-white">
          Cancel
        </button>
        <button onClick={handleDelete} disabled={deletePlayer.isPending}
          className="text-xs px-2.5 py-1 rounded-lg bg-rose-500 text-white font-semibold disabled:opacity-50">
          {deletePlayer.isPending ? "Deleting…" : "Yes, delete"}
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-hover rounded-lg transition-colors group">
      <PlayerAvatar player={player} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{player.name}</p>
        {player.alias && <p className="text-xs text-slate-500">"{player.alias}"</p>}
      </div>
      <GradeBadge grade={player.grade} />
      <span className="text-xs font-mono text-slate-400 w-12 text-right">{player.marketValue}</span>
      <button
        onClick={() => setConfirmDel(true)}
        className="w-7 h-7 rounded-lg hover:bg-rose-400/10 flex items-center justify-center text-slate-500 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
        title="Remove player"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

function TeamRow({ team, players }) {
  const [editing, setEditing]           = useState(false)
  const [name, setName]                 = useState(team.name)
  const [confirmDel, setConfirmDel]     = useState(false)
  const [expanded, setExpanded]         = useState(false)
  const [changingPwd, setChangingPwd]   = useState(false)
  const [newPassword, setNewPassword]   = useState("")
  const [pwdError, setPwdError]         = useState("")
  const [pwdSuccess, setPwdSuccess]     = useState(false)
  const updateTeam                      = useUpdateTeam()
  const deleteTeam                      = useDeleteTeam()
  const changePassword                  = useChangeTeamPassword()

  const roster = players.filter(p => p.teamId === team.id)

  const handleSave = () => {
    if (!name.trim()) return
    updateTeam.mutate({ id: team.id, name }, {
      onSuccess: () => setEditing(false),
      onError: (err) => alert(err.response?.data?.error || "Update failed"),
    })
  }

  const handleDelete = () => {
    deleteTeam.mutate(team.id, {
      onSuccess: () => setConfirmDel(false),
      onError: (err) => alert(err.response?.data?.error || "Delete failed"),
    })
  }

  const handlePasswordSave = () => {
    setPwdError("")
    if (newPassword.length < 6) {
      setPwdError("Password must be at least 6 characters")
      return
    }
    changePassword.mutate({ id: team.id, newPassword }, {
      onSuccess: () => {
        setPwdSuccess(true)
        setNewPassword("")
        setTimeout(() => {
          setPwdSuccess(false)
          setChangingPwd(false)
        }, 2000)
      },
      onError: (err) => setPwdError(err.response?.data?.error || "Failed to change password"),
    })
  }

  const cancelPassword = () => {
    setChangingPwd(false)
    setNewPassword("")
    setPwdError("")
    setPwdSuccess(false)
  }

  return (
    <div className="border-b border-surface-border/60 last:border-b-0">
      <div className={cn(
        "flex items-center gap-3 px-5 py-3.5 transition-colors",
        confirmDel ? "bg-rose-400/5" : "hover:bg-surface-hover"
      )}>
        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-500 hover:text-white transition-colors flex-shrink-0"
        >
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {/* Avatar */}
        <div className="w-8 h-8 rounded-lg bg-surface-border flex items-center justify-center text-sm font-bold text-slate-400 flex-shrink-0">
          {team.name.charAt(0)}
        </div>

        {/* Name */}
        <div className="flex-1 min-w-0">
          {editing ? (
            <input value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSave()}
              className="bg-pitch-800 border border-surface-border rounded-lg px-2.5 py-1 text-sm text-white focus:outline-none focus:border-accent/40 w-full max-w-xs" />
          ) : (
            <p className="text-sm font-medium text-white truncate">{team.name}</p>
          )}
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
            <Users className="w-3 h-3" /> {roster.length} player{roster.length !== 1 ? "s" : ""} · {team.points} pts
          </p>
        </div>

        {/* Confirm delete warning */}
        {confirmDel && (
          <div className="flex items-center gap-2 text-xs text-rose-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Delete team + all players?</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {editing ? (
            <>
              <button onClick={() => { setEditing(false); setName(team.name) }}
                className="w-7 h-7 rounded-lg border border-surface-border flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
              <button onClick={handleSave} disabled={updateTeam.isPending}
                className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center text-white transition-colors">
                <Check className="w-3.5 h-3.5" />
              </button>
            </>
          ) : confirmDel ? (
            <>
              <button onClick={() => setConfirmDel(false)}
                className="text-xs px-2.5 py-1 rounded-lg border border-surface-border text-slate-400 hover:text-white transition-colors">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleteTeam.isPending}
                className="text-xs px-2.5 py-1 rounded-lg bg-rose-500 text-white font-semibold transition-colors disabled:opacity-50">
                {deleteTeam.isPending ? "Deleting…" : "Yes, delete"}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { setChangingPwd(e => !e); setEditing(false) }}
                className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
                  changingPwd
                    ? "bg-amber-400/15 text-amber-400"
                    : "hover:bg-surface text-slate-400 hover:text-amber-400"
                )}
                title="Change password">
                <KeyRound className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => { setEditing(true); setChangingPwd(false) }}
                className="w-7 h-7 rounded-lg hover:bg-surface flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                title="Edit name">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setConfirmDel(true)}
                className="w-7 h-7 rounded-lg hover:bg-rose-400/10 flex items-center justify-center text-slate-400 hover:text-rose-400 transition-colors"
                title="Delete team">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Change password panel */}
      {changingPwd && (
        <div className="px-5 pb-4 pl-14">
          <div className="bg-amber-400/5 border border-amber-400/20 rounded-xl p-4">
            <p className="text-xs font-semibold text-amber-400 mb-3 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5" />
              Reset password for <span className="text-white">{team.name}</span> owner account
            </p>

            {pwdSuccess ? (
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
                <Check className="w-4 h-4" />
                Password changed successfully
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => { setNewPassword(e.target.value); setPwdError("") }}
                  onKeyDown={e => e.key === "Enter" && handlePasswordSave()}
                  placeholder="New password (min 6 chars)"
                  className="flex-1 bg-pitch-800 border border-surface-border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-400/40 transition-colors"
                />
                <button
                  onClick={handlePasswordSave}
                  disabled={changePassword.isPending}
                  className="px-3 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-pitch-900 text-sm font-semibold transition-colors disabled:opacity-50 flex-shrink-0"
                >
                  {changePassword.isPending ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={cancelPassword}
                  className="w-8 h-8 rounded-lg border border-surface-border flex items-center justify-center text-slate-400 hover:text-white transition-colors flex-shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {pwdError && (
              <p className="text-xs text-rose-400 mt-2">{pwdError}</p>
            )}
          </div>
        </div>
      )}

      {/* Expanded roster */}
      {expanded && (
        <div className="px-5 pb-3 pl-14">
          {roster.length === 0 ? (
            <p className="text-xs text-slate-500 py-2">No players on this team yet.</p>
          ) : (
            <div className="space-y-0.5 bg-pitch-900/40 rounded-xl p-1.5 border border-surface-border">
              {roster.map(p => <RosterPlayerRow key={p.id} player={p} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ManageTeams({ players = [] }) {
  const { data: teams = [], isLoading } = useTeams()

  if (isLoading) return <div className="text-slate-500 text-sm py-4">Loading teams…</div>

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-surface-border">
        <h3 className="text-sm font-semibold text-white">Existing teams</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Click a team to expand its roster · pencil to rename · key to reset password · trash to delete
        </p>
      </div>
      {teams.length === 0 ? (
        <div className="px-5 py-10 text-center text-slate-500 text-sm">No teams yet — create one below.</div>
      ) : (
        <div>
          {teams.map(t => <TeamRow key={t.id} team={t} players={players} />)}
        </div>
      )}
    </div>
  )
}