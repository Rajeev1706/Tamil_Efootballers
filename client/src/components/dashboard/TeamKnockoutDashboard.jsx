// components/dashboard/TeamKnockoutDashboard.jsx
import { Link } from "react-router-dom"
import { useTeamKnockoutCurrent } from "../../lib/queries"
import { TeamAvatar } from "../common/TeamLogo"
import { Trophy, ArrowRight, Zap } from "lucide-react"
import { cn } from "../../lib/utils"
import teamLeagueTrophy from "../../../images/Team League.png"
import europaTrophy     from "../../../images/europa.png"

const MATCH_LABELS = {
  champions_sf1:   "Champions SF 1",  champions_sf2:   "Champions SF 2",
  champions_final: "Champions Final", champions_3rd:   "3rd / 4th Place",
  europa_sf1:      "Europa SF 1",     europa_sf2:      "Europa SF 2",
  europa_final:    "Europa Final",    europa_7th:      "7th / 8th Place",
}

// Resolve effective scores for a leg — stored (after close) takes priority over live
function legStats(legData, matchTeam1Id) {
  if (!legData) return null
  const closed = legData.leg_status === "completed"

  const homePts   = closed ? (legData.stored_home_pts   ?? legData.live_home_pts)   : legData.live_home_pts
  const awayPts   = closed ? (legData.stored_away_pts   ?? legData.live_away_pts)   : legData.live_away_pts
  const homeGoals = closed ? (legData.stored_home_goals ?? legData.live_home_goals) : legData.live_home_goals
  const awayGoals = closed ? (legData.stored_away_goals ?? legData.live_away_goals) : legData.live_away_goals
  const isLive    = !closed && Number(legData.matches_logged) > 0

  const t1IsHome = legData.home_team_id === matchTeam1Id
  return {
    t1Pts:   t1IsHome ? homePts   : awayPts,
    t2Pts:   t1IsHome ? awayPts   : homePts,
    t1Goals: t1IsHome ? homeGoals : awayGoals,
    t2Goals: t1IsHome ? awayGoals : homeGoals,
    isLive,
    closed,
    hasData: closed || Number(legData.matches_logged) > 0,
  }
}

function StatLabel({ label }) {
  return <span className="text-[9px] font-bold uppercase tracking-widest text-slate-600">{label}</span>
}

function StatVal({ val, highlight, dim }) {
  return (
    <span className={cn(
      "text-xs font-bold font-mono w-8 text-center",
      highlight ? "text-emerald-400" : dim ? "text-slate-600" : "text-slate-300"
    )}>
      {val ?? "—"}
    </span>
  )
}

function MiniMatchRow({ match }) {
  const completed  = match.status === "completed"
  const pending    = !match.team1_id || !match.team2_id
  const needsDec   = match.status === "needs_decision"
  const isChamp    = match.match_type?.startsWith("champions_")
  const isFinal    = match.match_type?.endsWith("_final") || match.match_type?.endsWith("_3rd") || match.match_type?.endsWith("_7th")

  const l1 = legStats(match.liveLegs?.leg1, match.team1_id)
  const l2 = legStats(match.liveLegs?.leg2, match.team1_id)

  const anyLive   = l1?.isLive || l2?.isLive
  const hasAnyData = l1?.hasData || l2?.hasData

  // Aggregate stats
  const t1Pts   = (l1?.t1Pts   ?? 0) + (l2?.t1Pts   ?? 0)
  const t2Pts   = (l1?.t2Pts   ?? 0) + (l2?.t2Pts   ?? 0)
  const t1GF    = (l1?.t1Goals ?? 0) + (l2?.t1Goals ?? 0)
  const t2GF    = (l1?.t2Goals ?? 0) + (l2?.t2Goals ?? 0)
  const t1GA    = (l1?.t2Goals ?? 0) + (l2?.t2Goals ?? 0)
  const t2GA    = (l1?.t1Goals ?? 0) + (l2?.t1Goals ?? 0)
  const t1GD    = t1GF - t1GA
  const t2GD    = t2GF - t2GA

  const t1Wins  = completed && match.winner_id === match.team1_id
  const t2Wins  = completed && match.winner_id === match.team2_id

  const teams = [
    { id: match.team1_id, name: match.team1Name, logo: match.team1Logo,
      pts: t1Pts, gf: t1GF, ga: t1GA, gd: t1GD, wins: t1Wins },
    { id: match.team2_id, name: match.team2Name, logo: match.team2Logo,
      pts: t2Pts, gf: t2GF, ga: t2GA, gd: t2GD, wins: t2Wins },
  ]

  return (
    <div className={cn(
      "rounded-xl border p-3 mb-2",
      isFinal
        ? (isChamp ? "border-gold/30 bg-gold/5" : "border-violet-400/30 bg-violet-400/5")
        : "border-surface-border bg-surface-card/50"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          {MATCH_LABELS[match.match_type]}
        </p>
        <div className="flex items-center gap-2">
          {anyLive && (
            <span className="flex items-center gap-0.5 text-[9px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded-full">
              <Zap className="w-2.5 h-2.5" /> LIVE
            </span>
          )}
          {needsDec && <span className="text-[9px] font-bold text-rose-400">⚠ Tie</span>}
        </div>
      </div>

      {pending ? (
        <p className="text-xs text-slate-600 italic">Awaiting result…</p>
      ) : !match.toss_done ? (
        <div className="space-y-1">
          {teams.map(t => (
            <div key={t.id} className="flex items-center gap-2">
              <TeamAvatar logoUrl={t.logo} name={t.name} size="w-5 h-5" />
              <span className="text-xs text-slate-400">{t.name}</span>
            </div>
          ))}
          <p className="text-[10px] text-slate-600 italic pt-1">Toss pending…</p>
        </div>
      ) : (
        <>
          {/* Stats header row */}
          {hasAnyData && (
            <div className="flex items-center justify-between mb-1 pb-1 border-b border-surface-border/30">
              <span className="text-[9px] text-slate-700 flex-1">Team</span>
              <div className="flex gap-1">
                <StatLabel label="Pts" />
                <StatLabel label="GF" />
                <StatLabel label="GA" />
                <StatLabel label="GD" />
              </div>
            </div>
          )}

          {/* Team rows */}
          {teams.map(t => (
            <div key={t.id} className="flex items-center justify-between gap-2 py-1">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <TeamAvatar logoUrl={t.logo} name={t.name} size="w-5 h-5" />
                <span className={cn("text-xs font-medium truncate", t.wins ? "text-emerald-400" : "text-white")}>
                  {t.name}
                </span>
                {t.wins && <span className="text-[9px] text-emerald-400 font-bold flex-shrink-0">✓</span>}
              </div>
              {hasAnyData ? (
                <div className="flex gap-1 flex-shrink-0">
                  <StatVal val={t.pts} highlight={t.wins} />
                  <StatVal val={t.gf} />
                  <StatVal val={t.ga} />
                  <StatVal
                    val={t.gd >= 0 ? `+${t.gd}` : t.gd}
                    highlight={t.gd > 0}
                    dim={t.gd < 0}
                  />
                </div>
              ) : (
                <span className="text-[10px] text-slate-700">vs</span>
              )}
            </div>
          ))}

          {/* Leg breakdown */}
          {(l1?.hasData || l2?.hasData) && (
            <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-surface-border/30 mt-1">
              <div className="flex items-center gap-1">
                <span className="text-slate-600">Leg 1:</span>
                {l1?.hasData
                  ? <span className={cn("font-mono", l1.isLive ? "text-amber-400" : "text-slate-400")}>
                      {l1.isLive && <Zap className="w-2 h-2 inline mr-0.5" />}
                      {l1.t1Pts} – {l1.t2Pts}
                    </span>
                  : <span className="text-slate-700">—</span>
                }
              </div>
              <div className="flex items-center gap-1">
                <span className="text-slate-600">Leg 2:</span>
                {l2?.hasData
                  ? <span className={cn("font-mono", l2.isLive ? "text-amber-400" : "text-slate-400")}>
                      {l2.isLive && <Zap className="w-2 h-2 inline mr-0.5" />}
                      {l2.t1Pts} – {l2.t2Pts}
                    </span>
                  : <span className="text-slate-700">—</span>
                }
              </div>
            </div>
          )}

          {/* Fixtures created but no data yet */}
          {match.home_choice && !hasAnyData && (
            <p className="text-[10px] text-slate-600 italic pt-1">Fixtures live — waiting for results…</p>
          )}
        </>
      )}
    </div>
  )
}

export default function TeamKnockoutDashboard() {
  const { data, isLoading } = useTeamKnockoutCurrent()
  const matches = data?.matches || []

  const champMatches  = matches.filter(m => m.match_type?.startsWith("champions_"))
  const europaMatches = matches.filter(m => m.match_type?.startsWith("europa_"))
  const champFinal    = champMatches.find(m => m.match_type === "champions_final")
  const europaFinal   = europaMatches.find(m => m.match_type === "europa_final")

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
              <span className="text-xs text-emerald-400 font-semibold ml-auto">🏆 {champFinal.winnerName}</span>
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
              <span className="text-xs text-emerald-400 font-semibold ml-auto">🏆 {europaFinal.winnerName}</span>
            )}
          </div>
          {europaMatches.map(m => <MiniMatchRow key={m.id} match={m} />)}
        </div>
      )}

      <Link
        to="/team-knockout"
        className="flex items-center justify-center gap-2 text-xs text-slate-400 hover:text-white transition-colors pt-2"
      >
        View full bracket <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  )
}