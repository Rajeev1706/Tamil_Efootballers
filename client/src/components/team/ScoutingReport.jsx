import { useState } from "react"
import { Shield, AlertTriangle, CheckCircle, Swords, TrendingUp, Target, ChevronDown, X, Search } from "lucide-react"
import { useScoutingReport } from "../../lib/queries"
import { cn } from "../../lib/utils"
import PlayerAvatarIcon from "../common/PlayerAvatarIcon"
import GradeBadge from "../common/GradeBadge"
import { TeamLogoIcon } from "../common/TeamLogo"

// ── Threat Badge ─────────────────────────────────────────────────────────────
function ThreatBadge({ level }) {
  const cfg = {
    high:   { label: "HIGH",   cls: "text-rose-400 bg-rose-400/15 border-rose-400/30" },
    medium: { label: "MEDIUM", cls: "text-amber-400 bg-amber-400/15 border-amber-400/30" },
    low:    { label: "LOW",    cls: "text-emerald-400 bg-emerald-400/15 border-emerald-400/30" },
  }
  const c = cfg[level] || cfg.low
  return <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", c.cls)}>{c.label}</span>
}

// ── Form Display ─────────────────────────────────────────────────────────────
function FormDisplay({ form }) {
  if (!form || form.length === 0) return <span className="text-slate-600 text-xs">—</span>
  return (
    <div className="flex gap-0.5">
      {form.slice(0, 5).map((f, i) => (
        <span key={i} className={cn(
          "w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center",
          f === "W" ? "bg-emerald-400/20 text-emerald-400" :
          f === "D" ? "bg-amber-400/20 text-amber-400" :
                      "bg-rose-400/20 text-rose-400"
        )}>{f}</span>
      ))}
    </div>
  )
}

// ── H2H Cell ─────────────────────────────────────────────────────────────────
function H2HCell({ h2h }) {
  if (!h2h || (h2h.wins === 0 && h2h.losses === 0 && h2h.draws === 0)) {
    return <span className="text-slate-600 text-xs">No matches</span>
  }
  const dominant = h2h.wins > h2h.losses ? "win" : h2h.losses > h2h.wins ? "loss" : "even"
  return (
    <span className={cn(
      "text-xs font-bold px-2 py-1 rounded-lg border",
      dominant === "win"  ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/25" :
      dominant === "loss" ? "text-rose-400 bg-rose-400/10 border-rose-400/25" :
                            "text-amber-400 bg-amber-400/10 border-amber-400/25"
    )}>
      {h2h.wins}W {h2h.draws}D {h2h.losses}L
    </span>
  )
}

// ── Warning Card ─────────────────────────────────────────────────────────────
function WarningCard({ warning }) {
  const isDanger = warning.type === "danger"
  return (
    <div className={cn(
      "flex items-start gap-2.5 px-4 py-3 rounded-xl border text-sm",
      isDanger ? "bg-rose-400/5 border-rose-400/20" : "bg-emerald-400/5 border-emerald-400/20"
    )}>
      {isDanger
        ? <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
        : <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
      }
      <span className={isDanger ? "text-rose-300" : "text-emerald-300"}>{warning.text}</span>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function ScoutingReport({ myTeamId, oppTeamId, oppTeamName, onClose, onApplyRecommendations }) {
  const { data: report, isLoading, isError } = useScoutingReport(myTeamId, oppTeamId)
  const [expandedPlayer, setExpandedPlayer] = useState(null)

  if (isLoading) {
    return (
      <div className="card p-8 text-center">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-500">Generating scouting report...</p>
      </div>
    )
  }

  if (isError || !report) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm text-slate-500">Unable to generate report</p>
      </div>
    )
  }

  const { oppTeam, oppPlayers, myPlayers, h2hLookup, teamFixtures, recommendations, warnings } = report

  return (
    <div className="space-y-5">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
          <div className="flex items-center gap-3">
            <Search className="w-5 h-5 text-accent" />
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-widest">Scouting Report</p>
              <h2 className="text-lg font-bold text-white">{oppTeam.name}</h2>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-surface flex items-center justify-center text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Team stats */}
        <div className="grid grid-cols-4 gap-px bg-surface-border/50">
          {[
            { label: "Points", value: oppTeam.points || 0 },
            { label: "Record", value: `${oppTeam.wins || 0}W ${oppTeam.draws || 0}D ${oppTeam.losses || 0}L` },
            { label: "Goals For", value: oppTeam.gf || 0 },
            { label: "Goals Against", value: oppTeam.ga || 0 },
          ].map(s => (
            <div key={s.label} className="bg-pitch-900 px-4 py-3 text-center">
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className="text-sm font-bold text-white mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Key Alerts ────────────────────────────────────────────────────── */}
      {warnings.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-surface-border">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">Key Intel</h3>
          </div>
          <div className="p-4 space-y-2">
            {warnings.map((w, i) => <WarningCard key={i} warning={w} />)}
          </div>
        </div>
      )}

      {/* ── Threat Assessment ─────────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-surface-border">
          <Target className="w-4 h-4 text-rose-400" />
          <h3 className="text-sm font-semibold text-white">Opponent Players — Threat Assessment</h3>
        </div>
        <div className="divide-y divide-surface-border/50">
          {oppPlayers.map(p => {
            const isExpanded = expandedPlayer === p.id
            return (
              <div key={p.id}>
                <button
                  onClick={() => setExpandedPlayer(isExpanded ? null : p.id)}
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-surface-hover transition-colors text-left"
                >
                  <PlayerAvatarIcon player={p} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{p.name}</span>
                      <GradeBadge grade={p.grade} size="sm" />
                      <ThreatBadge level={p.threatLevel} />
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-slate-500">MV: <span className="text-slate-300">{p.market_value}</span></span>
                      <span className="text-xs text-slate-500">Win: <span className="text-slate-300">{p.winRate}%</span></span>
                      <span className="text-xs text-slate-500">GPM: <span className="text-slate-300">{p.goalsPerMatch}</span></span>
                    </div>
                  </div>
                  <FormDisplay form={p.form} />
                  <ChevronDown className={cn("w-4 h-4 text-slate-500 transition-transform", isExpanded && "rotate-180")} />
                </button>

                {isExpanded && (
                  <div className="bg-pitch-900/60 px-5 py-4 border-t border-surface-border/30">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                      <div className="bg-pitch-800 rounded-xl p-3 text-center">
                        <p className="text-lg font-bold text-white">{p.totalMatches}</p>
                        <p className="text-xs text-slate-500">Matches</p>
                      </div>
                      <div className="bg-pitch-800 rounded-xl p-3 text-center">
                        <p className="text-lg font-bold text-emerald-400">{p.wins}</p>
                        <p className="text-xs text-slate-500">Wins</p>
                      </div>
                      <div className="bg-pitch-800 rounded-xl p-3 text-center">
                        <p className="text-lg font-bold text-amber-400">{p.draws}</p>
                        <p className="text-xs text-slate-500">Draws</p>
                      </div>
                      <div className="bg-pitch-800 rounded-xl p-3 text-center">
                        <p className="text-lg font-bold text-rose-400">{p.losses}</p>
                        <p className="text-xs text-slate-500">Losses</p>
                      </div>
                    </div>

                    {/* How YOUR players have done against this opponent */}
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Your players vs {p.name}</p>
                    <div className="space-y-1.5">
                      {myPlayers.map(my => {
                        const h2h = h2hLookup[my.id]?.[p.id]
                        if (!h2h || (h2h.wins === 0 && h2h.losses === 0 && h2h.draws === 0)) return null
                        return (
                          <div key={my.id} className="flex items-center justify-between bg-pitch-800 rounded-lg px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-white">{my.name}</span>
                              <GradeBadge grade={my.grade} size="sm" />
                            </div>
                            <H2HCell h2h={h2h} />
                          </div>
                        )
                      })}
                      {myPlayers.every(my => {
                        const h2h = h2hLookup[my.id]?.[p.id]
                        return !h2h || (h2h.wins === 0 && h2h.losses === 0 && h2h.draws === 0)
                      }) && (
                        <p className="text-xs text-slate-600 py-2">No head-to-head history with any of your players</p>
                      )}
                    </div>

                    {/* Squad pic */}
                    {p.imageUrl && (
                      <div className="mt-4">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{p.name}'s Squad</p>
                        <img src={p.imageUrl} alt={`${p.name} squad`}
                          className="w-full max-w-md aspect-[20/9] object-cover rounded-xl border border-surface-border" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Recommended Lineup ────────────────────────────────────────────── */}
      {recommendations.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-surface-border">
            <Swords className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold text-white">Recommended Matchups</h3>
            <span className="text-xs text-slate-500 ml-1 flex-1">— based on H2H records & grade advantage</span>
            {onApplyRecommendations && (
              <button
                onClick={() =>
                  onApplyRecommendations(
                    recommendations.map(r => ({
                      myPlayerId:  r.myPlayer.id,
                      oppPlayerId: r.oppPlayer.id,
                    }))
                  )
                }
                className="flex items-center gap-1.5 text-xs font-semibold text-white bg-accent hover:bg-accent-dim px-3 py-1.5 rounded-lg transition-all flex-shrink-0"
              >
                <Swords className="w-3 h-3" /> Apply to Lineup
              </button>
            )}
          </div>
          <div className="divide-y divide-surface-border/50">
            {recommendations.map((rec, i) => {
              const h2h = rec.h2h
              const hasH2H = h2h.wins + h2h.losses + h2h.draws > 0
              return (
                <div key={i} className="flex items-center gap-3 px-5 py-3">
                  <span className="text-xs text-slate-600 font-mono w-6">#{i + 1}</span>

                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <span className="text-sm font-medium text-white truncate">{rec.myPlayer.name}</span>
                    <GradeBadge grade={rec.myPlayer.grade} size="sm" />
                  </div>

                  <div className="flex flex-col items-center px-3">
                    <span className="text-xs text-slate-600">vs</span>
                    {hasH2H && <H2HCell h2h={h2h} />}
                  </div>

                  <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                    <span className="text-sm font-medium text-white truncate">{rec.oppPlayer.name}</span>
                    <GradeBadge grade={rec.oppPlayer.grade} size="sm" />
                    <ThreatBadge level={rec.oppPlayer.threatLevel} />
                  </div>

                  <span className="text-[10px] text-slate-500 w-28 text-right flex-shrink-0">{rec.reason}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Past Meetings ─────────────────────────────────────────────────── */}
      {teamFixtures.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-surface-border">
            <Shield className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-semibold text-white">Past Meetings</h3>
          </div>
          <div className="divide-y divide-surface-border/50">
            {teamFixtures.map((f, i) => {
              const myScore  = f.isHome ? f.homeScore : f.awayScore
              const oppScore = f.isHome ? f.awayScore : f.homeScore
              const result = myScore > oppScore ? "win" : oppScore > myScore ? "loss" : "draw"
              return (
                <div key={i} className="flex items-center gap-3 px-5 py-3">
                  <span className="text-xs text-slate-600 w-20 flex-shrink-0">
                    {f.date ? new Date(f.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : `R${f.round}`}
                  </span>
                  <span className="text-sm text-slate-400 flex-1">
                    {f.homeTeam} vs {f.awayTeam}
                  </span>
                  <span className="text-sm font-mono font-bold text-white">
                    {f.homeScore ?? "?"} - {f.awayScore ?? "?"}
                  </span>
                  <span className={cn(
                    "text-xs font-bold px-2 py-0.5 rounded border",
                    result === "win"  ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/25" :
                    result === "loss" ? "text-rose-400 bg-rose-400/10 border-rose-400/25" :
                                        "text-amber-400 bg-amber-400/10 border-amber-400/25"
                  )}>
                    {result.toUpperCase()}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}