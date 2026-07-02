import { useState, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Trophy, ChevronRight } from "lucide-react"
import { useWeeklyTournament } from "../lib/queries"
import { weeklyApi } from "../lib/api"

export default function WeeklyDraw() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: tournament } = useWeeklyTournament(id)
  const [phase, setPhase]         = useState("intro")   // intro | revealing | done
  const [matchIdx, setMatchIdx]   = useState(0)
  const [revealStep, setRevealStep] = useState(0)       // 0=none 1=home 2=vs 3=away 4=pause
  const [starting, setStarting]   = useState(false)

  const r1Matches = (tournament?.matches || []).filter(m => m.round === 1)

  const [fadingOut, setFadingOut] = useState(false)

  // Auto-progress through reveal steps
  useEffect(() => {
    if (phase !== "revealing") return
    if (matchIdx >= r1Matches.length) { setPhase("done"); return }

    // Steps: 0=blank → 1=home appears → 2=vs appears → 3=away appears → 4=pause → then fade out → next
    const delays = [0, 600, 1000, 1600, 3200]
    const next = delays[revealStep + 1]

    if (next === undefined) {
      // Pause done — fade out current match card, then show next
      const t = setTimeout(() => {
        setFadingOut(true)
        setTimeout(() => {
          setFadingOut(false)
          setMatchIdx(i => i + 1)
          setRevealStep(0)
        }, 600) // fade out duration
      }, 500)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setRevealStep(s => s + 1), next - (delays[revealStep] || 0))
    return () => clearTimeout(t)
  }, [phase, matchIdx, revealStep])

  useEffect(() => {
    if (phase === "revealing") setRevealStep(0)
  }, [matchIdx])

  async function handleStart() {
    setStarting(true)
    await weeklyApi.start(id)
    navigate(`/weekly/bracket/${id}`)
  }

  const currentMatch = r1Matches[matchIdx]

  return (
    <div className="min-h-screen bg-pitch-900 flex flex-col items-center justify-center p-6"
      style={{ background: "radial-gradient(ellipse at center, rgba(16,185,129,0.06) 0%, rgb(5,8,16) 70%)" }}>

      {/* Logo */}
      <div className="flex items-center gap-3 mb-10">
        <Trophy className="w-8 h-8 text-accent" />
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-widest">Tamil Efootballers</p>
          <p className="text-xl font-extrabold text-white">{tournament?.name || "Weekly Tournament"}</p>
        </div>
      </div>

      {/* Intro */}
      {phase === "intro" && (
        <div className="text-center">
          <p className="text-slate-400 mb-2 text-sm">{r1Matches.length} first-round fixtures</p>
          <p className="text-slate-500 text-sm mb-8">{tournament?.player_count} players · Random draw</p>
          <button onClick={() => setPhase("revealing")}
            className="flex items-center gap-2 px-8 py-3 rounded-xl bg-accent text-white font-bold text-lg shadow-lg hover:bg-accent-dim transition-all mx-auto">
            Start Draw <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Revealing */}
      {phase === "revealing" && currentMatch && (
        <div className="w-full max-w-lg text-center">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-8">
            Match {matchIdx + 1} of {r1Matches.length}
          </p>

          <div className="bg-pitch-800 border border-surface-border rounded-2xl px-8 py-10 space-y-6"
            style={{
              boxShadow: "0 0 60px rgba(16,185,129,0.08)",
              opacity: fadingOut ? 0 : 1,
              transition: fadingOut ? "opacity 0.6s ease" : "none"
            }}>

            {/* Home player */}
            <div style={{
              opacity: revealStep >= 1 && !fadingOut ? 1 : 0,
              transform: revealStep >= 1 ? "translateY(0)" : "translateY(20px)",
              transition: fadingOut ? "opacity 0.3s ease" : "opacity 0.5s ease, transform 0.5s ease"
            }}>
              <p className="text-xs text-emerald-400 uppercase tracking-widest mb-2">Home</p>
              <p className="text-3xl font-extrabold text-white">{currentMatch.player1Name}</p>
            </div>

            {/* VS */}
            <div style={{
              opacity: revealStep >= 2 && !fadingOut ? 1 : 0,
              transition: fadingOut ? "opacity 0.3s ease" : "opacity 0.4s ease"
            }}>
              <p className="text-lg font-bold text-slate-500">VS</p>
            </div>

            {/* Away player */}
            <div style={{
              opacity: revealStep >= 3 && !fadingOut ? 1 : 0,
              transform: revealStep >= 3 ? "translateY(0)" : "translateY(-20px)",
              transition: fadingOut ? "opacity 0.3s ease" : "opacity 0.5s ease, transform 0.5s ease"
            }}>
              <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">Away</p>
              <p className={`text-3xl font-extrabold ${currentMatch.player2Name ? "text-white" : "text-slate-500 italic"}`}>
                {currentMatch.player2Name || "— BYE —"}
              </p>
            </div>
          </div>

          {/* Progress dots */}
          <div className="flex justify-center gap-2 mt-8">
            {r1Matches.map((_, i) => (
              <div key={i} className={`w-2 h-2 rounded-full transition-colors ${
                i < matchIdx ? "bg-accent" : i === matchIdx ? "bg-white" : "bg-slate-700"
              }`} />
            ))}
          </div>

          {/* Skip button */}
          <button onClick={() => setPhase("done")}
            className="mt-6 text-xs text-slate-500 hover:text-white transition-colors underline decoration-dotted">
            Skip animation →
          </button>
        </div>
      )}

      {/* Done */}
      {phase === "done" && (
        <div className="text-center">
          <p className="text-2xl font-extrabold text-white mb-2">Draw Complete! 🎉</p>
          <p className="text-slate-400 text-sm mb-8">All {r1Matches.length} first-round fixtures have been drawn</p>
          <div className="space-y-4 mb-8 max-w-sm mx-auto">
            {r1Matches.map((m, i) => (
              <div key={m.id} className="flex items-center justify-between bg-pitch-800 rounded-xl px-4 py-3 border border-surface-border">
                <span className="text-sm text-white font-medium">{m.player1Name}</span>
                <span className="text-xs text-slate-500">vs</span>
                <span className={`text-sm font-medium ${m.player2Name ? "text-white" : "text-slate-500 italic"}`}>
                  {m.player2Name || "BYE"}
                </span>
              </div>
            ))}
          </div>
          <button onClick={handleStart} disabled={starting}
            className="flex items-center gap-2 px-8 py-3 rounded-xl bg-accent text-white font-bold text-lg mx-auto hover:bg-accent-dim transition-all disabled:opacity-50">
            {starting ? "Starting…" : "Start Tournament →"}
          </button>
        </div>
      )}
    </div>
  )
}