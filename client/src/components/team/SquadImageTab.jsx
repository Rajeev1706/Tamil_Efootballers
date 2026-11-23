import { useState } from "react"
import { Camera, Loader2, CheckCircle } from "lucide-react"
import { uploadPlayerImage } from "../../lib/supabase"
import api from "../../lib/api"
import { cn } from "../../lib/utils"

// Single player card with inline squad image upload
function PlayerImageCard({ player, onUpdated }) {
  const [preview, setPreview] = useState(player.imageUrl || null)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved]     = useState(false)

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPreview(URL.createObjectURL(file))
    setLoading(true)
    setSaved(false)
    try {
      const publicUrl = await uploadPlayerImage(player.id, file)
      await api.patch(`/players/${player.id}/squad-image`, { imageUrl: publicUrl })
      setSaved(true)
      onUpdated?.(player.id, publicUrl)
    } catch (err) {
      alert(err.response?.data?.error || err.message || "Failed to save image")
      setPreview(player.imageUrl || null)
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async (e) => {
    e.stopPropagation()
    try {
      await api.patch(`/players/${player.id}/squad-image`, { imageUrl: null })
      setPreview(null)
      setSaved(false)
      onUpdated?.(player.id, null)
    } catch (err) {
      alert(err.response?.data?.error || "Failed to remove image")
    }
  }

  return (
    <div className="bg-surface rounded-2xl p-4 flex flex-col gap-3 border border-surface-border">
      {/* Player name + grade */}
      <div className="flex items-center gap-2">
        <span className={cn(
          "text-xs font-bold px-2 py-0.5 rounded-full",
          player.grade === "S" ? "bg-amber-500/20 text-amber-400" :
          player.grade === "A" ? "bg-blue-500/20 text-blue-400" :
          player.grade === "B" ? "bg-emerald-500/20 text-emerald-400" :
          "bg-slate-500/20 text-slate-400"
        )}>{player.grade}</span>
        <span className="text-sm font-semibold text-white truncate">{player.name}</span>
        {player.alias && <span className="text-xs text-slate-500 truncate">"{player.alias}"</span>}
      </div>

      {/* Image upload area */}
      <label className="cursor-pointer block">
        <div className={cn(
          "relative w-full aspect-[3/2] rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden transition-all group",
          preview ? "border-accent/30" : "border-surface-border hover:border-accent/40"
        )}>
          {preview ? (
            <>
              <img src={preview} alt={player.name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="w-5 h-5 text-white" />
                <span className="text-xs text-white ml-1">Change</span>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-1 text-slate-500 group-hover:text-slate-400 transition-colors">
              <Camera className="w-6 h-6" />
              <span className="text-xs">Add squad photo</span>
            </div>
          )}

          {loading && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            </div>
          )}

          {saved && !loading && (
            <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
              <CheckCircle className="w-3 h-3 text-white" />
            </div>
          )}
        </div>
        <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
      </label>

      {/* Remove link */}
      {preview && !loading && (
        <button
          onClick={handleRemove}
          className="text-xs text-slate-500 hover:text-rose-400 transition-colors text-center"
        >
          Remove photo
        </button>
      )}
    </div>
  )
}

export default function SquadImageTab({ players = [] }) {
  const [localPlayers, setLocalPlayers] = useState(players)

  const handleUpdated = (playerId, imageUrl) => {
    setLocalPlayers(prev =>
      prev.map(p => p.id === playerId ? { ...p, imageUrl } : p)
    )
  }

  if (!players.length) {
    return (
      <div className="text-center text-slate-500 py-16">
        <Camera className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">No players in your squad yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white">Squad Photos</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Upload a squad image for each player — it shows on their profile page.
          </p>
        </div>
        <span className="text-xs text-slate-500">{players.length} players</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {localPlayers.map(player => (
          <PlayerImageCard
            key={player.id}
            player={player}
            onUpdated={handleUpdated}
          />
        ))}
      </div>
    </div>
  )
}