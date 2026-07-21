import { useState, useRef, useEffect } from "react"
import { Settings, Camera, Loader2, CheckCircle, KeyRound, Eye, EyeOff, Check, X, Music } from "lucide-react"
import { uploadTeamLogo, uploadTeamAnthem } from "../../lib/supabase"
import { useUpdateTeamSettings } from "../../lib/queries"
import { authApi } from "../../lib/api"
import { cn } from "../../lib/utils"

export default function TeamSettings({ team }) {
  const [name, setName]               = useState(team?.name || "")
  const [logoPreview, setLogoPreview] = useState(team?.logoUrl || null)
  const [logoLoading, setLogoLoading] = useState(false)
  const [anthemUrl, setAnthemUrl]     = useState(team?.anthemUrl || null)
  const [anthemLoading, setAnthemLoading] = useState(false)
  const [anthemName, setAnthemName]   = useState(null)
  const [savedName, setSavedName]     = useState(false)
  const inputRef                      = useRef(null)
  const anthemRef                     = useRef(null)
  const updateSettings                = useUpdateTeamSettings()

  // Password change state
  const [currentPwd, setCurrentPwd]   = useState("")
  const [newPwd, setNewPwd]           = useState("")
  const [confirmPwd, setConfirmPwd]   = useState("")
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew]         = useState(false)
  const [pwdLoading, setPwdLoading]   = useState(false)
  const [pwdError, setPwdError]       = useState("")
  const [pwdSuccess, setPwdSuccess]   = useState(false)

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

  const handleAnthemUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 1024 * 1024) return alert("Anthem must be under 1 MB (around 10 seconds of audio)")
    setAnthemLoading(true)
    try {
      const publicUrl = await uploadTeamAnthem(team.id, file)
      setAnthemUrl(publicUrl)
      setAnthemName(file.name)
      updateSettings.mutate({ id: team.id, anthemUrl: publicUrl }, {
        onError: (err) => alert(err.response?.data?.error || "Failed to save anthem"),
      })
    } catch (err) {
      alert(err.message || "Upload failed")
    } finally {
      setAnthemLoading(false)
    }
  }

  const handleSaveName = () => {
    if (!name.trim() || name === team?.name) return
    updateSettings.mutate({ id: team.id, name: name.trim() }, {
      onSuccess: () => { setSavedName(true); setTimeout(() => setSavedName(false), 2000) },
      onError:   (err) => alert(err.response?.data?.error || "Failed to save name"),
    })
  }

  const handleChangePassword = async () => {
    setPwdError("")
    if (!currentPwd) return setPwdError("Enter your current password")
    if (newPwd.length < 6) return setPwdError("New password must be at least 6 characters")
    if (newPwd !== confirmPwd) return setPwdError("New passwords do not match")
    if (newPwd === currentPwd) return setPwdError("New password must differ from current password")

    setPwdLoading(true)
    try {
      await authApi.changePassword(currentPwd, newPwd)
      setPwdSuccess(true)
      setCurrentPwd("")
      setNewPwd("")
      setConfirmPwd("")
      setTimeout(() => setPwdSuccess(false), 3000)
    } catch (err) {
      setPwdError(err.response?.data?.error || "Failed to change password")
    } finally {
      setPwdLoading(false)
    }
  }

  return (
    <div className="max-w-lg space-y-4">

      {/* ── Team settings card ── */}
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
              <label
                htmlFor="team-logo-input"
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
              </label>
              <div>
                <label
                  htmlFor="team-logo-input"
                  className="text-xs text-accent hover:text-accent-glow transition-colors font-medium cursor-pointer inline-block"
                >
                  {logoPreview ? "Change logo" : "Upload logo"}
                </label>
                <p className="text-xs text-slate-600 mt-1">Square images work best</p>
              </div>
              <input id="team-logo-input" ref={inputRef} type="file" accept="image/*" onChange={handleLogoFile} className="hidden" />
            </div>
          </div>

          {/* Club anthem */}
          <div>
            <label className="text-xs font-medium text-slate-400 mb-2 block">Club anthem <span className="text-slate-600">(max 1 MB · ~10 sec)</span></label>
            <div className="flex items-center gap-3 p-3 rounded-xl border border-surface-border bg-pitch-800">
              <div className="w-10 h-10 rounded-lg bg-pitch-700 flex items-center justify-center flex-shrink-0">
                <Music className="w-5 h-5 text-slate-400" />
              </div>
              <div className="flex-1 min-w-0">
                {anthemUrl ? (
                  <>
                    <p className="text-xs text-white truncate">{anthemName || "Anthem uploaded"}</p>
                    <audio controls src={anthemUrl} className="mt-1 h-6 w-full" style={{ filter: "invert(1) hue-rotate(180deg)", maxWidth: "200px" }} />
                  </>
                ) : (
                  <p className="text-xs text-slate-500">No anthem yet — plays when your team wins a title</p>
                )}
              </div>
              <label htmlFor="team-anthem-input"
                className="flex-shrink-0 text-xs font-semibold text-accent border border-accent/30 px-3 py-1.5 rounded-lg hover:bg-accent/10 transition-colors cursor-pointer">
                {anthemLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : anthemUrl ? "Change" : "Upload"}
              </label>
            </div>
            <input id="team-anthem-input" ref={anthemRef} type="file" accept="audio/*" onChange={handleAnthemUpload} className="hidden" />
          </div>

          {/* Team name */}
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

      {/* ── Change password card ── */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-surface-border">
          <KeyRound className="w-4 h-4 text-amber-400" />
          <h2 className="text-base font-semibold text-white">Change password</h2>
        </div>

        <div className="p-5 space-y-4">
          {pwdSuccess && (
            <div className="flex items-center gap-2 bg-emerald-400/10 border border-emerald-400/20 rounded-xl px-4 py-3">
              <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <p className="text-sm text-emerald-400 font-semibold">Password changed successfully!</p>
            </div>
          )}

          {pwdError && (
            <div className="flex items-center gap-2 bg-rose-400/10 border border-rose-400/20 rounded-xl px-4 py-3">
              <X className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <p className="text-sm text-rose-400">{pwdError}</p>
            </div>
          )}

          {/* Current password */}
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">Current password</label>
            <div className="relative">
              <input
                type={showCurrent ? "text" : "password"}
                value={currentPwd}
                onChange={e => { setCurrentPwd(e.target.value); setPwdError("") }}
                placeholder="Enter current password"
                className="w-full bg-pitch-800 border border-surface-border rounded-xl px-3 py-2.5 pr-10 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent/40 transition-colors"
              />
              <button
                onClick={() => setShowCurrent(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New password */}
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">New password</label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                value={newPwd}
                onChange={e => { setNewPwd(e.target.value); setPwdError("") }}
                placeholder="Min 6 characters"
                className="w-full bg-pitch-800 border border-surface-border rounded-xl px-3 py-2.5 pr-10 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent/40 transition-colors"
              />
              <button
                onClick={() => setShowNew(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm new password */}
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">Confirm new password</label>
            <input
              type="password"
              value={confirmPwd}
              onChange={e => { setConfirmPwd(e.target.value); setPwdError("") }}
              onKeyDown={e => e.key === "Enter" && handleChangePassword()}
              placeholder="Re-enter new password"
              className={cn(
                "w-full bg-pitch-800 border rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none transition-colors",
                confirmPwd && newPwd && confirmPwd !== newPwd
                  ? "border-rose-400/50 focus:border-rose-400/70"
                  : "border-surface-border focus:border-accent/40"
              )}
            />
            {confirmPwd && newPwd && confirmPwd !== newPwd && (
              <p className="text-xs text-rose-400 mt-1">Passwords do not match</p>
            )}
          </div>

          <button
            onClick={handleChangePassword}
            disabled={pwdLoading || !currentPwd || !newPwd || !confirmPwd}
            className={cn(
              "w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2",
              (!currentPwd || !newPwd || !confirmPwd)
                ? "bg-surface-border text-slate-600 cursor-not-allowed"
                : "bg-amber-400 hover:bg-amber-300 text-pitch-900"
            )}
          >
            {pwdLoading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Changing…</>
              : <><KeyRound className="w-4 h-4" /> Change password</>
            }
          </button>
        </div>
      </div>

    </div>
  )
}