import { useState, useEffect, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useTlgCurrent } from "../lib/queries"
import { cn } from "../lib/utils"
import { TeamLogoIcon } from "../components/common/TeamLogo"
import teamLeagueLogo from "../../images/Team League.png"

function TeamCard({ team, revealed, position }) {
  return (
    <div className={cn(
      "transition-all duration-500",
      revealed ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-95"
    )}>
      <div className={cn(
        "rounded-2xl border px-5 py-4 flex items-center gap-4 bg-gradient-to-r from-pitch-800 to-pitch-900",
        revealed ? "border-accent/40 shadow-lg shadow-accent/10" : "border-surface-border"
      )}>
        <span className="text-sm text-slate-500 font-bold w-5 flex-shrink-0">{position}</span>
        {team.logoUrl ? (
          <TeamLogoIcon logoUrl={team.logoUrl} name={team.name} size="w-10 h-10" />
        ) : (
          <div className="w-10 h-10 rounded-xl bg-pitch-700 flex items-center justify-center flex-shrink-0">
            <span className="text-base font-bold text-slate-400">{team.name?.[0]}</span>
          </div>
        )}
        <span className="text-base font-bold text-white tracking-wide">{team.name}</span>
      </div>
    </div>
  )
}

export default function TlgDraw() {
  const navigate = useNavigate()
  const { data: tlg, refetch } = useTlgCurrent()
  const [revealedA, setRevealedA] = useState(0)
  const [revealedB, setRevealedB] = useState(0)
  const [phase, setPhase]         = useState("intro")
  const [currentGroup, setCurrentGroup] = useState("A")
  const timerRef = useRef(null)

  const groupA = tlg?.groups?.find(g => g.name === "A")
  const groupB = tlg?.groups?.find(g => g.name === "B")
  const allTeamsA = groupA?.standings ?? []
  const allTeamsB = groupB?.standings ?? []

  useEffect(() => { refetch() }, [])

  function startDraw() {
    setPhase("draw"); setRevealedA(0); setRevealedB(0); setCurrentGroup("A")
    revealNext(0, 0, "A")
  }

  function revealNext(cA, cB, group) {
    timerRef.current = setTimeout(() => {
      if (group === "A") {
        const next = cA + 1; setRevealedA(next); setCurrentGroup("B")
        if (next < 4 || cB < 4) revealNext(next, cB, "B")
        else setPhase("complete")
      } else {
        const next = cB + 1; setRevealedB(next); setCurrentGroup("A")
        if (cA < 4 || next < 4) revealNext(cA, next, "A")
        else setPhase("complete")
      }
    }, 900)
  }

  useEffect(() => () => clearTimeout(timerRef.current), [])

  return (
    <div className="min-h-screen bg-pitch-950 flex flex-col items-center px-4 py-10">
      <div className="flex items-center gap-3 mb-10">
        <img src={teamLeagueLogo} alt="Team League" className="w-10 h-10 object-contain" />
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-widest">Tamil Efootballers</p>
          <p className="text-xl font-extrabold text-white">Team League Group Draw</p>
        </div>
      </div>

      {phase === "intro" && (
        <div className="text-center space-y-4">
          <p className="text-slate-400 text-sm max-w-sm">
            8 teams will be drawn into Group A and Group B. Top 2 advance to Champions Bracket. Bottom 2 to Europa Bracket.
          </p>
          {allTeamsA.length === 0 ? (
            <p className="text-rose-400 text-sm">No groups found. Go back to admin and start the draw first.</p>
          ) : (
            <button onClick={startDraw} className="px-8 py-3 rounded-xl bg-gold/20 text-gold border border-gold/30 text-sm font-bold hover:bg-gold/30 transition-colors">
              🎲 Start Draw
            </button>
          )}
          <button onClick={() => navigate(-1)} className="block text-xs text-slate-600 hover:text-slate-400 mx-auto mt-4">← Back</button>
        </div>
      )}

      {(phase === "draw" || phase === "complete") && (
        <div className="w-full max-w-2xl space-y-6">
          {phase === "draw" && (
            <div className="text-center">
              <div className={cn(
                "inline-flex items-center gap-2 px-5 py-2.5 rounded-full border text-sm font-bold transition-all duration-300",
                currentGroup === "A" ? "bg-accent/20 border-accent/40 text-accent" : "bg-gold/20 border-gold/40 text-gold"
              )}>
                <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
                Drawing into Group {currentGroup}…
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-9 h-9 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center">
                  <span className="text-sm font-extrabold text-accent">A</span>
                </div>
                <span className="text-base font-bold text-white">Group A</span>
                {phase === "draw" && currentGroup === "A" && <div className="w-2 h-2 rounded-full bg-accent animate-pulse ml-auto" />}
              </div>
              {allTeamsA.map((t, i) => <TeamCard key={t.id} team={t} revealed={i < revealedA} position={i + 1} />)}
              {Array.from({ length: Math.max(0, 4 - allTeamsA.length) }).map((_, i) => (
                <div key={i} className="h-16 rounded-2xl border border-dashed border-surface-border/40 bg-pitch-900/30" />
              ))}
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-9 h-9 rounded-xl bg-gold/20 border border-gold/40 flex items-center justify-center">
                  <span className="text-sm font-extrabold text-gold">B</span>
                </div>
                <span className="text-base font-bold text-white">Group B</span>
                {phase === "draw" && currentGroup === "B" && <div className="w-2 h-2 rounded-full bg-gold animate-pulse ml-auto" />}
              </div>
              {allTeamsB.map((t, i) => <TeamCard key={t.id} team={t} revealed={i < revealedB} position={i + 1} />)}
              {Array.from({ length: Math.max(0, 4 - allTeamsB.length) }).map((_, i) => (
                <div key={i} className="h-16 rounded-2xl border border-dashed border-surface-border/40 bg-pitch-900/30" />
              ))}
            </div>
          </div>

          {phase === "complete" && (
            <div className="text-center space-y-4 pt-4">
              <div className="text-gold text-3xl">🎉</div>
              <p className="text-white font-bold text-lg">Draw Complete!</p>
              <p className="text-xs text-slate-500">Head to Group Stage in admin to log fixtures.</p>
              <button onClick={() => navigate(-1)} className="px-6 py-2.5 rounded-xl bg-accent/20 text-accent border border-accent/30 text-sm font-semibold hover:bg-accent/30 transition-colors">
                → Go to Admin
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}