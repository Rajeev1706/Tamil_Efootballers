import { useState } from "react"
import { Pencil, Check, X, Trash2, Camera, Trophy } from "lucide-react"
import GradeBadge from "../common/GradeBadge"
import PlayerAvatar from "../common/PlayerAvatar"
import ImageUpload from "./ImageUpload"
import { useUpdatePlayer, useDeletePlayer, useTeams } from "../../lib/queries"
import { getMVTier, cn } from "../../lib/utils"

const GRADES = ["S","A+","A","B","C"]

function EditableRow({ player, onPlayerClick }) {
  const [editing, setEditing]       = useState(false)
  const [grade, setGrade]           = useState(player.grade)
  const [teamId, setTeamId]         = useState(player.teamId ?? "")
  const [bdrDelta, setBdrDelta]     = useState("")
  const [trophy1, setTrophy1]       = useState(player.trophy1Count ?? 0)
  const [trophy2, setTrophy2]       = useState(player.trophy2Count ?? 0)
  const [trophy3, setTrophy3]       = useState(player.trophy3Count ?? 0)
  const [confirmDel, setConfirmDel] = useState(false)
  const updatePlayer                = useUpdatePlayer()
  const deletePlayer                = useDeletePlayer()
  const { data: teams = [] }        = useTeams()
  const tier                        = getMVTier(player.marketValue)
  const deltaNum                    = parseInt(bdrDelta) || 0

  const handleSave = () => {
    const body = {}
    if (grade  !== player.grade)              body.grade      = grade
    if (bdrDelta !== "")                      body.bdrDelta   = deltaNum
    if (parseInt(teamId) !== player.teamId)   body.teamId     = parseInt(teamId)
    if (trophy1 !== (player.trophy1Count ?? 0)) body.trophy1Count = trophy1
    if (trophy2 !== (player.trophy2Count ?? 0)) body.trophy2Count = trophy2
    if (trophy3 !== (player.trophy3Count ?? 0)) body.trophy3Count = trophy3
    if (!Object.keys(body).length) return setEditing(false)
    updatePlayer.mutate({ id: player.id, ...body }, {
      onSuccess: () => { setEditing(false); setBdrDelta("") },
      onError:   (err) => alert(err.response?.data?.error || "Update failed"),
    })
  }

  const handleCancel = () => {
    setEditing(false)
    setBdrDelta("")
    setGrade(player.grade)
    setTeamId(player.teamId ?? "")
    setTrophy1(player.trophy1Count ?? 0)
    setTrophy2(player.trophy2Count ?? 0)
    setTrophy3(player.trophy3Count ?? 0)
  }

  const handleDelete = () => {
    deletePlayer.mutate(player.id, {
      onSuccess: () => setConfirmDel(false),
      onError:   (err) => alert(err.response?.data?.error || "Delete failed"),
    })
  }

  if (confirmDel) {
    return (
      <tr className="border-b border-surface-border/60 bg-rose-400/5">
        <td colSpan={6} className="py-3.5 px-5">
          <div className="flex items-center gap-4">
            <p className="text-sm text-rose-400 flex-1">
              Delete <span className="font-semibold">{player.name}</span>? This removes all match records too.
            </p>
            <button onClick={() => setConfirmDel(false)}
              className="text-xs px-3 py-1.5 rounded-lg border border-surface-border text-slate-400 hover:text-white">
              Cancel
            </button>
            <button onClick={handleDelete} disabled={deletePlayer.isPending}
              className="text-xs px-3 py-1.5 rounded-lg bg-rose-500 text-white font-semibold disabled:opacity-50">
              {deletePlayer.isPending ? "Deleting…" : "Yes, delete"}
            </button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <>
      <tr className={cn(
        "border-b border-surface-border/60 transition-colors",
        editing ? "bg-pitch-800" : "hover:bg-surface-hover"
      )}>
        {/* Player */}
        <td className="py-3.5 px-5">
          <div className="flex items-center gap-3">
            <PlayerAvatar player={player} size="sm" />
            <div>
              <button
                onClick={() => onPlayerClick?.(player)}
                className="text-sm font-medium text-white hover:text-accent transition-colors text-left">
                {player.name}
              </button>
              {/* Team shown */}
              {editing ? (
                <select
                  value={teamId}
                  onChange={e => setTeamId(e.target.value)}
                  className="mt-1 bg-pitch-900 border border-surface-border rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-accent/40 w-full max-w-[160px]"
                >
                  <option value="">— No team —</option>
                  {teams.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-slate-500 mt-0.5">
                  {player.team || "No team"}
                </p>
              )}
            </div>
          </div>
        </td>

        {/* Grade */}
        <td className="py-3.5 px-4">
          {editing ? (
            <select value={grade} onChange={e => setGrade(e.target.value)}
              className="bg-pitch-900 border border-surface-border rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-accent/40">
              {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          ) : <GradeBadge grade={player.grade} />}
        </td>

        {/* Auction */}
        <td className="py-3.5 px-4 text-center font-mono text-sm text-slate-400">
          {player.auctionPrice}
        </td>

        {/* MV */}
        <td className="py-3.5 px-4 text-center">
          <p className="font-bold font-mono text-sm text-white">{player.marketValue}</p>
          <p className={cn("text-xs", tier.color)}>{tier.label}</p>
        </td>

        {/* BDR */}
        <td className="py-3.5 px-4">
          {editing ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-slate-400">{player.bdrPoints}</span>
                <input type="number" placeholder="±delta" value={bdrDelta}
                  onChange={e => setBdrDelta(e.target.value)}
                  className="w-24 bg-pitch-900 border border-surface-border rounded-lg px-2.5 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-accent/40 text-center" />
              </div>
              {bdrDelta !== "" && (
                <p className={cn("text-xs font-mono font-semibold",
                  deltaNum >= 0 ? "text-emerald-400" : "text-rose-400")}>
                  → {Math.max(0, player.bdrPoints + deltaNum).toLocaleString()} pts
                </p>
              )}
            </div>
          ) : (
            <span className="font-mono text-sm text-white">
              {player.bdrPoints?.toLocaleString()}
            </span>
          )}
        </td>

        {/* Actions */}
        <td className="py-3.5 px-5 text-right">
          {editing ? (
            <div className="flex items-center justify-end gap-2">
              <button onClick={handleCancel}
                className="w-8 h-8 rounded-lg border border-surface-border flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
              <button onClick={handleSave} disabled={updatePlayer.isPending}
                className="w-8 h-8 rounded-lg bg-accent hover:bg-accent-dim flex items-center justify-center text-white transition-colors disabled:opacity-50">
                <Check className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-1">
              <button onClick={() => setEditing(true)}
                className="w-8 h-8 rounded-lg hover:bg-surface flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                title="Edit">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setConfirmDel(true)}
                className="w-8 h-8 rounded-lg hover:bg-rose-400/10 flex items-center justify-center text-slate-400 hover:text-rose-400 transition-colors"
                title="Delete">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </td>
      </tr>

      {/* Image upload row */}
      {editing && (
        <tr className="border-b border-surface-border/60 bg-pitch-800">
          <td colSpan={6} className="px-5 py-4">
            <div className="flex items-center gap-4">
              <Camera className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <span className="text-xs text-slate-400 flex-shrink-0">Squad image</span>
              <ImageUpload player={player} onSuccess={() => {}} />
            </div>
          </td>
        </tr>
      )}

      {/* Trophy counts row */}
      {editing && (
        <tr className="border-b border-surface-border/60 bg-pitch-800">
          <td colSpan={6} className="px-5 py-4">
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-2 flex-shrink-0">
                <Trophy className="w-4 h-4 text-gold" />
                <span className="text-xs text-slate-400">Trophies</span>
              </div>
              {[
                { label: "Ballon d'Or", value: trophy1, onChange: setTrophy1 },
                { label: "Team League", value: trophy2, onChange: setTrophy2 },
                { label: "Weekly",      value: trophy3, onChange: setTrophy3 },
              ].map(t => (
                <div key={t.label} className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">{t.label}</span>
                  <input
                    type="number" min="0" value={t.value}
                    onChange={e => t.onChange(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-16 bg-pitch-900 border border-surface-border rounded-lg px-2.5 py-1.5 text-sm text-white font-mono text-center focus:outline-none focus:border-accent/40"
                  />
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default function PlayerManagement({ players, onPlayerClick }) {
  return (
    <div>
      <p className="text-sm text-slate-400 mb-4">
        Edit grades, BDR points, team assignment, squad images, and trophy counts.
        Click the pencil icon to edit — the team dropdown appears under the player name.
      </p>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border">
                {["Player / Team","Grade","Auction","Market value","BDR points",""].map(h => (
                  <th key={h} className={cn(
                    "py-3 text-xs font-semibold text-slate-500 tracking-wide uppercase",
                    h === "Player / Team" || h === "" ? "px-5 text-left" : "px-4 text-center",
                    h === "" && "text-right"
                  )}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {players.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 text-sm">
                    No players yet — add them in the Setup tab.
                  </td>
                </tr>
              ) : (
                players.map(p => (
                  <EditableRow key={p.id} player={p} onPlayerClick={onPlayerClick} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}