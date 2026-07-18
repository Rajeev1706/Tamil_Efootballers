import { useState } from "react"
import { Target, Trophy } from "lucide-react"
import { cn } from "../../lib/utils"
import { useTopScorers, useTeamLeaguePlayoffs, useFixtures } from "../../lib/queries"
import { TeamAvatar, TeamLogoIcon } from "../common/TeamLogo"
import PlayerAvatarIcon from "../common/PlayerAvatarIcon"
import teamLeagueTrophy from "../../../images/Team League.png"
import goldenBoot from "../../../images/Golden Boot.png"

// One playoff match card — shows both teams, the score once played, and
// highlights the winner in green. `label` is the match name shown above it.
function PlayoffMatchCard({ label, match }) {
  const isCompleted = match?.status === "completed"
  const t1Won = isCompleted && match.winnerTeamId === match.team1Id
  const t2Won = isCompleted && match.winnerTeamId === match.team2Id
  return (
    <div className="bg-pitch-800 border border-surface-border rounded-xl px-4 py-3 w-full max-w-[15rem]">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 text-center">{label}</p>
      <div className="flex items-center justify-between">
        <span className={cn("text-sm font-medium truncate flex-1 inline-flex items-center gap-1.5",
          !match?.team1Name ? "text-slate-600 italic" : t1Won ? "text-emerald-400" : "text-white"
        )}>
          <TeamLogoIcon logoUrl={match?.team1Logo} name={match?.team1Name} />
          {match?.team1Name ?? "TBD"}
        </span>
        <span className="text-xs font-mono text-slate-500 px-2 flex-shrink-0">
          {isCompleted ? match.team1Score : ""}
        </span>
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className={cn("text-sm font-medium truncate flex-1 inline-flex items-center gap-1.5",
          !match?.team2Name ? "text-slate-600 italic" : t2Won ? "text-emerald-400" : "text-white"
        )}>
          <TeamLogoIcon logoUrl={match?.team2Logo} name={match?.team2Name} />
          {match?.team2Name ?? "TBD"}
        </span>
        <span className="text-xs font-mono text-slate-500 px-2 flex-shrink-0">
          {isCompleted ? match.team2Score : ""}
        </span>
      </div>
      {!isCompleted && (!match?.team1Name || !match?.team2Name) && (
        <p className="text-[10px] text-slate-600 text-center mt-1.5">Awaiting</p>
      )}
    </div>
  )
}

export default function StandingsTable({ teams, players, onPlayerClick, view: controlledView, onViewChange }) {
  const [internalView, setInternalView] = useState("table")
  const view    = controlledView || internalView
  const setView = onViewChange || setInternalView
  const { data: scorers = [] } = useTopScorers()
  const { data: playoffsData } = useTeamLeaguePlayoffs()
  const { data: fixtures = [] } = useFixtures()
  const [activeFixtureRound, setActiveFixtureRound] = useState(1)

  // Same progressive-unlock rule as UCL fixtures — a round only becomes
  // browsable once every fixture in every round before it is closed.
  const roundsByNumber = fixtures.reduce((acc, f) => {
    (acc[f.round] ??= []).push(f)
    return acc
  }, {})
  const allRoundNumbers = Object.keys(roundsByNumber).map(Number).sort((a, b) => a - b)
  const firstIncompleteRound = allRoundNumbers.find(r => roundsByNumber[r].some(f => f.status !== "completed"))
  const unlockedFixtureRounds = firstIncompleteRound != null
    ? allRoundNumbers.filter(r => r <= firstIncompleteRound)
    : allRoundNumbers
  const currentFixtureRound = unlockedFixtureRounds.includes(activeFixtureRound)
    ? activeFixtureRound
    : (unlockedFixtureRounds[unlockedFixtureRounds.length - 1] ?? 1)
  const visibleFixtures = roundsByNumber[currentFixtureRound] || []

  return (
    <div className="card overflow-hidden">
      {/* Header with dropdown */}
      <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <img
            src={view === "scorers" ? goldenBoot : teamLeagueTrophy}
            alt={view === "scorers" ? "Golden Boot" : "Team League"}
            className="w-9 h-9 object-contain flex-shrink-0"
          />
          <div>
            <p className="section-label mb-0.5">League table</p>
            <h2 className="text-base font-semibold text-white">
              {view === "table" ? "Season standings" : view === "fixtures" ? "Fixtures" : view === "playoffs" ? "Playoffs" : "Golden Boot"}
            </h2>
          </div>
        </div>
        <select
          value={view}
          onChange={e => setView(e.target.value)}
          className="bg-pitch-800 border border-surface-border rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-accent/40 transition-colors"
        >
          <option value="table">League table</option>
          <option value="fixtures">Fixtures</option>
          <option value="playoffs">Playoffs</option>
          <option value="scorers">Golden Boot</option>
        </select>
      </div>

      {/* Fixtures — round-by-round results, only revealing a round once
          every fixture in the round before it is completed */}
      {view === "fixtures" && (
        fixtures.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-slate-500">No fixtures generated yet</p>
          </div>
        ) : (
          <>
            <div className="flex gap-1.5 px-5 py-3 overflow-x-auto border-b border-surface-border/60">
              {unlockedFixtureRounds.map(r => (
                <button key={r} onClick={() => setActiveFixtureRound(r)}
                  className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors",
                    r === currentFixtureRound ? "bg-accent text-white" : "bg-pitch-800 text-slate-500 hover:text-white"
                  )}>
                  Round {r}
                </button>
              ))}
            </div>
            <div>
              {visibleFixtures.map(f => {
                const isCompleted = f.status === "completed"
                const homeWon = isCompleted && f.homeScore > f.awayScore
                const awayWon = isCompleted && f.awayScore > f.homeScore
                return (
                  <div key={f.id} className="flex items-center justify-between px-5 py-3 border-b border-surface-border/50">
                    <span
                      onClick={() => f.homeTeamId && onPlayerClick?.({ id: f.homeTeamId, name: f.home, isTeam: true })}
                      className={cn("flex-1 min-w-0 flex items-center justify-end gap-1.5 truncate font-medium text-right pr-3",
                        homeWon ? "text-emerald-400" : "text-white"
                      )}>
                      {f.home ?? "TBD"}
                      <TeamLogoIcon logoUrl={f.homeLogo} name={f.home} />
                    </span>
                    <span className="flex-shrink-0 text-xs px-2">
                      {isCompleted ? (
                        <span className="font-mono font-bold text-white bg-pitch-800 px-2 py-0.5 rounded">
                          {f.homeScore} - {f.awayScore}
                        </span>
                      ) : (
                        <span className="text-slate-600">vs</span>
                      )}
                    </span>
                    <span
                      className={cn("flex-1 min-w-0 flex items-center gap-1.5 truncate font-medium pl-3",
                        awayWon ? "text-emerald-400" : "text-white"
                      )}>
                      <TeamLogoIcon logoUrl={f.awayLogo} name={f.away} />
                      {f.away ?? "TBD"}
                    </span>
                  </div>
                )
              })}
            </div>
          </>
        )
      )}

      {/* Playoffs — IPL-style bracket: Qualifier 1 + Eliminator feed into
          Qualifier 2, which feeds into the Final alongside Qualifier 1's
          winner. */}
      {view === "playoffs" && (
        !playoffsData?.matches || playoffsData.matches.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Trophy className="w-6 h-6 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Playoffs haven't started yet</p>
            <p className="text-xs text-slate-600 mt-1">They'll appear here once the group stage finishes</p>
          </div>
        ) : (() => {
          const find = (type) => playoffsData.matches.find(m => m.matchType === type)
          const q1 = find("qualifier1"), elim = find("eliminator"), q2 = find("qualifier2"), final = find("final")
          const championName = final?.status === "completed"
            ? (final.winnerTeamId === final.team1Id ? final.team1Name : final.team2Name)
            : null
          return (
            <div className="px-5 py-8">
              {championName && (
                <div className="flex items-center justify-center gap-2 mb-6 text-gold">
                  <Trophy className="w-5 h-5" />
                  <span className="font-bold text-lg">{championName}</span>
                  <span className="text-sm text-slate-400">are Team League Champions!</span>
                </div>
              )}
              <div className="flex flex-col items-center gap-6">
                {/* Round 1: Qualifier 1 + Eliminator side by side */}
                <div className="flex flex-wrap items-start justify-center gap-6 w-full">
                  <div className="flex flex-col items-center gap-1.5">
                    <PlayoffMatchCard label="Qualifier 1 · 1st v 2nd" match={q1} />
                    <p className="text-[10px] text-slate-600">Winner → Final · Loser → Qualifier 2</p>
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <PlayoffMatchCard label="Eliminator · 3rd v 4th" match={elim} />
                    <p className="text-[10px] text-slate-600">Winner → Qualifier 2 · Loser is out</p>
                  </div>
                </div>

                {/* Round 2: Qualifier 2 */}
                <div className="flex flex-col items-center gap-1.5">
                  <PlayoffMatchCard label="Qualifier 2" match={q2} />
                  <p className="text-[10px] text-slate-600">Winner → Final · Loser is out</p>
                </div>

                {/* Round 3: Final */}
                <div className="flex flex-col items-center gap-1.5">
                  <PlayoffMatchCard label="Final" match={final} />
                </div>
              </div>
            </div>
          )
        })()
      )}

      {/* League Table View */}
      {view === "table" && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border">
                {["#", "Team", "P", "W", "D", "L", "GF", "GA", "GD", "Pts"].map((h) => (
                  <th
                    key={h}
                    className={cn(
                      "py-2.5 text-xs font-semibold text-slate-500 tracking-wide",
                      h === "Team" ? "text-left px-4" : "text-center px-2",
                      h === "Pts"  && "text-gold"
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => {
                const pos     = Number(team.position)
                const isFirst = pos === 1
                return (
                  <tr
                    key={team.id}
                    className={cn(
                      "border-b border-surface-border/50 transition-colors",
                      "table-row-hover",
                      isFirst && "bg-gold/5 border-l-2 border-l-gold/60"
                    )}
                  >
                    <td className="py-3 px-3 text-center">
                      <span className={cn("text-sm font-medium", pos <= 4 ? "text-emerald-400" : "text-slate-500")}>{pos}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <TeamAvatar
                          logoUrl={team.logoUrl}
                          name={team.name}
                          fallbackClassName={isFirst ? "bg-gold/25 text-gold" : "bg-surface-border text-slate-400"}
                        />
                        <span className={cn("font-medium", isFirst ? "text-gold" : "text-slate-300")}>
                          {team.name}
                        </span>
                      </div>
                    </td>
                    {[team.played, team.won, team.drawn, team.lost, team.gf, team.ga].map((val, i) => (
                      <td key={i} className="py-3 px-2 text-center text-slate-400">{val}</td>
                    ))}
                    <td className={cn("py-3 px-2 text-center font-medium text-sm",
                      team.gd > 0 ? "text-emerald-400" : team.gd < 0 ? "text-rose-400" : "text-slate-400"
                    )}>
                      {team.gd > 0 ? `+${team.gd}` : team.gd}
                    </td>
                    <td className={cn(
                      "py-3 px-2 text-center font-bold text-sm",
                      isFirst ? "text-gold" : "text-white"
                    )}>
                      {team.points}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {view === "table" && teams.length >= 4 && (
        <div className="px-5 py-3 border-t border-surface-border/60 flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400/60" /> Top 4 qualify for Playoffs</span>
        </div>
      )}

      {/* Top 10 Goal Scorers View */}
      {view === "scorers" && (
        scorers.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Target className="w-6 h-6 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No goals logged yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border">
                  <th className="py-2.5 px-3 text-center text-xs font-semibold text-slate-500 tracking-wide w-10">#</th>
                  <th className="py-2.5 px-4 text-left text-xs font-semibold text-slate-500 tracking-wide">Player</th>
                  <th className="py-2.5 px-4 text-left text-xs font-semibold text-slate-500 tracking-wide">Team</th>
                  <th className="py-2.5 px-3 text-center text-xs font-semibold text-emerald-400 tracking-wide">Goals</th>
                </tr>
              </thead>
              <tbody>
                {scorers.map((scorer, idx) => {
                  const isFirst = idx === 0
                  const player  = players?.find(p => p.id === scorer.id)
                  return (
                    <tr
                      key={scorer.id}
                      onClick={() => player && onPlayerClick?.(player)}
                      className={cn(
                        "border-b border-surface-border/50 transition-colors",
                        player ? "cursor-pointer table-row-hover" : "",
                        isFirst && "bg-emerald-400/5"
                      )}
                    >
                      <td className="py-3 px-3 text-center">
                        {isFirst
                          ? <span className="rank-gold text-sm">1</span>
                          : <span className="text-slate-500 text-sm">{idx + 1}</span>
                        }
                      </td>
                      <td className="py-3 px-4">
                        <span className={cn("inline-flex items-center gap-2 font-medium", isFirst ? "text-white" : "text-slate-300")}>
                          <PlayerAvatarIcon player={scorer} />
                          {scorer.name}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-xs">
                        <span className="inline-flex items-center gap-1.5">
                          <TeamLogoIcon logoUrl={scorer.teamLogo} name={scorer.team} />
                          {scorer.team ?? "—"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={cn("font-bold font-mono text-sm", isFirst ? "text-emerald-400" : "text-white")}>
                          {scorer.goals}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  )
}