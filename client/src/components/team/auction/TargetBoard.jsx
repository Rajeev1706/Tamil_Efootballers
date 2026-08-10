import { useState, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { Search, Plus, X, ChevronUp, ChevronDown, Edit2, Check, AlertTriangle, Star, Zap, GripVertical, Target, Wallet, Shield } from "lucide-react"
import { cn } from "../../../lib/utils"
import { useAuctionTargets, useAddAuctionTarget, useUpdateAuctionTarget, useRemoveAuctionTarget, useReorderAuctionTargets, useAuctionCurrent } from "../../../lib/queries"
import SquadPlanning      from "./SquadPlanning"
import PlayerIntelligence from "./PlayerIntelligence"
import RivalWatch         from "./RivalWatch"
import AuctionDay         from "./AuctionDay"
import GradeBadge from "../../common/GradeBadge"
import PlayerAvatarIcon from "../../common/PlayerAvatarIcon"

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const PRIORITY_CONFIG = {
  must_have: { label: "Must Have", color: "text-rose-400 bg-rose-400/10 border-rose-400/25",    dot: "bg-rose-400"    },
  want:      { label: "Want",      color: "text-accent  bg-accent/10   border-accent/25",        dot: "bg-accent"      },
  backup:    { label: "Backup",    color: "text-slate-400 bg-slate-400/10 border-slate-400/25", dot: "bg-slate-400"   },
}

function FormDots({ form }) {
  if (!form || form.length === 0) return <span className="text-slate-600 text-[10px] sm:text-sm">No matches</span>
  return (
    <div className="flex gap-0.5">
      {form.slice(0, 5).map((f, i) => (
        <span key={i} className={cn(
          "w-4 h-4 rounded text-[9px] sm:text-sm sm:text-sm font-bold flex items-center justify-center",
          f === "W" ? "bg-emerald-400/20 text-emerald-400" :
          f === "D" ? "bg-amber-400/20 text-amber-400" :
                      "bg-rose-400/20 text-rose-400"
        )}>{f}</span>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Budget Bar
// ─────────────────────────────────────────────────────────────────────────────

function BudgetBar({ targets, totalBudget }) {
  const mustTotal   = targets.filter(t => t.priority === "must_have").reduce((a, t) => a + (t.maxBid || 0), 0)
  const wantTotal   = targets.filter(t => t.priority === "want").reduce((a, t) => a + (t.maxBid || 0), 0)
  const backupTotal = targets.filter(t => t.priority === "backup").reduce((a, t) => a + (t.maxBid || 0), 0)
  const totalPlanned = mustTotal + wantTotal + backupTotal
  const buffer      = Math.max(0, totalBudget - totalPlanned)
  const pct         = totalBudget > 0 ? Math.min(100, (totalPlanned / totalBudget) * 100) : 0
  const overBudget  = totalPlanned > totalBudget

  return (
    <div className="card p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-gold" />
          <span className="text-sm sm:text-sm font-bold text-white">Budget Planner</span>
        </div>
        <span className={cn("text-xs sm:text-sm font-bold font-mono", overBudget ? "text-rose-400" : "text-slate-300")}>
          {totalPlanned} / {totalBudget} pts
        </span>
      </div>

      {/* Segmented progress bar */}
      <div className="w-full h-3 bg-pitch-700 rounded-full overflow-hidden flex mb-3">
        {totalBudget > 0 && (
          <>
            <div className="h-full bg-rose-400 transition-all" style={{ width: `${Math.min(100,(mustTotal/totalBudget)*100)}%` }} />
            <div className="h-full bg-accent transition-all"   style={{ width: `${Math.min(100,(wantTotal/totalBudget)*100)}%` }} />
            <div className="h-full bg-slate-500 transition-all" style={{ width: `${Math.min(100,(backupTotal/totalBudget)*100)}%` }} />
          </>
        )}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "Must Have", val: mustTotal,   color: "text-rose-400",   dot: "bg-rose-400"  },
          { label: "Want",      val: wantTotal,   color: "text-accent",     dot: "bg-accent"    },
          { label: "Backup",    val: backupTotal, color: "text-slate-400",  dot: "bg-slate-400" },
          { label: "Buffer",    val: buffer,      color: overBudget ? "text-rose-400" : "text-emerald-400",
            dot: overBudget ? "bg-rose-400" : "bg-emerald-400" },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className={cn("w-2 h-2 rounded-full flex-shrink-0", s.dot)} />
            <span className="text-[10px] sm:text-sm text-slate-500">{s.label}:</span>
            <span className={cn("text-[10px] sm:text-sm font-bold font-mono", s.color)}>{s.val}</span>
          </div>
        ))}
      </div>

      {overBudget && (
        <div className="flex items-center gap-2 mt-3 bg-rose-400/5 border border-rose-400/20 rounded-xl px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
          <p className="text-[11px] sm:text-sm text-rose-300">
            Planned bids exceed budget by <span className="font-bold">{totalPlanned - totalBudget} pts</span>. Reduce max bids or reprioritise.
          </p>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Squad Fit Badge
// ─────────────────────────────────────────────────────────────────────────────

function SquadFitBadge({ player, myPlayers }) {
  const GRADE_NUM = { S: 4, A: 3, B: 2, C: 1 }
  const gradeCounts = myPlayers.reduce((acc, p) => {
    acc[p.grade] = (acc[p.grade] || 0) + 1; return acc
  }, {})
  const myGradeCount = gradeCounts[player.grade] || 0
  const hasGap = myGradeCount === 0

  if (hasGap) return (
    <span className="text-[9px] sm:text-sm sm:text-sm font-bold px-1.5 py-0.5 rounded border text-emerald-400 bg-emerald-400/10 border-emerald-400/25">
      Fills gap
    </span>
  )
  if (myGradeCount >= 3) return (
    <span className="text-[9px] sm:text-sm sm:text-sm font-bold px-1.5 py-0.5 rounded border text-amber-400 bg-amber-400/10 border-amber-400/25">
      Crowded tier
    </span>
  )
  return (
    <span className="text-[9px] sm:text-sm sm:text-sm font-bold px-1.5 py-0.5 rounded border text-sky-400 bg-sky-400/10 border-sky-400/25">
      +1 {player.grade} grade
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Target Card (in the My Targets list)
// ─────────────────────────────────────────────────────────────────────────────

function TargetCard({ target, myPlayers, onUpdate, onRemove, onMoveUp, onMoveDown, isFirst, isLast, dragHandleProps, nonBackupTargets = [] }) {
  const [editing, setEditing]         = useState(false)
  const [maxBid, setMaxBid]           = useState(target.maxBid ?? "")
  const [notes, setNotes]             = useState(target.notes ?? "")
  const [priority, setPriority]       = useState(target.priority)
  const [backupFor, setBackupFor]     = useState(target.backupForPlayerId ?? "")
  const cfg = PRIORITY_CONFIG[priority]
  const isOverbid = target.maxBid && target.marketValue && target.maxBid > target.marketValue

  const saveEdit = () => {
    onUpdate({ priority, maxBid: maxBid ? parseInt(maxBid) : null, notes, backupForPlayerId: backupFor ? parseInt(backupFor) : null })
    setEditing(false)
  }

  return (
    <div className={cn(
      "rounded-xl border bg-pitch-900/60 overflow-hidden",
      priority === "must_have" ? "border-rose-400/20" :
      priority === "want"      ? "border-accent/20" :
                                  "border-surface-border"
    )}>
      {/* Main row */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        {/* Drag handle */}
        <div className="cursor-grab text-slate-600 hover:text-slate-400 flex-shrink-0" {...dragHandleProps}>
          <GripVertical className="w-3.5 h-3.5" />
        </div>

        {/* Avatar */}
        <PlayerAvatarIcon player={target} size="w-8 h-8" />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm sm:text-sm font-semibold text-white truncate">{target.name}</span>
            <GradeBadge grade={target.grade} size="sm" />
            <SquadFitBadge player={target} myPlayers={myPlayers} />
            {isOverbid && (
              <span className="text-[9px] sm:text-sm sm:text-sm font-bold px-1.5 py-0.5 rounded border text-amber-400 bg-amber-400/10 border-amber-400/20">
                ⚠ Overbid
              </span>
            )}
            <span className="text-[9px] sm:text-sm sm:text-sm font-bold px-1.5 py-0.5 rounded border text-violet-400 bg-violet-400/10 border-violet-400/20">
              Fit: {squadFitScore(target, myPlayers)}/100
            </span>
            {winImpact(target, myPlayers) > 0 && (
              <span className="text-[9px] sm:text-sm sm:text-sm font-bold px-1.5 py-0.5 rounded border text-emerald-400 bg-emerald-400/10 border-emerald-400/20">
                +{winImpact(target, myPlayers)}% WR
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[10px] sm:text-sm text-slate-500">MV: <span className="text-slate-300 font-mono">{target.marketValue}</span></span>
            {target.maxBid && (
              <span className="text-[10px] sm:text-sm text-slate-500">
                Max: <span className={cn("font-mono font-bold", isOverbid ? "text-amber-400" : "text-emerald-400")}>{target.maxBid}</span>
              </span>
            )}
            <FormDots form={target.form} />
          </div>
          {target.backupForPlayerName && (
            <p className="text-[10px] sm:text-sm text-sky-400 mt-0.5 font-medium">⬆ Backup for {target.backupForPlayerName}</p>
          )}
          {target.notes && !editing && (
            <p className="text-[10px] sm:text-sm text-slate-500 mt-0.5 italic truncate">"{target.notes}"</p>
          )}
        </div>

        {/* Priority + actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className={cn("text-[9px] sm:text-sm sm:text-sm font-bold px-1.5 py-0.5 rounded-full border", cfg.color)}>
            {cfg.label}
          </span>
          <button onClick={() => setEditing(e => !e)} className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:text-white hover:bg-surface transition-colors">
            <Edit2 className="w-3 h-3" />
          </button>
          <button onClick={onRemove} className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 transition-colors">
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Edit panel */}
      {editing && (
        <div className="border-t border-surface-border px-3 py-3 space-y-3 bg-pitch-900">
          {/* Priority selector */}
          <div>
            <p className="text-[10px] sm:text-sm text-slate-500 uppercase tracking-widest mb-1.5">Priority</p>
            <div className="flex gap-1.5">
              {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => setPriority(key)}
                  className={cn(
                    "text-[10px] sm:text-sm font-bold px-2 py-1 rounded-lg border transition-all",
                    priority === key ? cfg.color : "text-slate-500 border-surface-border hover:border-slate-600"
                  )}
                >
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          {/* Backup For selector — only shown when priority = backup */}
          {priority === "backup" && (
            <div>
              <p className="text-[10px] sm:text-sm text-slate-500 uppercase tracking-widest mb-1.5">Backup For</p>
              <select
                value={backupFor}
                onChange={e => setBackupFor(e.target.value)}
                className="w-full bg-pitch-800 border border-surface-border rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-accent"
              >
                <option value="">— Select primary target —</option>
                {nonBackupTargets.filter(t => t.id !== target.id).map(t => (
                  <option key={t.id} value={t.playerId}>{t.name} ({t.grade})</option>
                ))}
              </select>
            </div>
          )}

          {/* Max bid */}
          <div>
            <p className="text-[10px] sm:text-sm text-slate-500 uppercase tracking-widest mb-1.5">Max Bid</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={maxBid}
                onChange={e => setMaxBid(e.target.value)}
                placeholder={`MV: ${target.marketValue}`}
                className="flex-1 bg-pitch-800 border border-surface-border rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent"
              />
              {maxBid && target.marketValue && parseInt(maxBid) > target.marketValue && (
                <span className="text-[10px] sm:text-sm text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> +{parseInt(maxBid) - target.marketValue} over MV
                </span>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <p className="text-[10px] sm:text-sm text-slate-500 uppercase tracking-widest mb-1.5">Scouting Notes</p>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. only if under 80, great vs A grade..."
              className="w-full bg-pitch-800 border border-surface-border rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent"
            />
          </div>

          <div className="flex gap-2">
            <button onClick={saveEdit} className="flex-1 flex items-center justify-center gap-1.5 bg-accent hover:bg-accent-dim text-white text-xs font-semibold py-2 rounded-lg transition-colors">
              <Check className="w-3.5 h-3.5" /> Save
            </button>
            <button onClick={() => setEditing(false)} className="px-4 py-2 rounded-lg border border-surface-border text-slate-400 hover:text-white text-xs transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Player Row (in the Browse panel)
// ─────────────────────────────────────────────────────────────────────────────

function PlayerRow({ player, isTargeted, onAdd }) {
  const [adding, setAdding] = useState(false)
  const [priority, setPriority] = useState("want")
  const [maxBid, setMaxBid]     = useState("")
  const navigate = useNavigate()

  const handleAdd = () => {
    onAdd({ playerId: player.id, priority, maxBid: maxBid ? parseInt(maxBid) : null })
    setAdding(false)
    setMaxBid("")
  }

  return (
    <div className="border-b border-surface-border/50 last:border-0">
      <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-hover/30 transition-colors">
        <PlayerAvatarIcon player={player} size="w-8 h-8" />
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => navigate(`/player/${player.id}`)}
        >
          <div className="flex items-center gap-1.5">
            <span className="text-sm sm:text-sm font-medium text-white truncate">{player.name}</span>
            <GradeBadge grade={player.grade} size="sm" />
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] sm:text-sm text-slate-500">MV: <span className="text-slate-300 font-mono">{player.marketValue}</span></span>
            <span className="text-[10px] sm:text-sm text-slate-500">BDR: <span className="text-slate-300 font-mono">{player.bdrPoints}</span></span>
          </div>
        </div>
        {isTargeted ? (
          <span className="text-[10px] sm:text-sm font-bold text-emerald-400 flex items-center gap-1 flex-shrink-0">
            <Check className="w-3 h-3" /> Added
          </span>
        ) : (
          <button
            onClick={() => setAdding(a => !a)}
            className="flex items-center gap-1 text-[11px] sm:text-sm font-semibold text-accent hover:text-white bg-accent/10 hover:bg-accent px-2.5 py-1 rounded-lg transition-all flex-shrink-0"
          >
            <Plus className="w-3 h-3" /> Target
          </button>
        )}
      </div>

      {/* Quick-add panel */}
      {adding && !isTargeted && (
        <div className="px-4 pb-3 bg-pitch-900/50 space-y-2">
          <div className="flex gap-1.5">
            {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => setPriority(key)}
                className={cn(
                  "text-[10px] sm:text-sm font-bold px-2 py-1 rounded-lg border flex-1 transition-all",
                  priority === key ? cfg.color : "text-slate-500 border-surface-border"
                )}
              >
                {cfg.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              value={maxBid}
              onChange={e => setMaxBid(e.target.value)}
              placeholder={`Max bid (MV: ${player.marketValue})`}
              className="flex-1 bg-pitch-800 border border-surface-border rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-accent"
            />
            <button onClick={handleAdd} className="px-3 py-1.5 bg-accent text-white text-xs font-bold rounded-lg hover:bg-accent-dim transition-colors">
              Add
            </button>
            <button onClick={() => setAdding(false)} className="px-3 py-1.5 border border-surface-border text-slate-400 text-xs rounded-lg hover:text-white transition-colors">
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Analysis placeholder panels (Phase 2–5 built later)
// ─────────────────────────────────────────────────────────────────────────────

function ComingSoon({ label, icon }) {
  return (
    <div className="card p-12 text-center">
      <div className="text-3xl mb-3">{icon}</div>
      <p className="text-white font-semibold text-sm mb-1">{label}</p>
      <p className="text-slate-500 text-xs">Coming in the next phase</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main TargetBoard
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Target Analysis Helpers (Features 1–5)
// ─────────────────────────────────────────────────────────────────────────────

const MV_BENCH = { S: 185, A: 110, B: 65, C: 40 }
const GRADE_NUM_T = { S: 4, A: 3, B: 2, C: 1 }

function fwr(form) {
  if (!form || !form.length) return 0
  return form.filter(f => f === "W").length / form.length
}

// Feature 5: Squad fit score 0-100
function squadFitScore(target, myPlayers) {
  const gradeCounts = myPlayers.reduce((acc, p) => { acc[p.grade] = (acc[p.grade]||0)+1; return acc }, {})
  const has = gradeCounts[target.grade] || 0
  const gapScore  = has === 0 ? 40 : has <= 2 ? 20 : 0
  const formScore = Math.round(fwr(target.form) * 30)
  const mvEff     = target.marketValue > 0 ? Math.min(1, (MV_BENCH[target.grade]||80) / target.marketValue) : 0.5
  return Math.min(100, gapScore + formScore + Math.round(mvEff * 30))
}

// Feature 3: Win impact (squad avg grade improvement)
function winImpact(target, myPlayers) {
  if (!myPlayers.length) return 0
  const cur = myPlayers.reduce((a,p) => a+(GRADE_NUM_T[p.grade]||1),0)/myPlayers.length
  const next = [...myPlayers,{grade:target.grade}].reduce((a,p)=>a+(GRADE_NUM_T[p.grade]||1),0)/(myPlayers.length+1)
  return +((next-cur)*15).toFixed(1) // approx % win rate gain
}

const SUB_MODULES = [
  { id: "targets",   label: "My Targets",   icon: "🎯" },
  { id: "squad",     label: "Squad",        icon: "🏗️" },
  { id: "intel",     label: "Intel",        icon: "🔍" },
  { id: "rivals",    label: "Rivals",       icon: "🕵️" },
  { id: "auctionday",label: "Auction Day",  icon: "⚡" },
]

export default function TargetBoard({ myTeamId, myPlayers, allPlayers, totalBudget }) {
  const [search,      setSearch]      = useState("")
  const [gradeFilter, setGradeFilter] = useState("all")
  const [mainView,    setMainView]    = useState("browse")  // "browse" | "analysis"
  const [subModule,   setSubModule]   = useState("targets") // active analysis sub-module
  const dragItem     = useRef(null)
  const dragOverItem = useRef(null)

  const { data: targets = [] } = useAuctionTargets(myTeamId)
  const { data: auctionData }  = useAuctionCurrent()

  // Players excluded from browse: own team + retained by any team
  const retainedIds = new Set((auctionData?.retentions || []).map(r => r.playerId))
  const addTarget    = useAddAuctionTarget()
  const updateTarget = useUpdateAuctionTarget()
  const removeTarget = useRemoveAuctionTarget()
  const reorder      = useReorderAuctionTargets()

  const targetedIds = new Set(targets.map(t => t.playerId))

  // Auction pool — players registered by admin for this auction
  // If no active auction session, fall back to all non-team players
  const poolPlayerIds = auctionData?.pool?.length
    ? new Set(auctionData.pool.map(p => p.playerId))
    : null

  // Available players = registered in auction pool (or all if no session)
  // + not retained + not a team captain
  const availablePlayers = allPlayers
    .filter(p => poolPlayerIds ? poolPlayerIds.has(p.id) : p.teamId !== myTeamId)
    .filter(p => !retainedIds.has(p.id))
    .filter(p => !p.isCaptain)
    .filter(p => gradeFilter === "all" || p.grade === gradeFilter)
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))

  // Group targets by priority
  const grouped = {
    must_have: targets.filter(t => t.priority === "must_have"),
    want:      targets.filter(t => t.priority === "want"),
    backup:    targets.filter(t => t.priority === "backup"),
  }

  const handleAdd = ({ playerId, priority, maxBid }) => {
    addTarget.mutate({ teamId: myTeamId, playerId, priority, maxBid, backupForPlayerId: null })
  }

  const handleUpdate = (target, updates) => {
    updateTarget.mutate({ id: target.id, teamId: myTeamId, ...updates })
  }

  const handleRemove = (target) => {
    removeTarget.mutate({ id: target.id, teamId: myTeamId })
  }

  // Drag-and-drop reorder
  const handleDragStart = (idx) => { dragItem.current = idx }
  const handleDragEnter = (idx) => { dragOverItem.current = idx }
  const handleDragEnd   = () => {
    if (dragItem.current === null || dragOverItem.current === null) return
    const copy = [...targets]
    const dragged = copy.splice(dragItem.current, 1)[0]
    copy.splice(dragOverItem.current, 0, dragged)
    reorder.mutate({ orderedIds: copy.map(t => t.id), teamId: myTeamId })
    dragItem.current = null
    dragOverItem.current = null
  }

  return (
    <div className="space-y-4">

      {/* ── Top dropdown: Browse Players / Analysis ─────────────────── */}
      <div className="flex items-center gap-3">
        <select
          value={mainView}
          onChange={e => setMainView(e.target.value)}
          className="bg-pitch-800 border border-surface-border rounded-xl px-4 py-2.5 text-sm font-semibold text-white focus:outline-none focus:border-accent cursor-pointer"
        >
          <option value="browse">📋 Browse Players</option>
          <option value="analysis">📊 Analysis</option>
        </select>
        {mainView === "browse" && (
          <span className="text-xs sm:text-sm text-slate-500">{availablePlayers.length} players available</span>
        )}
      </div>

      {/* ── Browse Players panel (full width) ───────────────────────── */}
      {mainView === "browse" && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-border">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search player..."
                  className="w-full pl-8 pr-3 py-1.5 bg-pitch-800 border border-surface-border rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-accent"
                />
              </div>
              <select
                value={gradeFilter}
                onChange={e => setGradeFilter(e.target.value)}
                className="bg-pitch-800 border border-surface-border rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-accent"
              >
                <option value="all">All grades</option>
                {["S","A","B","C"].map(g => <option key={g} value={g}>{g} Grade</option>)}
              </select>
            </div>
          </div>
          <div className="overflow-y-auto max-h-[520px]">
            {availablePlayers.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">No players found</div>
            ) : (
              availablePlayers.map(p => (
                <PlayerRow
                  key={p.id}
                  player={p}
                  isTargeted={targetedIds.has(p.id)}
                  onAdd={handleAdd}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Analysis panel ──────────────────────────────────────────── */}
      {mainView === "analysis" && (
        <div className="space-y-4">

          {/* Sub-module nav — horizontally scrollable on mobile */}
          <div className="overflow-x-auto pb-1 -mx-1 px-1">
            <div className="flex gap-2 min-w-max">
              {SUB_MODULES.map(m => (
                <button
                  key={m.id}
                  onClick={() => setSubModule(m.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all border flex-shrink-0",
                    subModule === m.id
                      ? "bg-accent text-white border-accent"
                      : "bg-pitch-800 text-slate-400 border-surface-border hover:text-white hover:border-slate-600"
                  )}
                >
                  <span>{m.icon}</span>
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sub-module content (full width) */}
          {subModule === "targets" && (
            <div className="space-y-4">
              <BudgetBar targets={targets} totalBudget={totalBudget} />
              <div className="card overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-border">
                  <Target className="w-4 h-4 text-gold" />
                  <span className="text-sm sm:text-sm font-bold text-white">My Targets</span>
                  <span className="text-[10px] sm:text-sm text-slate-500 ml-1">— {targets.length} players · drag to reorder</span>
                </div>

                {/* Feature 1: Target Conflict Detector */}
                {(() => {
                  const mustHaves = targets.filter(t => t.priority === "must_have")
                  const mustTotal = mustHaves.reduce((a,t) => a+(t.maxBid||MV_BENCH[t.grade]||80), 0)
                  const wantTotal = targets.filter(t=>t.priority==="want").reduce((a,t)=>a+(t.maxBid||MV_BENCH[t.grade]||80),0)
                  const conflicts = []
                  if (mustTotal > totalBudget * 0.7) conflicts.push(`Must-Haves alone cost ~${mustTotal}pts (${Math.round(mustTotal/totalBudget*100)}% of budget). Cut or downgrade one.`)
                  if (mustTotal + wantTotal > totalBudget) conflicts.push(`All must-haves + wants = ${mustTotal+wantTotal}pts. Budget is ${totalBudget}pts. Will need to sacrifice wants.`)
                  const samePriorityGrade = {}
                  mustHaves.forEach(t => { samePriorityGrade[t.grade] = (samePriorityGrade[t.grade]||0)+1 })
                  Object.entries(samePriorityGrade).forEach(([g,n]) => { if(n>1) conflicts.push(`${n} must-have ${g}-grade targets — you can only win one. Demote the rest to Want.`) })
                  if (!conflicts.length) return null
                  return (
                    <div className="mx-3 mt-3 space-y-1.5">
                      {conflicts.map((c,i) => (
                        <div key={i} className="flex items-start gap-2 bg-rose-400/5 border border-rose-400/20 rounded-xl px-3 py-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5"/>
                          <p className="text-[10px] sm:text-sm text-rose-300 leading-relaxed">{c}</p>
                        </div>
                      ))}
                    </div>
                  )
                })()}

                {/* Feature 4: Fallback Chain */}
                {(() => {
                  const mustHaves = targets.filter(t => t.priority === "must_have")
                  if (!mustHaves.length) return null
                  const fallbacks = mustHaves.map(t => {
                    const sameGrade = allPlayers.filter(p => !p.teamId && p.grade===t.grade && p.id!==t.playerId && !p.isCaptain).sort((a,b)=>fwr(b.form)-fwr(a.form)).slice(0,1)
                    return sameGrade.length ? { target: t, fallback: sameGrade[0] } : null
                  }).filter(Boolean)
                  if (!fallbacks.length) return null
                  return (
                    <div className="mx-3 mt-2">
                      <p className="text-[10px] sm:text-sm text-slate-500 uppercase tracking-widest font-semibold mb-1.5 px-1">Fallback Chain</p>
                      {fallbacks.map(({target:t, fallback:f}) => (
                        <div key={t.playerId} className="flex items-center gap-2 bg-sky-400/5 border border-sky-400/15 rounded-xl px-3 py-2 mb-1.5">
                          <span className="text-[10px] sm:text-sm text-slate-400 flex-shrink-0">If you miss</span>
                          <span className="text-[10px] sm:text-sm font-bold text-white">{t.name}</span>
                          <GradeBadge grade={t.grade} size="sm"/>
                          <span className="text-[10px] sm:text-sm text-slate-500">→ bid</span>
                          <span className="text-[10px] sm:text-sm font-bold text-sky-300">{f.name}</span>
                          <span className="text-[10px] sm:text-sm text-slate-500">{Math.round(fwr(f.form)*100)}% WR · MV:{f.marketValue}</span>
                        </div>
                      ))}
                    </div>
                  )
                })()}
                <div className="overflow-y-auto max-h-[520px]">
                  {targets.length === 0 ? (
                    <div className="p-8 text-center">
                      <Target className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                      <p className="text-slate-500 text-sm">No targets yet</p>
                      <p className="text-slate-600 text-xs mt-1">Switch to Browse Players and add players to your target list</p>
                    </div>
                  ) : (
                    <div className="p-3 space-y-2">
                      {Object.entries({ must_have: targets.filter(t=>t.priority==="must_have"), want: targets.filter(t=>t.priority==="want"), backup: targets.filter(t=>t.priority==="backup") }).map(([key, group]) => {
                        if (group.length === 0) return null
                        const cfg = PRIORITY_CONFIG[key]
                        return (
                          <div key={key}>
                            <div className="flex items-center gap-2 mb-1.5 px-1">
                              <span className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
                              <span className="text-[10px] sm:text-sm font-bold text-slate-500 uppercase tracking-widest">{cfg.label}</span>
                              <span className="text-[10px] sm:text-sm text-slate-600">({group.length})</span>
                            </div>
                            <div className="space-y-1.5">
                              {group.map((target) => {
                                const globalIdx = targets.indexOf(target)
                                return (
                                  <div
                                    key={target.id}
                                    draggable
                                    onDragStart={() => handleDragStart(globalIdx)}
                                    onDragEnter={() => handleDragEnter(globalIdx)}
                                    onDragEnd={handleDragEnd}
                                    onDragOver={e => e.preventDefault()}
                                  >
                                    <TargetCard
                                      target={target}
                                      myPlayers={myPlayers}
                                      onUpdate={(updates) => handleUpdate(target, updates)}
                                      onRemove={() => handleRemove(target)}
                                      isFirst={globalIdx === 0}
                                      isLast={globalIdx === targets.length - 1}
                                      dragHandleProps={{}}
                                      nonBackupTargets={targets.filter(t => t.priority !== 'backup')}
                                    />
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {subModule === "squad"      && <SquadPlanning myPlayers={myPlayers} allPlayers={allPlayers} myTeamId={myTeamId} totalBudget={totalBudget} targets={targets} />}
          {subModule === "intel"      && <PlayerIntelligence allPlayers={allPlayers} myTeamId={myTeamId} targets={targets} />}
          {subModule === "rivals"     && <RivalWatch myTeamId={myTeamId} allPlayers={allPlayers} targets={targets} myPlayers={myPlayers} />}
          {subModule === "auctionday" && <AuctionDay targets={targets} myTeamId={myTeamId} totalBudget={totalBudget} myPlayers={myPlayers} allPlayers={allPlayers} />}
        </div>
      )}
    </div>
  )
}