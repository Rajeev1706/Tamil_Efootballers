import { useMemo } from "react"
import { cn } from "../../lib/utils"
import { TeamLogoIcon } from "../common/TeamLogo"
import { Trophy, Target, Zap } from "lucide-react"

export default function TitleRaceTracker({ teams, fixtures }) {

  const data = useMemo(() => {
    // ── Debug logs — check browser console ───────────────────────────────
    console.log("[TitleRaceTracker] teams count:", teams?.length)
    console.log("[TitleRaceTracker] fixtures count:", fixtures?.length)
    console.log("[TitleRaceTracker] sample team:", teams?.[0])

    if (!teams || teams.length < 2) {
      console.log("[TitleRaceTracker] EXIT: not enough teams")
      return null
    }

    const sorted = [...teams].sort((a, b) => Number(b.points) - Number(a.points))
    const leader = sorted[0]
    console.log("[TitleRaceTracker] leader:", leader?.name, leader?.points, "played:", leader?.played)

    // Count remaining fixtures — String() coercion to avoid type mismatches
    const remaining = {}
    for (const t of teams) remaining[String(t.id)] = 0

    if (fixtures && fixtures.length > 0) {
      for (const f of fixtures) {
        if (f.status === "completed") continue
        const hid = String(f.homeTeamId)
        const aid = String(f.awayTeamId)
        if (remaining[hid] !== undefined) remaining[hid]++
        if (remaining[aid] !== undefined) remaining[aid]++
      }
    }

    console.log("[TitleRaceTracker] remaining from fixtures:", { ...remaining })

    // Fallback: estimate from played count if fixture matching gave all zeros
    const anyRemaining = Object.values(remaining).some(v => v > 0)
    if (!anyRemaining) {
      const totalGames = 2 * (teams.length - 1)
      for (const t of teams) {
        remaining[String(t.id)] = Math.max(0, totalGames - Number(t.played || 0))
      }
      console.log("[TitleRaceTracker] used fallback remaining:", { ...remaining })
    }

    const leaderRem = remaining[String(leader.id)]
    console.log("[TitleRaceTracker] leader remaining:", leaderRem)

    if (leaderRem === 0) {
      console.log("[TitleRaceTracker] EXIT: leader has 0 remaining — season over")
      return null
    }

    const entries = []
    for (const team of sorted.slice(0, 6)) {
      const gap       = Number(leader.points) - Number(team.points)
      const rem       = remaining[String(team.id)] ?? 0
      const maxPoints = Number(team.points) + rem * 3
      const canCatch  = maxPoints >= Number(leader.points)

      if (!canCatch && String(team.id) !== String(leader.id)) continue

      const mustWins = String(team.id) === String(leader.id) ? 0 : Math.ceil(gap / 3)
      const urgency  =
        mustWins === 0        ? "leader" :
        mustWins <= rem * 0.4 ? "comfortable" :
        mustWins <= rem * 0.7 ? "tight" :
                                "desperate"

      entries.push({ team, gap, rem, mustWins, urgency })
      if (entries.length >= 4) break
    }

    console.log("[TitleRaceTracker] entries count:", entries.length)

    if (entries.length < 2) {
      console.log("[TitleRaceTracker] EXIT: entries < 2")
      return null
    }

    return { entries, leader }
  }, [teams, fixtures])

  if (!data) return null

  const { entries, leader } = data
  const maxPts = entries[0].team.points

  const urgencyColor = {
    leader:      "text-gold border-gold/30 bg-gold/10",
    comfortable: "text-emerald-400 border-emerald-400/25 bg-emerald-400/5",
    tight:       "text-amber-400 border-amber-400/25 bg-amber-400/5",
    desperate:   "text-rose-400 border-rose-400/25 bg-rose-400/5",
  }
  const urgencyLabel = {
    leader:      "Leading",
    comfortable: "In Touch",
    tight:       "Must Push",
    desperate:   "Last Chance",
  }

  return (
    <div className="card overflow-hidden mb-4">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-border">
        <Trophy className="w-4 h-4 text-gold" />
        <h3 className="text-sm font-bold text-white">Title Race</h3>
        <span className="text-[10px] text-slate-500 ml-1">
          — {entries[0].rem} match{entries[0].rem !== 1 ? "es" : ""} remaining for {leader.name}
        </span>
      </div>

      <div className="divide-y divide-surface-border/40">
        {entries.map(({ team, gap, rem, mustWins, urgency }, i) => {
          const barPct   = maxPts > 0 ? Math.round((Number(team.points) / Number(maxPts)) * 100) : 100
          const isLeader = String(team.id) === String(leader.id)

          return (
            <div key={team.id} className="px-4 py-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={cn("text-xs font-bold w-5 flex-shrink-0", isLeader ? "text-gold" : "text-slate-500")}>
                    #{i + 1}
                  </span>
                  <TeamLogoIcon logoUrl={team.logoUrl} name={team.name} size="sm" />
                  <span className={cn("text-sm font-semibold truncate", isLeader ? "text-gold" : "text-white")}>
                    {team.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!isLeader && <span className="text-[10px] text-slate-500 font-mono">-{gap}pts</span>}
                  <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full border", urgencyColor[urgency])}>
                    {urgencyLabel[urgency]}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 ml-7">
                <div className="flex-1 h-1.5 bg-pitch-700 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all",
                      isLeader ? "bg-gold" :
                      urgency === "comfortable" ? "bg-emerald-400" :
                      urgency === "tight" ? "bg-amber-400" : "bg-rose-400"
                    )}
                    style={{ width: `${barPct}%` }}
                  />
                </div>
                <span className={cn("text-xs font-bold font-mono flex-shrink-0", isLeader ? "text-gold" : "text-white")}>
                  {team.points}pts
                </span>
              </div>

              <div className="flex items-center gap-3 ml-7">
                <span className="text-[10px] text-slate-500">{rem} match{rem !== 1 ? "es" : ""} left</span>
                {!isLeader && mustWins > 0 && (
                  <>
                    <span className="text-slate-700">·</span>
                    <div className="flex items-center gap-1">
                      <Target className="w-2.5 h-2.5 text-slate-500" />
                      <span className={cn("text-[10px] font-semibold", urgency === "desperate" ? "text-rose-400" : "text-slate-400")}>
                        Need {mustWins} win{mustWins !== 1 ? "s" : ""} min
                        {mustWins >= rem && <span className="text-rose-400 font-bold ml-1"> — must win all</span>}
                      </span>
                    </div>
                  </>
                )}
                {isLeader && rem > 0 && (
                  <div className="flex items-center gap-1">
                    <Zap className="w-2.5 h-2.5 text-gold" />
                    <span className="text-[10px] text-gold font-semibold">In the lead</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}