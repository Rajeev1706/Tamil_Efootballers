/**
 * AuctionIntelPanel — Pre/During auction intelligence for team captains.
 * Tabs:
 *   1. Value Score  — all pool players sorted by MV-to-likely-price ratio
 *   2. Sleeper Picks — high form, low BDR = undervalued, likely to go cheap
 *   3. Chemistry    — players in your squad from same team (synergy tracker)
 *   4. Formation    — set target formation, see which slots are filled
 */
import { useState, useMemo } from "react"
import { TrendingUp, Zap, Users, Layout, Star } from "lucide-react"
import { cn } from "../../lib/utils"
import PlayerAvatarIcon from "../common/PlayerAvatarIcon"

// ── Grade helpers ──────────────────────────────────────────────────────────
const GRADE_MV = { S: 180, "A+": 140, A: 110, B: 65, C: 40 }
function gradeRank(g) { return { S: 5, "A+": 4, A: 3, B: 2, C: 1 }[g] ?? 0 }
function winRate(form = []) {
  if (!form?.length) return 0
  return Math.round(form.filter(f => f === "W").length / form.length * 100)
}

// Value Score = how much below expected MV the player might go
// High = good deal expected. Based on MV vs grade benchmark.
function valueScore(p) {
  const mv = p.marketValue ?? 0
  const bench = GRADE_MV[p.grade] ?? 60
  if (mv === 0) return 50
  return Math.min(100, Math.max(0, Math.round((bench / Math.max(mv, 1)) * 60 + winRate(p.form) * 0.4)))
}

// ── Formations ─────────────────────────────────────────────────────────────
const FORMATIONS = {
  "4-3-3":  ["GK", "LB", "CB", "CB", "RB", "CM", "CM", "CM", "LW", "ST", "RW"],
  "4-4-2":  ["GK", "LB", "CB", "CB", "RB", "LM", "CM", "CM", "RM", "ST", "ST"],
  "4-2-3-1":["GK", "LB", "CB", "CB", "RB", "CDM", "CDM", "LAM", "CAM", "RAM", "ST"],
  "5-3-2":  ["GK", "LWB", "CB", "CB", "CB", "RWB", "CM", "CM", "CM", "ST", "ST"],
  "3-5-2":  ["GK", "CB", "CB", "CB", "LM", "CM", "CM", "CM", "RM", "ST", "ST"],
  "4-5-1":  ["GK", "LB", "CB", "CB", "RB", "LM", "CM", "CM", "CM", "RM", "ST"],
}

// ── Sub-panels ─────────────────────────────────────────────────────────────

function ValueScorePanel({ pool, onPlayerClick }) {
  const ranked = useMemo(() => {
    return pool
      .filter(p => p.status === "pending")
      .map(p => ({ ...p, vs: valueScore(p) }))
      .sort((a, b) => b.vs - a.vs)
  }, [pool])

  if (!ranked.length) return <p className="text-slate-500 text-sm text-center py-6">Pool is empty.</p>

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-slate-500 mb-2">Players ranked by expected value — higher score = better deal likely.</p>
      {ranked.map((p, i) => (
        <button
          key={p.id}
          onClick={() => onPlayerClick?.(p)}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-pitch-800/60 hover:bg-pitch-800 transition-colors text-left"
        >
          <span className="text-xs text-slate-600 w-5 flex-shrink-0">#{i + 1}</span>
          <PlayerAvatarIcon player={{ avatarId: p.avatarId, avatarUrl: p.avatarUrl, name: p.name, grade: p.grade }} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{p.name}</p>
            <p className="text-xs text-slate-500">MV ₹{p.marketValue ?? "?"} · {p.grade}</p>
          </div>
          <div className="flex flex-col items-end flex-shrink-0">
            <div className={cn("text-xs font-bold px-2 py-0.5 rounded",
              p.vs >= 75 ? "bg-emerald-400/20 text-emerald-400" :
              p.vs >= 50 ? "bg-accent/20 text-accent" :
                           "bg-slate-500/20 text-slate-400"
            )}>
              {p.vs}
            </div>
            <span className="text-[10px] text-slate-600 mt-0.5">value score</span>
          </div>
        </button>
      ))}
    </div>
  )
}

function SleeperPanel({ pool, onPlayerClick }) {
  const sleepers = useMemo(() => {
    return pool
      .filter(p => p.status === "pending")
      .map(p => {
        const wr  = winRate(p.form)
        const bdr = p.bdrPoints ?? 0
        const mv  = p.marketValue ?? 0
        // Sleeper = high form + low BDR (underrated) + reasonable MV
        const score = wr * 0.5 + Math.max(0, 40 - bdr) * 0.3 + Math.min(50, mv / 4) * 0.2
        return { ...p, sleeperScore: Math.round(score), wr }
      })
      .filter(p => p.wr >= 60 && (p.bdrPoints ?? 0) < 15)
      .sort((a, b) => b.sleeperScore - a.sleeperScore)
      .slice(0, 8)
  }, [pool])

  if (!sleepers.length) return (
    <div className="text-center py-6">
      <p className="text-slate-400 text-sm">No sleeper picks detected.</p>
      <p className="text-xs text-slate-600 mt-1">A sleeper = strong recent form but low BDR — likely to go cheap.</p>
    </div>
  )

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-slate-500 mb-2">High form, low BDR — underrated players likely to go cheaper than their value suggests.</p>
      {sleepers.map(p => (
        <button
          key={p.id}
          onClick={() => onPlayerClick?.(p)}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-amber-400/5 border border-amber-400/15 hover:border-amber-400/30 transition-colors text-left"
        >
          <Zap className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          <PlayerAvatarIcon player={{ avatarId: p.avatarId, avatarUrl: p.avatarUrl, name: p.name, grade: p.grade }} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{p.name}</p>
            <p className="text-xs text-slate-500">{p.wr}% WR · BDR {p.bdrPoints ?? 0} · MV ₹{p.marketValue ?? "?"}</p>
          </div>
          <span className="text-xs font-bold text-amber-400 flex-shrink-0">SLEEPER</span>
        </button>
      ))}
    </div>
  )
}

function ChemistryPanel({ myPlayers, sales, retentions, myTeamId }) {
  const mySquad = useMemo(() => {
    const wonIds      = sales.filter(s => s.teamId === myTeamId).map(s => s.playerId)
    const retainedIds = retentions.filter(r => r.teamId === myTeamId).map(r => r.playerId)
    const allIds      = [...wonIds, ...retainedIds]
    return myPlayers.filter(p => allIds.includes(p.id))
  }, [myPlayers, sales, retentions, myTeamId])

  // Group by their ORIGINAL team (the TEC team they play for — not their auction team)
  const groups = useMemo(() => {
    const byTeam = {}
    mySquad.forEach(p => {
      const key = p.team || "Free Agent"
      if (!byTeam[key]) byTeam[key] = []
      byTeam[key].push(p)
    })
    return Object.entries(byTeam)
      .filter(([, players]) => players.length > 1)
      .sort((a, b) => b[1].length - a[1].length)
  }, [mySquad])

  if (!mySquad.length) return <p className="text-slate-500 text-sm text-center py-6">No players won yet.</p>

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">Players from the same team playing together in your squad.</p>
      {groups.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-slate-400 text-sm">No chemistry pairs yet.</p>
          <p className="text-xs text-slate-600 mt-1">Win 2+ players from the same team to build chemistry.</p>
        </div>
      ) : (
        groups.map(([teamName, players]) => (
          <div key={teamName} className="bg-pitch-800/60 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-3.5 h-3.5 text-gold" />
              <span className="text-xs font-semibold text-gold">{teamName} · {players.length} players</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {players.map(p => (
                <div key={p.id} className="flex items-center gap-1.5 bg-pitch-900/60 rounded-lg px-2 py-1">
                  <PlayerAvatarIcon player={p} size="sm" />
                  <span className="text-xs text-white">{p.name}</span>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
      {groups.length === 0 && mySquad.length > 0 && (
        <div className="bg-pitch-800/40 rounded-xl px-4 py-3">
          <p className="text-xs text-slate-500">Your current squad ({mySquad.length} players):</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {mySquad.map(p => (
              <div key={p.id} className="flex items-center gap-1.5 bg-pitch-900/60 rounded-lg px-2 py-1">
                <PlayerAvatarIcon player={p} size="sm" />
                <span className="text-xs text-white">{p.name}</span>
                <span className="text-[10px] text-slate-500">{p.team || "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function FormationPanel({ myPlayers, sales, retentions, myTeamId }) {
  const [formation, setFormation] = useState("4-3-3")
  const positions = FORMATIONS[formation] || []

  const myWonIds = sales.filter(s => s.teamId === myTeamId).map(s => s.playerId)
  const retainedIds = retentions.filter(r => r.teamId === myTeamId).map(r => r.playerId)
  const mySquad  = myPlayers.filter(p => [...myWonIds, ...retainedIds].includes(p.id))

  // Simple fill: assign players to slots in grade order
  const filled   = [...mySquad].sort((a, b) => (b.marketValue ?? 0) - (a.marketValue ?? 0))
  const slots    = positions.map((pos, i) => ({ pos, player: filled[i] ?? null }))
  const filledCount = slots.filter(s => s.player).length

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={formation}
          onChange={e => setFormation(e.target.value)}
          className="bg-pitch-900 border border-surface-border rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-accent/40"
        >
          {Object.keys(FORMATIONS).map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <span className="text-xs text-slate-500">{filledCount} / {positions.length} slots filled</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {slots.map((s, i) => (
          <div key={i} className={cn(
            "rounded-xl border px-3 py-2 text-center transition-colors",
            s.player
              ? "bg-accent/10 border-accent/30"
              : "bg-pitch-800/40 border-surface-border border-dashed"
          )}>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">{s.pos}</p>
            {s.player ? (
              <>
                <PlayerAvatarIcon player={s.player} size="sm" className="mx-auto mb-1" />
                <p className="text-xs text-white font-medium truncate">{s.player.name}</p>
                <p className="text-[10px] text-slate-500">{s.player.grade}</p>
              </>
            ) : (
              <p className="text-xs text-slate-600 py-1">Empty</p>
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-600 text-center">Players auto-assigned by MV. Formation is for planning only.</p>
    </div>
  )
}

// ── Main Export ──────────────────────────────────────────────────────────────

const TABS = [
  { id: "value",     label: "Value Score", icon: TrendingUp },
  { id: "sleeper",   label: "Sleepers",    icon: Zap        },
  { id: "chemistry", label: "Chemistry",   icon: Users      },
  { id: "formation", label: "Formation",   icon: Layout     },
]

export default function AuctionIntelPanel({ pool = [], myPlayers = [], sales = [], retentions = [], myTeamId, onPlayerClick }) {
  const [tab, setTab] = useState("value")

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-surface-border">
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-gold" />
          <span className="text-sm font-semibold text-white">Auction Intel</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-surface-border">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors",
                tab === t.id
                  ? "text-accent border-b-2 border-accent"
                  : "text-slate-500 hover:text-white"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div className="px-4 py-4 max-h-96 overflow-y-auto">
        {tab === "value"     && <ValueScorePanel pool={pool} onPlayerClick={onPlayerClick} />}
        {tab === "sleeper"   && <SleeperPanel pool={pool} onPlayerClick={onPlayerClick} />}
        {tab === "chemistry" && <ChemistryPanel myPlayers={myPlayers} sales={sales} retentions={retentions} myTeamId={myTeamId} />}
        {tab === "formation" && <FormationPanel myPlayers={myPlayers} sales={sales} retentions={retentions} myTeamId={myTeamId} />}
      </div>
    </div>
  )
}