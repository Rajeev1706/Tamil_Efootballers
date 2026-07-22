import { useNavigate, useSearchParams } from "react-router-dom"
import { TeamAvatar } from "../common/TeamLogo"

export default function TeamsDirectory({ teams }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const sorted = [...teams].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-surface-border">
        <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-0.5">Teams</p>
        <h2 className="text-base font-semibold text-white">{teams.length} teams in the league</h2>
      </div>

      {sorted.map(team => (
        <button
          key={team.id}
          onClick={() => navigate(`/team-roster/${team.id}?${searchParams.toString()}`)}
          className="w-full flex items-center gap-2 px-5 py-3 border-b border-surface-border/40 hover:bg-white/5 transition-colors text-left last:border-b-0"
        >
          <TeamAvatar
            logoUrl={team.logoUrl}
            name={team.name}
            fallbackClassName="bg-surface-border text-slate-400"
          />
          <span className="font-medium text-slate-300 truncate">{team.name}</span>
        </button>
      ))}
    </div>
  )
}