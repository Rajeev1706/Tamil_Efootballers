import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Crown, ChevronDown, Trophy } from "lucide-react"
import Layout from "../components/layout/Layout"
import Loading from "../components/common/Loading"
import { useSeasonRecords, useLeagueInfo } from "../lib/queries"
import { cn } from "../lib/utils"
import ballondorImg  from "../../images/ballondor.png"
import teamLeagueImg from "../../images/Team League.png"
import weeklyImg     from "../../images/Weekly.png"
import uclImg        from "../../images/ucl.png"
import goldenBootImg from "../../images/Golden Boot.png"

function TrophyRow({ image, label, winner, sub }) {
  if (!winner) return null
  return (
    <div className="flex items-start gap-3 py-3 border-b border-surface-border/50 last:border-0">
      <img src={image} alt={label} className="w-9 h-9 object-contain flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm font-semibold text-white">{winner}</p>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function SeasonDetail({ record }) {
  const weeklyWinners = Array.isArray(record.weekly_winners)
    ? record.weekly_winners.filter(Boolean) : []
  const squadPlayers  = Array.isArray(record.team_league_players)
    ? record.team_league_players.filter(Boolean) : []

  return (
    <div className="space-y-5 mt-5">
      {/* Champion banner */}
      {record.champion_team && (
        <div className="card px-5 py-4 flex items-center gap-4 border-gold/20 bg-gold/5">
          <Crown className="w-7 h-7 text-gold flex-shrink-0" />
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">League Champions</p>
            <p className="text-xl font-extrabold text-gold">{record.champion_team}</p>
            {record.champion_pts && <p className="text-sm text-slate-400">{record.champion_pts} points</p>}
          </div>
        </div>
      )}

      {/* Season records grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: "Top Scorer / Golden Boot", value: record.top_scorer, sub: `${record.top_scorer_goals ?? 0} goals` },
          { label: "Highest MV",               value: record.highest_mv_player, sub: `MV ${record.highest_mv ?? 0}` },
          { label: "Longest Win Streak",        value: record.longest_streak_player, sub: `${record.longest_streak ?? 0} wins` },
        ].filter(s => s.value).map(s => (
          <div key={s.label} className="card p-4">
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className="font-bold text-white">{s.value}</p>
            <p className="text-xs text-accent">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Trophy winners */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-border">
          <p className="text-sm font-semibold text-white">Trophy Winners</p>
        </div>
        <div className="px-5 py-2">
          <TrophyRow image={ballondorImg}  label="Ballon d'Or"  winner={record.ballondor_winner} />
          <TrophyRow image={goldenBootImg} label="Golden Boot"  winner={record.top_scorer} sub={`${record.top_scorer_goals ?? 0} goals`} />
          <TrophyRow
            image={teamLeagueImg}
            label="Team League"
            winner={record.team_league_winner}
            sub={squadPlayers.length > 0 ? `Squad: ${squadPlayers.join(", ")}` : null}
          />
          <TrophyRow image={uclImg} label="UCL" winner={record.ucl_winner} />
          {/* Weekly — per week */}
          {weeklyWinners.length > 0 && (
            <div className="flex items-start gap-3 py-3">
              <img src={weeklyImg} alt="Weekly" className="w-9 h-9 object-contain flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-slate-500 mb-2">Weekly Trophy</p>
                <div className="space-y-1">
                  {weeklyWinners.map((w, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="text-xs text-slate-600 w-14 flex-shrink-0">Week {i + 1}</span>
                      <span className="text-white font-medium">{w}</span>
                    </div>
                  ))}
                </div>
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
  )
}

export default function HallOfFame() {
  const navigate = useNavigate()
  const { data: records = [], isLoading } = useSeasonRecords()
  const { data: infoItems = [] }          = useLeagueInfo()
  const [selectedId, setSelectedId] = useState(null)

  const sorted = [...records].sort((a, b) => b.season_number - a.season_number)
  const selected = selectedId
    ? records.find(r => r.id === selectedId)
    : sorted[0] || null

  // Auto-select first when loaded
  if (!isLoading && records.length > 0 && !selectedId && sorted[0]) {
    setSelectedId(sorted[0].id)
  }

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

        {isLoading ? (
          <Loading />
        ) : records.length === 0 ? (
          <div className="card px-6 py-16 text-center">
            <Trophy className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">No season records yet</p>
            <p className="text-xs text-slate-600 mt-1">Admin can add season records from the Setup tab</p>
          </div>
        ) : (
          <>
            {/* Season selector dropdown */}
            <div className="relative">
              <select
                value={selectedId ?? ""}
                onChange={e => setSelectedId(parseInt(e.target.value))}
                className="w-full appearance-none bg-pitch-800 border border-surface-border rounded-xl px-4 py-3 text-sm font-semibold text-white focus:outline-none focus:border-accent/40 transition-colors cursor-pointer pr-10"
              >
                {sorted.map(r => (
                  <option key={r.id} value={r.id} className="bg-pitch-900 text-white">
                    {r.season_name || `Season ${r.season_number}`}
                    {r.year ? ` · ${r.year}` : ""}
                    {r.champion_team ? ` — 🏆 ${r.champion_team}` : ""}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* League Info Board — admin-managed entries */}
            {infoItems.length > 0 && (
              <div className="card overflow-hidden mt-4">
                <div className="divide-y divide-surface-border/50">
                  {infoItems.map(item => (
                    <div key={item.id} className="px-5 py-4">
                      <p className="text-sm font-bold text-accent mb-1">{item.title}</p>
                      <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{item.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Selected season detail */}
            {selected && <SeasonDetail record={selected} />}
          </>
        )}
      </div>
    </Layout>
  )
}