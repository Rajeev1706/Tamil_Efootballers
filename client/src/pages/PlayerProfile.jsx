import { useState } from "react"
import { useParams, useNavigate, useSearchParams } from "react-router-dom"
import { ArrowLeft, Trophy, ImageIcon, Crown, UserRound, Pencil } from "lucide-react"
import Layout from "../components/layout/Layout"
import Loading from "../components/common/Loading"
import AvatarPicker from "../components/player/AvatarPicker"
import { usePlayer } from "../lib/queries"
import { useTeamColor, readableTeamColor } from "../lib/teamColor"
import { getAvatarById } from "../lib/avatars"
import { cn } from "../lib/utils"
import ballondorTrophy    from "../../images/ballondor.png"
import teamLeagueTrophy   from "../../images/Team League.png"
import weeklyTrophy       from "../../images/Weekly.png"
import uclTrophy          from "../../images/ucl.png"
import goldenBootTrophy   from "../../images/Golden Boot.png"
import teamLeagueGBTrophy from "../../images/team league_gb.png"
import uclGBTrophy        from "../../images/ucl_gb.png"

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

import HeadToHead from "../components/player/HeadToHead"
import SeasonSummary from "../components/player/SeasonSummary"

function TrophyCase({ player }) {
  const trophies = [
    { image: ballondorTrophy,    label: "Ballon d'Or",             count: player.trophy1Count ?? 0 },
    { image: teamLeagueTrophy,   label: "Team League",             count: player.trophy2Count ?? 0 },
    { image: uclTrophy,          label: "UCL",                     count: player.trophy4Count ?? 0 },
    { image: weeklyTrophy,       label: "Weekly",                  count: player.trophy3Count ?? 0 },
    { image: goldenBootTrophy,   label: "Weekly Golden Boot",      count: player.trophy5Count ?? 0 },
    { image: teamLeagueGBTrophy, label: "Team League Golden Boot", count: player.trophy6Count ?? 0 },
    { image: uclGBTrophy,        label: "UCL Golden Boot",         count: player.trophy7Count ?? 0 },
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
  const teamColor = useTeamColor(player?.teamLogo)
  const teamTextColor = readableTeamColor(teamColor)
  const presetAvatar = getAvatarById(player?.avatarId)
  const avatarThumb  = player?.avatarUrl    || presetAvatar?.thumb || null
  const avatarBg     = player?.avatarBgUrl  || presetAvatar?.bg    || null
  const [pickerOpen, setPickerOpen] = useState(false)

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

  return (
    <Layout backgroundImage={avatarBg}>
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium mb-5 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* ── Hero ── */}
      <div className="relative rounded-2xl overflow-hidden border border-surface-border mb-6">
        {/* Mobile only — full-page bg is hidden below sm, so the hero gets
            its own boxed-in copy of the character image instead */}
        {avatarBg && (
          <div className="sm:hidden">
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${avatarBg})` }}
            />
            <div className="absolute inset-0 bg-pitch-900/70" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-br from-pitch-800 via-pitch-800 to-pitch-700"
          style={avatarBg ? { opacity: 0.45 } : undefined}
        />
        <div className={cn("absolute inset-0",
          player.grade === "S"
            ? "bg-[radial-gradient(ellipse_at_top_right,rgba(245,158,11,0.12),transparent_60%)]"
            : "bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.10),transparent_60%)]"
        )} />

        <div className="relative px-6 py-8 sm:px-10">
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="flex items-start gap-4">
              <button
                onClick={() => setPickerOpen(true)}
                className="group relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex-shrink-0 overflow-hidden border border-surface-border bg-pitch-800 flex items-center justify-center"
                title="Choose avatar"
              >
                {avatarThumb ? (
                  <img src={avatarThumb} alt={player.name} className="w-full h-full object-cover" />
                ) : (
                  <UserRound className="w-7 h-7 text-slate-600" />
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Pencil className="w-5 h-5 text-white" />
                </div>
              </button>
              <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold text-white mb-1">{player.name}</h1>
                {player.isCaptain && <Crown className="w-5 h-5 text-gold flex-shrink-0" />}
              </div>
              {player.alias && (
                <p className="text-slate-400 text-sm mb-1">"{player.alias}"</p>
              )}
              {player.team && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 text-xs font-bold tracking-wide rounded-lg px-3 py-1.5 mt-1 border",
                    !teamColor && "text-accent bg-accent/10 border-accent/25"
                  )}
                  style={teamColor ? {
                    color: teamTextColor,
                    background: `linear-gradient(90deg, rgba(${teamColor.css},0.16), rgba(${teamColor.css},0.05))`,
                    borderColor: `rgba(${teamColor.css},0.4)`,
                    boxShadow: `0 0 14px rgba(${teamColor.css},0.15)`,
                  } : undefined}
                >
                  <span
                    className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", !teamColor && "bg-accent")}
                    style={teamColor ? { background: teamTextColor } : undefined}
                  />
                  {player.team}
                </span>
              )}
            </div>
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
          <SeasonSummary player={player} />

        </div>
      </div>

      {/* ── Trophies (full width row) ── */}
      <div className="mt-6">
        <TrophyCase player={player} />
      </div>

      {pickerOpen && (
        <AvatarPicker
          player={player}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </Layout>
  )
}