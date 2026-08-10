import { useState, useRef } from "react"
import { Star, Plus, Pencil, Trash2, Save, X, ImageIcon, Upload } from "lucide-react"
import {
  useSpecialEditions,
  useCreateSpecialEdition,
  useUpdateSpecialEdition,
  useDeleteSpecialEdition,
} from "../../lib/queries"
import { uploadImage } from "../../lib/api"

const IMAGE_OPTIONS = [
  { key: "epicmatch", label: "Epic Match" },
]

const EMPTY_FORM = { title: "", subtitle: "", imageKey: "epicmatch", imageUrl: "", sortOrder: 0 }

function ImagePicker({ imageKey, imageUrl, onKeyChange, onUrlChange }) {
  const fileRef   = useRef()
  const [loading, setLoading] = useState(false)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    try {
      const url = await uploadImage(file, "special")
      onUrlChange(url)
      onKeyChange("") // custom upload overrides preset
    } catch {
      alert("Upload failed — check your connection")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <label className="text-xs text-slate-500 font-medium block">Image</label>

      {/* Option A — preset from images folder */}
      <div>
        <p className="text-xs text-slate-600 mb-1">Use preset image:</p>
        <select
          value={imageKey}
          onChange={e => { onKeyChange(e.target.value); onUrlChange("") }}
          className="w-full bg-pitch-900 border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/40 transition-colors"
        >
          <option value="">None (upload custom below)</option>
          {IMAGE_OPTIONS.map(opt => (
            <option key={opt.key} value={opt.key}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Option B — upload to Cloudinary */}
      <div>
        <p className="text-xs text-slate-600 mb-1">Or upload a new image:</p>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />

        {imageUrl ? (
          <div className="relative group">
            <img src={imageUrl} alt="preview" className="w-full h-28 object-cover rounded-xl border border-surface-border" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-3">
              <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs font-semibold">
                <Upload className="w-3.5 h-3.5" /> Change
              </button>
              <button onClick={() => onUrlChange("")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-400 text-xs font-semibold">
                <X className="w-3.5 h-3.5" /> Remove
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={loading}
            className="w-full h-20 rounded-xl border-2 border-dashed border-surface-border hover:border-accent/40 flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-accent transition-colors disabled:opacity-50"
          >
            <ImageIcon className="w-5 h-5" />
            <span className="text-xs font-medium">{loading ? "Uploading to Cloudinary…" : "Click to upload"}</span>
          </button>
        )}
      </div>
    </div>
  )
}

function EditionForm({ initial = EMPTY_FORM, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial)
  const set = k => v => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="space-y-4">
      <ImagePicker
        imageKey={form.imageKey}
        imageUrl={form.imageUrl}
        onKeyChange={set("imageKey")}
        onUrlChange={set("imageUrl")}
      />

      <div>
        <label className="text-xs text-slate-500 font-medium block mb-1">Title *</label>
        <input
          type="text"
          value={form.title}
          onChange={e => set("title")(e.target.value)}
          placeholder="e.g. Best Match So Far, Season 7 Legend..."
          className="w-full bg-pitch-900 border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/40 transition-colors"
        />
      </div>

      <div>
        <label className="text-xs text-slate-500 font-medium block mb-1">Subtitle</label>
        <input
          type="text"
          value={form.subtitle}
          onChange={e => set("subtitle")(e.target.value)}
          placeholder="e.g. Zub VS Sms · Season 7"
          className="w-full bg-pitch-900 border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/40 transition-colors"
        />
      </div>

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
        <button onClick={onCancel} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-surface-border text-slate-400 hover:text-white text-sm transition-colors">
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

  // imageUrl takes priority over imageKey (preset)
  function resolvePayload(form) {
    return {
      title:     form.title,
      subtitle:  form.subtitle,
      imageUrl:  form.imageUrl || form.imageKey, // Cloudinary URL or preset key
      sortOrder: form.sortOrder,
    }
  }

  function handleCreate(form) {
    createEdition.mutate(resolvePayload(form), {
      onSuccess: () => setShowForm(false),
      onError: err => alert(err?.response?.data?.error || "Failed to save"),
    })
  }

  function handleUpdate(form) {
    updateEdition.mutate({ id: editingItem.id, ...resolvePayload(form) }, {
      onSuccess: () => setEditingItem(null),
      onError: err => alert(err?.response?.data?.error || "Failed to update"),
    })
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
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-gold/10 text-gold border border-gold/25 hover:bg-gold/20 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add Edition
          </button>
        )}
      </div>

      {showForm && (
        <div className="card p-5 border-gold/20">
          <p className="text-sm font-semibold text-white mb-4">New Special Edition</p>
          <EditionForm onSave={handleCreate} onCancel={() => setShowForm(false)} saving={createEdition.isPending} />
        </div>
      )}

      {editingItem && (
        <div className="card p-5 border-gold/20">
          <p className="text-sm font-semibold text-white mb-4">Edit: {editingItem.title}</p>
          <EditionForm
            initial={{
              title:     editingItem.title,
              subtitle:  editingItem.subtitle || "",
              imageKey:  IMAGE_OPTIONS.find(o => o.key === editingItem.image_url) ? itemData.image_url : "",
              imageUrl:  itemData?.image_url?.startsWith("http") ? itemData.image_url : "",
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
                  {item.image_url?.startsWith("http") ? (
                    <img src={item.image_url} alt={item.title} className="w-14 h-10 object-cover rounded-lg border border-surface-border flex-shrink-0" />
                  ) : (
                    <div className="w-14 h-10 rounded-lg border border-gold/30 bg-gold/10 flex items-center justify-center flex-shrink-0">
                      <Star className="w-4 h-4 text-gold" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{item.title}</p>
                    {item.subtitle && <p className="text-xs text-slate-500 truncate">{item.subtitle}</p>}
                  </div>
                  <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditingItem(item); setShowForm(false) }} className="w-7 h-7 rounded-lg hover:bg-gold/10 flex items-center justify-center text-slate-500 hover:text-gold transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setConfirmDel(item.id)} className="w-7 h-7 rounded-lg hover:bg-rose-400/10 flex items-center justify-center text-slate-500 hover:text-rose-400 transition-colors">
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