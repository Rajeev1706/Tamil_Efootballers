import { useState } from "react"
import { ChevronDown, ChevronUp, CheckCircle, Loader2, Users } from "lucide-react"
import { cn } from "../../lib/utils"
import { useFixtures, usePlayers, useFixtureRecords } from "../../lib/queries"
import { recordsApi } from "../../lib/api"
import { useQueryClient } from "@tanstack/react-query"

const RESULT_COLOR = {
  win:  "bg-emerald-400/10 text-emerald-400 border-emerald-400/25",
  draw: "bg-amber-400/10  text-amber-400  border-amber-400/25",
  loss: "bg-rose-400/10   text-rose-400   border-rose-400/25",
}

function AdminEntryRow({ entry, myPlayers, oppPlayers, onChange, onSubmit, submitting }) {
  const canSubmit = entry.myPlayerId && entry.oppPlayerId && entry.result &&
    entry.playerScore !== "" && entry.oppScore !== ""

  return (
    <div className="space-y-2 border border-surface-border rounded-xl p-3 bg-pitch-800/40">
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
        <select value={entry.myPlayerId} onChange={e => onChange("myPlayerId", e.target.value)}
          className="bg-pitch-900 border border-surface-border rounded-lg px-2 py-2 text-sm text-white focus:outline-none focus:border-accent/40 truncate">
          <option value="">— Home player —</option>
          {myPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <span className="text-slate-600 text-xs font-bold text-center">vs</span>
        <select value={entry.oppPlayerId} onChange={e => onChange("oppPlayerId", e.target.value)}
          className="bg-pitch-900 border border-surface-border rounded-lg px-2 py-2 text-sm text-white focus:outline-none focus:border-accent/40 truncate">
          <option value="">— Away player —</option>
          {oppPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <select value={entry.result} onChange={e => onChange("result", e.target.value)}
          className="flex-1 bg-pitch-900 border border-surface-border rounded-lg px-2 py-2 text-sm text-white focus:outline-none focus:border-accent/40">
          <option value="">Result</option>
          <option value="win">Win (Home)</option>
          <option value="draw">Draw</option>
          <option value="loss">Loss (Home)</option>
        </select>
        <span className="text-xs text-slate-600 flex-shrink-0">Score:</span>
        <input type="number" min="0" placeholder="0" value={entry.playerScore}
          onChange={e => onChange("playerScore", e.target.value)}
          className="w-14 text-center bg-pitch-900 border border-surface-border rounded-md py-2 text-sm text-white focus:outline-none focus:border-accent/40" />
        <span className="text-slate-600 text-xs">—</span>
        <input type="number" min="0" placeholder="0" value={entry.oppScore}
          onChange={e => onChange("oppScore", e.target.value)}
          className="w-14 text-center bg-pitch-900 border border-surface-border rounded-md py-2 text-sm text-white focus:outline-none focus:border-accent/40" />
        <button onClick={onSubmit} disabled={!canSubmit || submitting}
          className={cn("px-3 py-2 rounded-lg text-xs font-semibold transition-colors flex-shrink-0",
            canSubmit ? "bg-accent/15 text-accent border border-accent/25 hover:bg-accent/25"
                      : "bg-pitch-900 text-slate-600 border border-surface-border cursor-not-allowed")}>
          {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Log"}
        </button>
      </div>
    </div>
  )
}

function FixtureCard({ fixture, allPlayers }) {
  const [expanded, setExpanded]   = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const qc = useQueryClient()
  const { data: existingRecords = [], refetch } = useFixtureRecords(fixture.id)

  const homePlayers = allPlayers.filter(p => p.teamId === fixture.homeTeamId)
  const awayPlayers = allPlayers.filter(p => p.teamId === fixture.awayTeamId)

  const usedHomeIds = existingRecords.flatMap(r => [
    homePlayers.find(p => p.id === r.playerId)?.id,
    homePlayers.find(p => p.id === r.opponentId)?.id,
  ]).filter(Boolean)
  const usedAwayIds = existingRecords.flatMap(r => [
    awayPlayers.find(p => p.id === r.playerId)?.id,
    awayPlayers.find(p => p.id === r.opponentId)?.id,
  ]).filter(Boolean)

  const [entries, setEntries] = useState([
    { id: 1, myPlayerId: "", oppPlayerId: "", result: "", playerScore: "", oppScore: "" }
  ])

  function availableHome(currentId) {
    const usedInEntries = entries.filter(e => e.id !== currentId && e.myPlayerId).map(e => Number(e.myPlayerId))
    return homePlayers.filter(p => !usedHomeIds.includes(p.id) && !usedInEntries.includes(p.id))
  }

  function availableAway(currentId) {
    const usedInEntries = entries.filter(e => e.id !== currentId && e.oppPlayerId).map(e => Number(e.oppPlayerId))
    return awayPlayers.filter(p => !usedAwayIds.includes(p.id) && !usedInEntries.includes(p.id))
  }

  function updateEntry(id, field, value) {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e))
  }

  async function submitEntry(entry) {
    if (!entry.myPlayerId || !entry.oppPlayerId || !entry.result) return
    setSubmitting(true)
    try {
      await recordsApi.create({
        playerId:      Number(entry.myPlayerId),
        opponentId:    Number(entry.oppPlayerId),
        result:        entry.result,
        matchType:     "league",
        playerScore:   Number(entry.playerScore) || 0,
        opponentScore: Number(entry.oppScore)    || 0,
      })
      setEntries(prev => {
        const remaining = prev.filter(e => e.id !== entry.id)
        return remaining.length > 0
          ? remaining
          : [{ id: Date.now(), myPlayerId: "", oppPlayerId: "", result: "", playerScore: "", oppScore: "" }]
      })
      qc.invalidateQueries({ queryKey: ["fixture-records", fixture.id] })
      qc.invalidateQueries({ queryKey: ["players"] })
      qc.invalidateQueries({ queryKey: ["records"] })
      refetch()
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to log result")
    } finally {
      setSubmitting(false)
    }
  }

  const totalPlayers  = Math.min(homePlayers.length, awayPlayers.length)
  const loggedCount   = existingRecords.length
  const isComplete    = loggedCount >= totalPlayers && totalPlayers > 0

  return (
    <div className="card overflow-hidden">
      <button onClick={() => setExpanded(v => !v)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/5 transition-colors">
        <div className="flex items-center gap-3">
          <div className={cn("w-2 h-2 rounded-full flex-shrink-0",
            isComplete ? "bg-emerald-400" : loggedCount > 0 ? "bg-amber-400" : "bg-slate-600")} />
          <div className="text-left">
            <p className="text-sm font-semibold text-white">{fixture.home} <span className="text-slate-500 font-normal">vs</span> {fixture.away}</p>
            <p className="text-xs text-slate-500">Round {fixture.round} · {fixture.date?.slice(0, 10)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full",
            isComplete ? "bg-emerald-400/10 text-emerald-400"
            : loggedCount > 0 ? "bg-amber-400/10 text-amber-400"
            : "bg-slate-700 text-slate-500")}>
            {loggedCount}/{totalPlayers} logged
          </span>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-surface-border px-5 py-4 space-y-4">
          {/* Team headers */}
          <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">
            <span className="text-accent">{fixture.home}</span>
            <span className="text-right">{fixture.away}</span>
          </div>

          {/* Already logged */}
          {existingRecords.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Logged results</p>
              {existingRecords.map(r => {
                const isHome    = homePlayers.some(p => p.id === r.playerId)
                const homeName  = isHome ? r.playerName  : r.opponentName
                const awayName  = isHome ? r.opponentName : r.playerName
                const result    = isHome ? r.result : (r.result === "win" ? "loss" : r.result === "loss" ? "win" : "draw")
                const homeScore = isHome ? r.playerScore : r.opponentScore
                const awayScore = isHome ? r.opponentScore : r.playerScore
                const chip = { win: RESULT_COLOR.win, draw: RESULT_COLOR.draw, loss: RESULT_COLOR.loss }[result]
                return (
                  <div key={r.id} className="flex items-center gap-2 bg-pitch-800 rounded-lg px-3 py-2 text-sm">
                    <span className="text-slate-300 flex-1 truncate">{homeName}</span>
                    {homeScore != null && <span className="text-xs font-mono text-slate-400 flex-shrink-0">{homeScore}–{awayScore}</span>}
                    <span className={cn("text-xs font-bold px-2 py-0.5 rounded border flex-shrink-0", chip)}>
                      {result === "win" ? "HOME WIN" : result === "loss" ? "AWAY WIN" : "DRAW"}
                    </span>
                    <span className="text-slate-300 flex-1 text-right truncate">{awayName}</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Add results */}
          {!isComplete && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Add results</p>
              {entries.map(entry => (
                <AdminEntryRow
                  key={entry.id}
                  entry={entry}
                  myPlayers={availableHome(entry.id)}
                  oppPlayers={availableAway(entry.id)}
                  onChange={(field, val) => updateEntry(entry.id, field, val)}
                  onSubmit={() => submitEntry(entry)}
                  submitting={submitting}
                />
              ))}
              <button
                onClick={() => setEntries(prev => [...prev, { id: Date.now(), myPlayerId: "", oppPlayerId: "", result: "", playerScore: "", oppScore: "" }])}
                className="text-sm text-accent hover:text-accent/80 transition-colors">
                + Add another result
              </button>
            </div>
          )}

          {isComplete && (
            <div className="flex items-center gap-2 text-emerald-400 text-sm">
              <CheckCircle className="w-4 h-4" />
              <span>All player matchups logged for this fixture</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function TeamLeagueResults() {
  const { data: fixtures = [] } = useFixtures()
  const { data: players  = [] } = usePlayers()

  // Only show current round (lowest upcoming round)
  const upcoming = fixtures.filter(f => f.status === "upcoming")
  const currentRound = upcoming.length > 0
    ? Math.min(...upcoming.map(f => f.round))
    : null
  const currentFixtures = upcoming.filter(f => f.round === currentRound)

  if (currentFixtures.length === 0) {
    return (
      <div className="card px-6 py-12 text-center">
        <Users className="w-8 h-8 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400 font-medium">No active fixtures</p>
        <p className="text-sm text-slate-600 mt-1">Create fixtures first from the Fixtures tab</p>
      </div>
    )
  }

  const allPlayers = players.map(p => ({
    id: p.id, name: p.name, teamId: p.teamId
  }))

  // Summary counts
  const totalFixtures = currentFixtures.length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">
            Round {currentRound} · Current Matchday
          </p>
          <p className="text-sm text-slate-400 mt-0.5">{totalFixtures} fixtures</p>
        </div>
      </div>

      {currentFixtures.map(fixture => (
        <FixtureCard key={fixture.id} fixture={fixture} allPlayers={allPlayers} />
      ))}
    </div>
  )
}