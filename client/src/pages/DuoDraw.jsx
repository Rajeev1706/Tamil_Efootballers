import { useState, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Users } from "lucide-react"
import { useQuery, useMutation } from "@tanstack/react-query"
import api from "../lib/api"
import { cn } from "../lib/utils"

export default function DuoDraw() {
  const { season } = useParams()
  const navigate   = useNavigate()

  // Groups derived from pairs after draw
  const [phase, setPhase]           = useState("idle")   // idle | revealing | done
  const [groupIdx, setGroupIdx]     = useState(0)         // which group we're on
  const [pairIdx, setPairIdx]       = useState(0)         // which pair within current group
  const [revealStep, setRevealStep] = useState(0)         // 0=hidden 1=duo-name 2=player1 3=player2
  const [fadingOut, setFadingOut]   = useState(false)
  const [groupsDone, setGroupsDone] = useState([])        // completed group names

  const { data: pairs = [], isLoading } = useQuery({
    queryKey: ["duo-pairs", season],
    queryFn:  () => api.get(`/duo/pairs?season=${season}`).then(r => r.data),
    enabled:  !!season,
  })

  const revealMut = useMutation({
    mutationFn: () => api.post("/duo/reveal", { seasonNumber: Number(season) }).then(r => r.data),
  })

  // Build group map: { "Group A": [pair, ...], ... }
  const groupMap = {}
  pairs.forEach(p => {
    if (!p.groupName) return
    if (!groupMap[p.groupName]) groupMap[p.groupName] = []
    groupMap[p.groupName].push(p)
  })
  const groupNames = Object.keys(groupMap).sort()

  const currentGroupName = groupNames[groupIdx]
  const currentGroupPairs = groupMap[currentGroupName] || []
  const currentPair = currentGroupPairs[pairIdx]

  // ── auto-progress within a pair ──────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "revealing") return

    // Done with all groups
    if (groupIdx >= groupNames.length) {
      setPhase("done")
      revealMut.mutate()
      return
    }

    // Done with all pairs in this group → add to completed, move to next group
    if (pairIdx >= currentGroupPairs.length) {
      const t = setTimeout(() => {
        setGroupsDone(d => [...d, currentGroupName])
        setFadingOut(true)
        setTimeout(() => {
          setFadingOut(false)
          setPairIdx(0)
          setRevealStep(0)
          setGroupIdx(i => i + 1)
        }, 500)
      }, 800)
      return () => clearTimeout(t)
    }

    // Reveal steps for current pair: 0=blank → 1=duo name → 2=player1 → 3=player2 → pause → next
    const delays = [0, 500, 1000, 1600]
    const next = delays[revealStep + 1]

    if (next === undefined) {
      // Pause then advance to next pair
      const t = setTimeout(() => {
        setFadingOut(true)
        setTimeout(() => {
          setRevealStep(0)
          setFadingOut(false)
          setPairIdx(i => i + 1)
        }, 400)
      }, 1200)
      return () => clearTimeout(t)
    }

    const t = setTimeout(() => setRevealStep(s => s + 1), next - (delays[revealStep] || 0))
    return () => clearTimeout(t)
  }, [phase, groupIdx, pairIdx, revealStep, currentGroupPairs.length, groupNames.length])

  // Reset revealStep when pair changes
  useEffect(() => {
    if (phase === "revealing") setRevealStep(0)
  }, [pairIdx, groupIdx])

  if (isLoading) return (
    <div className="min-h-screen bg-pitch-900 flex items-center justify-center">
      <p className="text-slate-500">Loading draw…</p>
    </div>
  )

  if (pairs.length === 0 || groupNames.length === 0) return (
    <div className="min-h-screen bg-pitch-900 flex flex-col items-center justify-center gap-4">
      <p className="text-slate-400">No draw found. Generate the draw first from the admin panel.</p>
      <button onClick={() => navigate("/admin?tab=duo")}
        className="text-accent text-sm hover:underline">← Back to admin</button>
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
          <p className="text-xl font-extrabold text-white">Duo Tournament — Season {season} Draw</p>
        </div>
      </div>

      {/* Idle */}
      {phase === "idle" && (
        <div className="text-center">
          <p className="text-slate-400 mb-2 text-sm">{groupNames.length} groups · {pairs.length} pairs</p>
          <p className="text-slate-500 text-sm mb-10">Groups will be revealed one by one</p>
          <button onClick={() => setPhase("revealing")}
            className="bg-accent text-white px-10 py-4 rounded-2xl text-lg font-extrabold hover:bg-accent/90 transition-all hover:scale-105 shadow-lg shadow-accent/20">
            Reveal Draw
          </button>
        </div>
      )}

      {/* Revealing */}
      {phase === "revealing" && groupIdx < groupNames.length && (
        <div className="w-full max-w-lg space-y-6">
          {/* Group heading */}
          <div className="text-center">
            <p className="text-xs text-slate-600 uppercase tracking-[0.3em] mb-1">
              Group {groupIdx + 1} of {groupNames.length}
            </p>
            <h2 className="text-3xl font-black text-white">{currentGroupName}</h2>
          </div>

          {/* Previously completed pairs in this group */}
          <div className="space-y-2">
            {currentGroupPairs.slice(0, pairIdx).map((pair) => (
              <div key={pair.id} className="flex items-center gap-3 px-4 py-3 bg-pitch-800/80 rounded-xl border border-surface-border animate-in fade-in duration-300">
                <div className="flex-1 text-center">
                  <p className="text-sm font-bold text-white">{pair.set1Name}</p>
                </div>
                <div className="w-7 h-7 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center flex-shrink-0">
                  <Users className="w-3.5 h-3.5 text-accent" />
                </div>
                <div className="flex-1 text-center">
                  <p className="text-sm font-bold text-white">{pair.set2Name}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Current pair animating in */}
          {currentPair && pairIdx < currentGroupPairs.length && (
            <div className={cn(
              "transition-all duration-400",
              fadingOut ? "opacity-0 scale-95" : "opacity-100 scale-100"
            )}>
              <div className="flex items-center gap-0 px-2">
                {/* Player 1 */}
                <div className={cn(
                  "flex-1 text-center transition-all duration-500",
                  revealStep >= 2 ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"
                )}>
                  <div className="bg-pitch-800 border border-surface-border rounded-2xl px-5 py-4 mx-1"
                    style={{ boxShadow: revealStep >= 2 ? "0 0 30px rgba(99,102,241,0.15)" : "none" }}>
                    <p className="text-2xl sm:text-3xl font-black text-white">{currentPair.set1Name}</p>
                  </div>
                </div>

                {/* Connector */}
                <div className={cn(
                  "flex flex-col items-center flex-shrink-0 px-2 transition-all duration-300",
                  revealStep >= 1 ? "opacity-100 scale-100" : "opacity-0 scale-75"
                )}>
                  <div className="w-px h-6 bg-slate-700" />
                  <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center">
                    <Users className="w-4 h-4 text-accent" />
                  </div>
                  <div className="w-px h-6 bg-slate-700" />
                </div>

                {/* Player 2 */}
                <div className={cn(
                  "flex-1 text-center transition-all duration-500",
                  revealStep >= 3 ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
                )}>
                  <div className="bg-pitch-800 border border-surface-border rounded-2xl px-5 py-4 mx-1"
                    style={{ boxShadow: revealStep >= 3 ? "0 0 30px rgba(16,185,129,0.15)" : "none" }}>
                    <p className="text-2xl sm:text-3xl font-black text-white">{currentPair.set2Name}</p>
                  </div>
                </div>
              </div>

              {/* Duo name */}
              {revealStep >= 1 && (
                <div className="text-center mt-3 animate-in fade-in duration-300">
                  <p className="text-accent font-bold text-sm">{currentPair.duoName}</p>
                </div>
              )}
            </div>
          )}

          {/* Group progress dots */}
          <div className="flex justify-center gap-1.5 mt-4">
            {groupNames.map((g, i) => (
              <div key={g} className={cn(
                "rounded-full transition-all duration-300",
                i === groupIdx ? "w-4 h-1.5 bg-accent" :
                i < groupIdx  ? "w-1.5 h-1.5 bg-slate-600" : "w-1.5 h-1.5 bg-slate-800"
              )} />
            ))}
          </div>

          {/* Skip */}
          <div className="text-center">
            <button onClick={() => { revealMut.mutate(); setPhase("done") }}
              className="text-xs text-slate-600 hover:text-slate-400 transition-colors">
              Skip to all groups →
            </button>
          </div>
        </div>
      )}

      {/* Done */}
      {phase === "done" && (
        <div className="w-full max-w-2xl space-y-4 animate-in fade-in duration-500">
          <p className="text-center text-sm text-slate-400 mb-4">
            All {groupNames.length} groups revealed ✓
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[65vh] overflow-y-auto pr-1">
            {groupNames.map(groupName => (
              <div key={groupName} className="bg-pitch-800 rounded-xl border border-surface-border overflow-hidden">
                <div className="px-4 py-2 border-b border-surface-border/60 bg-accent/5">
                  <p className="text-xs font-bold text-accent uppercase tracking-widest">{groupName}</p>
                </div>
                <div className="p-2 space-y-1.5">
                  {(groupMap[groupName] || []).map(pair => (
                    <div key={pair.id} className="flex items-center gap-2 px-2 py-1.5 bg-pitch-900/40 rounded-lg">
                      <div className="flex-1 text-center min-w-0">
                        <p className="text-xs font-bold text-white truncate">{pair.set1Name}</p>
                      </div>
                      <div className="w-5 h-5 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center flex-shrink-0">
                        <Users className="w-2.5 h-2.5 text-accent" />
                      </div>
                      <div className="flex-1 text-center min-w-0">
                        <p className="text-xs font-bold text-white truncate">{pair.set2Name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="text-center pt-2">
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