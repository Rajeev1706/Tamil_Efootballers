import { useState } from "react"
import { User, CheckCircle, Camera } from "lucide-react"
import { useCreatePlayer, useTeams, useUpdatePlayer } from "../../lib/queries"
import { uploadPlayerImage } from "../../lib/supabase"
import GradeBadge from "../common/GradeBadge"
import { cn } from "../../lib/utils"

const GRADES = ["S", "A", "B", "C"]

export default function CreatePlayer({ onSuccess }) {
  const [name, setName]               = useState("")
  const [alias, setAlias]             = useState("")
  const [teamId, setTeamId]           = useState("")
  const [grade, setGrade]             = useState("B")
  const [auctionPrice, setAuctionPrice] = useState("")
  const [imageFile, setImageFile]     = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [done, setDone]               = useState(null)

  const { data: teams = [] } = useTeams()
  const createPlayer         = useCreatePlayer()
  const updatePlayer         = useUpdatePlayer()

  const canSubmit = name && teamId && grade && auctionPrice

  const handleImageChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const handleSubmit = async () => {
    if (!canSubmit) return

    createPlayer.mutate(
      {
        name,
        alias: alias || undefined,
        teamId: parseInt(teamId),
        grade,
        auctionPrice: parseInt(auctionPrice),
      },
      {
        onSuccess: async (data) => {
          // Upload image if selected
          if (imageFile) {
            try {
              const publicUrl = await uploadPlayerImage(data.id, imageFile)
              updatePlayer.mutate({ id: data.id, imageUrl: publicUrl })
            } catch (err) {
              console.error("Image upload failed:", err.message)
            }
          }
          setDone(data)
          setName(""); setAlias(""); setTeamId(""); setGrade("B")
          setAuctionPrice(""); setImageFile(null); setImagePreview(null)
          onSuccess?.()
        },
        onError: (err) => alert(err.response?.data?.error || "Failed to create player"),
      }
    )
  }

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <User className="w-4 h-4 text-violet-400" />
        <h3 className="text-sm font-semibold text-white">Add new player</h3>
      </div>

      {done && (
        <div className="bg-emerald-400/10 border border-emerald-400/25 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-semibold text-emerald-400">Player added!</span>
          </div>
          <p className="text-xs text-slate-400">
            <span className="text-white font-medium">{done.name}</span> added successfully.
          </p>
        </div>
      )}

      {/* Squad image upload */}
      <div>
        <label className="text-xs font-medium text-slate-400 mb-2 block">
          Squad image <span className="text-slate-600">(optional)</span>
        </label>
        <div className="flex items-center gap-4">
<label className={cn(
  "w-56 aspect-[20/9] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all group overflow-hidden",
  imagePreview ? "border-accent/30" : "border-surface-border hover:border-accent/40"
)}>
            {imagePreview ? (
              <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-1 text-slate-500 group-hover:text-slate-400">
                <Camera className="w-5 h-5" />
                <span className="text-xs">Upload</span>
              </div>
            )}
            <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
          </label>
          {imagePreview && (
            <div>
              <p className="text-xs text-slate-400">Image selected</p>
              <button
                onClick={() => { setImageFile(null); setImagePreview(null) }}
                className="text-xs text-rose-400 hover:text-rose-300 mt-1 transition-colors"
              >
                Remove
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs font-medium text-slate-400 mb-1.5 block">Full name</label>
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. Arjun Sharma"
            className="w-full bg-pitch-800 border border-surface-border rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent/40 transition-colors" />
        </div>

        <div className="col-span-2">
          <label className="text-xs font-medium text-slate-400 mb-1.5 block">
            In-game alias <span className="text-slate-600">(optional)</span>
          </label>
          <input value={alias} onChange={e => setAlias(e.target.value)}
            placeholder="e.g. Blaze"
            className="w-full bg-pitch-800 border border-surface-border rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent/40 transition-colors" />
        </div>

        <div className="col-span-2">
          <label className="text-xs font-medium text-slate-400 mb-1.5 block">Team</label>
          <select value={teamId} onChange={e => setTeamId(e.target.value)}
            className="w-full bg-pitch-800 border border-surface-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent/40 transition-colors">
            <option value="">Select team…</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-400 mb-1.5 block">Grade</label>
          <div className="flex gap-1.5 flex-wrap">
            {GRADES.map(g => (
              <button key={g} onClick={() => setGrade(g)}
                className={cn(
                  "px-3 py-1.5 rounded-lg border text-xs font-bold transition-all",
                  grade === g
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-surface-border text-slate-400 hover:border-slate-500"
                )}>
                {g}
              </button>
            ))}
          </div>
          {grade && <div className="mt-2"><GradeBadge grade={grade} size="md" /></div>}
        </div>

        <div>
          <label className="text-xs font-medium text-slate-400 mb-1.5 block">Auction price</label>
          <input type="number" min="0" value={auctionPrice}
            onChange={e => setAuctionPrice(e.target.value)}
            placeholder="e.g. 150"
            className="w-full bg-pitch-800 border border-surface-border rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent/40 transition-colors font-mono" />
          <p className="text-xs text-slate-600 mt-1">auction points</p>
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={!canSubmit || createPlayer.isPending}
        className={cn(
          "w-full py-2.5 rounded-xl text-sm font-semibold transition-all mt-2",
          canSubmit
            ? "bg-violet-500 hover:bg-violet-600 text-white"
            : "bg-surface-border text-slate-600 cursor-not-allowed"
        )}>
        {createPlayer.isPending ? "Adding…" : "Add player to team"}
      </button>
    </div>
  )
}