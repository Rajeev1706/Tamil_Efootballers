import { useState } from "react"
import { Calendar, Clock, ChevronDown, ChevronUp, Check, X } from "lucide-react"
import { cn } from "../../lib/utils"
import { useLineup, useFixtureRecords, useLogTeamRecord, useEditTeamRecord, useDeleteTeamRecord } from "../../lib/queries"

// ── Result button strip ───────────────────────────────────────────────────────
function ResultBtn({ label, value, selected, onClick, disabled }) {
  const colors = {
    win:  "bg-emerald-500/20 border-emerald-500/50 text-emerald-400",
    draw: "bg-amber-400/20 border-amber-400/50 text-amber-400",
    loss: "bg-rose-500/20 border-rose-500/50 text-rose-400",
  }
  return (
    <button
      onClick={() => onClick(value)}
      disabled={disabled}
      className={cn(
        "px-3 py-1 rounded-lg border text-xs font-bold transition-all",
        selected === value ? colors[value] : "border-surface-border text-slate-500 hover:border-slate-400",
        disabled && "opacity-40 cursor-not-allowed"
      )}
    >{label}</button>
  )
}

// ── Single matchup row ────────────────────────────────────────────────────────
function MatchupRow({ slot, myPlayer, oppPlayer, fixtureId, myTeamId, existingRecord, allPlayers, myPlayers, oppTeamId }) {
  const logRecord    = useLogTeamRecord()
  const updateRecord = useEditTeamRecord()
  const deleteRecord = useDeleteTeamRecord()

  const [result, setResult]         = useState(existingRecord?.result ?? null)
  const [myScore, setMyScore]       = useState(existingRecord?.playerScore ?? "")
  const [oppScore, setOppScore]     = useState(existingRecord?.opponentScore ?? "")
  const [editing, setEditing]       = useState(false)
  const [myPlayerId, setMyPlayerId]   = useState(myPlayer?.id ?? "")
  const [oppPlayerId, setOppPlayerId] = useState(oppPlayer?.id ?? "")
  const [saved, setSaved]           = useState(!!existingRecord)

  const canSave = myPlayerId && oppPlayerId && result

  async function handleSave() {
    const body = {
      playerId:      parseInt(myPlayerId),
      opponentId:    parseInt(oppPlayerId),
      result,
      playerScore:   myScore !== "" ? parseInt(myScore) : undefined,
      opponentScore: oppScore !== "" ? parseInt(oppScore) : undefined,
      fixtureId,
    }
    if (existingRecord) {
      await updateRecord.mutateAsync({ id: existingRecord.id, ...body })
    } else {
      await logRecord.mutateAsync(body)
    }
    setSaved(true)
    setEditing(false)
  }

  async function handleDelete() {
    if (!existingRecord) return
    await deleteRecord.mutateAsync(existingRecord.id)
    setResult(null); setMyScore(""); setOppScore(""); setSaved(false)
  }

  const resultColor = { win: "text-emerald-400", draw: "text-amber-400", loss: "text-rose-400" }

  return (
    <div className={cn(
      "px-4 py-3 border-b border-surface-border/40 last:border-0",
      saved && !editing && "bg-pitch-800/40"
    )}>
      {/* Matchup header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] text-slate-600 w-4 flex-shrink-0">{slot}</span>

        {/* Home player (LEFT) */}
        {editing || !saved ? (
          <select
            value={myPlayerId}
            onChange={e => setMyPlayerId(e.target.value)}
            className="flex-1 bg-pitch-800 border border-surface-border rounded px-2 py-1 text-xs text-white min-w-0"
          >
            <option value="">Select player…</option>
            {myPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        ) : (
          <span className="flex-1 text-sm font-medium text-white truncate">
            {myPlayers.find(p => p.id === parseInt(myPlayerId))?.name ?? "—"}
          </span>
        )}

        {/* Score */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {saved && !editing ? (
            <span className={cn("text-sm font-bold font-mono px-1", resultColor[result])}>
              {myScore !== "" ? `${myScore}–${oppScore}` : result?.toUpperCase()}
            </span>
          ) : (
            <>
              <input
                type="number" min="0" value={myScore}
                onChange={e => setMyScore(e.target.value)}
                placeholder="0"
                className="w-8 text-center bg-pitch-700 border border-surface-border rounded px-1 py-0.5 text-xs text-white"
              />
              <span className="text-slate-600 text-xs">–</span>
              <input
                type="number" min="0" value={oppScore}
                onChange={e => setOppScore(e.target.value)}
                placeholder="0"
                className="w-8 text-center bg-pitch-700 border border-surface-border rounded px-1 py-0.5 text-xs text-white"
              />
            </>
          )}
        </div>

        {/* Away player (RIGHT) */}
        {editing || !saved ? (
          <select
            value={oppPlayerId}
            onChange={e => setOppPlayerId(e.target.value)}
            className="flex-1 bg-pitch-800 border border-surface-border rounded px-2 py-1 text-xs text-white min-w-0"
          >
            <option value="">Opponent…</option>
            {allPlayers.filter(p => p.teamId === oppTeamId).map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        ) : (
          <span className="flex-1 text-sm font-medium text-slate-300 truncate text-right">
            {allPlayers.find(p => p.id === parseInt(oppPlayerId))?.name ?? "—"}
          </span>
        )}
      </div>

      {/* Result + actions */}
      {(editing || !saved) && (
        <div className="flex items-center gap-2 pl-6">
          <ResultBtn label="W" value="win"  selected={result} onClick={setResult} />
          <ResultBtn label="D" value="draw" selected={result} onClick={setResult} />
          <ResultBtn label="L" value="loss" selected={result} onClick={setResult} />
          <button
            onClick={handleSave}
            disabled={!canSave || logRecord.isPending || updateRecord.isPending}
            className="ml-auto flex items-center gap-1 px-3 py-1 rounded-lg bg-accent text-pitch-900 text-xs font-bold disabled:opacity-40"
          >
            <Check className="w-3 h-3" /> Save
          </button>
          {editing && (
            <button onClick={() => setEditing(false)} className="px-2 py-1 rounded-lg border border-surface-border text-xs text-slate-400">
              Cancel
            </button>
          )}
        </div>
      )}
      {saved && !editing && (
        <div className="flex items-center gap-2 pl-6">
          <button onClick={() => setEditing(true)} className="text-[10px] text-slate-500 hover:text-white underline decoration-dotted">Edit</button>
          <button onClick={handleDelete} className="text-[10px] text-rose-500 hover:text-rose-400 underline decoration-dotted">Delete</button>
        </div>
      )}
    </div>
  )
}

// ── Expandable fixture with matchup logging ───────────────────────────────────
function FixtureRow({ fixture, myTeamName, myTeamId, myPlayers, allPlayers }) {
  const isHome    = fixture.homeTeamId === myTeamId
  const opponent  = isHome ? fixture.away : fixture.home
  const oppTeamId = isHome ? fixture.awayTeamId : fixture.homeTeamId

  const isUpcoming = fixture.status === "upcoming"
  const myScore    = isHome ? fixture.homeScore : fixture.awayScore
  const oppScore   = isHome ? fixture.awayScore : fixture.homeScore

  let result = null, resultLabel = ""
  if (!isUpcoming && myScore != null) {
    if (myScore > oppScore)      { result = "win";  resultLabel = "W" }
    else if (myScore < oppScore) { result = "loss"; resultLabel = "L" }
    else                         { result = "draw"; resultLabel = "D" }
  }

  const resultColor = {
    win:  "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    loss: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    draw: "bg-amber-400/15 text-amber-400 border-amber-400/30",
  }

  const [expanded, setExpanded] = useState(false)

  // Lineup pre-fill from FixtureMaker (home team's planned matchups)
  const { data: lineup = [] } = useLineup(fixture.id)

  // Already logged records for this fixture
  const { data: existingRecords = [] } = useFixtureRecords(fixture.id)

  const formattedDate = fixture.date
    ? new Date(fixture.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "TBD"

  // Build matchup slots — prefer saved lineup, else empty slots matching team size
  const slots = lineup.length > 0
    ? lineup.map(m => ({
        slot:      m.slot,
        myPlayerId:  isHome ? m.myPlayerId  : m.oppPlayerId,
        oppPlayerId: isHome ? m.oppPlayerId : m.myPlayerId,
      }))
    : Array.from({ length: Math.max(myPlayers.length, 1) }, (_, i) => ({
        slot: i + 1, myPlayerId: null, oppPlayerId: null,
      }))

  return (
    <div className={cn(
      "border-b border-surface-border/60 last:border-0",
      !isUpcoming && result === "win"  && "border-l-2 border-l-emerald-500",
      !isUpcoming && result === "loss" && "border-l-2 border-l-rose-500",
      !isUpcoming && result === "draw" && "border-l-2 border-l-amber-400",
      isUpcoming && "border-l-2 border-l-accent/40",
    )}>
      {/* Fixture header row */}
      <div
        className={cn("flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-hover", isUpcoming && "cursor-pointer")}
        onClick={() => isUpcoming && setExpanded(e => !e)}
      >
        <div className="w-20 flex-shrink-0 text-center">
          <p className="text-xs font-semibold text-white">{formattedDate}</p>
          <p className="text-xs text-slate-600 mt-0.5">Round {fixture.round}</p>
        </div>

        <span className={cn(
          "text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0",
          isHome ? "bg-accent/15 text-accent" : "bg-slate-700/60 text-slate-400"
        )}>{isHome ? "H" : "A"}</span>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{isHome ? "vs " : "@ "}{opponent}</p>
          <p className="text-xs text-slate-600 mt-0.5">
            {isHome ? "Home" : "Away"}
            {fixture.grp && <span className="ml-2 text-accent font-semibold">Group {fixture.grp}</span>}
          </p>
        </div>

        {isUpcoming ? (
          <div className="flex items-center gap-2">
            {existingRecords.length > 0 && (
              <span className="text-xs text-emerald-400 font-semibold">{existingRecords.length} logged</span>
            )}
            <div className="flex items-center gap-1.5 text-accent/70">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">Upcoming</span>
            </div>
            {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <p className="text-base font-bold font-mono text-white">{myScore} – {oppScore}</p>
            {result && (
              <span className={cn("w-7 h-7 rounded-lg border flex items-center justify-center text-xs font-bold flex-shrink-0", resultColor[result])}>
                {resultLabel}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Expanded matchup section — only for upcoming */}
      {expanded && isUpcoming && (
        <div className="border-t border-surface-border/40 bg-pitch-900/40">
          {/* Header */}
          <div className="flex items-center px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-600">
            <span className="w-4 mr-2" />
            <span className="flex-1">{myTeamName} (home)</span>
            <span className="w-24 text-center">Score</span>
            <span className="flex-1 text-right">{opponent} (away)</span>
          </div>

          {slots.map(s => {
            const existingRecord = existingRecords.find(r =>
              (r.playerId === s.myPlayerId) || (r.playerId === s.oppPlayerId)
            ) ?? null

            return (
              <MatchupRow
                key={s.slot}
                slot={s.slot}
                myPlayer={myPlayers.find(p => p.id === s.myPlayerId)}
                oppPlayer={allPlayers.find(p => p.id === s.oppPlayerId)}
                fixtureId={fixture.id}
                myTeamId={myTeamId}
                oppTeamId={oppTeamId}
                existingRecord={existingRecord}
                myPlayers={myPlayers}
                allPlayers={allPlayers}
              />
            )
          })}

          <div className="px-4 py-2 text-[10px] text-slate-600 border-t border-surface-border/40">
            Results logged here feed directly into player match records, MV & form.
            Admin closes the fixture to update league standings.
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function TeamFixtures({ fixtures, myTeamName, myTeamId, myPlayers, allPlayers }) {
  const myFixtures = fixtures.filter(f => f.homeTeamId === myTeamId || f.awayTeamId === myTeamId)
  const past       = myFixtures.filter(f => f.status === "completed").reverse()
  const upcoming   = myFixtures.filter(f => f.status === "upcoming")

  const wins   = past.filter(f => {
    const isHome = f.homeTeamId === myTeamId
    return isHome ? f.homeScore > f.awayScore : f.awayScore > f.homeScore
  }).length
  const draws  = past.filter(f => f.homeScore === f.awayScore).length
  const losses = past.length - wins - draws

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Wins",   value: wins,   color: "text-emerald-400" },
          { label: "Draws",  value: draws,  color: "text-amber-400"   },
          { label: "Losses", value: losses, color: "text-rose-400"    },
        ].map(({ label, value, color }) => (
          <div key={label} className="card p-4 text-center">
            <p className={cn("text-2xl font-extrabold font-mono", color)}>{value}</p>
            <p className="text-xs text-slate-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Upcoming fixtures */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-surface-border">
          <Calendar className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-white">Upcoming fixtures</h2>
          <p className="text-xs text-slate-500 ml-1">— tap to log player results</p>
          {upcoming.length > 0 && (
            <span className="ml-auto text-xs font-semibold text-accent bg-accent/10 border border-accent/20 px-2 py-0.5 rounded-full">
              {upcoming.length} match{upcoming.length !== 1 ? "es" : ""}
            </span>
          )}
        </div>
        {upcoming.length === 0 ? (
          <div className="px-5 py-10 text-center text-slate-500 text-sm">No upcoming fixtures scheduled yet.</div>
        ) : (
          <div className="divide-y divide-surface-border/60">
            {upcoming.map(f => (
              <FixtureRow
                key={f.id}
                fixture={f}
                myTeamName={myTeamName}
                myTeamId={myTeamId}
                myPlayers={myPlayers}
                allPlayers={allPlayers}
              />
            ))}
          </div>
        )}
      </div>

      {/* Past results */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-surface-border">
          <Clock className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-white">Past results</h2>
        </div>
        {past.length === 0 ? (
          <div className="px-5 py-10 text-center text-slate-500 text-sm">No completed matches yet.</div>
        ) : (
          <div className="divide-y divide-surface-border/60">
            {past.map(f => (
              <FixtureRow
                key={f.id}
                fixture={f}
                myTeamName={myTeamName}
                myTeamId={myTeamId}
                myPlayers={myPlayers}
                allPlayers={allPlayers}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}