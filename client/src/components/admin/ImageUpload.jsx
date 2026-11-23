import { useState, useRef } from "react"
import { Camera, Loader2, CheckCircle, X } from "lucide-react"
import { uploadPlayerImage } from "../../lib/supabase"
import api from "../../lib/api"
import { cn } from "../../lib/utils"

export default function ImageUpload({ player, onSuccess }) {
  const [preview, setPreview]   = useState(player?.imageUrl || null)
  const [loading, setLoading]   = useState(false)
  const [saved, setSaved]       = useState(false)
  const inputRef                = useRef(null)

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Show local preview immediately
    setPreview(URL.createObjectURL(file))
    setLoading(true)
    setSaved(false)

    try {
      const publicUrl = await uploadPlayerImage(player.id, file)
      await api.patch(`/players/${player.id}/squad-image`, { imageUrl: publicUrl })
      setSaved(true)
      onSuccess?.(publicUrl)
    } catch (err) {
      alert(err.response?.data?.error || err.message || "Failed to save image")
      setPreview(player?.imageUrl || null)
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async () => {
    try {
      await api.patch(`/players/${player.id}/squad-image`, { imageUrl: null })
      setPreview(null)
      setSaved(false)
    } catch (err) {
      alert(err.response?.data?.error || "Failed to remove image")
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Image preview / placeholder */}
<div
  onClick={() => inputRef.current?.click()}
  className={cn(
    "relative w-56 aspect-[20/9] rounded-2xl border-2 border-dashed flex items-center justify-center overflow-hidden cursor-pointer transition-all group",
    preview ? "border-accent/30" : "border-surface-border hover:border-accent/40"
  )}
>
        {preview ? (
          <>
            <img src={preview} alt="Player" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera className="w-5 h-5 text-white" />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1 text-slate-500 group-hover:text-slate-400 transition-colors">
            <Camera className="w-6 h-6" />
            <span className="text-xs">Add photo</span>
          </div>
        )}

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          </div>
        )}

        {/* Saved indicator */}
        {saved && !loading && (
          <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
            <CheckCircle className="w-3 h-3 text-white" />
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />

      <div className="flex items-center gap-2">
        <button
          onClick={() => inputRef.current?.click()}
          className="text-xs text-accent hover:text-accent-glow transition-colors font-medium"
        >
          {preview ? "Change photo" : "Upload photo"}
        </button>
        {preview && (
          <>
            <span className="text-slate-700">·</span>
            <button
              onClick={handleRemove}
              className="text-xs text-slate-500 hover:text-rose-400 transition-colors"
            >
              Remove
            </button>
          </>
        )}
      </div>
    </div>
  )
}