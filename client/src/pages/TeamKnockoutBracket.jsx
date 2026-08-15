// pages/TeamKnockoutBracket.jsx
import { useState } from "react"
import { useTeamKnockoutCurrent } from "../lib/queries"
import Layout from "../components/layout/Layout"
import { TeamAvatar } from "../components/common/TeamLogo"
import { Trophy, Shield } from "lucide-react"
import { cn } from "../lib/utils"
import teamLeagueTrophy from "../../images/Team League.png"
import europaTrophy     from "../../images/europa.png"

const MATCH_LABELS = {
  champions_sf1:   "Semi-Final 1",
  champions_sf2:   "Semi-Final 2",
  champions_final: "Final",
  europa_sf1:      "Semi-Final 1",
  europa_sf2:      "Semi-Final 2",
  europa_final:    "Final",
}

function TeamRow({ name, logoUrl, isWinner, leg1, leg2, side = "left" }) {
  const total = (leg1 ?? 0) + (leg2 ?? 0)
  return (
    <div className={cn(
      "flex items-center gap-2 py-2.5 px-3",
      side === "right" && "flex-row-reverse",
      isWinner && "text-emerald-400",
      !isWinner && name && "text-white",
      !name && "text-slate-600 italic"
    )}>
      <TeamAvatar logoUrl={logoUrl} name={name} size="w-7 h-7" />
      <span className="font-semibold text-sm truncate flex-1">{name || "TBD"}</span>
      {leg1 !== null && leg2 !== null && (
        <span className={cn("font-mono font-bold text-base ml-auto flex-shrink-0", isWinner ? "text-emerald-400" : "text-slate-300")}>
          {total}
        </span>
      )}
    </div>
  )
}

function MatchCard({ match, label }) {
  const completed = match.status === "completed"
  const pending   = !match.team1_id || !match.team2_id
  const bothLegs  = match.team1_leg1 !== null && match.team1_leg2 !== null

  return (
    <div className={cn(
      "rounded-xl border overflow-hidden",
      match.match_type?.includes("final")
        ? (match.match_type?.startsWith("champions") ? "border-gold/40 bg-gold/5" : "border-violet-400/40 bg-violet-400/5")
        : "border-surface-border bg-surface-card"
    )}>
      {/* Label */}
      <div className="px-3 py-1.5 border-b border-surface-border/50 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</span>
        {completed && <span className="text-[10px] text-emerald-400 font-semibold">✓ Full Time</span>}
      </div>

      {pending ? (
        <div className="px-3 py-4 text-center text-xs text-slate-600 italic">
          Waiting for semi-final results…
        </div>
      ) : (
        <>
          <TeamRow
            name={match.team1Name} logoUrl={match.team1Logo}
            isWinner={completed && match.winner_id === match.team1_id}
            leg1={match.team1_leg1} leg2={match.team1_leg2}
          />
          <div className="flex items-center px-3 py-1 border-t border-b border-surface-border/30">
            {bothLegs ? (
              <div className="w-full flex justify-between text-[10px] text-slate-500">
                <span>Leg 1: {match.team1_leg1}–{match.team2_leg1}</span>
                <span>Leg 2: {match.team1_leg2}–{match.team2_leg2}</span>
              </div>
            ) : (
              <span className="text-xs text-slate-600 mx-auto">vs</span>
            )}
          </div>
          <TeamRow
            name={match.team2Name} logoUrl={match.team2Logo}
            isWinner={completed && match.winner_id === match.team2_id}
            leg1={match.team2_leg1} leg2={match.team2_leg2}
          />

          {/* Winner banner */}
          {completed && match.winnerName && (
            <div className={cn(
              "px-3 py-1.5 text-center text-xs font-bold border-t border-surface-border/30",
              match.match_type?.startsWith("champions") ? "text-gold" : "text-violet-400"
            )}>
              🏆 {match.winnerName} wins
            </div>
          )}
        </>
      )}
    </div>
  )
}

function BracketSection({ title, icon, matches, color }) {
  const sf1   = matches.find(m => m.match_type?.endsWith("_sf1"))
  const sf2   = matches.find(m => m.match_type?.endsWith("_sf2"))
  const final = matches.find(m => m.match_type?.endsWith("_final"))

  if (!sf1 && !sf2 && !final) return null

  return (
    <div className="mb-8">
      {/* Section header */}
      <div className={cn("flex items-center gap-2 mb-4 pb-2 border-b", color === "gold" ? "border-gold/20" : "border-violet-400/20")}>
        <img src={icon} alt={title} className="w-6 h-6 object-contain" />
        <h2 className={cn("font-bold text-base", color === "gold" ? "text-gold" : "text-violet-400")}>{title}</h2>
        <span className="text-xs text-slate-500 ml-1">
          {color === "gold" ? "(Top 2 from each group)" : "(3rd & 4th from each group)"}
        </span>
      </div>

      {/* Bracket grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
        {/* SF1 */}
        <div>
          {sf1 && <MatchCard match={sf1} label={MATCH_LABELS[sf1.match_type]} />}
        </div>

        {/* Final — center */}
        <div className="sm:mt-6">
          {final && <MatchCard match={final} label={MATCH_LABELS[final.match_type]} />}
        </div>

        {/* SF2 */}
        <div>
          {sf2 && <MatchCard match={sf2} label={MATCH_LABELS[sf2.match_type]} />}
        </div>
      </div>
    </div>
  )
}

export default function TeamKnockoutBracket() {
  const { data, isLoading } = useTeamKnockoutCurrent()
  const matches = data?.matches || []
  const groups  = data?.groups  || {}

  const champMatches  = matches.filter(m => m.match_type?.startsWith("champions_"))
  const europaMatches = matches.filter(m => m.match_type?.startsWith("europa_"))

  const hasData = matches.length > 0

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Page header */}
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-6 h-6 text-gold" />
          <div>
            <h1 className="text-xl font-bold text-white">Team Knockout</h1>
            <p className="text-xs text-slate-500">Champions & Europa brackets</p>
          </div>
        </div>

        {isLoading && (
          <div className="text-slate-500 text-sm text-center py-12">Loading…</div>
        )}

        {!isLoading && !hasData && (
          <div className="card p-12 text-center">
            <Trophy className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 font-semibold">Knockout fixtures not yet generated</p>
            <p className="text-slate-600 text-sm mt-1">
              Complete all group stage fixtures first. Admin will generate the bracket when ready.
            </p>

            {/* Show group standings as preview */}
            {(groups.A?.length > 0 || groups.B?.length > 0) && (
              <div className="grid grid-cols-2 gap-4 mt-6 text-left">
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
                          <span className="text-xs text-white truncate">{team.team_name}</span>
                        </div>
                        <span className="text-xs font-mono text-slate-400">{team.pts}pts</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {hasData && (
          <>
            <BracketSection
              title="Champions Bracket"
              icon={teamLeagueTrophy}
              matches={champMatches}
              color="gold"
            />
            <BracketSection
              title="Europa Bracket"
              icon={europaTrophy}
              matches={europaMatches}
              color="violet"
            />
          </>
        )}
      </div>
    </Layout>
  )
}