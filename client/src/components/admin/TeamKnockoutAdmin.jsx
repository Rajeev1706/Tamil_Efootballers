// components/admin/TeamKnockoutAdmin.jsx
import { useState } from "react"
import { Trophy, Trash2, RefreshCw, CheckCircle, Coins } from "lucide-react"
import {
  useTeamKnockoutCurrent, useGenerateTeamKnockout, useDeleteTeamKnockout,
  useTossKnockoutMatch, useTossChoiceKnockoutMatch, useForceKnockoutWinner,
} from "../../lib/queries"
import { TeamAvatar } from "../common/TeamLogo"
import { cn } from "../../lib/utils"

const MATCH_LABELS = {
  champions_sf1:   "Champions SF 1",  champions_sf2:   "Champions SF 2",
  champions_final: "Champions Final", champions_3rd:   "3rd / 4th Place",
  europa_sf1:      "Europa SF 1",     europa_sf2:      "Europa SF 2",
  europa_final:    "Europa Final",    europa_7th:      "7th / 8th Place",
}
const MATCH_COLORS = {
  champions_sf1:   "border-amber-500/30 bg-amber-500/5",
  champions_sf2:   "border-amber-500/30 bg-amber-500/5",
  champions_final: "border-gold/50 bg-gold/10",
  champions_3rd:   "border-slate-500/30 bg-slate-500/5",
  europa_sf1:      "border-violet-500/30 bg-violet-500/5",
  europa_sf2:      "border-violet-500/30 bg-violet-500/5",
  europa_final:    "border-violet-400/50 bg-violet-400/10",
  europa_7th:      "border-slate-500/30 bg-slate-500/5",
}

// ── Coin flip animation component ─────────────────────────────────────────────
function CoinFlip({ onDone }) {
  const [phase, setPhase] = useState("idle")

  const handleFlip = () => {
    setPhase("flipping")
    setTimeout(() => { setPhase("done"); onDone() }, 2200)
  }

  return (
    <div className="flex flex-col items-center gap-4 py-3">
      <style>{`
        @keyframes coinFlip {
          0%   { transform: rotateY(0deg); }
          25%  { transform: rotateY(720deg) scaleX(0.05); }
          50%  { transform: rotateY(1440deg) scaleX(1); }
          75%  { transform: rotateY(2160deg) scaleX(0.05); }
          100% { transform: rotateY(2880deg) scaleX(1); }
        }
        .coin-spin { animation: coinFlip 2.2s cubic-bezier(0.4,0,0.2,1) forwards; }
      `}</style>

      <div className={cn(
        "w-20 h-20 rounded-full flex items-center justify-center text-3xl shadow-lg",
        "bg-gradient-to-br from-yellow-400 to-amber-600 border-4 border-amber-300",
        phase === "flipping" && "coin-spin"
      )}>
        🪙
      </div>

      {phase === "idle" && (
        <button onClick={handleFlip}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-accent text-pitch-900 font-bold text-sm hover:bg-accent/90">
          <Coins className="w-4 h-4" /> Flip Coin
        </button>
      )}
      {phase === "flipping" && <p className="text-sm text-slate-400 animate-pulse">Flipping…</p>}
    </div>
  )
}

// ── Match card ────────────────────────────────────────────────────────────────
function MatchCard({ match }) {
  const toss        = useTossKnockoutMatch()
  const tossChoice  = useTossChoiceKnockoutMatch()
  const forceWinner = useForceKnockoutWinner()
  const [showToss, setShowToss] = useState(false)

  const noTeams       = !match.team1_id || !match.team2_id
  const completed     = match.status === "completed"
  const needsDecision = match.status === "needs_decision"
  const tossDone      = match.toss_done
  const choiceDone    = !!match.home_choice
  const isChampions   = match.match_type.startsWith("champions_")

  const handleToss = async () => { await toss.mutateAsync(match.id); setShowToss(false) }

  return (
    <div className={cn("rounded-xl border p-4 space-y-3", MATCH_COLORS[match.match_type])}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className={cn("text-xs font-bold uppercase tracking-wide", isChampions ? "text-amber-400" : "text-violet-400")}>
          {MATCH_LABELS[match.match_type]}
        </span>
        {completed && <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold"><CheckCircle className="w-3 h-3" /> Done</span>}
        {needsDecision && <span className="text-xs text-rose-400 font-semibold animate-pulse">⚠ Tie — Pick Winner</span>}
      </div>

      {noTeams ? (
        <p className="text-xs text-slate-600 italic">Waiting for semi-final results…</p>
      ) : (
        <>
          {/* Teams */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TeamAvatar logoUrl={match.team1Logo} name={match.team1Name} size="w-8 h-8" />
              <span className="font-semibold text-sm text-white">{match.team1Name}</span>
            </div>
            <span className="text-slate-600 text-xs font-mono">vs</span>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-white">{match.team2Name}</span>
              <TeamAvatar logoUrl={match.team2Logo} name={match.team2Name} size="w-8 h-8" />
            </div>
          </div>

          {/* Winner banner */}
          {completed && match.winnerName && (
            <div className="text-center text-xs text-gold font-semibold bg-gold/10 border border-gold/20 rounded-lg py-2">
              🏆 {match.winnerName} advances
            </div>
          )}

          {/* Leg scores */}
          {(completed || needsDecision || (choiceDone && (match.team1_leg1 !== null || match.team1_leg2 !== null))) && (
            <div className="flex gap-4 justify-center text-xs text-slate-500">
              <span>Leg 1: {match.team1_leg1 ?? "—"} – {match.team2_leg1 ?? "—"}</span>
              <span>Leg 2: {match.team1_leg2 ?? "—"} – {match.team2_leg2 ?? "—"}</span>
            </div>
          )}

          {/* Tie breaker */}
          {needsDecision && (
            <div className="space-y-2">
              <p className="text-xs text-slate-400 text-center">Teams level on GD. Admin picks the winner:</p>
              <div className="flex gap-2">
                {[{id: match.team1_id, name: match.team1Name}, {id: match.team2_id, name: match.team2Name}].map(t => (
                  <button key={t.id}
                    onClick={() => { if (confirm(`Confirm ${t.name} advances?`)) forceWinner.mutate({matchId: match.id, winnerId: t.id}) }}
                    disabled={forceWinner.isPending}
                    className="flex-1 py-2 rounded-lg bg-accent/15 border border-accent/30 text-accent text-xs font-semibold hover:bg-accent/25 disabled:opacity-50">
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Toss flow */}
          {!completed && !needsDecision && !choiceDone && (
            <div className="border border-surface-border/40 rounded-xl p-3 bg-pitch-900/40 space-y-3">
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide text-center">🪙 Coin Toss</p>

              {!tossDone ? (
                showToss
                  ? <CoinFlip onDone={handleToss} />
                  : <button onClick={() => setShowToss(true)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-pitch-900 font-bold text-sm hover:bg-accent/90">
                      <Coins className="w-4 h-4" /> Start Toss
                    </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-2 py-2 rounded-lg bg-gold/10 border border-gold/20">
                    <span className="text-lg">🥇</span>
                    <span className="text-sm font-bold text-gold">{match.tossWinnerName} wins the toss!</span>
                  </div>
                  <p className="text-xs text-slate-400 text-center">{match.tossWinnerName}, choose when to play home:</p>
                  <div className="flex gap-2">
                    {[{val:"leg1", label:"🏠 Home in Leg 1"}, {val:"leg2", label:"✈ Home in Leg 2"}].map(({val,label}) => (
                      <button key={val} onClick={() => tossChoice.mutate({matchId: match.id, homeChoice: val})}
                        disabled={tossChoice.isPending}
                        className="flex-1 py-2.5 rounded-xl border border-accent/30 bg-accent/10 text-accent text-xs font-bold hover:bg-accent/20 disabled:opacity-50">
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Fixtures created */}
          {!completed && !needsDecision && choiceDone && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                <CheckCircle className="w-3.5 h-3.5" />
                <span className="font-semibold">
                  {match.tossWinnerName} plays home in Leg {match.home_choice === "leg1" ? "1" : "2"}
                </span>
              </div>
              <div className="rounded-lg bg-pitch-800/60 border border-surface-border/30 px-3 py-2 text-xs text-slate-500 text-center">
                Fixtures are live in Team Dashboards. Team owners log player results,
                admin closes each leg from the Fixtures tab.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function TeamKnockoutAdmin() {
  const { data, isLoading } = useTeamKnockoutCurrent()
  const generateKO = useGenerateTeamKnockout()
  const deleteKO   = useDeleteTeamKnockout()

  if (isLoading) return <p className="text-slate-500 text-sm">Loading…</p>

  const matches       = data?.matches || []
  const hasMatches    = matches.length > 0
  const champMatches  = matches.filter(m => m.match_type.startsWith("champions_"))
  const europaMatches = matches.filter(m => m.match_type.startsWith("europa_"))
  const groups        = data?.groups || {}

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-gold" /> Team Knockout
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">2-leg ties · coin toss for home advantage</p>
        </div>
        <div className="flex gap-2">
          {hasMatches && (
            <button onClick={() => { if (confirm("Delete all knockout fixtures?")) deleteKO.mutate() }}
              disabled={deleteKO.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/30 text-rose-400 text-xs hover:bg-rose-500/10">
              <Trash2 className="w-3.5 h-3.5" /> Reset
            </button>
          )}
          {!hasMatches && (
            <button onClick={() => generateKO.mutate()} disabled={generateKO.isPending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-pitch-900 text-sm font-bold hover:bg-accent/90 disabled:opacity-50">
              <RefreshCw className={cn("w-4 h-4", generateKO.isPending && "animate-spin")} />
              {generateKO.isPending ? "Generating…" : "Generate Knockout Fixtures"}
            </button>
          )}
        </div>
      </div>

      {/* Group standings reference */}
      {!hasMatches && (groups.A?.length > 0 || groups.B?.length > 0) && (
        <div className="grid grid-cols-2 gap-4">
          {["A","B"].map(grp => (
            <div key={grp} className="card p-4">
              <p className="text-xs font-bold text-slate-400 uppercase mb-2">Group {grp}</p>
              {(groups[grp]||[]).map((team,i) => (
                <div key={team.team_id} className="flex items-center justify-between py-1 border-b border-surface-border/30 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs font-bold w-4", i < 2 ? "text-gold" : "text-violet-400")}>{i+1}</span>
                    <TeamAvatar logoUrl={team.logoUrl} name={team.team_name} size="w-5 h-5" />
                    <span className="text-xs text-white">{team.team_name}</span>
                  </div>
                  <span className="text-xs font-mono text-slate-400">{team.pts}pts</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {!hasMatches && !generateKO.isPending && (
        <div className="card p-8 text-center">
          <Trophy className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 font-semibold">No knockout fixtures yet</p>
          <p className="text-slate-600 text-sm mt-1">Complete all group stage fixtures first.</p>
        </div>
      )}

      {champMatches.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gold mb-3">🏆 Champions Bracket <span className="text-xs text-slate-500 font-normal">(Top 2 from each group)</span></h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-3">{champMatches.filter(m => m.match_type.includes("_sf")).map(m => <MatchCard key={m.id} match={m}/>)}</div>
            <div className="space-y-3">{champMatches.filter(m => !m.match_type.includes("_sf")).map(m => <MatchCard key={m.id} match={m}/>)}</div>
          </div>
        </div>
      )}

      {europaMatches.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-violet-400 mb-3">🥈 Europa Bracket <span className="text-xs text-slate-500 font-normal">(3rd & 4th from each group)</span></h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-3">{europaMatches.filter(m => m.match_type.includes("_sf")).map(m => <MatchCard key={m.id} match={m}/>)}</div>
            <div className="space-y-3">{europaMatches.filter(m => !m.match_type.includes("_sf")).map(m => <MatchCard key={m.id} match={m}/>)}</div>
          </div>
        </div>
      )}

      {generateKO.isError && (
        <p className="text-rose-400 text-sm">{generateKO.error?.response?.data?.error || "Failed to generate"}</p>
      )}
    </div>
  )
}