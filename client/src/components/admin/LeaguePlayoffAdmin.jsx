// components/admin/LeaguePlayoffAdmin.jsx
// Admin panel for the league_knockout format playoffs (Q1 → Eliminator → Q2 → Final)
// 2-leg coin toss flow — mirrors TeamKnockoutAdmin.jsx
import { useState } from "react"
import { Trophy, Trash2, RefreshCw, CheckCircle, Coins } from "lucide-react"
import {
  useTeamLeaguePlayoffs,
  useGenerateLeaguePlayoffs,
  useResetLeaguePlayoffs,
  useTossLeaguePlayoffMatch,
  useTossChoiceLeaguePlayoffMatch,
  useForceLeaguePlayoffWinner,
} from "../../lib/queries"
import { TeamAvatar } from "../common/TeamLogo"
import { cn } from "../../lib/utils"

const MATCH_LABELS = {
  qualifier1: "Qualifier 1  (1st vs 2nd)",
  eliminator: "Eliminator   (3rd vs 4th)",
  qualifier2: "Qualifier 2  (Q1 loser vs Eliminator winner)",
  final:      "Final        (Q1 winner vs Q2 winner)",
}

const MATCH_COLORS = {
  qualifier1: "border-gold/40 bg-gold/5",
  eliminator: "border-violet-500/30 bg-violet-500/5",
  qualifier2: "border-sky-500/30 bg-sky-500/5",
  final:      "border-emerald-500/40 bg-emerald-500/5",
}

// ── Coin flip animation ────────────────────────────────────────────────────────
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

// ── Single playoff match card ──────────────────────────────────────────────────
function PlayoffMatchCard({ match }) {
  const toss        = useTossLeaguePlayoffMatch()
  const tossChoice  = useTossChoiceLeaguePlayoffMatch()
  const forceWinner = useForceLeaguePlayoffWinner()
  const [showToss, setShowToss]   = useState(false)
  const [isRedoing, setIsRedoing] = useState(false)

  const noTeams       = !match.team1Id || !match.team2Id
  const completed     = match.status === "completed"
  const needsDecision = match.status === "needs_decision"
  const tossDone      = match.tossDone
  const choiceDone    = !!match.homeChoice

  const handleToss = async () => {
    await toss.mutateAsync(match.id)
    setShowToss(false)
    setIsRedoing(false)
  }

  return (
    <div className={cn("rounded-xl border p-4 space-y-3", MATCH_COLORS[match.matchType])}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
          {MATCH_LABELS[match.matchType] || match.matchType}
        </span>
        {completed && (
          <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold">
            <CheckCircle className="w-3 h-3" /> Done
          </span>
        )}
        {needsDecision && (
          <span className="text-xs text-rose-400 font-semibold animate-pulse">⚠ Tie — Pick Winner</span>
        )}
      </div>

      {noTeams ? (
        <p className="text-xs text-slate-600 italic">Waiting for earlier result…</p>
      ) : (
        <>
          {/* Teams row */}
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
          {completed && (
            <div className="text-center text-xs text-gold font-semibold bg-gold/10 border border-gold/20 rounded-lg py-2">
              🏆 {match.winnerTeamId === match.team1Id ? match.team1Name : match.team2Name} advances
            </div>
          )}

          {/* Leg scores */}
          {(completed || needsDecision || (choiceDone && (match.team1Leg1 !== null || match.team1Leg2 !== null))) && (
            <div className="flex gap-4 justify-center text-xs text-slate-500">
              <span>Leg 1: {match.team1Leg1 ?? "—"} – {match.team2Leg1 ?? "—"}</span>
              <span>Leg 2: {match.team1Leg2 ?? "—"} – {match.team2Leg2 ?? "—"}</span>
            </div>
          )}

          {/* Tie-breaker */}
          {needsDecision && (
            <div className="space-y-2">
              <p className="text-xs text-slate-400 text-center">Teams level on aggregate. Admin picks the winner:</p>
              <div className="flex gap-2">
                {[{ id: match.team1Id, name: match.team1Name }, { id: match.team2Id, name: match.team2Name }].map(t => (
                  <button key={t.id}
                    onClick={() => { if (confirm(`Confirm ${t.name} advances?`)) forceWinner.mutate({ matchId: match.id, winnerId: t.id }) }}
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

              {(!tossDone || isRedoing) && !choiceDone ? (
                (showToss || isRedoing)
                  ? <CoinFlip onDone={handleToss} />
                  : <button onClick={() => setShowToss(true)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-pitch-900 font-bold text-sm hover:bg-accent/90">
                      <Coins className="w-4 h-4" /> Start Toss
                    </button>
              ) : choiceDone ? null : (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-2 py-2 rounded-lg bg-gold/10 border border-gold/20">
                    <span className="text-lg">🥇</span>
                    <span className="text-sm font-bold text-gold">{match.tossWinnerName} wins the toss!</span>
                  </div>
                  <p className="text-xs text-slate-400 text-center">{match.tossWinnerName}, choose when to play home:</p>
                  <div className="flex gap-2">
                    {[{ val: "leg1", label: "🏠 Home in Leg 1" }, { val: "leg2", label: "✈ Home in Leg 2" }].map(({ val, label }) => (
                      <button key={val}
                        onClick={() => tossChoice.mutate({ matchId: match.id, homeChoice: val })}
                        disabled={tossChoice.isPending}
                        className="flex-1 py-2.5 rounded-xl border border-accent/30 bg-accent/10 text-accent text-xs font-bold hover:bg-accent/20 disabled:opacity-50">
                        {label}
                      </button>
                    ))}
                  </div>
                  {/* Redo toss before home choice is locked */}
                  <button
                    onClick={() => { if (confirm("Redo the coin toss? The current result will be replaced.")) setIsRedoing(true) }}
                    disabled={toss.isPending}
                    className="w-full text-[10px] text-slate-600 hover:text-slate-400 transition-colors pt-1 underline underline-offset-2">
                    Redo toss
                  </button>
                </div>
              )}

              {toss.isError && (
                <p className="text-rose-400 text-xs text-center">{toss.error?.response?.data?.error || "Toss failed"}</p>
              )}
            </div>
          )}

          {/* Fixtures created */}
          {!completed && !needsDecision && choiceDone && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                <CheckCircle className="w-3.5 h-3.5" />
                <span className="font-semibold">
                  {match.tossWinnerName} plays home in Leg {match.homeChoice === "leg1" ? "1" : "2"}
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
export default function LeaguePlayoffAdmin() {
  const { data, isLoading } = useTeamLeaguePlayoffs()
  const generate = useGenerateLeaguePlayoffs()
  const reset    = useResetLeaguePlayoffs()

  if (isLoading) return <p className="text-slate-500 text-sm">Loading…</p>

  const matches    = data?.matches || []
  const hasMatches = matches.length > 0

  const ORDER  = ["qualifier1", "eliminator", "qualifier2", "final"]
  const sorted = [...matches].sort((a, b) => ORDER.indexOf(a.matchType) - ORDER.indexOf(b.matchType))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-gold" /> League Playoffs
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">2-leg ties · coin toss for home advantage</p>
        </div>
        <div className="flex gap-2">
          {hasMatches && (
            <button
              onClick={() => { if (confirm("Reset all playoff results for this season? This cannot be undone.")) reset.mutate() }}
              disabled={reset.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/30 text-rose-400 text-xs hover:bg-rose-500/10 disabled:opacity-50">
              <Trash2 className="w-3.5 h-3.5" /> Reset
            </button>
          )}
          {!hasMatches && (
            <button
              onClick={() => generate.mutate()}
              disabled={generate.isPending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-pitch-900 text-sm font-bold hover:bg-accent/90 disabled:opacity-50">
              <RefreshCw className={cn("w-4 h-4", generate.isPending && "animate-spin")} />
              {generate.isPending ? "Generating…" : "Generate Playoff Bracket"}
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {generate.isError && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-400">
          {generate.error?.response?.data?.error || "Failed to generate playoffs. Make sure all league fixtures are completed."}
        </div>
      )}

      {/* Empty state */}
      {!hasMatches && !generate.isPending && (
        <div className="card p-8 text-center">
          <Trophy className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 font-semibold">No playoff bracket yet</p>
          <p className="text-slate-600 text-sm mt-1">
            Complete all league fixtures, then click <strong className="text-slate-400">Generate Playoff Bracket</strong>.
          </p>
        </div>
      )}

      {/* Match cards */}
      {hasMatches && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sorted.map(m => <PlayoffMatchCard key={m.id} match={m} />)}
        </div>
      )}
    </div>
  )
}