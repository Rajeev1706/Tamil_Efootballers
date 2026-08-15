// components/admin/TeamKnockoutAdmin.jsx
import { useState } from "react"
import { Trophy, Trash2, RefreshCw, CheckCircle } from "lucide-react"
import { useTeamKnockoutCurrent, useGenerateTeamKnockout, useSaveTeamKnockoutLeg, useDeleteTeamKnockout } from "../../lib/queries"
import { TeamAvatar } from "../common/TeamLogo"
import { cn } from "../../lib/utils"

const MATCH_LABELS = {
  champions_sf1:   "Champions SF 1",
  champions_sf2:   "Champions SF 2",
  champions_final: "Champions Final",
  europa_sf1:      "Europa SF 1",
  europa_sf2:      "Europa SF 2",
  europa_final:    "Europa Final",
}

const MATCH_COLORS = {
  champions_sf1:   "border-amber-500/30 bg-amber-500/5",
  champions_sf2:   "border-amber-500/30 bg-amber-500/5",
  champions_final: "border-gold/50 bg-gold/10",
  europa_sf1:      "border-violet-500/30 bg-violet-500/5",
  europa_sf2:      "border-violet-500/30 bg-violet-500/5",
  europa_final:    "border-violet-400/50 bg-violet-400/10",
}

function LegInput({ label, value, onChange, disabled }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</span>
      <input
        type="number" min="0" value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-14 text-center bg-pitch-800 border border-surface-border rounded-lg px-2 py-1.5 text-sm text-white disabled:opacity-40"
      />
    </div>
  )
}

function MatchCard({ match }) {
  const saveLeg = useSaveTeamKnockoutLeg()
  const [leg1, setLeg1] = useState({ t1: match.team1_leg1 ?? "", t2: match.team2_leg1 ?? "" })
  const [leg2, setLeg2] = useState({ t1: match.team1_leg2 ?? "", t2: match.team2_leg2 ?? "" })

  const noTeams = !match.team1_id || !match.team2_id
  const completed = match.status === "completed"

  const handleSaveLeg = async (legNum) => {
    const scores = legNum === 1 ? leg1 : leg2
    if (scores.t1 === "" || scores.t2 === "") return
    await saveLeg.mutateAsync({
      matchId:    match.id,
      leg:        legNum,
      team1Score: parseInt(scores.t1),
      team2Score: parseInt(scores.t2),
    })
  }

  // Aggregate totals
  const t1Total = (parseInt(leg1.t1) || 0) + (parseInt(leg2.t1) || 0)
  const t2Total = (parseInt(leg1.t2) || 0) + (parseInt(leg2.t2) || 0)

  return (
    <div className={cn("rounded-xl border p-4", MATCH_COLORS[match.match_type])}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
          {MATCH_LABELS[match.match_type]}
        </span>
        {completed && (
          <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold">
            <CheckCircle className="w-3 h-3" /> Done
          </span>
        )}
      </div>

      {noTeams ? (
        <p className="text-xs text-slate-600 italic">Waiting for semi-final results…</p>
      ) : (
        <>
          {/* Teams */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TeamAvatar logoUrl={match.team1Logo} name={match.team1Name} size="w-8 h-8" />
              <span className="font-semibold text-sm text-white">{match.team1Name}</span>
            </div>
            {(leg1.t1 !== "" || leg2.t1 !== "") && (
              <span className="text-lg font-bold font-mono text-white">
                {t1Total} – {t2Total}
              </span>
            )}
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-white">{match.team2Name}</span>
              <TeamAvatar logoUrl={match.team2Logo} name={match.team2Name} size="w-8 h-8" />
            </div>
          </div>

          {/* Winner banner */}
          {completed && match.winnerName && (
            <div className="text-center text-xs text-gold font-semibold mb-3">
              🏆 {match.winnerName} advances
            </div>
          )}

          {/* Leg inputs */}
          {!completed && (
            <div className="space-y-3">
              {/* Leg 1 */}
              <div className="flex items-end gap-2 justify-center">
                <LegInput label="Leg 1 Home" value={leg1.t1} onChange={v => setLeg1(p => ({ ...p, t1: v }))} />
                <span className="text-slate-600 mb-2 text-sm">–</span>
                <LegInput label="Leg 1 Away" value={leg1.t2} onChange={v => setLeg1(p => ({ ...p, t2: v }))} />
                <button
                  onClick={() => handleSaveLeg(1)}
                  disabled={leg1.t1 === "" || leg1.t2 === "" || saveLeg.isPending}
                  className="mb-0.5 px-3 py-1.5 rounded-lg bg-accent text-pitch-900 text-xs font-bold disabled:opacity-40"
                >
                  Save
                </button>
              </div>
              {/* Leg 2 */}
              <div className="flex items-end gap-2 justify-center">
                <LegInput label="Leg 2 Home" value={leg2.t1} onChange={v => setLeg2(p => ({ ...p, t1: v }))} />
                <span className="text-slate-600 mb-2 text-sm">–</span>
                <LegInput label="Leg 2 Away" value={leg2.t2} onChange={v => setLeg2(p => ({ ...p, t2: v }))} />
                <button
                  onClick={() => handleSaveLeg(2)}
                  disabled={leg2.t1 === "" || leg2.t2 === "" || saveLeg.isPending || match.team1_leg1 === null}
                  className="mb-0.5 px-3 py-1.5 rounded-lg bg-accent text-pitch-900 text-xs font-bold disabled:opacity-40"
                >
                  Save
                </button>
              </div>
              <p className="text-[10px] text-slate-600 text-center">
                Save Leg 1 first, then Leg 2. Winner determined by total pts → GD → GF.
              </p>
            </div>
          )}

          {/* Completed leg scores */}
          {completed && (
            <div className="flex gap-4 justify-center text-xs text-slate-500">
              <span>Leg 1: {match.team1_leg1} – {match.team2_leg1}</span>
              <span>Leg 2: {match.team1_leg2} – {match.team2_leg2}</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function TeamKnockoutAdmin() {
  const { data, isLoading } = useTeamKnockoutCurrent()
  const generateKO = useGenerateTeamKnockout()
  const deleteKO   = useDeleteTeamKnockout()

  if (isLoading) return <p className="text-slate-500 text-sm">Loading…</p>

  const matches = data?.matches || []
  const hasMatches = matches.length > 0

  const champMatches = matches.filter(m => m.match_type.startsWith("champions_"))
  const europaMatches = matches.filter(m => m.match_type.startsWith("europa_"))

  // Group stage standings for reference
  const groups = data?.groups || {}

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-gold" /> Team Knockout
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Champions + Europa brackets for Group + Knockout format
          </p>
        </div>
        <div className="flex gap-2">
          {hasMatches && (
            <button
              onClick={() => { if (confirm("Delete all knockout fixtures for this season?")) deleteKO.mutate() }}
              disabled={deleteKO.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/30 text-rose-400 text-xs hover:bg-rose-500/10"
            >
              <Trash2 className="w-3.5 h-3.5" /> Reset
            </button>
          )}
          {!hasMatches && (
            <button
              onClick={() => generateKO.mutate()}
              disabled={generateKO.isPending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-pitch-900 text-sm font-bold hover:bg-accent/90 disabled:opacity-50"
            >
              <RefreshCw className={cn("w-4 h-4", generateKO.isPending && "animate-spin")} />
              {generateKO.isPending ? "Generating…" : "Generate Knockout Fixtures"}
            </button>
          )}
        </div>
      </div>

      {/* Group standings reference */}
      {!hasMatches && (groups.A?.length > 0 || groups.B?.length > 0) && (
        <div className="grid grid-cols-2 gap-4">
          {["A", "B"].map(grp => (
            <div key={grp} className="card p-4">
              <p className="text-xs font-bold text-slate-400 uppercase mb-2">Group {grp}</p>
              {(groups[grp] || []).map((team, i) => (
                <div key={team.team_id} className="flex items-center justify-between py-1 border-b border-surface-border/30 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs font-bold w-4", i < 2 ? "text-gold" : "text-violet-400")}>
                      {i + 1}
                    </span>
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
          <p className="text-slate-600 text-sm mt-1">
            Complete all group stage fixtures first, then generate the knockout bracket.
          </p>
        </div>
      )}

      {/* Champions bracket */}
      {champMatches.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gold mb-3 flex items-center gap-2">
            🏆 Champions Bracket
            <span className="text-xs text-slate-500 font-normal">(Top 2 from each group)</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {champMatches.map(m => <MatchCard key={m.id} match={m} />)}
          </div>
        </div>
      )}

      {/* Europa bracket */}
      {europaMatches.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-violet-400 mb-3 flex items-center gap-2">
            🥈 Europa Bracket
            <span className="text-xs text-slate-500 font-normal">(3rd & 4th from each group)</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {europaMatches.map(m => <MatchCard key={m.id} match={m} />)}
          </div>
        </div>
      )}

      {generateKO.isError && (
        <p className="text-rose-400 text-sm">{generateKO.error?.response?.data?.error || "Failed to generate"}</p>
      )}
    </div>
  )
}