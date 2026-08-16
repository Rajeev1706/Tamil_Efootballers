// pages/UclKODraw.jsx — animated R32 draw reveal for UCL Knockout
// Flow: intro → animated reveal of each R32 fixture → done → Start Tournament
import { useState, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Trophy, ChevronRight } from "lucide-react"
import { useUclKnockout, useStartUclKnockout } from "../lib/queries"
export default function UclKODraw() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: tournament } = useUclKnockout(id)

  const [phase, setPhase]           = useState("intro")
  const [matchIdx, setMatchIdx]     = useState(0)
  const [revealStep, setRevealStep] = useState(0)
  const [fadingOut, setFadingOut]   = useState(false)
  const startTournament = useStartUclKnockout()

  const r32Matches = (tournament?.matches || []).filter(m => m.round === 1)

  // If already started, redirect straight to bracket
  if (tournament && (tournament.status === "active" || tournament.status === "completed")) {
    navigate(`/ucl-knockout/bracket/${id}`, { replace: true })
    return null
  }

  useEffect(() => {
    if (phase !== "revealing") return
    if (matchIdx >= r32Matches.length) { setPhase("done"); return }

    const delays = [0, 600, 1000, 1600, 3200]
    const next = delays[revealStep + 1]

    if (next === undefined) {
      const t = setTimeout(() => {
        setFadingOut(true)
        setTimeout(() => {
          setFadingOut(false)
          setMatchIdx(i => i + 1)
          setRevealStep(0)
        }, 600)
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
    await startTournament.mutateAsync(id)
    navigate(`/ucl-knockout/bracket/${id}`)
  }

  const currentMatch = r32Matches[matchIdx]

  return (
    <div
      className="min-h-screen bg-pitch-900 flex flex-col items-center justify-center p-6"
      style={{ background: "radial-gradient(ellipse at center, rgba(99,102,241,0.08) 0%, rgb(5,8,16) 70%)" }}
    >
      <div className="flex items-center gap-3 mb-10">
        <Trophy className="w-8 h-8 text-accent" />
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-widest">UCL Knockout</p>
          <p className="text-xl font-extrabold text-white">{tournament?.name || "UCL Knockout Draw"}</p>
        </div>
      </div>

      {phase === "intro" && (
        <div className="text-center">
          <p className="text-slate-400 mb-2 text-sm">{r32Matches.length} Round of 32 fixtures</p>
          <p className="text-slate-500 text-sm mb-8">
            {tournament?.players?.length || 32} players · Seeded draw (1st vs 4th, 2nd vs 3rd)
          </p>
          <button
            onClick={() => setPhase("revealing")}
            className="flex items-center gap-2 px-8 py-3 rounded-xl bg-accent text-white font-bold text-lg shadow-lg hover:bg-accent-dim transition-all mx-auto"
          >
            Start Draw <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {phase === "revealing" && currentMatch && (
        <div className="w-full max-w-lg text-center">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-8">
            Match {matchIdx + 1} of {r32Matches.length}
          </p>

          <div
            className="bg-pitch-800 border border-surface-border rounded-2xl px-8 py-10 space-y-6"
            style={{
              boxShadow: "0 0 60px rgba(99,102,241,0.10)",
              opacity: fadingOut ? 0 : 1,
              transition: fadingOut ? "opacity 0.6s ease" : "none",
            }}
          >
            <div style={{
              opacity: revealStep >= 1 && !fadingOut ? 1 : 0,
              transform: revealStep >= 1 ? "translateY(0)" : "translateY(20px)",
              transition: fadingOut ? "opacity 0.3s ease" : "opacity 0.5s ease, transform 0.5s ease",
            }}>
              <p className="text-xs text-accent uppercase tracking-widest mb-1">Player 1</p>
              <p className="text-3xl font-extrabold text-white">{currentMatch.player1Name}</p>
              {currentMatch.player1Group && (
                <p className="text-xs text-slate-500 mt-1">{currentMatch.player1Group}</p>
              )}
            </div>

            <div style={{
              opacity: revealStep >= 2 && !fadingOut ? 1 : 0,
              transition: fadingOut ? "opacity 0.3s ease" : "opacity 0.4s ease",
            }}>
              <p className="text-lg font-bold text-slate-500">VS</p>
            </div>

            <div style={{
              opacity: revealStep >= 3 && !fadingOut ? 1 : 0,
              transform: revealStep >= 3 ? "translateY(0)" : "translateY(-20px)",
              transition: fadingOut ? "opacity 0.3s ease" : "opacity 0.5s ease, transform 0.5s ease",
            }}>
              <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Player 2</p>
              <p className={`text-3xl font-extrabold ${currentMatch.player2Name ? "text-white" : "text-slate-500 italic"}`}>
                {currentMatch.player2Name || "— BYE —"}
              </p>
              {currentMatch.player2Group && (
                <p className="text-xs text-slate-500 mt-1">{currentMatch.player2Group}</p>
              )}
            </div>
          </div>

          <div className="flex justify-center gap-1.5 mt-8 flex-wrap">
            {r32Matches.map((_, i) => (
              <div key={i} className={`w-2 h-2 rounded-full transition-colors ${
                i < matchIdx ? "bg-accent" : i === matchIdx ? "bg-white" : "bg-slate-700"
              }`} />
            ))}
          </div>

          <button
            onClick={() => setPhase("done")}
            className="mt-6 text-xs text-slate-500 hover:text-white transition-colors underline decoration-dotted"
          >
            Skip animation →
          </button>
        </div>
      )}

      {phase === "done" && (
        <div className="text-center w-full max-w-lg">
          <p className="text-2xl font-extrabold text-white mb-2">Draw Complete! 🎉</p>
          <p className="text-slate-400 text-sm mb-6">All {r32Matches.length} Round of 32 fixtures drawn</p>

          <div className="space-y-2 mb-8 max-h-80 overflow-y-auto pr-1">
            {r32Matches.map((m) => (
              <div key={m.id} className="flex items-center justify-between bg-pitch-800 rounded-xl px-4 py-3 border border-surface-border">
                <div className="text-left min-w-0">
                  <p className="text-sm text-white font-medium truncate">{m.player1Name}</p>
                  {m.player1Group && <p className="text-xs text-slate-600">{m.player1Group}</p>}
                </div>
                <span className="text-xs text-slate-500 flex-shrink-0 px-3">vs</span>
                <div className="text-right min-w-0">
                  <p className={`text-sm font-medium truncate ${m.player2Name ? "text-white" : "text-slate-500 italic"}`}>
                    {m.player2Name || "BYE"}
                  </p>
                  {m.player2Group && <p className="text-xs text-slate-600">{m.player2Group}</p>}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleStart}
            disabled={startTournament.isPending}
            className="flex items-center gap-2 px-8 py-3 rounded-xl bg-accent text-white font-bold text-lg mx-auto hover:bg-accent-dim transition-all disabled:opacity-50"
          >
            {startTournament.isPending ? "Starting…" : "Start Tournament →"}
          </button>
        </div>
      )}
    </div>
  )
}