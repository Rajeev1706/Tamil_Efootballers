import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, ChevronDown, ChevronUp, Star } from "lucide-react"
import { useChampionship } from "../lib/queries"
import { cn } from "../lib/utils"
import { TeamLogoIcon } from "../components/common/TeamLogo"
import PlayerAvatarIcon from "../components/common/PlayerAvatarIcon"
import Layout from "../components/layout/Layout"
import championshipImg from "../../images/championship.png"

function Loading() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function TeamRow({ team, rank }) {
  const [open, setOpen] = useState(false)
  const players = team.players ?? []

  const rankStyle =
    rank === 1 ? "text-gold bg-gold/15 border-gold/30" :
    rank === 2 ? "text-slate-300 bg-slate-300/10 border-slate-300/25" :
    rank === 3 ? "text-amber-600 bg-amber-600/10 border-amber-600/25" :
                 "text-slate-500 bg-pitch-800/40 border-surface-border"

  return (
    <div className={cn(
      "card overflow-hidden transition-all",
      rank === 1 && "border-gold/30 shadow-lg shadow-gold/5"
    )}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-pitch-800/30 transition-colors text-left"
      >
        {/* Rank badge */}
        <div className={cn(
          "w-8 h-8 rounded-lg border flex items-center justify-center text-sm font-extrabold flex-shrink-0",
          rankStyle
        )}>
          {rank === 1 ? "🏆" : rank}
        </div>

        {/* Team logo + name */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {team.logoUrl && <TeamLogoIcon src={team.logoUrl} size="md" />}
          <div>
            <p className="text-sm font-bold text-white">{team.name}</p>
            <p className="text-xs text-slate-500">{team.playerCount} players</p>
          </div>
        </div>

        {/* Total BDR */}
        <div className="text-right flex-shrink-0">
          <p className={cn(
            "text-xl font-extrabold font-mono",
            rank === 1 ? "text-gold" : "text-white"
          )}>
            {team.totalBdr}
          </p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">BDR pts</p>
        </div>

        {open
          ? <ChevronUp className="w-4 h-4 text-slate-500 flex-shrink-0 ml-2" />
          : <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0 ml-2" />
        }
      </button>

      {/* Expanded player breakdown */}
      {open && (
        <div className="border-t border-surface-border/50">
          <div className="grid grid-cols-[auto_1fr_auto] gap-x-3 items-center px-5 py-2 text-[10px] font-semibold text-slate-600 uppercase tracking-wide border-b border-surface-border/30">
            <span>#</span>
            <span>Player</span>
            <span className="text-right">BDR</span>
          </div>
          {players.length === 0 ? (
            <p className="text-xs text-slate-600 text-center py-4">No players</p>
          ) : (
            players.map((p, i) => (
              <div key={p.id} className="grid grid-cols-[auto_1fr_auto] gap-x-3 items-center px-5 py-3 border-b border-surface-border/30 last:border-0 hover:bg-pitch-800/20 transition-colors">
                <span className="text-xs text-slate-600 w-5 text-center">{i + 1}</span>
                <div className="flex items-center gap-2 min-w-0">
                  <PlayerAvatarIcon player={p} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm text-white font-medium truncate">{p.name}</p>
                    <p className="text-[10px] text-slate-500">{p.grade}-grade</p>
                  </div>
                </div>
                <p className={cn(
                  "text-sm font-bold font-mono text-right",
                  p.bdrPoints > 0 ? "text-accent" : "text-slate-600"
                )}>
                  {p.bdrPoints ?? 0}
                </p>
              </div>
            ))
          )}
          <div className="flex items-center justify-between px-5 py-3 bg-pitch-900/40">
            <p className="text-xs font-semibold text-slate-400">Team Total</p>
            <p className={cn("text-base font-extrabold font-mono", rank === 1 ? "text-gold" : "text-white")}>
              {team.totalBdr}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ChampionshipPage() {
  const navigate = useNavigate()
  const { data: standings = [], isLoading } = useChampionship()

  const leader = standings[0]

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Header */}
        <button onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors mb-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="card px-6 py-8 text-center">
          <img src={championshipImg} alt="Championship" className="w-24 h-24 object-contain mx-auto mb-3" />
          <h1 className="text-2xl font-extrabold text-white">Championship</h1>
          <p className="text-slate-400 text-sm mt-1">Team BDR Standings — Season Total</p>
          {leader && (
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gold/10 border border-gold/30">
              <Star className="w-3.5 h-3.5 text-gold fill-gold" />
              <span className="text-sm font-semibold text-gold">
                {leader.name} leads with {leader.totalBdr} pts
              </span>
            </div>
          )}
        </div>

        {/* Standings */}
        {isLoading ? <Loading /> : (
          <div className="space-y-2">
            {standings.map((team, i) => (
              <TeamRow key={team.id} team={team} rank={i + 1} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}