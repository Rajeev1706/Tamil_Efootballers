import { useState, useRef, useEffect } from "react"
import { Settings, Camera, Loader2, CheckCircle } from "lucide-react"
import { uploadTeamLogo } from "../../lib/supabase"
import { useUpdateTeamSettings } from "../../lib/queries"
import { cn } from "../../lib/utils"

export default function TeamSettings({ team }) {
  const [name, setName]               = useState(team?.name || "")
  const [logoPreview, setLogoPreview] = useState(team?.logoUrl || null)
  const [logoLoading, setLogoLoading] = useState(false)
  const [savedName, setSavedName]     = useState(false)
  const inputRef                      = useRef(null)
  const updateSettings                = useUpdateTeamSettings()

  // Sync when team data refreshes from server
  useEffect(() => {
    if (team?.logoUrl) setLogoPreview(team.logoUrl)
    if (team?.name)   setName(team.name)
  }, [team?.logoUrl, team?.name])

  const handleLogoFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLogoPreview(URL.createObjectURL(file))
    setLogoLoading(true)

    try {
      const publicUrl = await uploadTeamLogo(team.id, file)
      updateSettings.mutate({ id: team.id, logoUrl: publicUrl }, {
        onError: (err) => alert(err.response?.data?.error || "Failed to save logo"),
      })
    } catch (err) {
      alert(err.message || "Upload failed")
      setLogoPreview(team?.logoUrl || null)
    } finally {
      setLogoLoading(false)
    }
  }

  const handleSaveName = () => {
    if (!name.trim() || name === team?.name) return
    updateSettings.mutate({ id: team.id, name: name.trim() }, {
      onSuccess: () => { setSavedName(true); setTimeout(() => setSavedName(false), 2000) },
      onError:   (err) => alert(err.response?.data?.error || "Failed to save name"),
    })
  }

  return (
    <div className="max-w-lg">
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-surface-border">
          <Settings className="w-4 h-4 text-accent" />
          <h2 className="text-base font-semibold text-white">Team settings</h2>
        </div>

        <div className="p-5 space-y-6">
          {/* Logo */}
          <div>
            <label className="text-xs font-medium text-slate-400 mb-2 block">Team logo</label>
            <div className="flex items-center gap-4">
              <div
                onClick={() => inputRef.current?.click()}
                className={cn(
                  "relative w-20 h-20 rounded-2xl border-2 border-dashed flex items-center justify-center overflow-hidden cursor-pointer transition-all group flex-shrink-0",
                  logoPreview ? "border-accent/30" : "border-surface-border hover:border-accent/40"
                )}
              >
                {logoPreview ? (
                  <>
                    <img src={logoPreview} alt={team?.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Camera className="w-4 h-4 text-white" />
                    </div>
                  </>
                ) : (
                  <span className="text-xl font-extrabold text-slate-500">
                    {team?.name?.charAt(0) || "?"}
                  </span>
                )}
                {logoLoading && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  </div>
                )}
              </div>
              <div>
                <button
                  onClick={() => inputRef.current?.click()}
                  className="text-xs text-accent hover:text-accent-glow transition-colors font-medium"
                >
                  {logoPreview ? "Change logo" : "Upload logo"}
                </button>
                <p className="text-xs text-slate-600 mt-1">Square images work best</p>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoFile}
                className="hidden"
              />
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="text-xs font-medium text-slate-400 mb-2 block">Team name</label>
            <div className="flex items-center gap-2">
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSaveName()}
                className="flex-1 bg-pitch-800 border border-surface-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent/40 transition-colors"
              />
              <button
                onClick={handleSaveName}
                disabled={!name.trim() || name === team?.name || updateSettings.isPending}
                className={cn(
                  "px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5 flex-shrink-0",
                  (!name.trim() || name === team?.name)
                    ? "bg-surface-border text-slate-600 cursor-not-allowed"
                    : "bg-accent hover:bg-accent-dim text-white"
                )}
              >
                {savedName ? <><CheckCircle className="w-3.5 h-3.5" /> Saved</> : "Save"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}