import { useState, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Users } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import api from "../lib/api"
import { cn } from "../lib/utils"

export default function DuoDraw() {
  const { season } = useParams()
  const navigate = useNavigate()
  const [phase, setPhase]           = useState("intro")
  const [pairIdx, setPairIdx]       = useState(0)
  const [revealStep, setRevealStep] = useState(0)   // 0=blank 1=set1 2=connector 3=set2 4=pause
  const [fadingOut, setFadingOut]   = useState(false)
  const [transitioning, setTransitioning] = useState(false) // true while between pairs

  const { data: pairs = [] } = useQuery({
    queryKey: ["duo-pairs", season],
    queryFn:  () => api.get(`/duo/pairs?season=${season}`).then(r => r.data),
    enabled:  !!season,
  })

  const currentPair = pairs[pairIdx]

  // Auto-progress reveal steps
  useEffect(() => {
    if (phase !== "revealing") return
    if (pairIdx >= pairs.length) { setPhase("done"); return }

    const delays = [0, 500, 900, 1400, 3000]
    const next = delays[revealStep + 1]

    if (next === undefined) {
      const t = setTimeout(() => {
        setFadingOut(true)
        setTimeout(() => {
          // Mark as transitioning so new pair renders fully hidden
          setTransitioning(true)
          setFadingOut(false)
          setPairIdx(i => i + 1)
          setRevealStep(0)
          // Small delay before starting new reveal so DOM updates first
          setTimeout(() => setTransitioning(false), 80)
        }, 500)
      }, 400)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setRevealStep(s => s + 1), next - (delays[revealStep] || 0))
    return () => clearTimeout(t)
  }, [phase, pairIdx, revealStep, pairs.length])

  useEffect(() => {
    if (phase === "revealing") setRevealStep(0)
  }, [pairIdx])

  if (pairs.length === 0) return (
    <div className="min-h-screen bg-pitch-900 flex items-center justify-center">
      <p className="text-slate-500">Loading pairs...</p>
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: "radial-gradient(ellipse at center, rgba(99,102,241,0.08) 0%, rgb(5,8,16) 70%)" }}>

      {/* Header */}
      <div className="flex items-center gap-3 mb-12">
        <Users className="w-8 h-8 text-accent" />
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-widest">Tamil Efootballers</p>
          <p className="text-xl font-extrabold text-white">Duo Tournament — Season {season}</p>
        </div>
      </div>

      {/* Intro screen */}
      {phase === "intro" && (
        <div className="text-center">
          <p className="text-slate-400 mb-2 text-sm">{pairs.length} duo pairs drawn</p>
          <p className="text-slate-500 text-sm mb-10">S/A+/A players paired with B/C players · Random draw</p>
          <button onClick={() => setPhase("revealing")}
            className="bg-accent text-white px-10 py-4 rounded-2xl text-lg font-extrabold hover:bg-accent/90 transition-all hover:scale-105 shadow-lg shadow-accent/20">
            Reveal Pairs
          </button>
        </div>
      )}

      {/* Revealing screen */}
      {phase === "revealing" && currentPair && (
        <div className={cn("transition-all duration-500", (fadingOut || transitioning) ? "opacity-0 scale-95" : "opacity-100 scale-100")}>
          {/* Pair number */}
          <p className="text-xs text-slate-600 uppercase tracking-[0.3em] text-center mb-6 font-semibold">
            Duo Pair {pairIdx + 1} of {pairs.length}
          </p>

          {/* The card */}
          <div className="relative flex items-center justify-center gap-0 min-w-[340px] sm:min-w-[480px]">

            {/* Set 1 player */}
            <div className={cn(
              "flex-1 text-center transition-all duration-500",
              revealStep >= 1 ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"
            )}>
              <div className="bg-pitch-800 border border-surface-border rounded-2xl px-6 py-5 mx-1"
                style={{ boxShadow: revealStep >= 1 ? "0 0 30px rgba(99,102,241,0.15)" : "none" }}>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Set 1</p>
                <p className="text-2xl sm:text-3xl font-black text-white">{currentPair.set1Name}</p>
              </div>
            </div>

            {/* Connector */}
            <div className={cn(
              "flex flex-col items-center flex-shrink-0 px-3 transition-all duration-300",
              revealStep >= 2 ? "opacity-100 scale-100" : "opacity-0 scale-75"
            )}>
              <div className="w-px h-8 bg-slate-700" />
              <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center">
                <Users className="w-4 h-4 text-accent" />
              </div>
              <div className="w-px h-8 bg-slate-700" />
            </div>

            {/* Set 2 player */}
            <div className={cn(
              "flex-1 text-center transition-all duration-500",
              revealStep >= 3 ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
            )}>
              <div className="bg-pitch-800 border border-surface-border rounded-2xl px-6 py-5 mx-1"
                style={{ boxShadow: revealStep >= 3 ? "0 0 30px rgba(16,185,129,0.15)" : "none" }}>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Set 2</p>
                <p className="text-2xl sm:text-3xl font-black text-white">{currentPair.set2Name}</p>
              </div>
            </div>
          </div>

          {/* Duo name */}
          {revealStep >= 3 && (
            <div className="text-center mt-5 animate-in fade-in duration-300">
              <p className="text-accent font-bold text-sm">{currentPair.duoName}</p>
            </div>
          )}

          {/* Progress dots */}
          <div className="flex justify-center gap-1.5 mt-10">
            {pairs.map((_, i) => (
              <div key={i} className={cn(
                "rounded-full transition-all duration-300",
                i === pairIdx ? "w-4 h-1.5 bg-accent" :
                i < pairIdx ? "w-1.5 h-1.5 bg-slate-600" : "w-1.5 h-1.5 bg-slate-800"
              )} />
            ))}
          </div>

          {/* Skip button */}
          <div className="text-center mt-8">
            <button onClick={() => setPhase("done")}
              className="text-xs text-slate-600 hover:text-slate-400 transition-colors">
              Skip to all pairs →
            </button>
          </div>
        </div>
      )}

      {/* Done screen — show all pairs */}
      {phase === "done" && (
        <div className="w-full max-w-2xl space-y-3 animate-in fade-in duration-500">
          <p className="text-center text-sm text-slate-400 mb-6">
            All {pairs.length} duo pairs drawn ✓
          </p>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {pairs.map((pair, idx) => (
              <div key={pair.id}
                className="flex items-center gap-3 px-4 py-3 bg-pitch-800 rounded-xl border border-surface-border">
                <span className="text-xs text-slate-600 w-5 flex-shrink-0 font-mono">{idx + 1}</span>
                <div className="flex-1 text-center min-w-0">
                  <p className="text-sm font-bold text-white truncate">{pair.set1Name}</p>
                </div>
                <div className="flex-shrink-0 px-2">
                  <div className="w-6 h-6 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center">
                    <Users className="w-3 h-3 text-accent" />
                  </div>
                </div>
                <div className="flex-1 text-center min-w-0">
                  <p className="text-sm font-bold text-white truncate">{pair.set2Name}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center pt-4">
            <button onClick={() => navigate("/admin?tab=duo")}
              className="bg-accent text-white px-8 py-3 rounded-xl font-bold hover:bg-accent/90 transition-all">
              View Groups & Fixtures →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}