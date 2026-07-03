import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Trophy } from "lucide-react"
import { useUclAdminGroups } from "../lib/queries"
import { uclApi } from "../lib/api"

export default function UclDraw() {
  const navigate = useNavigate()
  const { data: allGroups = [], isLoading } = useUclAdminGroups()

  const [groupIdx, setGroupIdx]         = useState(0)
  const [playerIdx, setPlayerIdx]       = useState(0)
  const [phase, setPhase]               = useState("intro") // intro | revealing | fading | done
  const [groupVisible, setGroupVisible] = useState(true)

  // Only animate pending_draw groups
  const groups = allGroups.filter(g => g.status === "pending_draw")

  const currentGroup = groups[groupIdx]
  const isLastGroup  = groupIdx >= groups.length - 1

  // Auto-reveal players one by one
  useEffect(() => {
    if (phase !== "revealing" || !currentGroup) return

    if (playerIdx < currentGroup.players.length) {
      const t = setTimeout(() => setPlayerIdx(i => i + 1), 600)
      return () => clearTimeout(t)
    }

    // All players revealed — pause then fade out group
    const t = setTimeout(() => {
      setPhase("fading")
      setGroupVisible(false)
      setTimeout(() => {
        if (isLastGroup) {
          setPhase("done")
          setGroupVisible(true)
        } else {
          setGroupIdx(i => i + 1)
          setPlayerIdx(0)
          setGroupVisible(true)
          setPhase("revealing")
        }
      }, 800)
    }, 1800)
    return () => clearTimeout(t)
  }, [phase, playerIdx, currentGroup, isLastGroup])

  if (isLoading) return (
    <div className="min-h-screen bg-pitch-900 flex items-center justify-center">
      <p className="text-slate-500 text-sm">Loading groups…</p>
    </div>
  )

  if (!isLoading && groups.length === 0) return (
    <div className="min-h-screen bg-pitch-900 flex items-center justify-center">
      <p className="text-slate-500 text-sm">No pending groups found — draw may already be complete</p>
    </div>
  )

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: "radial-gradient(ellipse at center, rgba(16,185,129,0.06) 0%, rgb(5,8,16) 70%)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-10">
        <Trophy className="w-8 h-8 text-accent" />
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-widest">Tamil Efootballers</p>
          <p className="text-xl font-extrabold text-white">UCL Group Stage Draw</p>
        </div>
      </div>

      {/* Intro screen */}
      {phase === "intro" && (
        <div className="text-center">
          <p className="text-slate-400 mb-2 text-sm">{groups.length} groups · {groups.reduce((s, g) => s + g.players.length, 0)} players</p>
          <p className="text-slate-500 text-sm mb-8">Players will be revealed group by group</p>
          <button
            onClick={() => setPhase("revealing")}
            className="flex items-center gap-2 px-8 py-3 rounded-xl bg-accent text-white font-bold text-lg shadow-lg hover:bg-accent-dim transition-all mx-auto"
          >
            🎲 Start Draw
          </button>
        </div>
      )}

      {/* Group card — only during reveal/fading */}
      {(phase === "revealing" || phase === "fading") && currentGroup && (
        <div
          className="w-full max-w-sm"
          style={{
            opacity: groupVisible ? 1 : 0,
            transform: groupVisible ? "scale(1)" : "scale(0.95)",
            transition: "opacity 0.7s ease, transform 0.7s ease",
          }}
        >
          {/* Group name */}
          <div className="text-center mb-6">
            <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Drawing</p>
            <h2 className="text-4xl font-extrabold text-accent">{currentGroup.name}</h2>
            <p className="text-xs text-slate-500 mt-1">{currentGroup.players.length} players</p>
          </div>

          {/* Player list — names appear one by one and stay */}
          <div
            className="rounded-2xl border border-surface-border overflow-hidden"
            style={{ boxShadow: "0 0 40px rgba(16,185,129,0.08)" }}
          >
            <div className="divide-y divide-surface-border/40">
              {currentGroup.players.map((p, i) => (
                <div
                  key={p.id}
                  style={{
                    opacity: i < playerIdx ? 1 : 0,
                    transform: i < playerIdx ? "translateX(0)" : "translateX(-16px)",
                    transition: "opacity 0.4s ease, transform 0.4s ease",
                    background: i < playerIdx ? "rgba(16,185,129,0.03)" : "transparent",
                  }}
                  className="flex items-center gap-3 px-5 py-3.5"
                >
                  <div className="w-6 h-6 rounded-full bg-accent/15 text-accent flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {i + 1}
                  </div>
                  <span className="text-base font-semibold text-white">{p.name}</span>
                  {p.team && <span className="text-xs text-slate-500 ml-auto">{p.team}</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Progress dots */}
          <div className="flex justify-center gap-2 mt-6">
            {groups.map((_, i) => (
              <div key={i} className={`w-2 h-2 rounded-full transition-all duration-300 ${
                i < groupIdx ? "bg-accent" : i === groupIdx ? "bg-white scale-125" : "bg-slate-700"
              }`} />
            ))}
          </div>

          {/* Skip */}
          <div className="text-center mt-4">
            <button
              onClick={() => { setPhase("done"); setGroupVisible(true) }}
              className="text-xs text-slate-600 hover:text-slate-400 transition-colors underline decoration-dotted"
            >
              Skip draw
            </button>
          </div>
        </div>
      )}

      {/* Done screen */}
      {phase === "done" && (
        <div className="text-center">
          <div className="text-5xl mb-4">🏆</div>
          <p className="text-2xl font-extrabold text-white mb-2">Draw Complete!</p>
          <p className="text-slate-400 text-sm mb-8">
            All {groups.length} groups have been drawn — {groups.reduce((s, g) => s + g.players.length, 0)} players assigned
          </p>

          {/* Summary of all groups */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8 max-w-2xl mx-auto">
            {groups.map(g => (
              <div key={g.id} className="bg-pitch-800 border border-surface-border rounded-xl p-3 text-left">
                <p className="text-xs font-bold text-accent mb-2">{g.name}</p>
                <div className="space-y-1">
                  {g.players.map(p => (
                    <p key={p.id} className="text-xs text-slate-300 truncate">{p.name}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={async () => {
              await uclApi.activate()
              navigate("/admin?tab=uclgroups")
            }}
            className="px-8 py-3 rounded-xl bg-accent text-white font-bold text-lg hover:bg-accent-dim transition-all"
          >
            Done →
          </button>
        </div>
      )}
    </div>
  )
}