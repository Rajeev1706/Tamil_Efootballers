// components/admin/LeaguePlayoffAdmin.jsx
// Admin panel for the league_knockout format playoffs (Q1 → Eliminator → Q2 → Final)
import { useState } from "react"
import { Trophy, Trash2, RefreshCw, CheckCircle } from "lucide-react"
import {
  useTeamLeaguePlayoffs,
  useGenerateLeaguePlayoffs,
  useResetLeaguePlayoffs,
  useLeaguePlayoffResult,
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

// ── Single match card with inline score entry ──────────────────────────────
function PlayoffMatchCard({ match }) {
  const saveResult  = useLeaguePlayoffResult()
  const [t1, setT1] = useState("")
  const [t2, setT2] = useState("")

  const noTeams   = !match.team1Id || !match.team2Id
  const completed = match.status === "completed"

  const handleSave = () => {
    const s1 = parseInt(t1), s2 = parseInt(t2)
    if (isNaN(s1) || isNaN(s2) || s1 === s2) {
      alert("Enter two different whole-number scores (draws not allowed in playoffs).")
      return
    }
    saveResult.mutate({ id: match.id, team1Score: s1, team2Score: s2 })
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
      </div>

      {noTeams ? (
        <p className="text-xs text-slate-600 italic">Waiting for earlier result…</p>
      ) : (
        <>
          {/* Teams */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <TeamAvatar logoUrl={match.team1Logo} name={match.team1Name} size="w-8 h-8" />
              <span className="font-semibold text-sm text-white truncate">{match.team1Name}</span>
            </div>
            <span className="text-slate-600 text-xs font-mono shrink-0">vs</span>
            <div className="flex items-center gap-2 min-w-0 justify-end">
              <span className="font-semibold text-sm text-white truncate">{match.team2Name}</span>
              <TeamAvatar logoUrl={match.team2Logo} name={match.team2Name} size="w-8 h-8" />
            </div>
          </div>

          {/* Result banner */}
          {completed && (
            <div className="text-center text-xs text-gold font-semibold bg-gold/10 border border-gold/20 rounded-lg py-2">
              🏆 {match.team1Score} – {match.team2Score}
              {" · "}
              {match.winnerTeamId === match.team1Id ? match.team1Name : match.team2Name} advances
            </div>
          )}

          {/* Score entry (only if not yet done) */}
          {!completed && (
            <div className="flex items-center gap-2">
              <input
                type="number" min="0"
                value={t1} onChange={e => setT1(e.target.value)}
                placeholder={match.team1Name?.split(" ")[0]}
                className="flex-1 bg-pitch-900 border border-surface-border/40 rounded-lg px-2 py-1.5 text-sm text-center text-white focus:outline-none focus:border-accent/60"
              />
              <span className="text-slate-600 text-xs">–</span>
              <input
                type="number" min="0"
                value={t2} onChange={e => setT2(e.target.value)}
                placeholder={match.team2Name?.split(" ")[0]}
                className="flex-1 bg-pitch-900 border border-surface-border/40 rounded-lg px-2 py-1.5 text-sm text-center text-white focus:outline-none focus:border-accent/60"
              />
              <button
                onClick={handleSave}
                disabled={saveResult.isPending || !t1 || !t2}
                className="px-3 py-1.5 rounded-lg bg-accent text-pitch-900 text-xs font-bold hover:bg-accent/90 disabled:opacity-50 shrink-0"
              >
                {saveResult.isPending ? "…" : "Save"}
              </button>
            </div>
          )}

          {saveResult.isError && (
            <p className="text-rose-400 text-xs">{saveResult.error?.response?.data?.error || "Save failed"}</p>
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

  // Order: qualifier1 → eliminator → qualifier2 → final
  const ORDER = ["qualifier1", "eliminator", "qualifier2", "final"]
  const sorted = [...matches].sort((a, b) => ORDER.indexOf(a.matchType) - ORDER.indexOf(b.matchType))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-gold" /> League Playoffs
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Qualifier 1 · Eliminator · Qualifier 2 · Final
          </p>
        </div>
        <div className="flex gap-2">
          {hasMatches && (
            <button
              onClick={() => { if (confirm("Reset all playoff results for this season? This cannot be undone.")) reset.mutate() }}
              disabled={reset.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/30 text-rose-400 text-xs hover:bg-rose-500/10 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" /> Reset
            </button>
          )}
          {!hasMatches && (
            <button
              onClick={() => generate.mutate()}
              disabled={generate.isPending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-pitch-900 text-sm font-bold hover:bg-accent/90 disabled:opacity-50"
            >
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