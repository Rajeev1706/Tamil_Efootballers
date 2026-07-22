import { useEffect, useRef } from "react"
import { useParams, useNavigate, useSearchParams } from "react-router-dom"
import { ArrowLeft, Crown } from "lucide-react"
import Layout from "../components/layout/Layout"
import Loading from "../components/common/Loading"
import PlayerAvatarIcon from "../components/common/PlayerAvatarIcon"
import { useTeams, usePlayers } from "../lib/queries"
import { cn } from "../lib/utils"

export default function TeamRosterPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const audioRef = useRef(null)

  const { data: teams = [], isLoading: teamsLoading } = useTeams()
  const { data: players = [], isLoading: playersLoading } = usePlayers()

  const team = teams.find(t => t.id === parseInt(id))
  const roster = team
    ? [...players.filter(p => p.teamId === team.id)]
        .sort((a, b) => (b.isCaptain ? 1 : 0) - (a.isCaptain ? 1 : 0))
    : []

  useEffect(() => {
    if (!team?.anthemUrl) return
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = 0
    audio.play().catch(() => {})
    return () => { audio.pause(); audio.currentTime = 0 }
  }, [team?.anthemUrl])

  const handlePlayer = (player) =>
    navigate(`/player/${player.id}?${searchParams.toString()}`)

  if (teamsLoading || playersLoading) return <Layout><Loading /></Layout>
  if (!team) return <Layout><div className="text-center py-20 text-slate-500">Team not found</div></Layout>

  return (
    <Layout>
      {team.anthemUrl && <audio ref={audioRef} src={team.anthemUrl} preload="auto" />}

      <button onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-6 text-sm">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Header panel — team logo + name only, clean, no watermarks */}
      <div className="rounded-2xl border border-surface-border mb-6 bg-pitch-800/80 backdrop-blur-sm px-6 py-8 sm:px-10 flex items-center gap-5">
        {team.logoUrl && (
          <img src={team.logoUrl} alt={team.name}
            className="w-16 h-16 sm:w-20 sm:h-20 object-contain rounded-xl flex-shrink-0 border border-surface-border bg-pitch-900/50" />
        )}
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Team Roster</p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{team.name}</h1>
          <p className="text-slate-400 text-sm mt-1">{roster.length} players</p>
        </div>
      </div>

      {/* Player list */}
      <div className="card overflow-hidden">
        {roster.length === 0 ? (
          <div className="py-16 text-center text-slate-600 text-sm">No players in this team yet</div>
        ) : roster.map((player, idx) => (
          <button key={player.id} onClick={() => handlePlayer(player)}
            className="w-full flex items-center gap-3 px-5 py-3.5 border-b border-surface-border/40 hover:bg-white/5 transition-colors text-left last:border-b-0">

            {player.isCaptain ? (
              <div className="w-9 h-9 flex-shrink-0 rounded-full bg-gold/15 border border-gold/40 flex items-center justify-center">
                <Crown className="w-4 h-4 text-gold" />
              </div>
            ) : (
              <div className="w-9 h-9 flex-shrink-0 rounded-full bg-pitch-800 border border-surface-border flex items-center justify-center">
                <span className="text-xs font-semibold text-slate-400">{idx + 1}</span>
              </div>
            )}

            <PlayerAvatarIcon player={player} size="w-[43px] h-[43px]" />

            <div className="flex-1 min-w-0">
              <p className={cn("font-semibold text-sm truncate", player.isCaptain ? "text-gold" : "text-white")}>
                {player.name}
                {player.isCaptain && <span className="ml-2 text-xs font-normal text-gold/60">Captain</span>}
              </p>
              {player.alias && <p className="text-xs text-slate-500 truncate">"{player.alias}"</p>}
            </div>

            <span className="text-xs text-slate-600 flex-shrink-0">→</span>
          </button>
        ))}
      </div>
    </Layout>
  )
}