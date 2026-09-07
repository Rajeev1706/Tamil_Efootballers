import { useState, useMemo } from "react"
import { TrendingUp, Zap, Users, Layout, Star } from "lucide-react"
import { cn } from "../../lib/utils"
import PlayerAvatarIcon from "../common/PlayerAvatarIcon"

const GRADE_MV = { S: 180, "A+": 140, A: 110, B: 65, C: 40 }
function winRate(form = []) {
  if (!form?.length) return 0
  return Math.round(form.filter(f => f === "W").length / form.length * 100)
}
function valueScore(p) {
  const mv = p.marketValue ?? 0
  const bench = GRADE_MV[p.grade] ?? 60
  if (mv === 0) return 50
  return Math.min(100, Math.max(0, Math.round((bench / Math.max(mv, 1)) * 60 + winRate(p.form) * 0.4)))
}

// ── Value Score — compact list ────────────────────────────────────────────
function ValueScorePanel({ pool, onPlayerClick }) {
  const ranked = useMemo(() =>
    pool.filter(p => p.status === "pending")
        .map(p => ({ ...p, vs: valueScore(p) }))
        .sort((a, b) => b.vs - a.vs)
  , [pool])

  if (!ranked.length) return <p className="text-xs text-slate-500 text-center py-4">Pool empty</p>

  return (
    <div className="space-y-1">
      {ranked.map((p, i) => (
        <button key={p.id} onClick={() => onPlayerClick?.(p)}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-pitch-800 transition-colors text-left">
          <span className="text-[10px] text-slate-600 w-4 flex-shrink-0">#{i+1}</span>
          <span className="text-sm font-medium text-white truncate flex-1">{p.name}</span>
          <span className="text-xs text-slate-500 flex-shrink-0">{p.grade} · ₹{p.marketValue ?? "?"}</span>
          <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0",
            p.vs >= 75 ? "bg-emerald-400/20 text-emerald-400" :
            p.vs >= 50 ? "bg-accent/20 text-accent" : "bg-slate-500/20 text-slate-400"
          )}>{p.vs}</span>
        </button>
      ))}
    </div>
  )
}

// ── Sleepers — compact list ───────────────────────────────────────────────
function SleeperPanel({ pool, onPlayerClick }) {
  const sleepers = useMemo(() =>
    pool.filter(p => p.status === "pending")
        .map(p => ({ ...p, wr: winRate(p.form) }))
        .filter(p => p.wr >= 60 && (p.bdrPoints ?? 0) < 15)
        .sort((a, b) => b.wr - a.wr)
        .slice(0, 8)
  , [pool])

  if (!sleepers.length) return <p className="text-xs text-slate-500 text-center py-4">No sleepers detected</p>

  return (
    <div className="space-y-1">
      {sleepers.map(p => (
        <button key={p.id} onClick={() => onPlayerClick?.(p)}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-pitch-800 transition-colors text-left">
          <Zap className="w-3 h-3 text-amber-400 flex-shrink-0" />
          <span className="text-sm font-medium text-white truncate flex-1">{p.name}</span>
          <span className="text-xs text-slate-500 flex-shrink-0">{p.wr}% WR · ₹{p.marketValue ?? "?"}</span>
          <span className="text-[10px] font-bold text-amber-400 flex-shrink-0">SLEEPER</span>
        </button>
      ))}
    </div>
  )
}

// ── Chemistry — compact ───────────────────────────────────────────────────
function ChemistryPanel({ myPlayers, sales, retentions, myTeamId }) {
  const mySquad = useMemo(() => {
    const ids = [
      ...sales.filter(s => s.teamId === myTeamId).map(s => s.playerId),
      ...retentions.filter(r => r.teamId === myTeamId).map(r => r.playerId)
    ]
    return myPlayers.filter(p => ids.includes(p.id))
  }, [myPlayers, sales, retentions, myTeamId])

  const groups = useMemo(() => {
    const byTeam = {}
    mySquad.forEach(p => {
      const key = p.team || "Free Agent"
      if (!byTeam[key]) byTeam[key] = []
      byTeam[key].push(p)
    })
    return Object.entries(byTeam).filter(([, pl]) => pl.length > 1).sort((a, b) => b[1].length - a[1].length)
  }, [mySquad])

  if (!mySquad.length) return <p className="text-xs text-slate-500 text-center py-4">No players won yet</p>

  return (
    <div className="space-y-2">
      {groups.length === 0
        ? <p className="text-xs text-slate-500 text-center py-4">No chemistry pairs yet · {mySquad.length} players won</p>
        : groups.map(([teamName, players]) => (
            <div key={teamName} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-gold/5 border border-gold/20">
              <Star className="w-3 h-3 text-gold flex-shrink-0" />
              <span className="text-xs font-semibold text-gold truncate">{teamName}</span>
              <span className="text-xs text-slate-400 flex-shrink-0">{players.map(p => p.name).join(", ")}</span>
            </div>
          ))
      }
    </div>
  )
}

// ── Squad by Grade ────────────────────────────────────────────────────────
const GRADE_ORDER_SQUAD = ["S", "A+", "A", "B", "C"]
const GRADE_COLORS_SQUAD = {
  S:    "text-gold border-gold/30 bg-gold/5",
  "A+": "text-purple-300 border-purple-300/20 bg-purple-300/5",
  A:    "text-blue-300 border-blue-300/20 bg-blue-300/5",
  B:    "text-emerald-400 border-emerald-400/20 bg-emerald-400/5",
  C:    "text-slate-400 border-slate-600 bg-pitch-800/40",
}

function SquadPanel({ myPlayers, sales, retentions, myTeamId }) {
  const ids = [
    ...sales.filter(s => s.teamId === myTeamId).map(s => s.playerId),
    ...retentions.filter(r => r.teamId === myTeamId).map(r => r.playerId)
  ]
  const squad = myPlayers.filter(p => ids.includes(p.id))

  if (!squad.length) return <p className="text-xs text-slate-500 text-center py-4">No players won yet</p>

  return (
    <div className="space-y-2">
      {GRADE_ORDER_SQUAD.map(grade => {
        const players = squad.filter(p => p.grade === grade)
        return (
          <div key={grade} className={cn("rounded-lg border px-3 py-2", GRADE_COLORS_SQUAD[grade])}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wide flex-shrink-0">{grade}</span>
              {players.length === 0
                ? <span className="text-[10px] opacity-40">—</span>
                : players.map(p => (
                    <span key={p.id} className="text-xs font-medium text-white bg-pitch-900/60 px-2 py-0.5 rounded-lg">
                      {p.name}
                    </span>
                  ))
              }
            </div>
          </div>
        )
      })}
      <p className="text-[10px] text-slate-600 text-right">{squad.length} players won</p>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────
const TABS = [
  { id: "value",     label: "Value",     icon: TrendingUp },
  { id: "sleeper",   label: "Sleepers",  icon: Zap        },
  { id: "chemistry", label: "Chem",      icon: Users      },
  { id: "squad",     label: "Squad",     icon: Layout     },
]

export default function AuctionIntelPanel({ pool = [], myPlayers = [], sales = [], retentions = [], myTeamId, onPlayerClick }) {
  const [tab, setTab] = useState("value")

  return (
    <div className="card overflow-hidden">
      <div className="flex border-b border-surface-border">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn("flex-1 flex items-center justify-center gap-1 py-2 text-[11px] font-semibold transition-colors",
                tab === t.id ? "text-accent border-b-2 border-accent" : "text-slate-500 hover:text-white")}>
              <Icon className="w-3 h-3" />
              {t.label}
            </button>
          )
        })}
      </div>
      <div className="px-3 py-3 max-h-72 overflow-y-auto">
        {tab === "value"     && <ValueScorePanel pool={pool} onPlayerClick={onPlayerClick} />}
        {tab === "sleeper"   && <SleeperPanel pool={pool} onPlayerClick={onPlayerClick} />}
        {tab === "chemistry" && <ChemistryPanel myPlayers={myPlayers} sales={sales} retentions={retentions} myTeamId={myTeamId} />}
        {tab === "squad"     && <SquadPanel myPlayers={myPlayers} sales={sales} retentions={retentions} myTeamId={myTeamId} />}
      </div>
    </div>
  )
}