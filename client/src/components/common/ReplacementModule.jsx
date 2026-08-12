/**
 * ReplacementModule.jsx
 *
 * Suggests replacement players for each player on a team.
 * Replacement candidates: unassigned players (no team) with the same grade,
 * ranked by closest win rate to the player being replaced.
 *
 * Props:
 *   players   — all players (from usePlayers())
 *   myTeamId  — if set, only shows that team's players (team dashboard mode)
 *               if null/undefined, shows all teams (admin mode)
 */
import { useState, useMemo } from "react"
import { RefreshCw, ChevronDown, ChevronUp, Search } from "lucide-react"
import { cn } from "../../lib/utils"
import PlayerAvatarIcon from "../common/PlayerAvatarIcon"
import GradeBadge from "../common/GradeBadge"

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcWinRate(form = []) {
  if (!form?.length) return null
  return Math.round(form.filter(f => f === "W").length / form.length * 100)
}

function winRateLabel(wr) {
  if (wr == null) return "No data"
  if (wr >= 70) return `${wr}% 🔥`
  if (wr >= 50) return `${wr}% ✅`
  return `${wr}% ⚠️`
}

function findReplacements(player, pool, count = 3) {
  const playerWR = calcWinRate(player.form)

  return pool
    .filter(p =>
      p.grade === player.grade &&
      p.id !== player.id
    )
    .map(p => {
      const candidateWR = calcWinRate(p.form)
      // Distance = difference in win rate. Null treated as 50% baseline.
      const pWR = playerWR ?? 50
      const cWR = candidateWR ?? 50
      const distance = Math.abs(pWR - cWR)
      return { ...p, candidateWR, distance }
    })
    .sort((a, b) => a.distance - b.distance)
    .slice(0, count)
}

// ── Replacement card for one candidate ───────────────────────────────────────

function CandidateCard({ candidate, playerWR }) {
  const wr = candidate.candidateWR
  const diff = wr != null && playerWR != null ? wr - playerWR : null

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-pitch-800/60 border border-surface-border/50 hover:border-accent/20 transition-colors">
      <PlayerAvatarIcon player={candidate} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{candidate.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <GradeBadge grade={candidate.grade} size="xs" />
          <span className="text-xs text-slate-500">MV ₹{candidate.marketValue ?? "?"}</span>
          <span className="text-xs text-slate-500">BDR {candidate.bdrPoints ?? 0}</span>
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <p className={cn("text-xs font-semibold",
          wr == null ? "text-slate-500" :
          wr >= 70 ? "text-emerald-400" :
          wr >= 50 ? "text-white" : "text-amber-400"
        )}>
          {wr != null ? `${wr}% WR` : "No data"}
        </p>
        {diff != null && (
          <p className={cn("text-[10px]",
            diff > 0 ? "text-emerald-400" : diff < 0 ? "text-rose-400" : "text-slate-500"
          )}>
            {diff > 0 ? `+${diff}%` : diff < 0 ? `${diff}%` : "Same WR"}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Player row with expandable replacements ───────────────────────────────────

function PlayerReplacementRow({ player, replacements }) {
  const [open, setOpen] = useState(false)
  const wr = calcWinRate(player.form)

  return (
    <div className="border-b border-surface-border/50 last:border-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-pitch-800/30 transition-colors text-left"
      >
        <PlayerAvatarIcon player={player} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white truncate">{player.name}</span>
            <GradeBadge grade={player.grade} size="xs" />
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {wr != null ? `${wr}% win rate` : "No match data"} · MV ₹{player.marketValue ?? "?"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-slate-500">
            {replacements.length} suggestion{replacements.length !== 1 ? "s" : ""}
          </span>
          {open ? (
            <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
          )}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-3 space-y-1.5">
          {replacements.length === 0 ? (
            <p className="text-xs text-slate-600 text-center py-2">
              No unassigned {player.grade}-grade players available.
            </p>
          ) : (
            replacements.map(c => (
              <CandidateCard key={c.id} candidate={c} playerWR={wr} />
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── Team section ──────────────────────────────────────────────────────────────

function TeamSection({ teamName, players, pool }) {
  const [open, setOpen] = useState(true)

  const playersWithRecs = useMemo(() => {
    return players.map(p => ({
      player: p,
      replacements: findReplacements(p, pool),
    }))
  }, [players, pool])

  const totalRecs = playersWithRecs.reduce((s, r) => s + r.replacements.length, 0)

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-3.5 border-b border-surface-border bg-pitch-800/30 text-left hover:bg-pitch-800/50 transition-colors"
      >
        <RefreshCw className="w-4 h-4 text-accent flex-shrink-0" />
        <span className="text-sm font-semibold text-white flex-1">{teamName}</span>
        <span className="text-xs text-slate-500">{players.length} players · {totalRecs} total suggestions</span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>

      {open && (
        <div>
          {playersWithRecs.map(({ player, replacements }) => (
            <PlayerReplacementRow
              key={player.id}
              player={player}
              replacements={replacements}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function ReplacementModule({ players = [], myTeamId }) {
  const [search, setSearch]     = useState("")
  const [gradeFilter, setGrade] = useState("All")

  // Unassigned players = the replacement pool
  const pool = useMemo(() =>
    players.filter(p => !p.teamId),
    [players]
  )

  // Players on teams
  const assignedPlayers = useMemo(() =>
    players.filter(p => p.teamId),
    [players]
  )

  // Group by team
  const teamGroups = useMemo(() => {
    const groups = {}
    for (const p of assignedPlayers) {
      const key = p.teamId
      if (!groups[key]) groups[key] = { teamName: p.team ?? "Unknown", players: [] }
      groups[key].players.push(p)
    }
    return groups
  }, [assignedPlayers])

  // Filter logic
  const filteredGroups = useMemo(() => {
    const entries = Object.entries(teamGroups)

    // In team dashboard mode — only show myTeamId
    const filtered = myTeamId
      ? entries.filter(([teamId]) => parseInt(teamId) === myTeamId)
      : entries

    return filtered.map(([teamId, { teamName, players }]) => {
      let pts = players
      if (search) pts = pts.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
      if (gradeFilter !== "All") pts = pts.filter(p => p.grade === gradeFilter)
      return { teamId, teamName, players: pts }
    }).filter(g => g.players.length > 0)
  }, [teamGroups, myTeamId, search, gradeFilter])

  const poolSize = pool.length

  return (
    <div className="space-y-4">
      {/* Header info */}
      <div className="card px-5 py-4">
        <div className="flex items-center gap-2 mb-2">
          <RefreshCw className="w-4 h-4 text-accent" />
          <span className="text-sm font-semibold text-white">Player Replacement Recommendations</span>
        </div>
        <p className="text-xs text-slate-500">
          Suggests unassigned players as replacements based on the same grade and closest win rate.
          <span className="ml-1 text-accent font-semibold">{poolSize} unassigned player{poolSize !== 1 ? "s" : ""}</span> in the replacement pool.
        </p>
        {poolSize === 0 && (
          <p className="text-xs text-amber-400 mt-2">⚠️ No unassigned players available — all players are currently assigned to teams.</p>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search player..."
            className="w-full pl-8 pr-3 py-2 bg-pitch-800 border border-surface-border rounded-lg text-sm text-white focus:outline-none focus:border-accent/40"
          />
        </div>
        <select
          value={gradeFilter}
          onChange={e => setGrade(e.target.value)}
          className="bg-pitch-800 border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/40"
        >
          {["All", "S", "A+", "A", "B", "C"].map(g => (
            <option key={g} value={g}>{g === "All" ? "All Grades" : `Grade ${g}`}</option>
          ))}
        </select>
      </div>

      {/* Team sections */}
      {filteredGroups.length === 0 ? (
        <div className="card px-6 py-10 text-center">
          <RefreshCw className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No players match your filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map(({ teamId, teamName, players }) => (
            <TeamSection
              key={teamId}
              teamName={teamName}
              players={players}
              pool={pool}
            />
          ))}
        </div>
      )}

      {/* Pool breakdown */}
      {poolSize > 0 && (
        <div className="card px-5 py-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Unassigned Player Pool</p>
          <div className="flex flex-wrap gap-2">
            {["S", "A+", "A", "B", "C"].map(grade => {
              const count = pool.filter(p => p.grade === grade).length
              if (!count) return null
              return (
                <div key={grade} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-surface-border bg-pitch-800/50 text-xs">
                  <span className="font-bold text-white">{grade}</span>
                  <span className="text-slate-400">×{count}</span>
                </div>
              )
            })}
          </div>
          <div className="mt-3 space-y-1">
            {pool.slice(0, 5).map(p => (
              <div key={p.id} className="flex items-center gap-2 text-xs text-slate-400">
                <GradeBadge grade={p.grade} size="xs" />
                <span>{p.name}</span>
                <span className="text-slate-600">· WR {calcWinRate(p.form) != null ? `${calcWinRate(p.form)}%` : "—"}</span>
              </div>
            ))}
            {pool.length > 5 && (
              <p className="text-xs text-slate-600">+{pool.length - 5} more unassigned players</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}