import { useState } from "react"
import { Plus, Trash2, Pencil, Check, X, Users, ChevronDown, ChevronUp } from "lucide-react"
import {
  useUclGroups, useUclUnassigned,
  useCreateUclGroup, useRenameUclGroup, useDeleteUclGroup,
  useAssignUclPlayer, useUnassignUclPlayer,
} from "../../lib/queries"
import { cn } from "../../lib/utils"

function GroupCard({ group, unassigned }) {
  const [expanded, setExpanded]   = useState(true)
  const [editing, setEditing]     = useState(false)
  const [name, setName]           = useState(group.name)
  const [confirmDel, setConfirmDel] = useState(false)
  const [addPlayerId, setAddPlayerId] = useState("")

  const renameGroup    = useRenameUclGroup()
  const deleteGroup    = useDeleteUclGroup()
  const assignPlayer   = useAssignUclPlayer()
  const unassignPlayer = useUnassignUclPlayer()

  const handleRename = () => {
    if (!name.trim() || name === group.name) { setEditing(false); return }
    renameGroup.mutate({ id: group.id, name: name.trim() }, { onSuccess: () => setEditing(false) })
  }

  const handleAdd = () => {
    if (!addPlayerId) return
    assignPlayer.mutate({ groupId: group.id, playerId: Number(addPlayerId) }, {
      onSuccess: () => setAddPlayerId(""),
    })
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 flex items-center justify-between border-b border-surface-border">
        <button onClick={() => setExpanded(v => !v)} className="flex items-center gap-2 flex-1 min-w-0">
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
          {editing ? (
            <input
              value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleRename()}
              onClick={e => e.stopPropagation()}
              className="bg-pitch-800 border border-surface-border rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-accent/40"
            />
          ) : (
            <span className="font-semibold text-white text-sm">{group.name}</span>
          )}
          <span className="text-xs text-slate-500">({group.players.length} players)</span>
        </button>
        <div className="flex items-center gap-1">
          {editing ? (
            <>
              <button onClick={handleRename} className="w-7 h-7 rounded-lg hover:bg-emerald-400/10 flex items-center justify-center text-emerald-400"><Check className="w-3.5 h-3.5" /></button>
              <button onClick={() => { setEditing(false); setName(group.name) }} className="w-7 h-7 rounded-lg hover:bg-surface flex items-center justify-center text-slate-400"><X className="w-3.5 h-3.5" /></button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="w-7 h-7 rounded-lg hover:bg-accent/10 flex items-center justify-center text-slate-500 hover:text-accent"><Pencil className="w-3.5 h-3.5" /></button>
          )}
          <button onClick={() => setConfirmDel(true)} className="w-7 h-7 rounded-lg hover:bg-rose-400/10 flex items-center justify-center text-slate-500 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {confirmDel && (
        <div className="px-5 py-3 bg-rose-500/5 border-b border-surface-border flex items-center gap-3">
          <p className="text-sm text-rose-400 flex-1">Delete "{group.name}"? Players will become unassigned.</p>
          <button onClick={() => setConfirmDel(false)} className="text-xs px-3 py-1.5 rounded-lg border border-surface-border text-slate-400">Cancel</button>
          <button onClick={() => deleteGroup.mutate(group.id)} className="text-xs px-3 py-1.5 rounded-lg bg-rose-500 text-white font-semibold">Delete</button>
        </div>
      )}

      {expanded && (
        <div className="px-5 py-4 space-y-3">
          {group.players.length === 0 ? (
            <p className="text-sm text-slate-500">No players in this group yet</p>
          ) : (
            <div className="space-y-2">
              {group.players.map(p => (
                <div key={p.id} className="flex items-center justify-between bg-pitch-800 rounded-lg px-3 py-2">
                  <div>
                    <span className="text-sm text-white font-medium">{p.name}</span>
                    <span className="text-xs text-slate-500 ml-2">{p.team ?? "Unassigned"}</span>
                  </div>
                  <button onClick={() => unassignPlayer.mutate(p.id)}
                    className="text-xs text-slate-500 hover:text-rose-400 transition-colors">Remove</button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <select value={addPlayerId} onChange={e => setAddPlayerId(e.target.value)}
              className="flex-1 bg-pitch-900 border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/40">
              <option value="">+ Add player to this group…</option>
              {unassigned.map(p => (
                <option key={p.id} value={p.id}>{p.name} {p.team ? `(${p.team})` : ""}</option>
              ))}
            </select>
            <button onClick={handleAdd} disabled={!addPlayerId}
              className="px-3 py-2 rounded-lg bg-accent/15 text-accent border border-accent/25 text-sm font-semibold disabled:opacity-40">
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function UclGroupsAdmin() {
  const { data: groups = [], isLoading } = useUclGroups()
  const { data: unassigned = [] }        = useUclUnassigned()
  const createGroup = useCreateUclGroup()
  const [newGroupName, setNewGroupName] = useState("")

  const handleCreate = () => {
    if (!newGroupName.trim()) return
    createGroup.mutate(newGroupName.trim(), { onSuccess: () => setNewGroupName("") })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-white">UCL Groups</h2>
          <span className="text-xs text-slate-500">— manage groups and player assignments</span>
        </div>
      </div>

      <div className="card p-4 flex items-center gap-2">
        <input
          value={newGroupName}
          onChange={e => setNewGroupName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleCreate()}
          placeholder="New group name e.g. Group A"
          className="flex-1 bg-pitch-800 border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/40"
        />
        <button onClick={handleCreate} disabled={!newGroupName.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent/15 text-accent border border-accent/25 text-sm font-semibold disabled:opacity-40">
          <Plus className="w-3.5 h-3.5" /> Add Group
        </button>
      </div>

      {unassigned.length > 0 && (
        <p className="text-xs text-slate-500">{unassigned.length} player{unassigned.length !== 1 ? "s" : ""} not yet assigned to a UCL group</p>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500 text-center py-6">Loading…</p>
      ) : groups.length === 0 ? (
        <div className="card px-5 py-10 text-center">
          <Users className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No UCL groups yet</p>
          <p className="text-slate-600 text-xs mt-1">Create a group above to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(g => <GroupCard key={g.id} group={g} unassigned={unassigned} />)}
        </div>
      )}
    </div>
  )
}