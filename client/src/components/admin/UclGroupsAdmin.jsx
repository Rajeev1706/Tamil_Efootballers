import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { Plus, Trash2, Pencil, Check, X, Users, ChevronDown, ChevronUp, Zap } from "lucide-react"
import {
  useUclAdminGroups, useUclUnassigned,
  useCreateUclGroup, useGenerateUclGroups,
  useRenameUclGroup, useDeleteUclGroup,
  useAssignUclPlayer, useUnassignUclPlayer,
} from "../../lib/queries"
import { usePlayers } from "../../lib/queries"
import { uclApi } from "../../lib/api"
import { cn } from "../../lib/utils"

// Auto-generate form: select players → auto-create 8 groups
function GenerateForm({ onClose }) {
  const navigate = useNavigate()
  const { data: allPlayers = [] } = usePlayers()
  const generateGroups = useGenerateUclGroups()
  const [selected, setSelected] = useState([])
  const [search, setSearch]     = useState("")

  const filtered = allPlayers.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) && !selected.includes(p.id)
  )

  function togglePlayer(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const perGroup   = Math.floor(selected.length / 8)
  const remainder  = selected.length % 8

  async function handleGenerate() {
    if (selected.length < 1) return
    await generateGroups.mutateAsync(selected)
    onClose() // return to admin list — View Draw button will appear
  }

  return (
    <div className="card p-5 space-y-4 mb-5">
      <div className="flex items-center gap-2">
        <Zap className="w-4 h-4 text-accent" />
        <h3 className="text-sm font-semibold text-white">Auto-Generate 8 Groups</h3>
      </div>

      <div>
        <p className="text-xs text-slate-500 mb-2">
          Select players — {selected.length} selected
          {selected.length > 0 && (
            <span className="ml-2 text-accent">
              → {perGroup} per group{remainder > 0 ? `, first ${remainder} group${remainder > 1 ? "s" : ""} get 1 extra` : ""}
            </span>
          )}
        </p>

        {/* Selected chips */}
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {selected.map(id => {
              const p = allPlayers.find(pl => pl.id === id)
              return (
                <button key={id} onClick={() => togglePlayer(id)}
                  className="flex items-center gap-1 px-2 py-0.5 bg-accent/15 border border-accent/25 rounded-lg text-xs text-accent">
                  {p?.name} ✕
                </button>
              )
            })}
          </div>
        )}

        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search players…"
          className="w-full bg-pitch-800 border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/40 mb-2" />

        <div className="max-h-48 overflow-y-auto space-y-1 border border-surface-border rounded-lg p-2">
          {filtered.map(p => (
            <div key={p.id} onClick={() => togglePlayer(p.id)}
              className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-pitch-800 cursor-pointer">
              <div className="w-4 h-4 rounded border border-surface-border flex items-center justify-center flex-shrink-0 bg-pitch-800">
                {selected.includes(p.id) && <div className="w-2 h-2 rounded-sm bg-accent" />}
              </div>
              <span className="text-sm text-white flex-1">{p.name}</span>
              <span className="text-xs text-slate-500">{p.team ?? "Free"}</span>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-xs text-slate-600 text-center py-2">No more players</p>}
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onClose} className="px-4 py-2 rounded-lg border border-surface-border text-slate-400 text-sm">Cancel</button>
        <button onClick={handleGenerate}
          disabled={selected.length < 1 || generateGroups.isPending}
          className="flex-1 px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold disabled:opacity-40">
          {generateGroups.isPending ? "Generating…" : `Generate 8 Groups (${selected.length} players)`}
        </button>
      </div>
    </div>
  )
}

function GroupCard({ group, unassigned }) {
  const [expanded, setExpanded]       = useState(true)
  const [editing, setEditing]         = useState(false)
  const [name, setName]               = useState(group.name)
  const [confirmDel, setConfirmDel]   = useState(false)
  const [confirmRegen, setConfirmRegen] = useState(false)
  const [addPlayerId, setAddPlayerId] = useState("")
  const [regenerating, setRegenerating] = useState(false)

  const renameGroup    = useRenameUclGroup()
  const deleteGroup    = useDeleteUclGroup()
  const assignPlayer   = useAssignUclPlayer()
  const unassignPlayer = useUnassignUclPlayer()
  const qc = useQueryClient()

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

  async function handleRegenerate() {
    setRegenerating(true)
    try {
      await uclApi.regenerateGroupFixtures(group.id)
      // Invalidate all UCL-related queries
      qc.invalidateQueries({ queryKey: ["ucl-fixtures"] })
      qc.invalidateQueries({ queryKey: ["ucl-standings"] })
      qc.invalidateQueries({ queryKey: ["ucl-groups"] })
      qc.invalidateQueries({ queryKey: ["ucl-admin-groups"] })
      setConfirmRegen(false)
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to regenerate")
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 flex items-center justify-between border-b border-surface-border">
        <button onClick={() => setExpanded(v => !v)} className="flex items-center gap-2 flex-1 min-w-0">
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
          {editing ? (
            <input value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleRename()}
              onClick={e => e.stopPropagation()}
              className="bg-pitch-800 border border-surface-border rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-accent/40" />
          ) : (
            <span className="font-semibold text-white text-sm">{group.name}</span>
          )}
          <span className="text-xs text-slate-500">({group.players.length} players)</span>
        </button>
        <div className="flex items-center gap-1">
          {editing ? (
            <>
              <button onClick={handleRename} className="w-7 h-7 rounded-lg hover:bg-emerald-400/10 flex items-center justify-center text-emerald-400"><Check className="w-3.5 h-3.5" /></button>
              <button onClick={() => { setEditing(false); setName(group.name) }} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400"><X className="w-3.5 h-3.5" /></button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="w-7 h-7 rounded-lg hover:bg-accent/10 flex items-center justify-center text-slate-500 hover:text-accent"><Pencil className="w-3.5 h-3.5" /></button>
          )}
          <button onClick={() => setConfirmDel(true)} className="w-7 h-7 rounded-lg hover:bg-rose-400/10 flex items-center justify-center text-slate-500 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {confirmDel && (
        <div className="px-5 py-3 bg-rose-500/5 border-b border-surface-border flex items-center gap-3">
          <p className="text-sm text-rose-400 flex-1">Delete "{group.name}"? Players become unassigned.</p>
          <button onClick={() => setConfirmDel(false)} className="text-xs px-3 py-1.5 rounded-lg border border-surface-border text-slate-400">Cancel</button>
          <button onClick={() => deleteGroup.mutate(group.id)} className="text-xs px-3 py-1.5 rounded-lg bg-rose-500 text-white font-semibold">Delete</button>
        </div>
      )}

      {expanded && (
        <div className="px-5 py-4 space-y-3">
          {group.players.length === 0 ? (
            <p className="text-sm text-slate-500">No players in this group yet</p>
          ) : (
            <div className="space-y-1.5">
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

          <div className="flex items-center gap-2 pt-1">
            <select value={addPlayerId} onChange={e => setAddPlayerId(e.target.value)}
              className="flex-1 bg-pitch-900 border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/40">
              <option value="">+ Add player to this group…</option>
              {unassigned.map(p => (
                <option key={p.id} value={p.id}>{p.name}{p.team ? ` (${p.team})` : ""}</option>
              ))}
            </select>
            <button onClick={handleAdd} disabled={!addPlayerId}
              className="px-3 py-2 rounded-lg bg-accent/15 text-accent border border-accent/25 text-sm font-semibold disabled:opacity-40">
              Add
            </button>
          </div>

          {/* Regenerate fixtures */}
          <div className="pt-2 border-t border-surface-border/50">
            {confirmRegen ? (
              <div className="flex items-center gap-2">
                <p className="text-xs text-amber-400 flex-1">Delete all results & regenerate fixtures?</p>
                <button onClick={() => setConfirmRegen(false)} className="text-xs px-2 py-1 border border-surface-border rounded text-slate-400">Cancel</button>
                <button onClick={handleRegenerate} disabled={regenerating}
                  className="text-xs px-3 py-1 bg-amber-400 text-black rounded font-bold disabled:opacity-50">
                  {regenerating ? "…" : "Regenerate"}
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmRegen(true)}
                className="text-xs text-slate-500 hover:text-amber-400 transition-colors flex items-center gap-1">
                ↺ Regenerate fixtures for this group
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function UclGroupsAdmin() {
  const navigate = useNavigate()
  const { data: groups = [], isLoading } = useUclAdminGroups()
  const { data: unassigned = [] }        = useUclUnassigned()
  const createGroup = useCreateUclGroup()
  const [showGenerate, setShowGenerate] = useState(false)
  const [showCreate, setShowCreate]     = useState(false)
  const [newGroupName, setNewGroupName] = useState("")

  const handleCreate = () => {
    if (!newGroupName.trim()) return
    createGroup.mutate(newGroupName.trim(), { onSuccess: () => setNewGroupName("") })
    setShowCreate(false)
  }

  const pendingGroups = groups.filter(g => g.status === "pending_draw")
  const activeGroups  = groups.filter(g => g.status === "active" || !g.status)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-white">UCL Groups</h2>
          {unassigned.length > 0 && (
            <span className="text-xs text-slate-500">{unassigned.length} unassigned</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setShowGenerate(v => !v); setShowCreate(false) }}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-accent text-white border border-accent/50 hover:bg-accent-dim transition-colors">
            <Zap className="w-3.5 h-3.5" /> Auto-generate Groups
          </button>
          <button onClick={() => { setShowCreate(v => !v); setShowGenerate(false) }}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-pitch-800 text-slate-400 border border-surface-border hover:text-white transition-colors">
            <Plus className="w-3.5 h-3.5" /> Manual
          </button>
        </div>
      </div>

      {showGenerate && <GenerateForm onClose={() => setShowGenerate(false)} />}

      {/* View Draw button — shown only when pending_draw groups exist */}
      {pendingGroups.length > 0 && !showGenerate && (
        <div className="card px-5 py-4 flex items-center justify-between border-amber-400/20">
          <div>
            <p className="text-sm font-semibold text-white">UCL Group Draw Ready</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {pendingGroups.length} groups · {pendingGroups.reduce((s, g) => s + g.players.length, 0)} players · Draw not started yet
            </p>
          </div>
          <button
            onClick={() => navigate("/ucl/draw")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-400/15 text-amber-400 border border-amber-400/30 text-sm font-semibold hover:bg-amber-400/25 transition-colors"
          >
            🎲 View Draw
          </button>
        </div>
      )}

      {showCreate && (
        <div className="card p-4 flex items-center gap-2">
          <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleCreate()}
            placeholder="Group name e.g. Group A"
            className="flex-1 bg-pitch-800 border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/40" />
          <button onClick={handleCreate} disabled={!newGroupName.trim()}
            className="px-4 py-2 rounded-lg bg-accent/15 text-accent border border-accent/25 text-sm font-semibold disabled:opacity-40">
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setShowCreate(false)} className="px-3 py-2 rounded-lg border border-surface-border text-slate-400 text-sm">Cancel</button>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500 text-center py-6">Loading…</p>
      ) : activeGroups.length === 0 && pendingGroups.length === 0 && !showGenerate ? (
        <div className="card px-5 py-10 text-center">
          <Users className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No UCL groups yet</p>
          <p className="text-slate-600 text-xs mt-1">Use Auto-generate to create 8 groups instantly, or add manually</p>
        </div>
      ) : activeGroups.length > 0 ? (
        <div className="space-y-3">
          {activeGroups.map(g => <GroupCard key={g.id} group={g} unassigned={unassigned} />)}
        </div>
      ) : null}
    </div>
  )
}