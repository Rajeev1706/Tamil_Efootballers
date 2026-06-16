import { Shield, TrendingUp, Award } from "lucide-react"
import { cn } from "../../lib/utils"

export default function TeamHeader({ team, myPlayers }) {
  const totalMV    = myPlayers.reduce((s, p) => s + p.marketValue, 0)
  const topPlayer  = [...myPlayers].sort((a, b) => b.bdrPoints - a.bdrPoints)[0]

  return (
    <div className="relative rounded-2xl overflow-hidden border border-surface-border mb-6">
      <div className="absolute inset-0 bg-gradient-to-r from-pitch-800 via-pitch-800 to-pitch-700" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.10),transparent_55%)]" />

      <div className="relative px-6 py-6 sm:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">

          {/* Team identity */}
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl border-2 border-accent/30 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {team.logoUrl ? (
                <img src={team.logoUrl} alt={team.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-accent/20 flex items-center justify-center">
                  <span className="text-3xl font-extrabold text-accent">{team.name.charAt(0)}</span>
                </div>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-0.5">My team</p>
              <h1 className="text-xl sm:text-2xl font-extrabold text-white">{team.name}</h1>
              <p className="text-sm text-slate-400 mt-0.5">
                <span className="text-accent font-semibold">#{team.position}</span>
                {" "}in the league · Season 1
              </p>
            </div>
          </div>

          {/* Stats row */}
          <div className="sm:ml-auto flex items-center gap-3 flex-wrap">
            <StatChip icon={Award} label="Points" value={team.points} accent="text-gold" />
            <StatChip icon={Shield} label="Record" value={`${team.won}W ${team.drawn}D ${team.lost}L`} />
            <StatChip icon={TrendingUp} label="Squad MV" value={totalMV} mono />
          </div>
        </div>

        {/* Top player callout */}
        {topPlayer && (
          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs text-slate-500">Top performer</span>
            <span className="text-xs font-semibold text-white bg-surface/60 border border-surface-border px-2 py-0.5 rounded-full">
              {topPlayer.name} · {topPlayer.bdrPoints.toLocaleString()} BDR pts
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function StatChip({ icon: Icon, label, value, accent, mono }) {
  return (
    <div className="bg-surface/60 border border-surface-border rounded-xl px-4 py-2.5 flex items-center gap-2.5">
      <Icon className="w-3.5 h-3.5 text-slate-500" />
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className={cn("text-sm font-bold", mono && "font-mono", accent || "text-white")}>
          {value}
        </p>
      </div>
    </div>
  )
}