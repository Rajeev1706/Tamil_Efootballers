import { useState } from "react"
import { Trophy } from "lucide-react"
import { cn } from "../../lib/utils"
import { TeamLogoIcon } from "../common/TeamLogo"
import PlayerAvatarIcon from "../common/PlayerAvatarIcon"
import ballondorTrophy    from "../../../images/ballondor.png"
import teamLeagueTrophy   from "../../../images/Team League.png"
import weeklyTrophy       from "../../../images/Weekly.png"
import uclTrophy          from "../../../images/ucl.png"
import goldenBootTrophy   from "../../../images/Golden Boot.png"
import teamLeagueGBTrophy from "../../../images/team league_gb.png"
import uclGBTrophy        from "../../../images/ucl_gb.png"

const TROPHY_OPTIONS = [
  { value: "trophy1Count", label: "Ballon d'Or",           image: ballondorTrophy    },
  { value: "trophy2Count", label: "Team League",           image: teamLeagueTrophy   },
  { value: "trophy4Count", label: "UCL",                   image: uclTrophy          },
  { value: "trophy3Count", label: "Weekly",                image: weeklyTrophy       },
  { value: "trophy5Count", label: "Weekly Golden Boot",    image: goldenBootTrophy   },
  { value: "trophy6Count", label: "Team League Golden Boot", image: teamLeagueGBTrophy },
  { value: "trophy7Count", label: "UCL Golden Boot",       image: uclGBTrophy        },
]

export default function TrophyRanking({ players, onPlayerClick, trophyKey: controlledKey, onTrophyChange }) {
  const [internalKey, setInternalKey] = useState("trophy1Count")
  const trophyKey    = controlledKey || internalKey
  const setTrophyKey = onTrophyChange || setInternalKey

  const sorted = [...players]
    .filter(p => (p[trophyKey] ?? 0) > 0)
    .sort((a, b) => ((b[trophyKey] ?? 0) - (a[trophyKey] ?? 0)) || a.name.localeCompare(b.name))

  const activeOption = TROPHY_OPTIONS.find(o => o.value === trophyKey)
  const activeLabel  = activeOption?.label

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <img
            src={activeOption?.image}
            alt={activeLabel}
            className="w-9 h-9 object-contain flex-shrink-0"
          />
          <div>
            <p className="section-label mb-0.5">Trophies</p>
            <h2 className="text-base font-semibold text-white">{activeLabel} winners</h2>
          </div>
        </div>
        <select
          value={trophyKey}
          onChange={e => setTrophyKey(e.target.value)}
          className="bg-pitch-800 border border-surface-border rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-accent/40 transition-colors"
        >
          {TROPHY_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {sorted.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <Trophy className="w-6 h-6 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No {activeLabel} wins logged yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border">
                {["#", "Player", "Team", "Wins"].map((h) => (
                  <th
                    key={h}
                    className={cn(
                      "py-2.5 text-xs font-semibold text-slate-500 tracking-wide",
                      h === "Player" || h === "Team" ? "text-left px-4" : "text-center px-3",
                      h === "Wins" && "text-gold"
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((player, idx) => {
                const isFirst = idx === 0
                const count = player[trophyKey] ?? 0

                return (
                  <tr
                    key={player.id}
                    onClick={() => onPlayerClick?.(player)}
                    className={cn(
                      "table-row-hover border-b border-surface-border/50 cursor-pointer",
                      isFirst && "bg-gold/5"
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
                        <PlayerAvatarIcon player={player} />
                        {player.name}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-xs">
                      <span className="inline-flex items-center gap-2">
                        <TeamLogoIcon logoUrl={player.teamLogo} name={player.team} />
                        {player.team}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={cn("font-bold font-mono text-sm", isFirst ? "text-gold" : "text-white")}>
                        {count}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}