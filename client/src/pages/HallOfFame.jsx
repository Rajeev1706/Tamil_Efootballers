import { useNavigate } from "react-router-dom"
import { ArrowLeft, Trophy, Crown, ChevronDown, ChevronUp } from "lucide-react"
import { useState } from "react"
import Layout from "../components/layout/Layout"
import Loading from "../components/common/Loading"
import { useSeasonRecords } from "../lib/queries"
import { cn } from "../lib/utils"
import ballondorImg  from "../../images/ballondor.png"
import teamLeagueImg from "../../images/Team League.png"
import weeklyImg     from "../../images/Weekly.png"
import uclImg        from "../../images/ucl.png"

function StatChip({ label, value, sub }) {
  if (!value) return null
  return (
    <div className="bg-pitch-800 rounded-xl p-3 border border-surface-border">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="font-semibold text-white text-sm">{value}</p>
      {sub && <p className="text-xs text-slate-600">{sub}</p>}
    </div>
  )
}

function TrophyRow({ image, label, winner }) {
  if (!winner) return null
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-surface-border/50 last:border-0">
      <img src={image} alt={label} className="w-8 h-8 object-contain flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm font-semibold text-white truncate">{winner}</p>
      </div>
      <Trophy className="w-4 h-4 text-gold flex-shrink-0" />
    </div>
  )
}

function SeasonCard({ record }) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gold/15 border border-gold/20 text-gold flex items-center justify-center font-extrabold text-sm flex-shrink-0">
            S{record.season_number}
          </div>
          <div className="text-left">
            <p className="text-base font-bold text-white">{record.season_name}</p>
            {record.champion_team && (
              <p className="text-xs text-gold">🏆 Champions: {record.champion_team} · {record.champion_pts} pts</p>
            )}
          </div>
        </div>
        {expanded
          ? <ChevronUp className="w-4 h-4 text-slate-500" />
          : <ChevronDown className="w-4 h-4 text-slate-500" />
        }
      </button>

      {expanded && (
        <div className="border-t border-surface-border px-5 py-4 space-y-4">
          {/* Records grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatChip label="Top Scorer" value={record.top_scorer} sub={`${record.top_scorer_goals ?? 0} goals`} />
            <StatChip label="Highest MV" value={record.highest_mv_player} sub={`MV ${record.highest_mv ?? 0}`} />
            <StatChip label="Longest Win Streak" value={record.longest_streak_player} sub={`${record.longest_streak ?? 0} wins in a row`} />
          </div>

          {/* Trophy winners */}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-2">Trophy Winners</p>
            <div className="card px-4 py-1">
              <TrophyRow image={ballondorImg}  label="Ballon d'Or"  winner={record.ballondor_winner} />
              <TrophyRow image={teamLeagueImg} label="Team League"  winner={record.team_league_winner} />
              {Array.isArray(record.team_league_players) && record.team_league_players.filter(Boolean).length > 0 && (
                <div className="pl-11 pb-2 flex flex-wrap gap-1.5">
                  {record.team_league_players.filter(Boolean).map((p, i) => (
                    <span key={i} className="text-xs bg-pitch-800 border border-surface-border rounded-full px-2.5 py-0.5 text-slate-400">
                      {p}
                    </span>
                  ))}
                </div>
              )}
              <TrophyRow image={uclImg}        label="UCL"          winner={record.ucl_winner} />
              {/* Weekly — show each week separately */}
              {(() => {
                const weeks = Array.isArray(record.weekly_winners)
                  ? record.weekly_winners.filter(Boolean)
                  : record.weekly_winner ? [record.weekly_winner] : []
                if (weeks.length === 0) return null
                return weeks.map((w, i) => (
                  <TrophyRow key={i} image={weeklyImg} label={`Weekly · Week ${i + 1}`} winner={w} />
                ))
              })()}
            </div>
          </div>

          {record.notes && (
            <p className="text-xs text-slate-500 italic border-l-2 border-accent/30 pl-3">
              "{record.notes}"
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function HallOfFame() {
  const navigate = useNavigate()
  const { data: records = [], isLoading } = useSeasonRecords()

  if (isLoading) return <Layout><Loading /></Layout>

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium mb-5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {/* Hero */}
        <div className="card px-6 py-8 mb-6 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-accent/5" />
          <Crown className="w-10 h-10 text-gold mx-auto mb-3" />
          <h1 className="text-3xl font-extrabold text-white mb-1">Hall of Fame</h1>
          <p className="text-slate-400 text-sm">Tamil Efootballers League · Season History</p>
        </div>

        {/* Season records */}
        {records.length === 0 ? (
          <div className="card px-6 py-16 text-center">
            <Trophy className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">No season records yet</p>
            <p className="text-xs text-slate-600 mt-1">Admin can add season records from the Setup tab in the Admin panel</p>
          </div>
        ) : (
          <div className="space-y-4">
            {records.map(r => (
              <SeasonCard key={r.id} record={r} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}