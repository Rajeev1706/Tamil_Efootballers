import { useParams, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Trophy, ArrowLeft, TrendingDown, TrendingUp, Shield, Star, ChevronDown, ChevronUp } from "lucide-react"
import { useState } from "react"
import Layout from "../components/layout/Layout"
import { useCachedImage } from "../hooks/useCachedImage"
import api from "../lib/api"
import { cn } from "../lib/utils"
import AITeamSeasonSummary from "../components/team/AITeamSeasonSummary"
import { useAuthStore } from "../store/authStore"

import teamLeagueTrophy  from "../../images/Team League.png"
import uclTrophy         from "../../images/ucl.png"
import weeklyTrophy      from "../../images/Weekly.png"
import ballonDorTrophy   from "../../images/ballondor.png"
import revolutionTrophy  from "../../images/revolution.png"
import championshipImg   from "../../images/championship.png"
import europaTrophy      from "../../images/europa.png"

// ── Ordinal helper ─────────────────────────────────────────────────────────────
function ordinal(n) {
  if (!n) return "—"
  const s = ["th","st","nd","rd"]
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

// ── Position badge colors ──────────────────────────────────────────────────────
function positionStyle(pos) {
  if (!pos) return { bg: "bg-pitch-800", text: "text-slate-500", border: "border-surface-border" }
  if (pos === 1) return { bg: "bg-gold/10",    text: "text-gold",         border: "border-gold/30" }
  if (pos === 2) return { bg: "bg-slate-400/10", text: "text-slate-300", border: "border-slate-400/30" }
  if (pos === 3) return { bg: "bg-amber-700/10", text: "text-amber-600", border: "border-amber-700/30" }
  return { bg: "bg-pitch-800", text: "text-slate-400", border: "border-surface-border" }
}

// ── Trophy shelf (mirrors player cabinet) ─────────────────────────────────────
const TEAM_TROPHY_TYPES = {
  team_league:  { key: "team_league",  image: teamLeagueTrophy, label: "Dshann League",  color: "#10b981", glow: "rgba(16,185,129,0.45)"  },
  championship: { key: "championship", image: championshipImg,  label: "Team of Champions", color: "#f59e0b", glow: "rgba(245,158,11,0.45)"   },
  europa:       { key: "europa",       image: europaTrophy,     label: "Europa",       color: "#818cf8", glow: "rgba(129,140,248,0.45)"  },
}

function SingleTrophy({ type }) {
  return (
    <div className="flex flex-col items-center gap-0 group flex-shrink-0 -mt-1">
      <div
        className="transition-all duration-300 group-hover:scale-105 sm:group-hover:-translate-y-2 mt-4 flex items-end justify-center"
        style={{ height: "80px", filter: `drop-shadow(0 4px 10px ${type.glow.replace("0.45)", "0.2)")})` }}
      >
        <img src={type.image} alt={type.label} className="w-10 sm:w-20 object-contain max-h-full" />
      </div>
      <div
        className="mt-1 px-2 py-0.5 rounded text-center"
        style={{
          background: "linear-gradient(135deg,#1a1a2e 0%,#16213e 100%)",
          border: `1px solid ${type.color}35`,
          boxShadow: `inset 0 1px 0 ${type.color}15`,
        }}
      >
        <p className="text-[7px] sm:text-[11px] font-bold leading-tight max-w-[50px] sm:max-w-[80px] text-center"
          style={{ color: type.color }}>
          {type.label}
        </p>
      </div>
    </div>
  )
}

function CabinetShelf({ items }) {
  return (
    <div className="relative">
      <div
        className="relative rounded-xl px-0 pt-2 sm:pt-3 pb-0"
        style={{ background: "rgba(0,0,0,0.25)", borderTop: "1px solid rgba(255,255,255,0.04)" }}
      >
        <div className="flex items-end justify-evenly w-full px-1 sm:px-6 overflow-x-auto">
          {items.map((type, i) => <SingleTrophy key={i} type={type} />)}
        </div>
        <div
          className="h-3 mt-2 relative"
          style={{
            background: "linear-gradient(180deg,#2a3344 0%,#1a2233 40%,#111827 100%)",
            boxShadow: "0 6px 20px rgba(0,0,0,0.9),inset 0 1px 0 rgba(255,255,255,0.08)",
          }}
        >
          <div className="absolute inset-0 opacity-20"
            style={{ backgroundImage: "repeating-linear-gradient(90deg,transparent,transparent 40px,rgba(255,255,255,0.03) 40px,rgba(255,255,255,0.03) 41px)" }}
          />
        </div>
      </div>
    </div>
  )
}

const TROPHIES_PER_SHELF = 5

// ── Season History Row ─────────────────────────────────────────────────────────
function generateSummary(season, teamName, isChampion) {
  const { squad = [], seasonStats = {} } = season
  const totalPlayers = squad.length
  const winRate = seasonStats.matches > 0
    ? Math.round((seasonStats.wins / seasonStats.matches) * 100) : 0
  const topScorer = squad.sort((a, b) => b.goals - a.goals)[0]
  const topPerformer = squad.sort((a, b) => b.wins - a.wins)[0]

  const openers = [
    `Season ${season.season_number} was a defining chapter for ${teamName}.`,
    `${teamName} made their mark in Season ${season.season_number}.`,
    `It was a memorable season for ${teamName} in Season ${season.season_number}.`,
    `Season ${season.season_number} saw ${teamName} put in a determined campaign.`,
  ]
  const opener = openers[season.season_number % openers.length]

  const squadLine = totalPlayers > 0 ? ` The squad had ${totalPlayers} players.` : ""

  const resultLines = isChampion
    ? [` They lifted the Dshann League title`, ` They were crowned Dshann League champions`, ` A historic triumph — the Dshann League title was theirs`]
    : season.relegated
    ? [` It ended in relegation`, ` The season ended in heartbreak with relegation`]
    : winRate >= 60
    ? [` A strong campaign with ${winRate}% win rate`, ` Solid performances saw them win ${winRate}% of their games`]
    : winRate >= 40
    ? [` A balanced season — winning ${winRate}% of games`, ` Mixed results saw a ${winRate}% win rate`]
    : [` A tough season with only ${winRate}% wins`, ` They struggled, managing just ${winRate}% wins`]
  const resultLine = (resultLines[season.season_number % resultLines.length] || resultLines[0])
    + (seasonStats.matches ? ` across ${seasonStats.matches} matches.` : ".")

  const performerLine = topPerformer
    ? ` ${topPerformer.name} stood out with ${topPerformer.wins} wins.` : ""
  const goalLine = seasonStats.goals > 0
    ? ` The team scored ${seasonStats.goals} goals in total.` : ""

  return opener + squadLine + resultLine + performerLine + goalLine
}

function SeasonRow({ season, trophySeasons, teamName }) {
  const [expanded, setExpanded]  = useState(false)
  const isChampion    = trophySeasons.includes(season.season_number)
  const leagueStyle   = positionStyle(season.team_league_pos)
  const champStyle    = positionStyle(season.championship_pos)
  const squad         = season.squad || []
  const summary       = generateSummary(season, teamName, isChampion)

  return (
    <div className={cn(
      "border-b border-surface-border/40 last:border-0 transition-colors",
      season.relegated ? "bg-rose-950/10" : isChampion ? "bg-gold/5" : ""
    )}>
    <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-3 items-center px-4 py-3 cursor-pointer hover:bg-white/3"
      onClick={() => setExpanded(e => !e)}>
      {/* Season label */}
      <div className="flex flex-col items-center min-w-[52px]">
        <span className="text-xs font-bold text-slate-300">S{season.season_number}</span>
        {season.year && <span className="text-[10px] text-slate-600">{season.year}</span>}
      </div>

      {/* Team League position */}
      <div className="flex flex-col items-center gap-1">
        <span className="text-[9px] text-slate-600 uppercase tracking-wide font-semibold">League</span>
        {season.team_league_pos ? (
          <span className={cn(
            "text-sm font-extrabold font-mono px-2 py-0.5 rounded-lg border",
            leagueStyle.bg, leagueStyle.text, leagueStyle.border
          )}>
            {ordinal(season.team_league_pos)}
          </span>
        ) : (
          <span className="text-xs text-slate-600">—</span>
        )}
        {isChampion && season.team_league_pos === 1 && (
          <span className="text-[9px] text-gold flex items-center gap-0.5">
            <Trophy className="w-2.5 h-2.5" /> Champions
          </span>
        )}
      </div>

      {/* Championship position */}
      <div className="flex flex-col items-center gap-1">
        <span className="text-[9px] text-slate-600 uppercase tracking-wide font-semibold">Team of Champions</span>
        <span className={cn(
          "text-sm font-extrabold font-mono px-2 py-0.5 rounded-lg border",
          champStyle.bg, champStyle.text, champStyle.border
        )}>
          {season.championship_pos ? ordinal(season.championship_pos) : "—"}
        </span>
      </div>

      {/* Relegated badge */}
      <div className="flex items-center justify-end min-w-[70px]">
        {season.relegated ? (
          <span className="flex items-center gap-1 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded-full text-rose-400 text-[10px] font-bold">
            <TrendingDown className="w-3 h-3" /> Relegated
          </span>
        ) : isChampion ? (
          <span className="flex items-center gap-1 bg-gold/10 border border-gold/30 px-2 py-0.5 rounded-full text-gold text-[10px] font-bold">
            <Trophy className="w-3 h-3" /> Winner
          </span>
        ) : null}
      </div>
    </div>

    {/* Expanded squad + summary */}
    {expanded && (
      <div className="px-4 pb-4 space-y-3">
        {/* Auto-generated summary */}
        <p className="text-xs text-slate-400 italic leading-relaxed border-l-2 border-accent/40 pl-3">
          {summary}
        </p>
        {/* Squad chips */}
        {squad.length > 0 && (
          <div>
            <p className="text-[10px] text-slate-600 uppercase tracking-widest font-semibold mb-2">
              Squad ({squad.length} players)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {squad.map(p => (
                <span key={p.id}
                  className="text-xs bg-pitch-800 border border-surface-border rounded-full px-2.5 py-1 text-slate-300 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent/60 flex-shrink-0" />
                  {p.name}
                  <span className="text-slate-600 text-[10px]">{p.wins}W</span>
                </span>
              ))}
            </div>
          </div>
        )}
        {squad.length === 0 && (
          <p className="text-xs text-slate-600">No match records found for this season.</p>
        )}
      </div>
    )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function TeamTrophyDetail() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const authUser = useAuthStore(s => s.user)
  const isAdmin  = authUser?.role === "admin"
  const [showAllHistory, setShowAllHistory] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ["team-trophies", id],
    queryFn:  () => api.get(`/team-trophies/${id}`).then(r => r.data),
  })

  const logoSrc = useCachedImage(data?.team?.logoUrl)

  if (isLoading) return (
    <Layout>
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    </Layout>
  )

  if (!data?.team) return <Layout><p className="text-slate-500 text-center py-16">Team not found</p></Layout>

  const { team, trophies = [], history = [], stats = {}, winRate = {} } = data

  // Build trophy shelf instances — one entry per trophy, using the correct image per tournament
  const trophyInstances = trophies.map(t => TEAM_TROPHY_TYPES[t.tournament] || TEAM_TROPHY_TYPES.team_league)
  const shelves = []
  for (let i = 0; i < trophyInstances.length; i += TROPHIES_PER_SHELF) {
    shelves.push(trophyInstances.slice(i, i + TROPHIES_PER_SHELF))
  }

  const trophySeasonNumbers = trophies.filter(t => t.tournament === "team_league").map(t => t.season_number)
  const teamLeagueCount  = trophies.filter(t => t.tournament === "team_league").length
  const championshipCount = trophies.filter(t => t.tournament === "championship").length
  const europaCount      = trophies.filter(t => t.tournament === "europa").length
  const totalTrophies    = trophies.length
  const relegationCount = stats.relegationCount || 0

  // Show first 5 seasons collapsed, rest expanded
  const VISIBLE_ROWS = 5
  const visibleHistory = showAllHistory ? history : history.slice(0, VISIBLE_ROWS)

  return (
    <Layout>
      <button onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium mb-5 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Team header */}
      <div className="flex items-center gap-4 mb-6">
        {logoSrc
          ? <img src={logoSrc} alt={team.name} className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-gold/30 flex-shrink-0" />
          : <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gold/10 border-2 border-gold/30 flex items-center justify-center text-xl font-black text-gold flex-shrink-0">
              {team.name?.slice(0, 2).toUpperCase()}
            </div>
        }
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white">{team.name}</h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {totalTrophies > 0 && (
              <span className="flex items-center gap-1.5 text-gold text-sm font-bold">
                <Trophy className="w-4 h-4" />
                {totalTrophies} {totalTrophies === 1 ? "Title" : "Titles"}
              </span>
            )}
            {relegationCount > 0 && (
              <span className="flex items-center gap-1.5 text-rose-400 text-sm font-semibold">
                <TrendingDown className="w-4 h-4" />
                {relegationCount}× Relegated
              </span>
            )}
            {stats.bestLeaguePos && (
              <span className="flex items-center gap-1.5 text-slate-400 text-xs">
                <Star className="w-3 h-3 text-slate-500" />
                Best: {ordinal(stats.bestLeaguePos)} in league
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Summary stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <div className="card p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <img src={teamLeagueTrophy} alt="Dshann League" className="w-5 h-5 object-contain" />
            <p className="text-2xl font-extrabold text-accent font-mono">{teamLeagueCount}</p>
          </div>
          <p className="text-xs text-slate-500">Team League</p>
        </div>
        <div className="card p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <img src={championshipImg} alt="Team of Champions" className="w-5 h-5 object-contain" />
            <p className="text-2xl font-extrabold text-gold font-mono">{championshipCount}</p>
          </div>
          <p className="text-xs text-slate-500">Team of Champions</p>
        </div>
        <div className="card p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <img src={europaTrophy} alt="Europa" className="w-5 h-5 object-contain" />
            <p className="text-2xl font-extrabold text-violet-400 font-mono">{europaCount}</p>
          </div>
          <p className="text-xs text-slate-500">Europa</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-extrabold text-rose-400 font-mono">{relegationCount}</p>
          <p className="text-xs text-slate-500 mt-1">Relegations</p>
        </div>
        {/* Win Rate */}
        <div className="card p-4 text-center col-span-2 sm:col-span-1">
          <p className="text-2xl font-extrabold font-mono"
            style={{ color: winRate.rate >= 60 ? "#10b981" : winRate.rate >= 45 ? "#f59e0b" : "#f43f5e" }}>
            {winRate.rate !== null && winRate.rate !== undefined ? `${winRate.rate}%` : "—"}
          </p>
          <p className="text-xs text-slate-500 mt-1">Win Rate</p>
          {winRate.played > 0 && (
            <p className="text-[10px] text-slate-600 mt-0.5">
              {winRate.wins}W · {winRate.draws}D · {winRate.losses}L
            </p>
          )}
        </div>
      </div>

      {/* ── Trophy Cabinet ── */}
      <div className="mb-6">
        <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-3">Trophy Cabinet</p>

        {totalTrophies === 0 ? (
          <div
            className="rounded-2xl p-16 text-center"
            style={{
              background: "linear-gradient(180deg, #080d14 0%, #0d1520 100%)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <div className="text-6xl mb-4 opacity-10">🏆</div>
            <p className="text-slate-600 font-semibold">No trophies yet</p>
            <p className="text-slate-700 text-sm mt-1">The cabinet awaits its first glory</p>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={{ background: "transparent" }}>
            {/* Header plate */}
            <div
              className="px-6 py-4 flex items-center justify-between"
              style={{ background: "rgba(0,0,0,0.3)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div className="flex items-center gap-3">
                <div className="w-1 h-8 rounded-full bg-gold" style={{ boxShadow: "0 0 8px rgba(245,158,11,0.6)" }} />
                <div>
                  <p className="text-[9px] text-slate-600 uppercase tracking-[0.2em]">Tamil Efootballers</p>
                  <p className="text-sm font-bold text-white">{team.name}'s Trophy Cabinet</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black text-gold font-mono" style={{ textShadow: "0 0 20px rgba(245,158,11,0.4)" }}>
                  {totalTrophies}
                </p>
                <p className="text-[9px] text-slate-600 uppercase tracking-widest">{totalTrophies === 1 ? "Title" : "Titles"}</p>
              </div>
            </div>

            {/* Shelves */}
            <div className="flex">
              <div className="w-1 sm:w-2 flex-shrink-0"
                style={{ background: "linear-gradient(90deg,#0a0f1a 0%,#111827 100%)", borderRight: "1px solid rgba(255,255,255,0.03)" }} />
              <div className="flex-1 py-4 space-y-1">
                {shelves.map((shelf, idx) => <CabinetShelf key={idx} items={shelf} />)}
              </div>
              <div className="w-1 sm:w-2 flex-shrink-0"
                style={{ background: "linear-gradient(270deg,#0a0f1a 0%,#111827 100%)", borderLeft: "1px solid rgba(255,255,255,0.03)" }} />
            </div>

            {/* Winning seasons list — grouped by trophy type */}
            <div className="px-6 pt-3 pb-4" style={{ background: "rgba(0,0,0,0.2)" }}>
              <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-2">All Trophies</p>
              <div className="flex flex-wrap gap-2">
                {trophies.map(t => {
                  const type = TEAM_TROPHY_TYPES[t.tournament] || TEAM_TROPHY_TYPES.team_league
                  return (
                    <div key={t.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border"
                      style={{ borderColor: `${type.color}40`, background: `${type.color}12` }}
                    >
                      <img src={type.image} alt={type.label} className="w-4 h-4 object-contain flex-shrink-0" />
                      <span className="text-xs font-bold" style={{ color: type.color }}>
                        {type.label} · S{t.season_number}{t.year ? ` · ${t.year}` : ""}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── AI Season Summary ── */}
      {history.length > 0 && (
        <div className="mb-6">
          <AITeamSeasonSummary
            teamId={id}
            seasons={history.map(h => h.season_number).sort((a, b) => b - a)}
            isAdmin={isAdmin}
          />
        </div>
      )}

      {/* ── Season-by-season history ── */}
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-3">Season History</p>

        {history.length === 0 ? (
          <div className="card p-10 text-center">
            <Shield className="w-8 h-8 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-600 font-semibold text-sm">No season history recorded yet</p>
            <p className="text-slate-700 text-xs mt-1">Admin can add season-by-season records from the admin panel</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            {/* Column headers */}
            <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-3 px-4 py-2 bg-pitch-800/50 border-b border-surface-border">
              <span className="text-[10px] text-slate-600 uppercase tracking-wide font-semibold min-w-[52px]">Season</span>
              <span className="text-[10px] text-slate-600 uppercase tracking-wide font-semibold text-center">League Pos</span>
              <span className="text-[10px] text-slate-600 uppercase tracking-wide font-semibold text-center">Team of Champions</span>
              <span className="text-[10px] text-slate-600 uppercase tracking-wide font-semibold min-w-[70px]"></span>
            </div>

            {visibleHistory.map(season => (
              <SeasonRow key={season.id} season={season} trophySeasons={trophySeasonNumbers} teamName={team.name} />
            ))}

            {history.length > VISIBLE_ROWS && (
              <button
                onClick={() => setShowAllHistory(v => !v)}
                className="w-full flex items-center justify-center gap-2 py-3 text-xs text-slate-500 hover:text-slate-300 transition-colors border-t border-surface-border/40"
              >
                {showAllHistory
                  ? <><ChevronUp className="w-3.5 h-3.5" /> Show less</>
                  : <><ChevronDown className="w-3.5 h-3.5" /> Show {history.length - VISIBLE_ROWS} more seasons</>
                }
              </button>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}