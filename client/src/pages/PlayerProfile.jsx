import { useState } from "react"
import { useParams, useNavigate, useSearchParams } from "react-router-dom"
import { ArrowLeft, Trophy, Swords, ImageIcon, Crown } from "lucide-react"
import Layout from "../components/layout/Layout"
import Loading from "../components/common/Loading"
import { usePlayer } from "../lib/queries"
import { cn } from "../lib/utils"
import ballondorTrophy from "../../images/ballondor.png"
import teamLeagueTrophy from "../../images/Team League.png"
import weeklyTrophy from "../../images/Weekly.png"
import uclTrophy from "../../images/ucl.png"

const MATCH_TYPE_OPTIONS = [
  { value: "all",    label: "Total matches" },
  { value: "league", label: "Team league"   },
  { value: "ucl",    label: "UCL"           },
  { value: "weekly", label: "Weekly"        },
]

const FormDot = ({ result }) => {
  const cls = { W: "bg-emerald-500", D: "bg-amber-400", L: "bg-rose-500" }
  return (
    <div className="flex flex-col items-center gap-1">
      <span className={cn("w-4 h-4 rounded-full", cls[result] || "bg-slate-600")} />
      <span className={cn(
        "text-xs font-bold",
        result === "W" ? "text-emerald-400" : result === "D" ? "text-amber-400" : "text-rose-400"
      )}>{result}</span>
    </div>
  )
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-sm font-semibold font-mono text-white">{value}</span>
    </div>
  )
}

function PlayerSquadCard({ player }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-surface-border">
        <ImageIcon className="w-4 h-4 text-accent" />
        <h2 className="text-base font-semibold text-white">Player squad</h2>
      </div>

      <div className="p-5">
        {player.imageUrl ? (
          <img
            src={player.imageUrl}
            alt={player.name}
            className="w-full aspect-[20/9] object-cover rounded-xl border border-surface-border"
          />
        ) : (
          <div className={cn(
            "w-full aspect-[20/9] rounded-xl border-2 border-dashed border-surface-border flex flex-col items-center justify-center gap-2",
            player.grade === "S" ? "bg-gold/10" : "bg-pitch-800"
          )}>
            <div className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-extrabold",
              player.grade === "S"
                ? "bg-gold/20 text-gold border-2 border-gold/40"
                : "bg-accent/20 text-accent border-2 border-accent/30"
            )}>
              {player.name?.split(" ").map(n => n[0]).join("")}
            </div>
            <p className="text-xs text-slate-500 mt-2">No squad image uploaded</p>
          </div>
        )}

        <div className="mt-4">
          <p className="text-sm font-semibold text-white">{player.name}</p>
          {player.alias && <p className="text-xs text-slate-500">"{player.alias}"</p>}
        </div>
      </div>
    </div>
  )
}

function HeadToHead({ matchHistory = [] }) {
  const [selectedOpp, setSelectedOpp] = useState("")

  const opponents = [...new Set(matchHistory.map(m => m.opponentName))]
  const records   = matchHistory.filter(m => m.opponentName === selectedOpp)
  const wins      = records.filter(m => m.result === "win").length
  const draws     = records.filter(m => m.result === "draw").length
  const losses    = records.filter(m => m.result === "loss").length
  const total     = wins + draws + losses

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-surface-border">
        <Swords className="w-4 h-4 text-violet-400" />
        <h2 className="text-base font-semibold text-white">Head-to-head record</h2>
      </div>

      <div className="p-5">
        <select
          value={selectedOpp}
          onChange={e => setSelectedOpp(e.target.value)}
          className="w-full bg-pitch-800 border border-surface-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent/40 transition-colors mb-4"
        >
          <option value="">Select opponent…</option>
          {opponents.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>

        {!selectedOpp && (
          <div className="py-8 text-center">
            <p className="text-slate-500 text-sm">Select an opponent to view head-to-head records</p>
          </div>
        )}

        {selectedOpp && (
          <div>
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-surface-border">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-surface-border flex items-center justify-center text-xs font-bold text-slate-400">
                  {selectedOpp.split(" ").map(n => n[0]).join("")}
                </div>
                <div>
                  <span className="text-sm font-semibold text-white">{selectedOpp}</span>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {total} match{total !== 1 ? "es" : ""}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold font-mono text-white">
                  {total ? Math.round((wins / total) * 100) : 0}%
                </p>
                <p className="text-xs text-slate-500 mt-0.5">win rate</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-emerald-400/10 border border-emerald-400/20 rounded-xl p-3 text-center">
                <p className="text-2xl font-extrabold font-mono text-emerald-400">{wins}</p>
                <p className="text-xs text-slate-500 mt-0.5">Wins</p>
              </div>
              <div className="bg-amber-400/10 border border-amber-400/20 rounded-xl p-3 text-center">
                <p className="text-2xl font-extrabold font-mono text-amber-400">{draws}</p>
                <p className="text-xs text-slate-500 mt-0.5">Draws</p>
              </div>
              <div className="bg-rose-400/10 border border-rose-400/20 rounded-xl p-3 text-center">
                <p className="text-2xl font-extrabold font-mono text-rose-400">{losses}</p>
                <p className="text-xs text-slate-500 mt-0.5">Losses</p>
              </div>
            </div>

            <div className="space-y-1.5">
              {records.map(m => (
                <div key={m.id}
                  className="flex items-center gap-3 bg-pitch-800 rounded-xl px-4 py-2.5 border border-surface-border">
                  <span className="text-xs text-slate-600 w-14 flex-shrink-0">
                    {m.date
                      ? new Date(m.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                      : "—"}
                  </span>
                  <span className={cn(
                    "text-xs font-bold px-2 py-0.5 rounded border flex-shrink-0",
                    m.result === "win"  ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/25"
                    : m.result === "draw" ? "bg-amber-400/10 text-amber-400 border-amber-400/25"
                    : "bg-rose-400/10 text-rose-400 border-rose-400/25"
                  )}>
                    {m.result.toUpperCase()}
                  </span>
                  {m.playerScore !== null && m.playerScore !== undefined && (
                    <span className="text-xs font-mono font-bold text-white">
                      {m.playerScore}-{m.opponentScore}
                    </span>
                  )}
                  {m.matchType && (
                    <span className="text-xs text-slate-500 capitalize ml-auto">{m.matchType}</span>
                  )}
                </div>
              ))}
</div>
          </div>
        )}
      </div>
    </div>
  )
}

function TrophyCase({ player }) {
  const trophies = [
    { image: ballondorTrophy,  label: "Ballon d'Or", count: player.trophy1Count ?? 0 },
    { image: teamLeagueTrophy, label: "Team League", count: player.trophy2Count ?? 0 },
    { image: uclTrophy,        label: "UCL",          count: player.trophy4Count ?? 0 },
    { image: weeklyTrophy,     label: "Weekly",      count: player.trophy3Count ?? 0 },
  ]

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-surface-border">
        <Trophy className="w-4 h-4 text-gold" />
        <h2 className="text-base font-semibold text-white">Trophies</h2>
      </div>
      <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
        {trophies.map((t, i) => (
          <div key={i} className="flex items-center gap-3 bg-pitch-800 rounded-xl p-4 border border-surface-border">
            <img src={t.image} alt={t.label} className="w-10 h-10 object-contain flex-shrink-0" />
            <div>
              <p className="text-2xl font-extrabold font-mono text-white">{t.count}</p>
              <p className="text-xs text-slate-500">{t.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
export default function PlayerProfile() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const showAuctionDelta = ["team", "admin"].includes(searchParams.get("ctx"))
  const { data: player, isLoading, isError } = usePlayer(id)

  const [summaryFilter, setSummaryFilter] = useState("all")

  if (isLoading) return <Layout><Loading /></Layout>
  if (isError || !player) return (
    <Layout>
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-slate-400">Player not found.</p>
        <button onClick={() => navigate(-1)} className="text-accent text-sm hover:underline">
          Go back
        </button>
      </div>
    </Layout>
  )

  const delta = player.isCaptain ? 0 : player.marketValue - player.auctionPrice

  const allHistory = player.matchHistory || []

  const filteredHistory = summaryFilter === "all"
    ? allHistory
    : allHistory.filter(m => m.matchType === summaryFilter)

  const filteredWins   = filteredHistory.filter(m => m.result === "win").length
  const filteredDraws  = filteredHistory.filter(m => m.result === "draw").length
  const filteredLosses = filteredHistory.filter(m => m.result === "loss").length
  const filteredTotal  = filteredWins + filteredDraws + filteredLosses

  // Goals scored — sum playerScore from all filtered matches
  const filteredGoals  = filteredHistory.reduce((sum, m) =>
    sum + (m.playerScore != null ? m.playerScore : 0), 0)
  const goalsPerMatch  = filteredTotal > 0
    ? (filteredGoals / filteredTotal).toFixed(1)
    : "—"

  return (
    <Layout>
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium mb-5 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* ── Hero ── */}
      <div className="relative rounded-2xl overflow-hidden border border-surface-border mb-6">
        <div className="absolute inset-0 bg-gradient-to-br from-pitch-800 via-pitch-800 to-pitch-700" />
        <div className={cn("absolute inset-0",
          player.grade === "S"
            ? "bg-[radial-gradient(ellipse_at_top_right,rgba(245,158,11,0.12),transparent_60%)]"
            : "bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.10),transparent_60%)]"
        )} />

        <div className="relative px-6 py-8 sm:px-10">
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold text-white mb-1">{player.name}</h1>
                {player.isCaptain && <Crown className="w-5 h-5 text-gold flex-shrink-0" />}
              </div>
              {player.alias && (
                <p className="text-slate-400 text-sm mb-1">"{player.alias}"</p>
              )}
              <p className="text-slate-500 text-sm">{player.team}</p>
            </div>

            {player.form?.length > 0 && (
              <div className="sm:ml-auto">
                <p className="text-xs text-slate-500 uppercase tracking-widest mb-2 font-semibold">
                  Recent form
                </p>
                <div className="flex items-end gap-3">
                  {player.form.map((r, i) => <FormDot key={i} result={r} />)}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3 mt-6">
            {[
              {
                label: "Auction price",
                value: player.isCaptain ? "CAP" : player.auctionPrice,
                cls: player.isCaptain ? "text-gold" : undefined,
              },
              {
                label: "Market value",
                value: player.marketValue,
                cls: player.grade === "S" ? "text-gold" : "text-accent",
              },
              { label: "BDR points", value: player.bdrPoints?.toLocaleString() ?? "—" },
            ].map(({ label, value, cls }) => (
              <div key={label} className="bg-pitch-800/60 border border-surface-border rounded-xl px-5 py-3 text-center">
                <p className="text-xs text-slate-500 mb-1">{label}</p>
                <p className={cn("text-xl font-extrabold font-mono", cls || "text-white")}>{value}</p>
              </div>
            ))}
          </div>

{showAuctionDelta && !player.isCaptain && (
            <div className="flex items-center gap-3 mt-4">
              <span className={cn(
                "text-sm font-semibold font-mono px-3 py-1 rounded-lg border",
                delta > 0  ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/25"
                : delta < 0 ? "text-rose-400 bg-rose-400/10 border-rose-400/25"
                : "text-slate-400 bg-surface-border border-surface-border"
              )}>
                {delta > 0 ? "+" : ""}{delta} from auction
              </span>
            </div>
          )}
          {player.isCaptain && (
            <div className="flex items-center gap-2 mt-4">
              <span className="text-sm font-semibold font-mono px-3 py-1 rounded-lg border text-gold bg-gold/10 border-gold/25 flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5" /> Team captain
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Left — Match history + Head-to-head */}
        <div className="xl:col-span-2 space-y-6">
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-surface-border">
              <h2 className="text-base font-semibold text-white">Match history</h2>
              {allHistory.length > 5 && (
                <p className="text-xs text-slate-500 mt-0.5">
                  Showing last 5 of {allHistory.length} matches
                </p>
              )}
            </div>

            {!allHistory.length ? (
              <div className="px-5 py-12 text-center text-slate-500 text-sm">
                No matches logged yet.
              </div>
            ) : (
              <div className="divide-y divide-surface-border/50">
                {allHistory.slice(0, 5).map(m => (
                  <div key={m.id}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-hover transition-colors">
                    <span className="text-xs text-slate-600 w-14 flex-shrink-0">
                      {m.date
                        ? new Date(m.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                        : "—"}
                    </span>
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <span className="text-sm text-slate-300 truncate">vs {m.opponentName}</span>
                      {m.playerScore !== null && m.playerScore !== undefined && (
                        <span className="text-xs font-mono font-bold text-white px-1.5 py-0.5 rounded bg-pitch-800 border border-surface-border flex-shrink-0">
                          {m.playerScore}-{m.opponentScore}
                        </span>
                      )}
                      {m.matchType && m.matchType !== "league" && (
                        <span className="text-xs text-slate-500 capitalize hidden sm:inline">
                          · {m.matchType.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <span className={cn(
                      "text-xs font-bold px-2 py-0.5 rounded border flex-shrink-0",
                      m.result === "win"  ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/25"
                      : m.result === "draw" ? "bg-amber-400/10 text-amber-400 border-amber-400/25"
                      : "bg-rose-400/10 text-rose-400 border-rose-400/25"
                    )}>
                      {m.result.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <HeadToHead matchHistory={allHistory} />
        </div>

        {/* Right — Player squad, Season summary */}
        <div className="space-y-6">

          <PlayerSquadCard player={player} />

          {/* Season summary */}
          <div className="card overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-surface-border">
              <Trophy className="w-4 h-4 text-gold" />
              <h2 className="text-base font-semibold text-white">Season summary</h2>
            </div>

            <div className="px-5 pt-4">
              <select
                value={summaryFilter}
                onChange={e => setSummaryFilter(e.target.value)}
                className="w-full bg-pitch-800 border border-surface-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent/40 transition-colors"
              >
                {MATCH_TYPE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div className="p-5 grid grid-cols-3 gap-3">
              {[
                { label: "Wins",   value: filteredWins,   color: "text-emerald-400" },
                { label: "Draws",  value: filteredDraws,  color: "text-amber-400"  },
                { label: "Losses", value: filteredLosses, color: "text-rose-400"   },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-pitch-800 rounded-xl p-3 text-center border border-surface-border">
                  <p className={cn("text-2xl font-extrabold font-mono", color)}>{value}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            <div className="px-5 pb-5 space-y-2.5">
              <SummaryRow label="Games played" value={filteredTotal} />
              <SummaryRow
                label="Win rate"
                value={filteredTotal ? `${Math.round((filteredWins / filteredTotal) * 100)}%` : "—"}
              />
              <SummaryRow label="Goals scored" value={filteredGoals} />
              <SummaryRow label="Goals per match" value={goalsPerMatch} />
              <SummaryRow label="BDR points" value={player.bdrPoints?.toLocaleString() ?? "—"} />
            </div>
          </div>

        </div>
      </div>

      {/* ── Trophies (full width row) ── */}
      <div className="mt-6">
        <TrophyCase player={player} />
      </div>
    </Layout>
  )
}