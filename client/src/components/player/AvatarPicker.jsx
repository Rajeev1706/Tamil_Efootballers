import { useState, useRef, useEffect } from "react"
import { X, Check, UserRound, Upload, Loader2, ImageIcon, Ban } from "lucide-react"
import { AVATARS } from "../../lib/avatars"
import { uploadPlayerAvatarImage } from "../../lib/supabase"
import { useSetPlayerAvatar } from "../../lib/queries"
import { cn } from "../../lib/utils"

export default function AvatarPicker({ player, onClose }) {
  const setAvatar = useSetPlayerAvatar()

  // mode is the single source of truth for what's staged (nothing is
  // uploaded or saved until the Save button is clicked):
  //   "unchanged" — no staged change, show the player's current avatar
  //   "preset"    — a preset character (or explicit "none") is staged
  //   "custom"    — one or both custom image files are staged
  const [mode, setMode] = useState("unchanged")
  const [stagedPresetId, setStagedPresetId] = useState(null)
  const [avatarFile, setAvatarFile] = useState(null)
  const [bgFile, setBgFile]         = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [bgPreview, setBgPreview]         = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)

  const avatarInputRef = useRef(null)
  const bgInputRef      = useRef(null)

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview)
      if (bgPreview) URL.revokeObjectURL(bgPreview)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const hasChanges = mode !== "unchanged"

  const pickPresetLocally = (avatarId) => {
    setMode("preset")
    setStagedPresetId(avatarId)
    setAvatarFile(null); setBgFile(null)
    setAvatarPreview(null); setBgPreview(null)
  }

  const pickFileLocally = (file, kind) => {
    if (!file) return
    const url = URL.createObjectURL(file)
    setMode("custom")
    if (kind === "avatar") { setAvatarFile(file); setAvatarPreview(url) }
    else                   { setBgFile(file);     setBgPreview(url) }
  }

  const handleSave = async () => {
    if (!hasChanges) return
    setError(null)
    setSaving(true)
    try {
      const body = {}
      if (mode === "preset") {
        body.avatarId = stagedPresetId // null = explicitly clear everything
      } else if (mode === "custom") {
        if (avatarFile) body.avatarUrl   = await uploadPlayerAvatarImage(player.id, avatarFile, "avatar")
        if (bgFile)     body.avatarBgUrl = await uploadPlayerAvatarImage(player.id, bgFile, "bg")
      }

      await new Promise((resolve, reject) => {
        setAvatar.mutate({ id: player.id, ...body }, { onSuccess: resolve, onError: reject })
      })
      onClose()
    } catch (err) {
      setError(err.message || err.response?.data?.error || "Failed to save. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  // What to actually display, depending on staged mode
  const showingCustom = mode === "custom" || (mode === "unchanged" && !!(player.avatarUrl || player.avatarBgUrl))
  const displayAvatarUrl = mode === "custom" ? avatarPreview : mode === "unchanged" ? player.avatarUrl : null
  const displayBgUrl     = mode === "custom" ? bgPreview     : mode === "unchanged" ? player.avatarBgUrl : null
  const effectivePresetId = mode === "preset" ? stagedPresetId : (mode === "unchanged" && !showingCustom ? player.avatarId : null)

  // "None" is active whenever nothing at all is currently set/staged —
  // covers clearing a preset, clearing a custom upload, or just the
  // player's natural starting state if they never had an avatar.
  const noneActive = !showingCustom && effectivePresetId == null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={() => !saving && onClose()}
    >
      <div
        className="card w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Choose an avatar</h2>
          <button onClick={onClose} disabled={saving} className="text-slate-500 hover:text-white transition-colors disabled:opacity-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-6">
          {/* ── Upload your own ── */}
          <div>
            <p className="section-label mb-3">Upload your own</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => avatarInputRef.current?.click()}
                disabled={saving}
                className={cn(
                  "relative aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 transition-colors disabled:opacity-50",
                  displayAvatarUrl ? "border-accent/40" : "border-surface-border hover:border-accent/40"
                )}
              >
                {displayAvatarUrl ? (
                  <img src={displayAvatarUrl} alt="Avatar" className="absolute inset-0 w-full h-full object-cover rounded-xl" />
                ) : (
                  <>
                    <Upload className="w-5 h-5 text-slate-500" />
                    <span className="text-[11px] text-slate-500 font-medium px-2 text-center">Avatar image</span>
                  </>
                )}
              </button>

              <button
                onClick={() => bgInputRef.current?.click()}
                disabled={saving}
                className={cn(
                  "relative aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 transition-colors disabled:opacity-50",
                  displayBgUrl ? "border-accent/40" : "border-surface-border hover:border-accent/40"
                )}
              >
                {displayBgUrl ? (
                  <img src={displayBgUrl} alt="Background" className="absolute inset-0 w-full h-full object-cover rounded-xl" />
                ) : (
                  <>
                    <ImageIcon className="w-5 h-5 text-slate-500" />
                    <span className="text-[11px] text-slate-500 font-medium px-2 text-center">Background image</span>
                  </>
                )}
              </button>
            </div>

            <input
              ref={avatarInputRef} type="file" accept="image/*" className="hidden"
              onChange={e => pickFileLocally(e.target.files?.[0], "avatar")}
            />
            <input
              ref={bgInputRef} type="file" accept="image/*" className="hidden"
              onChange={e => pickFileLocally(e.target.files?.[0], "bg")}
            />
          </div>

          {/* ── Preset characters (includes a "None" option) ── */}
          <div>
            <p className="section-label mb-3">Or pick a character</p>
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
              {/* None — clears whatever is currently set, custom or preset */}
              <button
                onClick={() => pickPresetLocally(null)}
                disabled={saving}
                className={cn(
                  "relative aspect-square rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all disabled:opacity-50",
                  noneActive ? "border-accent bg-accent/10" : "border-dashed border-surface-border hover:border-rose-400/40"
                )}
                title="No avatar"
              >
                <Ban className={cn("w-5 h-5", noneActive ? "text-accent" : "text-slate-500")} />
                <span className={cn("text-[10px] font-medium", noneActive ? "text-accent" : "text-slate-500")}>None</span>
                {noneActive && (
                  <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-accent flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-pitch-900" />
                  </div>
                )}
              </button>

              {AVATARS.length === 0 ? (
                <div className="col-span-3 sm:col-span-4 flex items-center justify-center text-sm text-slate-500">
                  No preset characters available yet
                </div>
              ) : (
                AVATARS.map(a => {
                  const active = !showingCustom && a.id === effectivePresetId
                  return (
                    <button
                      key={a.id}
                      onClick={() => pickPresetLocally(a.id)}
                      disabled={saving}
                      className={cn(
                        "relative aspect-square rounded-xl overflow-hidden border-2 transition-all disabled:opacity-50",
                        active ? "border-accent" : "border-surface-border hover:border-accent/40"
                      )}
                      title={a.name}
                    >
                      <img src={a.thumb} alt={a.name} className="w-full h-full object-cover" />
                      {active && (
                        <div className="absolute inset-0 bg-accent/25 flex items-center justify-center">
                          <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center">
                            <Check className="w-4 h-4 text-pitch-900" />
                          </div>
                        </div>
                      )}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* ── Footer: Cancel / Save ── */}
        <div className="px-5 py-4 border-t border-surface-border flex items-center justify-between gap-3">
          <p className="text-xs text-rose-400">{error}</p>
          <div className="flex items-center gap-2 ml-auto flex-shrink-0">
            <button
              onClick={onClose}
              disabled={saving}
              className="text-sm font-medium text-slate-400 hover:text-white transition-colors px-4 py-2 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="text-sm font-semibold bg-accent hover:bg-accent-dim text-pitch-900 px-4 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}