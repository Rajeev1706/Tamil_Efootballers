import { useState, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Trophy } from "lucide-react"
import { useUclKnockout } from "../lib/queries"
import { uclKnockoutApi } from "../lib/api"

export default function UclKnockoutDraw() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: tournament } = useUclKnockout(id)

  const [phase, setPhase]           = useState("intro")
  const [matchIdx, setMatchIdx]     = useState(0)
  const [revealStep, setRevealStep] = useState(0)
  const [fadingOut, setFadingOut]   = useState(false)
  const [starting, setStarting]     = useState(false)

  // Redirect if already active
  if (tournament && (tournament.status === "active" || tournament.status === "completed")) {
    navigate(`/ucl-knockout/bracket/${id}`, { replace: true })
    return null
  }

  const r32Matches = (tournament?.matches || []).filter(m => m.round === 1)

  useEffect(() => {
    if (phase !== "revealing") return
    if (matchIdx >= r32Matches.length) { setPhase("done"); return }

    const delays = [0, 600, 1000, 1600, 3200]
    const next = delays[revealStep + 1]
    if (next === undefined) {
      const t = setTimeout(() => {
        setFadingOut(true)
        setTimeout(() => { setFadingOut(false); setMatchIdx(i => i + 1); setRevealStep(0) }, 600)
      }, 500)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setRevealStep(s => s + 1), next - (delays[revealStep] || 0))
    return () => clearTimeout(t)
  }, [phase, matchIdx, revealStep])

  const currentMatch = r32Matches[matchIdx]

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: "radial-gradient(ellipse at center, rgba(16,185,129,0.06) 0%, rgb(5,8,16) 70%)" }}>

      <div className="flex items-center gap-3 mb-10">
        <Trophy className="w-8 h-8 text-accent" />
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-widest">Tamil Efootballers · UCL</p>
          <p className="text-xl font-extrabold text-white">{tournament?.name || "Knockout Stage Draw"}</p>
        </div>
      </div>

      {/* Intro */}
      {phase === "intro" && (
        <div className="text-center">
          <p className="text-slate-400 mb-1 text-sm">Round of 32 · {r32Matches.length} fixtures</p>
          <p className="text-slate-500 text-sm mb-8">Seeded from UCL group standings</p>
          <button onClick={() => setPhase("revealing")}
            className="flex items-center gap-2 px-8 py-3 rounded-xl bg-accent text-white font-bold text-lg shadow-lg hover:bg-accent-dim transition-all mx-auto">
            🎲 Start Draw
          </button>
        </div>
      )}

      {/* Revealing */}
      {(phase === "revealing" || phase === "fading") && currentMatch && (
        <div className="w-full max-w-lg text-center">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-8">
            Match {matchIdx + 1} of {r32Matches.length}
          </p>
          <div className="bg-pitch-800 border border-surface-border rounded-2xl px-8 py-10 space-y-6"
            style={{ boxShadow: "0 0 60px rgba(16,185,129,0.08)", opacity: fadingOut ? 0 : 1, transition: fadingOut ? "opacity 0.6s ease" : "none" }}>

            <div style={{ opacity: revealStep >= 1 && !fadingOut ? 1 : 0, transform: revealStep >= 1 ? "translateY(0)" : "translateY(20px)", transition: "opacity 0.5s ease, transform 0.5s ease" }}>
              <p className="text-xs text-emerald-400 uppercase tracking-widest mb-1">Home</p>
              <p className="text-3xl font-extrabold text-white">{currentMatch.player1Name}</p>
              {currentMatch.player1Group && <p className="text-xs text-slate-500 mt-1">{currentMatch.player1Group}</p>}
            </div>

            <div style={{ opacity: revealStep >= 2 && !fadingOut ? 1 : 0, transition: "opacity 0.4s ease" }}>
              <p className="text-lg font-bold text-slate-500">VS</p>
            </div>

            <div style={{ opacity: revealStep >= 3 && !fadingOut ? 1 : 0, transform: revealStep >= 3 ? "translateY(0)" : "translateY(-20px)", transition: "opacity 0.5s ease, transform 0.5s ease" }}>
              <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Away</p>
              <p className="text-3xl font-extrabold text-white">{currentMatch.player2Name}</p>
              {currentMatch.player2Group && <p className="text-xs text-slate-500 mt-1">{currentMatch.player2Group}</p>}
            </div>
          </div>

          <div className="flex justify-center gap-1.5 mt-8 flex-wrap">
            {r32Matches.map((_, i) => (
              <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i < matchIdx ? "bg-accent" : i === matchIdx ? "bg-white" : "bg-slate-700"}`} />
            ))}
          </div>
          <button onClick={() => setPhase("done")} className="mt-4 text-xs text-slate-600 hover:text-slate-400 transition-colors underline decoration-dotted">Skip animation →</button>
        </div>
      )}

      {/* Done */}
      {phase === "done" && (
        <div className="text-center w-full max-w-2xl">
          <div className="text-4xl mb-4">🏆</div>
          <p className="text-2xl font-extrabold text-white mb-6">Draw Complete!</p>
          <div className="grid grid-cols-2 gap-2 mb-8 max-w-lg mx-auto">
            {r32Matches.map((m, i) => (
              <div key={m.id} className="flex items-center justify-between bg-pitch-800 rounded-xl px-3 py-2.5 border border-surface-border">
                <div className="text-left">
                  <p className="text-xs text-white font-medium truncate">{m.player1Name}</p>
                  <p className="text-xs text-slate-600">{m.player1Group}</p>
                </div>
                <span className="text-xs text-slate-600 mx-2">vs</span>
                <div className="text-right">
                  <p className="text-xs text-white font-medium truncate">{m.player2Name}</p>
                  <p className="text-xs text-slate-600">{m.player2Group}</p>
                </div>
              </div>
            ))}
          </div>
          <button onClick={async () => { setStarting(true); await uclKnockoutApi.start(id); navigate(`/ucl-knockout/bracket/${id}`) }}
            disabled={starting}
            className="px-8 py-3 rounded-xl bg-accent text-white font-bold text-lg hover:bg-accent-dim transition-all disabled:opacity-50 mx-auto">
            {starting ? "Starting…" : "Start Tournament →"}
          </button>
        </div>
      )}
    </div>
  )
}