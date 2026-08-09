import { useState } from "react"
import { Star, Plus, Pencil, Trash2, Save, X } from "lucide-react"
import {
  useSpecialEditions,
  useCreateSpecialEdition,
  useUpdateSpecialEdition,
  useDeleteSpecialEdition,
} from "../../lib/queries"

// ── Available images from the images/ folder ──────────────────────────────────
// Add new entries here whenever a new image is dropped into client/images/
const IMAGE_OPTIONS = [
  { key: "epicmatch", label: "Epic Match" },
]

const EMPTY_FORM = { title: "", subtitle: "", imageKey: "epicmatch", sortOrder: 0 }

function EditionForm({ initial = EMPTY_FORM, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial)
  const set = k => v => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="space-y-4">

      {/* Image selector */}
      <div>
        <label className="text-xs text-slate-500 font-medium block mb-1">Image</label>
        <select
          value={form.imageKey}
          onChange={e => set("imageKey")(e.target.value)}
          className="w-full bg-pitch-900 border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/40 transition-colors"
        >
          <option value="">No image</option>
          {IMAGE_OPTIONS.map(opt => (
            <option key={opt.key} value={opt.key}>{opt.label}</option>
          ))}
        </select>
        <p className="text-xs text-slate-600 mt-1">Images are added by dropping files into the client/images/ folder</p>
      </div>

      {/* Title */}
      <div>
        <label className="text-xs text-slate-500 font-medium block mb-1">Title *</label>
        <input
          type="text"
          value={form.title}
          onChange={e => set("title")(e.target.value)}
          placeholder="e.g. Season 7 Legend, Iron Man of TEC..."
          className="w-full bg-pitch-900 border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/40 transition-colors"
        />
      </div>

      {/* Subtitle */}
      <div>
        <label className="text-xs text-slate-500 font-medium block mb-1">Subtitle</label>
        <input
          type="text"
          value={form.subtitle}
          onChange={e => set("subtitle")(e.target.value)}
          placeholder="e.g. Most decorated player of all time"
          className="w-full bg-pitch-900 border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/40 transition-colors"
        />
      </div>

      {/* Sort order */}
      <div>
        <label className="text-xs text-slate-500 font-medium block mb-1">Sort order (lower = shown first)</label>
        <input
          type="number"
          value={form.sortOrder}
          onChange={e => set("sortOrder")(parseInt(e.target.value) || 0)}
          className="w-24 bg-pitch-900 border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/40 transition-colors"
        />
      </div>

      <div className="flex gap-3 pt-1">
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-surface-border text-slate-400 hover:text-white text-sm transition-colors"
        >
          <X className="w-3.5 h-3.5" /> Cancel
        </button>
        <button
          onClick={() => onSave(form)}
          disabled={saving || !form.title.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gold/20 text-gold border border-gold/30 text-sm font-semibold disabled:opacity-50 hover:bg-gold/30 transition-colors"
        >
          <Save className="w-3.5 h-3.5" /> {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  )
}

export default function SpecialEditionAdmin() {
  const { data: items = [], isLoading } = useSpecialEditions()
  const createEdition = useCreateSpecialEdition()
  const updateEdition = useUpdateSpecialEdition()
  const deleteEdition = useDeleteSpecialEdition()

  const [showForm, setShowForm]       = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [confirmDel, setConfirmDel]   = useState(null)

  function handleCreate(form) {
    createEdition.mutate(
      { title: form.title, subtitle: form.subtitle, imageUrl: form.imageKey, sortOrder: form.sortOrder },
      {
        onSuccess: () => setShowForm(false),
        onError: err => alert(err?.response?.data?.error || "Failed to save"),
      }
    )
  }

  function handleUpdate(form) {
    updateEdition.mutate(
      { id: editingItem.id, title: form.title, subtitle: form.subtitle, imageUrl: form.imageKey, sortOrder: form.sortOrder },
      {
        onSuccess: () => setEditingItem(null),
        onError: err => alert(err?.response?.data?.error || "Failed to update"),
      }
    )
  }

  function handleDelete(id) {
    deleteEdition.mutate(id, {
      onSuccess: () => setConfirmDel(null),
      onError: err => alert(err?.response?.data?.error || "Failed to delete"),
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-gold" />
          <h2 className="text-sm font-semibold text-white">Special Editions</h2>
          <span className="text-xs text-slate-500">— featured cards on Hall of Fame</span>
        </div>
        {!showForm && !editingItem && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-gold/10 text-gold border border-gold/25 hover:bg-gold/20 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Edition
          </button>
        )}
      </div>

      {showForm && (
        <div className="card p-5 border-gold/20">
          <p className="text-sm font-semibold text-white mb-4">New Special Edition</p>
          <EditionForm
            onSave={handleCreate}
            onCancel={() => setShowForm(false)}
            saving={createEdition.isPending}
          />
        </div>
      )}

      {editingItem && (
        <div className="card p-5 border-gold/20">
          <p className="text-sm font-semibold text-white mb-4">Edit: {editingItem.title}</p>
          <EditionForm
            initial={{
              title:     editingItem.title,
              subtitle:  editingItem.subtitle || "",
              imageKey:  editingItem.image_url || "epicmatch",
              sortOrder: editingItem.sort_order,
            }}
            onSave={handleUpdate}
            onCancel={() => setEditingItem(null)}
            saving={updateEdition.isPending}
          />
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500 text-center py-6">Loading…</p>
      ) : items.length === 0 && !showForm ? (
        <div className="card px-5 py-8 text-center">
          <Star className="w-6 h-6 text-slate-600 mx-auto mb-2" />
          <p className="text-slate-500 text-sm">No special editions yet</p>
          <p className="text-xs text-slate-600 mt-1">Add featured cards to highlight legends on the Hall of Fame</p>
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
                <div className="card px-4 py-3 flex items-center gap-3 group">
                  <div className="w-10 h-10 rounded-lg border border-gold/30 bg-gold/10 flex items-center justify-center flex-shrink-0">
                    <Star className="w-4 h-4 text-gold" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{item.title}</p>
                    {item.subtitle && <p className="text-xs text-slate-500 truncate">{item.subtitle}</p>}
                    <p className="text-xs text-slate-600 mt-0.5">Image: {item.image_url || "none"}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setEditingItem(item); setShowForm(false) }}
                      className="w-7 h-7 rounded-lg hover:bg-gold/10 flex items-center justify-center text-slate-500 hover:text-gold transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setConfirmDel(item.id)}
                      className="w-7 h-7 rounded-lg hover:bg-rose-400/10 flex items-center justify-center text-slate-500 hover:text-rose-400 transition-colors"
                    >
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