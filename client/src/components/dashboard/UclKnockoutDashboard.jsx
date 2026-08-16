// components/dashboard/UclKnockoutDashboard.jsx
import { Link } from "react-router-dom"
import { useUclKnockoutCurrent } from "../../lib/queries"
import PlayerAvatarIcon from "../common/PlayerAvatarIcon"
import { Trophy, ArrowRight } from "lucide-react"
import { cn } from "../../lib/utils"

const ROUND_LABELS = {
  1: "R32", 2: "R16", 3: "QF", 4: "SF", 5: "Final"
}

function MiniMatchRow({ match }) {
  const completed = match.status === "completed"
  const p1Won = completed && match.winnerId === match.player1Id
  const p2Won = completed && match.winnerId === match.player2Id

  return (
    <div className="flex items-center justify-between py-2 px-3 border-b border-surface-border/30 last:border-0">
      <div className={cn("flex items-center gap-1.5 min-w-0 flex-1",
        p1Won ? "text-emerald-400" : "text-white"
      )}>
        <PlayerAvatarIcon player={{ avatarId: match.player1AvatarId, avatarUrl: match.player1AvatarUrl, name: match.player1Name }} />
        <span className="text-xs font-medium truncate">{match.player1Name ?? "TBD"}</span>
      </div>
      <div className="px-2 flex-shrink-0 text-center">
        {completed ? (
          <span className="text-xs font-mono font-bold text-white">
            {match.player1Score} - {match.player2Score}
          </span>
        ) : (
          <span className="text-xs text-slate-600">vs</span>
        )}
      </div>
      <div className={cn("flex items-center gap-1.5 min-w-0 flex-1 justify-end",
        p2Won ? "text-emerald-400" : "text-white"
      )}>
        <span className="text-xs font-medium truncate">{match.player2Name ?? "TBD"}</span>
        <PlayerAvatarIcon player={{ avatarId: match.player2AvatarId, avatarUrl: match.player2AvatarUrl, name: match.player2Name }} />
      </div>
    </div>
  )
}

export default function UclKnockoutDashboard() {
  const { data, isLoading } = useUclKnockoutCurrent()

  if (isLoading) return <p className="text-slate-500 text-sm py-8 text-center">Loading…</p>

  if (!data || data.status === "setup" || data.status === "draw") {
    return (
      <div className="text-center py-10">
        <Trophy className="w-8 h-8 text-slate-700 mx-auto mb-2" />
        <p className="text-slate-500 text-sm font-semibold">UCL Knockout not started yet</p>
        <p className="text-slate-600 text-xs mt-1">Available once the draw is complete</p>
      </div>
    )
  }

  const matches = data.matches || []
  const totalRounds = data.totalRounds || 5

  // Find the most active round (latest round with at least one match played or pending with players)
  const activeRound = (() => {
    for (let r = totalRounds; r >= 1; r--) {
      const rMatches = matches.filter(m => m.round === r && (m.player1Id || m.player2Id))
      if (rMatches.length > 0) return r
    }
    return 1
  })()

  const roundMatches = matches.filter(m => m.round === activeRound)
  const champion = matches.find(m => m.round === totalRounds && m.status === "completed")?.winnerName

  const roundLabel = {
    1: "Round of 32", 2: "Round of 16", 3: "Quarter-Final", 4: "Semi-Final", 5: "Final"
  }[activeRound] || `Round ${activeRound}`

  return (
    <div>
      {/* Champion banner */}
      {champion && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl bg-gold/10 border border-gold/20">
          <Trophy className="w-4 h-4 text-gold flex-shrink-0" />
          <span className="text-sm font-bold text-gold">{champion}</span>
          <span className="text-xs text-slate-400">UCL Champion</span>
        </div>
      )}

      {/* Current round */}
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">{roundLabel}</span>
        <span className="text-xs text-slate-600">{data.name}</span>
      </div>

      <div className="card overflow-hidden mb-4">
        {roundMatches.length === 0 ? (
          <p className="text-xs text-slate-600 text-center py-4">No fixtures yet</p>
        ) : (
          roundMatches.map(m => <MiniMatchRow key={m.id} match={m} />)
        )}
      </div>

      {/* Round nav dots */}
      <div className="flex justify-center gap-2 mb-4">
        {Array.from({ length: totalRounds }, (_, i) => i + 1).map(r => {
          const rMatches = matches.filter(m => m.round === r)
          const done = rMatches.every(m => m.status === "completed") && rMatches.length > 0
          return (
            <div key={r} className={cn(
              "flex flex-col items-center gap-0.5",
              r === activeRound ? "opacity-100" : "opacity-40"
            )}>
              <div className={cn("w-2 h-2 rounded-full",
                done ? "bg-emerald-400" : r === activeRound ? "bg-white" : "bg-slate-700"
              )} />
              <span className="text-[9px] text-slate-600">{ROUND_LABELS[r]}</span>
            </div>
          )
        })}
      </div>

      <Link
        to={`/ucl-knockout/bracket/${data.id}`}
        className="flex items-center justify-center gap-2 text-xs text-slate-400 hover:text-white transition-colors"
      >
        View full bracket <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  )
}