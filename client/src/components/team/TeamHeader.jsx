import { Shield, TrendingUp, Award } from "lucide-react"
import { cn } from "../../lib/utils"
import { useBestLeaguePerformer } from "../../lib/queries"

export default function TeamHeader({ team, myPlayers, teamColor }) {
  const totalMV   = myPlayers.reduce((s, p) => s + p.marketValue, 0)
  const topPlayer = [...myPlayers].sort((a, b) => b.bdrPoints - a.bdrPoints)[0]
  const rgb       = teamColor?.css || null

  // Best player = this season's League results only (separate from Top
  // performer above, which is all-time BDR across every competition).
  const { data: bestLeaguePlayer } = useBestLeaguePerformer(team?.id)

  return (
    <div
      className="relative rounded-2xl overflow-hidden mb-6"
      style={rgb
        ? { border: `1.5px solid rgba(${rgb}, 0.5)` }
        : { border: "1.5px solid rgba(16,185,129,0.2)" }
      }
    >
      {/* Dark base */}
      <div className="absolute inset-0 bg-pitch-800" />

      {rgb ? (
        <>
          {/* Subtle left color wash */}
          <div className="absolute inset-0"
            style={{ background: `linear-gradient(120deg, rgba(${rgb},0.25) 0%, rgba(${rgb},0.08) 40%, transparent 70%)` }}
          />
          {/* Soft top-right glow */}
          <div className="absolute inset-0"
            style={{ background: `radial-gradient(ellipse at top right, rgba(${rgb},0.15), transparent 55%)` }}
          />
          {/* Bottom color strip */}
          <div className="absolute bottom-0 left-0 right-0 h-0.5"
            style={{ background: `linear-gradient(to right, rgba(${rgb},0.5), transparent)` }}
          />
        </>
      ) : (
        <>
          <div className="absolute inset-0 bg-gradient-to-r from-pitch-800 via-pitch-800 to-pitch-700" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.10),transparent_55%)]" />
        </>
      )}

      <div className="relative px-6 py-6 sm:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">

          {/* Team identity */}
          <div className="flex items-center gap-4">
            {/* Logo / Avatar */}
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden"
              style={rgb
                ? { border: `2px solid rgba(${rgb}, 0.4)`, boxShadow: `0 0 12px rgba(${rgb},0.2)` }
                : { border: "2px solid rgba(16,185,129,0.3)" }
              }
            >
              {team.logoUrl ? (
                <img src={team.logoUrl} alt={team.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"
                  style={rgb
                    ? { background: `rgba(${rgb}, 0.25)` }
                    : { background: "rgba(16,185,129,0.2)" }
                  }
                >
                  <span className="text-3xl font-extrabold"
                    style={{ color: rgb ? `rgb(${rgb})` : "#10b981" }}
                  >
                    {team.name.charAt(0)}
                  </span>
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-0.5">My team</p>
              <h1 className="text-xl sm:text-2xl font-extrabold text-white">{team.name}</h1>
              <p className="text-sm text-slate-300 mt-0.5">
                <span className="font-bold"
                  style={{ color: rgb ? `rgb(${rgb})` : "#10b981" }}
                >
                  #{team.position}
                </span>
                {" "}in the league · Season 1
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="sm:ml-auto flex items-center gap-3 flex-wrap">
            <StatChip icon={Award}      label="Points"   value={team.points}                                rgb={rgb} gold />
            <StatChip icon={Shield}     label="Record"   value={`${team.won}W ${team.drawn}D ${team.lost}L`} rgb={rgb} />
            <StatChip icon={TrendingUp} label="Squad MV" value={totalMV}                                    rgb={rgb} mono />
          </div>
        </div>

        {/* Top performer (all-time) + Best player (this season's League) */}
        {(topPlayer || (bestLeaguePlayer && bestLeaguePlayer.points > 0)) && (
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            {topPlayer && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Top performer</span>
                <span
                  className="text-xs font-semibold text-white px-2.5 py-0.5 rounded-full"
                  style={rgb
                    ? { background: `rgba(${rgb},0.2)`, border: `1px solid rgba(${rgb},0.4)` }
                    : { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }
                  }
                >
                  {topPlayer.name} · {topPlayer.bdrPoints.toLocaleString()} BDR pts
                </span>
              </div>
            )}
            {bestLeaguePlayer && bestLeaguePlayer.points > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Best player</span>
                <span className="text-xs font-semibold text-emerald-400 px-2.5 py-0.5 rounded-full bg-emerald-400/10 border border-emerald-400/30">
                  {bestLeaguePlayer.name} · {bestLeaguePlayer.points} pts this season
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function StatChip({ icon: Icon, label, value, rgb, gold, mono }) {
  return (
    <div
      className="rounded-xl px-4 py-2.5 flex items-center gap-2.5"
      style={rgb
        ? {
            background: `rgba(${rgb}, 0.07)`,
            border:     `1px solid rgba(${rgb}, 0.18)`,
          }
        : {
            background: "rgba(255,255,255,0.04)",
            border:     "1px solid rgba(255,255,255,0.08)",
          }
      }
    >
      <Icon className="w-3.5 h-3.5 text-slate-400" />
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className={cn("text-sm font-bold", mono && "font-mono", gold ? "text-amber-400" : "text-white")}>
          {value}
        </p>
      </div>
    </div>
  )
}