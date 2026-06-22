import { useState } from "react"
import { CheckCircle, ChevronDown, ChevronUp, Loader2 } from "lucide-react"
import { cn } from "../../lib/utils"
import { useLogTeamRecord, useFixtureRecords } from "../../lib/queries"

const RESULTS = [
  { value: "win",  label: "Win",  color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  { value: "draw", label: "Draw", color: "bg-amber-400/15  text-amber-400  border-amber-400/30"  },
  { value: "loss", label: "Loss", color: "bg-rose-500/15   text-rose-400   border-rose-500/30"   },
]

export default function TeamResults({ fixtures, myPlayers, allPlayers, myTeamId }) {
  // Only show the current matchday — the lowest upcoming round for this team
  const upcomingFixtures = fixtures.filter(f => f.status === "upcoming")
  const currentRound = upcomingFixtures.length > 0
    ? Math.min(...upcomingFixtures.map(f => f.round))
    : null
  const currentFixtures = upcomingFixtures.filter(f => f.round === currentRound)

  if (currentFixtures.length === 0) {
    return (
      <div className="card px-6 py-12 text-center">
        <CheckCircle className="w-8 h-8 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400 font-medium">No active fixture</p>
        <p className="text-sm text-slate-600 mt-1">Results will appear here once the admin schedules your next matchday</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Round {currentRound} · Current matchday</p>
      {currentFixtures.map(fixture => (
        <FixtureResultCard
          key={fixture.id}
          fixture={fixture}
          myPlayers={myPlayers}
          allPlayers={allPlayers}
          myTeamId={myTeamId}
        />
      ))}
    </div>
  )
}

function FixtureResultCard({ fixture, myPlayers, allPlayers, myTeamId }) {
  const [expanded, setExpanded]     = useState(true)
  const [playerScore, setPlayerScore] = useState(0)
  const [oppScore, setOppScore]       = useState(0)

  const isHome    = fixture.homeTeamId === myTeamId
  const oppTeamId = isHome ? fixture.awayTeamId : fixture.homeTeamId
  const oppName   = isHome ? fixture.away : fixture.home

  const oppPlayers = allPlayers.filter(p => p.teamId === oppTeamId)

  const { data: existingRecords = [], refetch } = useFixtureRecords(fixture.id)
  const logRecord = useLogTeamRecord()

  // Players already used in logged records for this fixture (both sides)
  const usedMyIds  = existingRecords.map(r =>
    myPlayers.find(p => p.id === r.playerId || p.id === r.opponentId)?.id
  ).filter(Boolean)
  const usedOppIds = existingRecords.map(r =>
    oppPlayers.find(p => p.id === r.playerId || p.id === r.opponentId)?.id
  ).filter(Boolean)

  // Local pending entries (not yet submitted)
  const [entries, setEntries] = useState([{ id: 1, myPlayerId: "", oppPlayerId: "", result: "" }])

  function addEntry() {
    setEntries(prev => [...prev, { id: Date.now(), myPlayerId: "", oppPlayerId: "", result: "" }])
  }

  function updateEntry(id, field, value) {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e))
  }

  function removeEntry(id) {
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  // Players already selected in other pending entries
  function availableMyPlayers(currentId) {
    const usedInEntries = entries.filter(e => e.id !== currentId && e.myPlayerId).map(e => Number(e.myPlayerId))
    return myPlayers.filter(p => !usedMyIds.includes(p.id) && !usedInEntries.includes(p.id))
  }

  function availableOppPlayers(currentId) {
    const usedInEntries = entries.filter(e => e.id !== currentId && e.oppPlayerId).map(e => Number(e.oppPlayerId))
    return oppPlayers.filter(p => !usedOppIds.includes(p.id) && !usedInEntries.includes(p.id))
  }

  async function submitEntry(entry) {
    if (!entry.myPlayerId || !entry.oppPlayerId || !entry.result) return
    try {
      await logRecord.mutateAsync({
        playerId:      Number(entry.myPlayerId),
        opponentId:    Number(entry.oppPlayerId),
        result:        entry.result,
        playerScore,
        opponentScore: oppScore,
        fixtureId:     fixture.id,
      })
      setEntries(prev => prev.filter(e => e.id !== entry.id))
      refetch()
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to log result")
    }
  }

  return (
    <div className="card overflow-hidden">
      {/* Fixture header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className={cn(
            "w-6 h-6 rounded-md text-xs font-bold flex items-center justify-center",
            isHome ? "bg-emerald-500/20 text-emerald-400" : "bg-blue-500/20 text-blue-400"
          )}>
            {isHome ? "H" : "A"}
          </span>
          <div className="text-left">
            <p className="text-sm font-semibold text-white">vs {oppName}</p>
            <p className="text-xs text-slate-500">Round {fixture.round} · {fixture.scheduledDate?.slice(0, 10) ?? ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">{existingRecords.length} results logged</span>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-surface-border px-5 py-4 space-y-4">

          {/* Score line */}
          <div className="flex items-center gap-3 justify-center">
            <span className="text-xs text-slate-500 w-20 text-right">Your score</span>
            <input type="number" min="0" value={playerScore} onChange={e => setPlayerScore(Number(e.target.value))}
              className="w-14 text-center bg-pitch-800 border border-surface-border rounded-lg py-1.5 text-sm text-white focus:outline-none focus:border-accent/40" />
            <span className="text-slate-500 font-bold">—</span>
            <input type="number" min="0" value={oppScore} onChange={e => setOppScore(Number(e.target.value))}
              className="w-14 text-center bg-pitch-800 border border-surface-border rounded-lg py-1.5 text-sm text-white focus:outline-none focus:border-accent/40" />
            <span className="text-xs text-slate-500 w-20">{oppName} score</span>
          </div>

          {/* Already logged records */}
          {existingRecords.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Logged results</p>
              {existingRecords.map(r => {
                const isMine = myPlayers.some(p => p.id === r.playerId)
                const myName  = isMine ? r.playerName  : r.opponentName
                const oppName_ = isMine ? r.opponentName : r.playerName
                const result  = isMine ? r.result : (r.result === "win" ? "loss" : r.result === "loss" ? "win" : "draw")
                const chip = RESULTS.find(x => x.value === result)
                return (
                  <div key={r.id} className="flex items-center justify-between bg-pitch-800 rounded-lg px-3 py-2">
                    <span className="text-sm text-slate-300">{myName} <span className="text-slate-600">vs</span> {oppName_}</span>
                    <span className={cn("text-xs font-semibold px-2 py-0.5 rounded border", chip?.color)}>{chip?.label}</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* New entries */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Add results</p>
            {entries.map(entry => (
              <EntryRow
                key={entry.id}
                entry={entry}
                myPlayers={availableMyPlayers(entry.id)}
                oppPlayers={availableOppPlayers(entry.id)}
                onChange={(field, value) => updateEntry(entry.id, field, value)}
                onSubmit={() => submitEntry(entry)}
                onRemove={() => removeEntry(entry.id)}
                submitting={logRecord.isPending}
              />
            ))}
            <button
              onClick={addEntry}
              className="text-sm text-accent hover:text-accent/80 transition-colors"
            >
              + Add another result
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function EntryRow({ entry, myPlayers, oppPlayers, onChange, onSubmit, onRemove, submitting }) {
  const canSubmit = entry.myPlayerId && entry.oppPlayerId && entry.result

  return (
    <div className="grid grid-cols-[1fr_auto_1fr_auto_auto] gap-2 items-center">
      <select
        value={entry.myPlayerId}
        onChange={e => onChange("myPlayerId", e.target.value)}
        className="bg-pitch-800 border border-surface-border rounded-lg px-2 py-2 text-sm text-white focus:outline-none focus:border-accent/40 truncate"
      >
        <option value="">— Your player —</option>
        {myPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>

      <span className="text-slate-600 text-xs font-bold">vs</span>

      <select
        value={entry.oppPlayerId}
        onChange={e => onChange("oppPlayerId", e.target.value)}
        className="bg-pitch-800 border border-surface-border rounded-lg px-2 py-2 text-sm text-white focus:outline-none focus:border-accent/40 truncate"
      >
        <option value="">— Opp player —</option>
        {oppPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>

      <select
        value={entry.result}
        onChange={e => onChange("result", e.target.value)}
        className="bg-pitch-800 border border-surface-border rounded-lg px-2 py-2 text-sm text-white focus:outline-none focus:border-accent/40"
      >
        <option value="">Result</option>
        <option value="win">Win</option>
        <option value="draw">Draw</option>
        <option value="loss">Loss</option>
      </select>

      <div className="flex gap-1">
        <button
          onClick={onSubmit}
          disabled={!canSubmit || submitting}
          className={cn(
            "px-3 py-2 rounded-lg text-xs font-semibold transition-colors",
            canSubmit
              ? "bg-accent/15 text-accent border border-accent/25 hover:bg-accent/25"
              : "bg-pitch-800 text-slate-600 border border-surface-border cursor-not-allowed"
          )}
        >
          {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Log"}
        </button>
        <button
          onClick={onRemove}
          className="px-2 py-2 rounded-lg text-xs text-slate-600 hover:text-rose-400 transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  )
}