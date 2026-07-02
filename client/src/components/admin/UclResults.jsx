import { useState, useEffect } from "react"
import { ChevronDown, ChevronUp, CheckCircle, Loader2, Trophy, RotateCcw } from "lucide-react"
import { cn } from "../../lib/utils"
import { useUclGroups, useResetGroupFixtures } from "../../lib/queries"
import { recordsApi } from "../../lib/api"
import { useQueryClient } from "@tanstack/react-query"

const RESULT_COLOR = {
  win:  "bg-emerald-400/10 text-emerald-400 border-emerald-400/25",
  draw: "bg-amber-400/10  text-amber-400  border-amber-400/25",
  loss: "bg-rose-400/10   text-rose-400   border-rose-400/25",
}

function buildPairings(players) {
  // Round robin — every player plays every other player exactly once
  const pairs = []
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      pairs.push([players[i], players[j]])
    }
  }
  return pairs
}

function PairRow({ pair, existing, onLogged }) {
  const [p1, p2] = pair
  const logged = existing.find(r =>
    (r.playerId === p1.id && r.opponentId === p2.id) ||
    (r.playerId === p2.id && r.opponentId === p1.id)
  )

  const [score1, setScore1] = useState("")
  const [score2, setScore2] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    if (score1 === "" || score2 === "") return
    setSubmitting(true)
    const s1 = Number(score1), s2 = Number(score2)
    const result = s1 > s2 ? "win" : s1 < s2 ? "loss" : "draw"
    try {
      await recordsApi.create({
        playerId: p1.id,
        opponentId: p2.id,
        result,
        matchType: "ucl",
        playerScore: s1,
        opponentScore: s2,
      })
      onLogged()
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to log result")
    } finally {
      setSubmitting(false)
    }
  }

  if (logged) {
    return <LoggedRow r={logged} group={{ players: [p1, p2] }} onChanged={onLogged} />
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-pitch-800/40 border border-surface-border rounded-lg">
      <span className="text-sm text-white flex-1 truncate">{p1.name}</span>
      <input type="number" min="0" placeholder="0" value={score1}
        onChange={e => setScore1(e.target.value)}
        className="w-12 text-center bg-pitch-900 border border-surface-border rounded-md py-1.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-accent/40" />
      <span className="text-slate-600 text-xs">–</span>
      <input type="number" min="0" placeholder="0" value={score2}
        onChange={e => setScore2(e.target.value)}
        className="w-12 text-center bg-pitch-900 border border-surface-border rounded-md py-1.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-accent/40" />
      <span className="text-sm text-white flex-1 text-right truncate">{p2.name}</span>
      <button onClick={submit} disabled={score1 === "" || score2 === "" || submitting}
        className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex-shrink-0",
          score1 !== "" && score2 !== "" ? "bg-accent/15 text-accent border border-accent/25 hover:bg-accent/25"
                                          : "bg-pitch-900 text-slate-600 border border-surface-border cursor-not-allowed")}>
        {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Log"}
      </button>
    </div>
  )
}

function LoggedRow({ r, group, players, onChanged }) {
  const [editing, setEditing]   = useState(false)
  const [score1, setScore1]     = useState(r.playerScore ?? "")
  const [score2, setScore2]     = useState(r.opponentScore ?? "")
  const [saving, setSaving]     = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const qc = useQueryClient()

  const isHome    = group.players.some(p => p.id === r.playerId)
  const homeName  = isHome ? r.playerName  : r.opponentName
  const awayName  = isHome ? r.opponentName : r.playerName
  const homeScore = isHome ? r.playerScore : r.opponentScore
  const awayScore = isHome ? r.opponentScore : r.playerScore
  const result    = isHome ? r.result : (r.result === "win" ? "loss" : r.result === "loss" ? "win" : "draw")
  const chip      = RESULT_COLOR[result]

  async function handleSave() {
    const s1 = Number(score1), s2 = Number(score2)
    const newResult = s1 > s2 ? "win" : s1 < s2 ? "loss" : "draw"
    setSaving(true)
    try {
      await recordsApi.update(r.id, {
        result: isHome ? newResult : (newResult === "win" ? "loss" : newResult === "loss" ? "win" : "draw"),
        playerScore: isHome ? s1 : s2,
        opponentScore: isHome ? s2 : s1,
      })
      setEditing(false)
      qc.invalidateQueries({ queryKey: ["ucl-standings"] })
      onChanged()
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to update")
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    try {
      await recordsApi.delete(r.id)
      qc.invalidateQueries({ queryKey: ["ucl-standings"] })
      onChanged()
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to delete")
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 bg-pitch-800 rounded-lg px-3 py-2">
        <span className="text-sm text-white flex-1 truncate">{homeName}</span>
        <input type="number" min="0" value={score1} onChange={e => setScore1(e.target.value)}
          className="w-10 text-center bg-pitch-900 border border-surface-border rounded text-xs text-white py-1 focus:outline-none focus:border-accent/40" />
        <span className="text-slate-600 text-xs">–</span>
        <input type="number" min="0" value={score2} onChange={e => setScore2(e.target.value)}
          className="w-10 text-center bg-pitch-900 border border-surface-border rounded text-xs text-white py-1 focus:outline-none focus:border-accent/40" />
        <span className="text-sm text-white flex-1 text-right truncate">{awayName}</span>
        <button onClick={() => setEditing(false)} className="text-xs text-slate-500 px-1">✕</button>
        <button onClick={handleSave} disabled={saving}
          className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded disabled:opacity-40">
          {saving ? "…" : "✓"}
        </button>
      </div>
    )
  }

  if (confirmDel) {
    return (
      <div className="flex items-center gap-2 bg-rose-500/5 border border-rose-400/20 rounded-lg px-3 py-2">
        <span className="text-xs text-rose-400 flex-1">Delete {homeName} vs {awayName}?</span>
        <button onClick={() => setConfirmDel(false)} className="text-xs px-2 py-0.5 border border-surface-border rounded text-slate-400">Cancel</button>
        <button onClick={handleDelete} className="text-xs px-2 py-0.5 bg-rose-500 text-white rounded font-semibold">Delete</button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 bg-pitch-800 rounded-lg px-3 py-2 group">
      <span className="text-sm text-slate-300 flex-1 truncate">{homeName}</span>
      {homeScore != null && (
        <span className="text-xs font-mono text-slate-400 flex-shrink-0">{homeScore}–{awayScore}</span>
      )}
      <span className={cn("text-xs font-bold px-2 py-0.5 rounded border flex-shrink-0", chip)}>
        {result === "win" ? "WIN" : result === "loss" ? "LOSS" : "DRAW"}
      </span>
      <span className="text-sm text-slate-300 flex-1 text-right truncate">{awayName}</span>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => { setScore1(homeScore ?? ""); setScore2(awayScore ?? ""); setEditing(true) }}
          className="text-xs text-slate-500 hover:text-accent px-1">✎</button>
        <button onClick={() => setConfirmDel(true)}
          className="text-xs text-slate-500 hover:text-rose-400 px-1">✕</button>
      </div>
    </div>
  )
}

function GroupResultsCard({ group, uclRecords, onRefresh }) {
  const [expanded, setExpanded]       = useState(true)
  const [confirmReset, setConfirmReset] = useState(false)
  const qc = useQueryClient()
  const resetFixtures = useResetGroupFixtures()

  const pairings = buildPairings(group.players)
  const groupRecords = uclRecords.filter(r =>
    group.players.some(p => p.id === r.playerId) && group.players.some(p => p.id === r.opponentId)
  )
  const loggedCount = groupRecords.length
  const totalCount  = pairings.length
  const isComplete  = loggedCount >= totalCount && totalCount > 0

  function refresh() {
    qc.invalidateQueries({ queryKey: ["ucl-standings"] })
    qc.invalidateQueries({ queryKey: ["players"] })
    onRefresh()
  }

  if (group.players.length < 2) {
    return (
      <div className="card px-5 py-4">
        <p className="text-sm font-semibold text-white">{group.name}</p>
        <p className="text-xs text-slate-500 mt-1">Needs at least 2 players to generate fixtures</p>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      <button onClick={() => setExpanded(v => !v)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/5 transition-colors">
        <div className="flex items-center gap-3">
          <div className={cn("w-2 h-2 rounded-full flex-shrink-0",
            isComplete ? "bg-emerald-400" : loggedCount > 0 ? "bg-amber-400" : "bg-slate-600")} />
          <p className="text-sm font-semibold text-white">{group.name}</p>
          <span className="text-xs text-slate-500">({group.players.length} players)</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full",
            isComplete ? "bg-emerald-400/10 text-emerald-400"
            : loggedCount > 0 ? "bg-amber-400/10 text-amber-400"
            : "bg-slate-700 text-slate-500")}>
            {loggedCount}/{totalCount} logged
          </span>
          {loggedCount > 0 && !confirmReset && (
            <button onClick={e => { e.stopPropagation(); setConfirmReset(true) }}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-rose-400 transition-colors">
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </div>
      </button>

      {confirmReset && (
        <div className="border-b border-surface-border px-5 py-3 bg-rose-500/5 flex items-center gap-3">
          <p className="text-sm text-rose-400 flex-1">Delete all logged results for {group.name}?</p>
          <button onClick={() => setConfirmReset(false)} className="text-xs px-3 py-1.5 rounded-lg border border-surface-border text-slate-400">Cancel</button>
          <button onClick={async () => {
            await resetFixtures.mutateAsync(group.id)
            setConfirmReset(false)
            onRefresh()
          }} className="text-xs px-3 py-1.5 rounded-lg bg-rose-500 text-white font-semibold">
            Reset fixtures
          </button>
        </div>
      )}

      {expanded && (
        <div className="border-t border-surface-border px-5 py-4 space-y-2">
          {pairings.map((pair, i) => (
            <PairRow key={i} pair={pair} existing={groupRecords} onLogged={refresh} />
          ))}
          {isComplete && (
            <div className="flex items-center gap-2 text-emerald-400 text-sm pt-2">
              <CheckCircle className="w-4 h-4" />
              <span>All fixtures logged for {group.name}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function UclResults() {
  const { data: groups = [], isLoading } = useUclGroups()
  const [uclRecords, setUclRecords] = useState([])

  const fetchUclRecords = async () => {
    const all = await recordsApi.list()
    setUclRecords(all.filter(r => r.matchType === "ucl"))
  }

  useEffect(() => { fetchUclRecords() }, [])

  if (isLoading) return <p className="text-sm text-slate-500 text-center py-6">Loading…</p>

  if (groups.length === 0) {
    return (
      <div className="card px-6 py-12 text-center">
        <Trophy className="w-8 h-8 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400 font-medium">No UCL groups created yet</p>
        <p className="text-sm text-slate-600 mt-1">Create groups first in the UCL Groups tab</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">Log UCL group-stage results — each group plays round-robin within itself, each pair meeting once.</p>
      {groups.map(g => (
        <GroupResultsCard key={g.id} group={g} uclRecords={uclRecords} onRefresh={fetchUclRecords} />
      ))}
    </div>
  )
}