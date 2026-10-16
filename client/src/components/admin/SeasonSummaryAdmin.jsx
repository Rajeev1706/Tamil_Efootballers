/**
 * SeasonSummaryAdmin — Admin panel card for generating AI Season Summaries
 * Lives in Admin → Setup tab under "Season Summaries"
 */
import { useState } from "react"
import { Sparkles, ChevronDown, CheckCircle2, Loader2 } from "lucide-react"
import api from "../../lib/api"
import { cn } from "../../lib/utils"

export default function SeasonSummaryAdmin({ currentSeason }) {
  // Build list of past seasons (1 … currentSeason - 1) + current, newest first
  const seasonNum  = parseInt(currentSeason) || 1
  const seasons    = Array.from({ length: seasonNum }, (_, i) => seasonNum - i)

  const [selectedSeason, setSelectedSeason] = useState(
    seasonNum > 1 ? seasonNum - 1 : seasonNum
  )
  const [status, setStatus]   = useState(null)  // null | "loading" | "success" | "error"
  const [message, setMessage] = useState("")
  const [progress, setProgress] = useState(null) // { players, teams }

  async function handleGenerate() {
    if (!window.confirm(
      `Generate AI Season Summaries for S${selectedSeason}?\n\nTop 50 players (by win rate) will get AI-generated narratives. The rest will receive predefined summaries.\n\nThis runs in the background — you can leave the page.`
    )) return

    setStatus("loading")
    setMessage("")
    setProgress(null)

    try {
      const res = await api.post("/season-summaries/trigger", { season: selectedSeason })
      setStatus("success")
      setMessage(res.data.message || `Generation started for S${selectedSeason}`)

      // Poll status every 5s for up to 2 minutes
      let polls = 0
      const interval = setInterval(async () => {
        polls++
        try {
          const s = await api.get(`/season-summaries/status?season=${selectedSeason}`)
          setProgress(s.data)
          const done =
            s.data.players.done >= s.data.players.total &&
            s.data.teams.done  >= s.data.teams.total
          if (done || polls >= 24) clearInterval(interval)
        } catch { /* ignore poll errors */ }
      }, 5000)
    } catch (err) {
      setStatus("error")
      setMessage(err?.response?.data?.error || "Failed to start generation")
    }
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-violet-400" />
        <div>
          <p className="text-white font-semibold text-sm">Season Summaries</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Top 50 players (win rate) → AI narrative · Rest → predefined summary
          </p>
        </div>
      </div>

      {/* Season picker + button */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <select
            value={selectedSeason}
            onChange={e => { setSelectedSeason(Number(e.target.value)); setStatus(null); setProgress(null) }}
            disabled={status === "loading"}
            className="appearance-none bg-pitch-800 border border-surface-border rounded-xl pl-3 pr-8 py-2 text-sm text-white focus:outline-none focus:border-accent/40 transition-colors cursor-pointer disabled:opacity-50"
          >
            {seasons.map(s => (
              <option key={s} value={s}>S{s}{s === seasonNum ? " (Current)" : ""}</option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        <button
          onClick={handleGenerate}
          disabled={status === "loading"}
          className={cn(
            "px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2",
            status === "loading"
              ? "bg-violet-500/10 border border-violet-500/20 text-violet-400 cursor-not-allowed"
              : "bg-violet-500/15 border border-violet-500/30 text-violet-400 hover:bg-violet-500/25"
          )}
        >
          {status === "loading" ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</>
          ) : (
            <><Sparkles className="w-3.5 h-3.5" /> Generate Summaries</>
          )}
        </button>
      </div>

      {/* Result message */}
      {status === "success" && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-xs text-emerald-400 font-semibold">{message}</p>
            {progress && (
              <p className="text-xs text-slate-400">
                Players: {progress.players.done}/{progress.players.total} done ·{" "}
                Teams: {progress.teams.done}/{progress.teams.total} done
              </p>
            )}
            {!progress && (
              <p className="text-xs text-slate-500">
                Running in background — check player profiles in a few minutes.
              </p>
            )}
          </div>
        </div>
      )}

      {status === "error" && (
        <p className="text-xs text-rose-400 px-1">{message}</p>
      )}
    </div>
  )
}