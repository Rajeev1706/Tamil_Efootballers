import { useState } from "react"
import { Trophy, Target, ArrowRight, Crown } from "lucide-react"
import { cn } from "../../lib/utils"
import { useSeasonMatchRecords } from "../../lib/queries"
import ballondorImg  from "../../../images/ballondor.png"
import teamLeagueImg from "../../../images/Team League.png"
import weeklyImg     from "../../../images/Weekly.png"
import uclImg        from "../../../images/ucl.png"

const RESULT_COLOR = {
  win:  "bg-emerald-400/10 text-emerald-400 border-emerald-400/25",
  draw: "bg-amber-400/10  text-amber-400  border-amber-400/25",
  loss: "bg-rose-400/10   text-rose-400   border-rose-400/25",
}

export default function PastSeasonDashboard({ record, season }) {
  const [tab, setTab] = useState("overview")
  const { data: matchRecords = [], isLoading: recordsLoading } = useSeasonMatchRecords(season)

  const weeklyWinners  = Array.isArray(record?.weekly_winners)  ? record.weekly_winners.filter(Boolean)  : []
  const squadPlayers   = Array.isArray(record?.team_league_players) ? record.team_league_players.filter(Boolean) : []

  // Compute player stats from match records
  const playerStats = {}
  matchRecords.forEach(r => {
    // Player side
    if (!playerStats[r.playerId]) playerStats[r.playerId] = { name: r.playerName, team: r.playerTeam, w: 0, d: 0, l: 0, goals: 0 }
    if (r.result === "win")  playerStats[r.playerId].w++
    if (r.result === "draw") playerStats[r.playerId].d++
    if (r.result === "loss") playerStats[r.playerId].l++
    playerStats[r.playerId].goals += r.playerScore ?? 0

    // Opponent side (flipped)
    if (!playerStats[r.opponentId]) playerStats[r.opponentId] = { name: r.opponentName, team: r.opponentTeam, w: 0, d: 0, l: 0, goals: 0 }
    const oppResult = r.result === "win" ? "loss" : r.result === "loss" ? "win" : "draw"
    if (oppResult === "win")  playerStats[r.opponentId].w++
    if (oppResult === "draw") playerStats[r.opponentId].d++
    if (oppResult === "loss") playerStats[r.opponentId].l++
    playerStats[r.opponentId].goals += r.opponentScore ?? 0
  })

  const sortedPlayers = Object.values(playerStats).sort((a, b) =>
    (b.w * 3 + b.d) - (a.w * 3 + a.d) || b.goals - a.goals
  )

  const topScorers = [...sortedPlayers].sort((a, b) => b.goals - a.goals).slice(0, 10)

  const TABS = [
    { id: "overview",  label: "Overview"       },
    { id: "records",   label: `Match Records (${matchRecords.length})` },
    { id: "players",   label: "Player Stats"   },
    { id: "scorers",   label: "Top Scorers"    },
  ]

  return (
    <div className="space-y-5">
      {/* Champion banner */}
      {record?.champion_team && (
        <div className="card px-6 py-5 flex items-center gap-4 border-gold/20 bg-gold/5">
          <Crown className="w-8 h-8 text-gold flex-shrink-0" />
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">League Champions</p>
            <p className="text-2xl font-extrabold text-gold">{record.champion_team}</p>
            {record.champion_pts && <p className="text-sm text-slate-400">{record.champion_pts} points</p>}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-pitch-800 rounded-xl p-1 border border-surface-border overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all whitespace-nowrap",
              tab === t.id ? "bg-accent text-white" : "text-slate-500 hover:text-white"
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === "overview" && record && (
        <div className="space-y-4">
          {/* Season records */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: "Top Scorer",      value: record.top_scorer,           sub: `${record.top_scorer_goals ?? 0} goals` },
              { label: "Highest MV",      value: record.highest_mv_player,    sub: `MV ${record.highest_mv ?? 0}` },
              { label: "Longest Streak",  value: record.longest_streak_player, sub: `${record.longest_streak ?? 0} wins` },
            ].filter(s => s.value).map(s => (
              <div key={s.label} className="card p-4">
                <p className="text-xs text-slate-500 mb-1">{s.label}</p>
                <p className="font-bold text-white">{s.value}</p>
                <p className="text-xs text-accent">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Trophies */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-surface-border">
              <p className="text-sm font-semibold text-white">Trophy Winners</p>
            </div>
            <div className="divide-y divide-surface-border/50">
              {record.ballondor_winner && (
                <div className="flex items-center gap-3 px-5 py-3">
                  <img src={ballondorImg} alt="BDR" className="w-8 h-8 object-contain flex-shrink-0" />
                  <div><p className="text-xs text-slate-500">Ballon d'Or</p><p className="text-sm font-semibold text-white">{record.ballondor_winner}</p></div>
                </div>
              )}
              {record.team_league_winner && (
                <div className="px-5 py-3">
                  <div className="flex items-center gap-3 mb-1">
                    <img src={teamLeagueImg} alt="TL" className="w-8 h-8 object-contain flex-shrink-0" />
                    <div><p className="text-xs text-slate-500">Team League</p><p className="text-sm font-semibold text-white">{record.team_league_winner}</p></div>
                  </div>
                  {squadPlayers.length > 0 && (
                    <p className="text-xs text-slate-500 pl-11">Squad: {squadPlayers.join(", ")}</p>
                  )}
                </div>
              )}
              {record.ucl_winner && (
                <div className="flex items-center gap-3 px-5 py-3">
                  <img src={uclImg} alt="UCL" className="w-8 h-8 object-contain flex-shrink-0" />
                  <div><p className="text-xs text-slate-500">UCL</p><p className="text-sm font-semibold text-white">{record.ucl_winner}</p></div>
                </div>
              )}
              {weeklyWinners.length > 0 && (
                <div className="px-5 py-3">
                  <div className="flex items-center gap-3 mb-2">
                    <img src={weeklyImg} alt="Weekly" className="w-8 h-8 object-contain flex-shrink-0" />
                    <p className="text-xs text-slate-500 font-semibold">Weekly Trophy</p>
                  </div>
                  <div className="pl-11 space-y-1">
                    {weeklyWinners.map((w, i) => (
                      <p key={i} className="text-sm text-slate-300">
                        <span className="text-xs text-slate-500 w-14 inline-block">Week {i + 1}</span>{w}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {record.notes && (
            <div className="card px-5 py-4 border-l-2 border-accent/30">
              <p className="text-xs text-slate-500 mb-1">Season Notes</p>
              <p className="text-sm text-slate-300 italic">"{record.notes}"</p>
            </div>
          )}
        </div>
      )}

      {/* Match Records tab */}
      {tab === "records" && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-border">
            <p className="text-sm font-semibold text-white">{matchRecords.length} match records logged this season</p>
          </div>
          {recordsLoading ? (
            <p className="text-center py-8 text-slate-500 text-sm">Loading...</p>
          ) : matchRecords.length === 0 ? (
            <p className="text-center py-8 text-slate-500 text-sm">No match records found for this season</p>
          ) : (
            <div className="divide-y divide-surface-border/50 max-h-96 overflow-y-auto">
              {matchRecords.map(r => (
                <div key={r.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-white truncate">{r.playerName}</span>
                      {r.playerScore != null && (
                        <span className="text-xs font-mono text-slate-400 flex-shrink-0">{r.playerScore}–{r.opponentScore}</span>
                      )}
                      <ArrowRight className="w-3 h-3 text-slate-600 flex-shrink-0" />
                      <span className="text-slate-400 truncate">{r.opponentName}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {r.playerTeam} vs {r.opponentTeam} · {r.date?.slice(0, 10)}
                    </p>
                  </div>
                  <span className={cn("text-xs font-bold px-2 py-0.5 rounded border flex-shrink-0", RESULT_COLOR[r.result])}>
                    {r.result.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Player Stats tab */}
      {tab === "players" && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-border">
            <p className="text-sm font-semibold text-white">Player stats this season</p>
          </div>
          {sortedPlayers.length === 0 ? (
            <p className="text-center py-8 text-slate-500 text-sm">No player data for this season</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-border">
                    {["#", "Player", "Team", "W", "D", "L", "Goals"].map(h => (
                      <th key={h} className={cn("py-2.5 text-xs font-semibold text-slate-500 tracking-wide",
                        h === "Player" || h === "Team" ? "text-left px-4" : "text-center px-2"
                      )}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedPlayers.map((p, i) => (
                    <tr key={p.name + i} className="border-b border-surface-border/50 hover:bg-surface-hover transition-colors">
                      <td className="py-2.5 px-2 text-center text-slate-500 text-xs">{i + 1}</td>
                      <td className="py-2.5 px-4 font-medium text-white">{p.name}</td>
                      <td className="py-2.5 px-4 text-slate-400 text-xs">{p.team ?? "—"}</td>
                      <td className="py-2.5 px-2 text-center text-emerald-400 font-semibold">{p.w}</td>
                      <td className="py-2.5 px-2 text-center text-amber-400 font-semibold">{p.d}</td>
                      <td className="py-2.5 px-2 text-center text-rose-400 font-semibold">{p.l}</td>
                      <td className="py-2.5 px-2 text-center text-white font-bold">{p.goals}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Top Scorers tab */}
      {tab === "scorers" && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-border flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-400" />
            <p className="text-sm font-semibold text-white">Golden Boot — Top 10 Scorers</p>
          </div>
          {topScorers.length === 0 ? (
            <p className="text-center py-8 text-slate-500 text-sm">No goal data for this season</p>
          ) : (
            <div className="divide-y divide-surface-border/50">
              {topScorers.map((p, i) => (
                <div key={p.name + i} className={cn("flex items-center gap-3 px-5 py-3", i === 0 && "bg-emerald-400/5")}>
                  <span className={cn("w-6 text-center text-sm font-bold flex-shrink-0",
                    i === 0 ? "text-gold" : "text-slate-500"
                  )}>{i + 1}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{p.name}</p>
                    <p className="text-xs text-slate-500">{p.team ?? "—"}</p>
                  </div>
                  <span className={cn("text-xl font-extrabold font-mono", i === 0 ? "text-emerald-400" : "text-white")}>
                    {p.goals}
                  </span>
                  <span className="text-xs text-slate-600">goals</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}