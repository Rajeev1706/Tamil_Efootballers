import { useState } from "react"
import { Plus, Pencil, Trash2, Save, X, Info } from "lucide-react"
import { useLeagueInfo, useCreateLeagueInfo, useUpdateLeagueInfo, useDeleteLeagueInfo } from "../../lib/queries"
import { cn } from "../../lib/utils"

function InfoForm({ initial = { title: "", content: "", sortOrder: 0 }, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial)
  const set = k => v => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-slate-500 font-medium block mb-1">Title</label>
        <input
          type="text"
          value={form.title}
          onChange={e => set("title")(e.target.value)}
          placeholder="e.g. League Rules, About TEC, Prize Info..."
          className="w-full bg-pitch-900 border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/40 transition-colors"
        />
      </div>
      <div>
        <label className="text-xs text-slate-500 font-medium block mb-1">Content</label>
        <textarea
          value={form.content}
          onChange={e => set("content")(e.target.value)}
          placeholder="Write the info content here..."
          rows={4}
          className="w-full bg-pitch-900 border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/40 transition-colors resize-none"
        />
      </div>
      <div>
        <label className="text-xs text-slate-500 font-medium block mb-1">Sort Order (lower = shown first)</label>
        <input
          type="number"
          value={form.sortOrder}
          onChange={e => set("sortOrder")(parseInt(e.target.value) || 0)}
          className="w-24 bg-pitch-900 border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/40 transition-colors"
        />
      </div>
      <div className="flex gap-3 pt-1">
        <button onClick={onCancel}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-surface-border text-slate-400 hover:text-white text-sm transition-colors">
          <X className="w-3.5 h-3.5" /> Cancel
        </button>
        <button
          onClick={() => onSave(form)}
          disabled={saving || !form.title.trim() || !form.content.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold disabled:opacity-50 transition-colors"
        >
          <Save className="w-3.5 h-3.5" /> {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  )
}

export default function LeagueInfoAdmin() {
  const { data: items = [], isLoading } = useLeagueInfo()
  const createInfo = useCreateLeagueInfo()
  const updateInfo = useUpdateLeagueInfo()
  const deleteInfo = useDeleteLeagueInfo()

  const [showForm, setShowForm]       = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [confirmDel, setConfirmDel]   = useState(null)

  function handleCreate(form) {
    createInfo.mutate({ title: form.title, content: form.content, sortOrder: form.sortOrder }, {
      onSuccess: () => setShowForm(false),
      onError: err => alert(err?.response?.data?.error || "Failed to save"),
    })
  }

  function handleUpdate(form) {
    updateInfo.mutate({ id: editingItem.id, title: form.title, content: form.content, sortOrder: form.sortOrder }, {
      onSuccess: () => setEditingItem(null),
      onError: err => alert(err?.response?.data?.error || "Failed to update"),
    })
  }

  function handleDelete(id) {
    deleteInfo.mutate(id, {
      onSuccess: () => setConfirmDel(null),
      onError: err => alert(err?.response?.data?.error || "Failed to delete"),
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-white">League Info Board</h2>
          <span className="text-xs text-slate-500">— shown on Hall of Fame page</span>
        </div>
        {!showForm && !editingItem && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-accent/15 text-accent border border-accent/25 hover:bg-accent/25 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Info
          </button>
        )}
      </div>

      {showForm && (
        <div className="card p-5">
          <p className="text-sm font-semibold text-white mb-4">Add New Info</p>
          <InfoForm onSave={handleCreate} onCancel={() => setShowForm(false)} saving={createInfo.isPending} />
        </div>
      )}

      {editingItem && (
        <div className="card p-5 border-accent/20">
          <p className="text-sm font-semibold text-white mb-4">Edit: {editingItem.title}</p>
          <InfoForm
            initial={{ title: editingItem.title, content: editingItem.content, sortOrder: editingItem.sort_order }}
            onSave={handleUpdate}
            onCancel={() => setEditingItem(null)}
            saving={updateInfo.isPending}
          />
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500 text-center py-6">Loading…</p>
      ) : items.length === 0 && !showForm ? (
        <div className="card px-5 py-8 text-center">
          <Info className="w-6 h-6 text-slate-600 mx-auto mb-2" />
          <p className="text-slate-500 text-sm">No info entries yet</p>
          <p className="text-xs text-slate-600 mt-1">Add titles and info to display on the Hall of Fame page</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id}>
              {confirmDel === item.id ? (
                <div className="card px-4 py-3 flex items-center gap-3 border-rose-500/20 bg-rose-500/5">
                  <p className="text-sm text-rose-400 flex-1">Delete "{item.title}"?</p>
                  <button onClick={() => setConfirmDel(null)} className="text-xs px-3 py-1.5 rounded-lg border border-surface-border text-slate-400">Cancel</button>
                  <button onClick={() => handleDelete(item.id)} className="text-xs px-3 py-1.5 rounded-lg bg-rose-500 text-white font-semibold">Delete</button>
                </div>
              ) : (
                <div className="card px-4 py-3 flex items-start justify-between gap-3 group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{item.title}</p>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.content}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditingItem(item); setShowForm(false) }}
                      className="w-7 h-7 rounded-lg hover:bg-accent/10 flex items-center justify-center text-slate-500 hover:text-accent transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setConfirmDel(item.id)}
                      className="w-7 h-7 rounded-lg hover:bg-rose-400/10 flex items-center justify-center text-slate-500 hover:text-rose-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}