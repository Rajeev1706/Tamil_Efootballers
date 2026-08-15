// components/dashboard/TeamKnockoutDashboard.jsx
import { Link } from "react-router-dom"
import { useTeamKnockoutCurrent } from "../../lib/queries"
import { TeamAvatar } from "../common/TeamLogo"
import { Trophy, ArrowRight } from "lucide-react"
import { cn } from "../../lib/utils"
import teamLeagueTrophy from "../../../images/Team League.png"
import europaTrophy     from "../../../images/europa.png"

const MATCH_LABELS = {
  champions_sf1:   "Champions SF 1",
  champions_sf2:   "Champions SF 2",
  champions_final: "Champions Final",
  europa_sf1:      "Europa SF 1",
  europa_sf2:      "Europa SF 2",
  europa_final:    "Europa Final",
}

function MiniMatchRow({ match }) {
  const completed = match.status === "completed"
  const pending   = !match.team1_id || !match.team2_id
  const isChamp   = match.match_type?.startsWith("champions_")
  const isFinal   = match.match_type?.endsWith("_final")

  return (
    <div className={cn(
      "rounded-lg border p-3 mb-2",
      isFinal
        ? (isChamp ? "border-gold/30 bg-gold/5" : "border-violet-400/30 bg-violet-400/5")
        : "border-surface-border bg-surface-card/50"
    )}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
        {MATCH_LABELS[match.match_type]}
      </p>

      {pending ? (
        <p className="text-xs text-slate-600 italic">Awaiting result…</p>
      ) : (
        <div className="space-y-1.5">
          {/* Team 1 */}
          <div className={cn("flex items-center justify-between gap-2",
            completed && match.winner_id === match.team1_id ? "text-emerald-400" : "text-white"
          )}>
            <div className="flex items-center gap-1.5 min-w-0">
              <TeamAvatar logoUrl={match.team1Logo} name={match.team1Name} size="w-5 h-5" />
              <span className="text-xs font-medium truncate">{match.team1Name}</span>
            </div>
            {match.team1_leg1 !== null && (
              <span className="text-xs font-mono font-bold flex-shrink-0">
                {(match.team1_leg1 || 0) + (match.team1_leg2 || 0)}
              </span>
            )}
          </div>
          {/* Team 2 */}
          <div className={cn("flex items-center justify-between gap-2",
            completed && match.winner_id === match.team2_id ? "text-emerald-400" : "text-white"
          )}>
            <div className="flex items-center gap-1.5 min-w-0">
              <TeamAvatar logoUrl={match.team2Logo} name={match.team2Name} size="w-5 h-5" />
              <span className="text-xs font-medium truncate">{match.team2Name}</span>
            </div>
            {match.team2_leg1 !== null && (
              <span className="text-xs font-mono font-bold flex-shrink-0">
                {(match.team2_leg1 || 0) + (match.team2_leg2 || 0)}
              </span>
            )}
          </div>

          {/* Leg breakdown */}
          {match.team1_leg1 !== null && match.team1_leg2 !== null && (
            <div className="flex justify-between text-[10px] text-slate-500 pt-1 border-t border-surface-border/30">
              <span>Leg 1: {match.team1_leg1}–{match.team2_leg1}</span>
              <span>Leg 2: {match.team1_leg2}–{match.team2_leg2}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function TeamKnockoutDashboard() {
  const { data, isLoading } = useTeamKnockoutCurrent()
  const matches = data?.matches || []

  const champMatches  = matches.filter(m => m.match_type?.startsWith("champions_"))
  const europaMatches = matches.filter(m => m.match_type?.startsWith("europa_"))

  // Champions winner (from final)
  const champFinal  = champMatches.find(m => m.match_type === "champions_final")
  const europaFinal = europaMatches.find(m => m.match_type === "europa_final")

  if (isLoading) return <p className="text-slate-500 text-sm py-8 text-center">Loading…</p>

  if (matches.length === 0) {
    return (
      <div className="text-center py-10">
        <Trophy className="w-8 h-8 text-slate-700 mx-auto mb-2" />
        <p className="text-slate-500 text-sm font-semibold">Team Knockout not started</p>
        <p className="text-slate-600 text-xs mt-1">Available once group stage is complete</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Champions bracket */}
      {champMatches.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <img src={teamLeagueTrophy} alt="Champions" className="w-5 h-5 object-contain" />
            <h3 className="text-sm font-bold text-gold">Champions</h3>
            {champFinal?.winnerName && champFinal.status === "completed" && (
              <span className="text-xs text-emerald-400 font-semibold ml-auto">
                🏆 {champFinal.winnerName}
              </span>
            )}
          </div>
          {champMatches.map(m => <MiniMatchRow key={m.id} match={m} />)}
        </div>
      )}

      {/* Europa bracket */}
      {europaMatches.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <img src={europaTrophy} alt="Europa" className="w-5 h-5 object-contain" />
            <h3 className="text-sm font-bold text-violet-400">Europa</h3>
            {europaFinal?.winnerName && europaFinal.status === "completed" && (
              <span className="text-xs text-emerald-400 font-semibold ml-auto">
                🏆 {europaFinal.winnerName}
              </span>
            )}
          </div>
          {europaMatches.map(m => <MiniMatchRow key={m.id} match={m} />)}
        </div>
      )}

      {/* Link to full bracket page */}
      <Link
        to="/team-knockout"
        className="flex items-center justify-center gap-2 text-xs text-slate-400 hover:text-white transition-colors pt-2"
      >
        View full bracket <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  )
}