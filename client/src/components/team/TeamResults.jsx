import { useState, useEffect, useRef } from "react"
import { CheckCircle, ChevronDown, ChevronUp, Loader2, Pencil, Trash2, X, Save, Download } from "lucide-react"
import { toPng } from "html-to-image"
import { cn } from "../../lib/utils"
import { useLogTeamRecord, useFixtureRecords, useEditTeamRecord, useDeleteTeamRecord, useLineup } from "../../lib/queries"
import tefLogo from "../../../images/logo.png"

const RESULTS = [
  { value: "win",  label: "Win",  color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  { value: "draw", label: "Draw", color: "bg-amber-400/15  text-amber-400  border-amber-400/30"  },
  { value: "loss", label: "Loss", color: "bg-rose-500/15   text-rose-400   border-rose-500/30"   },
  { value: "walkover", label: "Walkover (I gave WO)", color: "bg-orange-400/15 text-orange-400 border-orange-400/30" },
  { value: "walkover_opp", label: "Walkover (Opp gave WO)", color: "bg-emerald-400/15 text-emerald-400 border-emerald-400/30" },
]

const KO_LABELS = {
  champions_sf1: "Champions SF 1", champions_sf2: "Champions SF 2",
  champions_final: "Champions Final", champions_3rd: "3rd / 4th Place",
  europa_sf1: "Europa SF 1", europa_sf2: "Europa SF 2",
  europa_final: "Europa Final", europa_7th: "7th / 8th Place",
}

export default function TeamResults({ fixtures, myPlayers, allPlayers, myTeamId, myTeam }) {
  const upcomingFixtures = fixtures.filter(f => f.status === "upcoming")
  const currentRound = upcomingFixtures.length > 0
    ? Math.min(...upcomingFixtures.map(f => f.round))
    : null
  const currentFixtures = upcomingFixtures.filter(f => f.round === currentRound)

  const firstFix = currentFixtures[0]
  const matchdayLabel = firstFix?.isKnockoutLeg && firstFix?.knockoutMatchType
    ? `${KO_LABELS[firstFix.knockoutMatchType] ?? "Knockout"} · Leg ${firstFix.knockoutLeg}`
    : `Round ${currentRound} · Current matchday`

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
      <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">{matchdayLabel}</p>
      {currentFixtures.map(fixture => (
        <FixtureResultCard
          key={fixture.id}
          fixture={fixture}
          myPlayers={myPlayers}
          allPlayers={allPlayers}
          myTeamId={myTeamId}
          myTeam={myTeam}
        />
      ))}
    </div>
  )
}

function FixtureResultCard({ fixture, myPlayers, allPlayers, myTeamId, myTeam }) {
  const [expanded, setExpanded] = useState(true)
  const [exporting, setExporting] = useState(false)
  const exportRef = useRef(null)

  const isHome    = fixture.homeTeamId === myTeamId
  const oppTeamId = isHome ? fixture.awayTeamId : fixture.homeTeamId
  const oppName   = isHome ? fixture.away : fixture.home
  const oppLogoUrl = isHome ? fixture.awayLogo : fixture.homeLogo

  const oppPlayers = allPlayers.filter(p => p.teamId === oppTeamId)

  const { data: existingRecords = [], refetch } = useFixtureRecords(fixture.id)
  const { data: lineup = [] } = useLineup(fixture.id)
  const logRecord = useLogTeamRecord()

  // Compute aggregate totals from logged records
  const myTotal  = existingRecords.reduce((sum, r) => {
    const isMine = myPlayers.some(p => p.id === r.playerId)
    return sum + (isMine ? (r.playerScore ?? 0) : (r.opponentScore ?? 0))
  }, 0)
  const oppTotal = existingRecords.reduce((sum, r) => {
    const isMine = myPlayers.some(p => p.id === r.playerId)
    return sum + (isMine ? (r.opponentScore ?? 0) : (r.playerScore ?? 0))
  }, 0)

  const matchOutcome = existingRecords.length === 0
    ? null
    : myTotal > oppTotal ? "win" : myTotal < oppTotal ? "loss" : "draw"

  async function handleExport() {
    if (!exportRef.current || existingRecords.length === 0) return
    setExporting(true)
    await new Promise(r => setTimeout(r, 300))
    try {
      const dataUrl = await toPng(exportRef.current, { cacheBust: true, pixelRatio: 2 })
      const link = document.createElement("a")
      link.download = `${myTeam?.name ?? "My Team"}-vs-${oppName}-R${fixture.round}.png`
      link.href = dataUrl
      link.click()
    } catch (e) {
      console.error(e)
    } finally {
      setExporting(false)
    }
  }

  // Pre-fill entries from saved lineup if available
  const buildInitialEntries = () => {
    if (lineup.length > 0) {
      return lineup.map((m, i) => ({
        id:          i + 1,
        myPlayerId:  isHome ? (m.myPlayerId  ?? "") : (m.oppPlayerId ?? ""),
        oppPlayerId: isHome ? (m.oppPlayerId ?? "") : (m.myPlayerId  ?? ""),
        result:      "",
        playerScore: "",
        oppScore:    "",
      }))
    }
    return [{ id: 1, myPlayerId: "", oppPlayerId: "", result: "", playerScore: "", oppScore: "" }]
  }

  const [entries, setEntries] = useState(buildInitialEntries)

  useEffect(() => {
    if (lineup.length > 0 && entries.every(e => !e.myPlayerId && !e.oppPlayerId)) {
      setEntries(buildInitialEntries())
    }
  }, [lineup.length])

  useEffect(() => {
    if (existingRecords.length === 0) return
    const loggedMyIds = existingRecords.flatMap(r => [
      myPlayers.find(p => p.id === r.playerId)?.id,
      myPlayers.find(p => p.id === r.opponentId)?.id,
    ]).filter(Boolean)
    setEntries(prev => {
      const filtered = prev.filter(e =>
        !e.myPlayerId || !loggedMyIds.includes(Number(e.myPlayerId))
      )
      return filtered.length > 0
        ? filtered
        : [{ id: Date.now(), myPlayerId: "", oppPlayerId: "", result: "", playerScore: "", oppScore: "" }]
    })
  }, [existingRecords.length])

  const usedMyIds  = existingRecords.flatMap(r => [
    myPlayers.find(p => p.id === r.playerId)?.id,
    myPlayers.find(p => p.id === r.opponentId)?.id,
  ]).filter(Boolean)
  const usedOppIds = existingRecords.flatMap(r => [
    oppPlayers.find(p => p.id === r.playerId)?.id,
    oppPlayers.find(p => p.id === r.opponentId)?.id,
  ]).filter(Boolean)

  function addEntry() {
    setEntries(prev => [...prev, {
      id: Date.now(), myPlayerId: "", oppPlayerId: "", result: "", playerScore: "", oppScore: ""
    }])
  }

  function updateEntry(id, field, value) {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e))
  }

  function removeEntry(id) {
    setEntries(prev => prev.filter(e => e.id !== id))
  }

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
      const isWalkover  = entry.result === "walkover" || entry.result === "walkover_opp"
      const result      = entry.result === "walkover" ? "loss" : entry.result === "walkover_opp" ? "win" : entry.result
      const playerScore = entry.result === "walkover" ? 0 : entry.result === "walkover_opp" ? 3 : Number(entry.playerScore)
      const oppScore    = entry.result === "walkover" ? 3 : entry.result === "walkover_opp" ? 0 : Number(entry.oppScore)

      await logRecord.mutateAsync({
        playerId:      Number(entry.myPlayerId),
        opponentId:    Number(entry.oppPlayerId),
        result,
        playerScore,
        opponentScore: oppScore,
        fixtureId:     fixture.id,
        isWalkover,
      })
      setEntries(prev => prev.filter(e => e.id !== entry.id))
      if (entries.length === 1) {
        setEntries([{ id: Date.now(), myPlayerId: "", oppPlayerId: "", result: "", playerScore: "", oppScore: "" }])
      }
      refetch()
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to log result")
    }
  }

  return (
    <>
      {/* Hidden export card — rendered off-screen for PNG capture */}
      <div className="fixed -left-[9999px] -top-[9999px] pointer-events-none" aria-hidden>
        <MatchExportCard
          ref={exportRef}
          myTeam={myTeam}
          oppName={oppName}
          oppLogoUrl={oppLogoUrl}
          round={fixture.round}
          date={fixture.date}
          records={existingRecords}
          myPlayers={myPlayers}
          myTotal={myTotal}
          oppTotal={oppTotal}
          outcome={matchOutcome}
        />
      </div>

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
              <p className="text-xs text-slate-500">Round {fixture.round} · {fixture.date?.slice(0, 10) ?? ""}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">{existingRecords.length} results logged</span>
            {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
          </div>
        </button>

        {expanded && (
          <div className="border-t border-surface-border px-5 py-4 space-y-4">

            {/* Logged records */}
            {existingRecords.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Logged results</p>
                  <button
                    onClick={handleExport}
                    disabled={exporting}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-accent/10 border border-accent/25 text-accent text-xs font-semibold hover:bg-accent/20 transition-colors disabled:opacity-50"
                  >
                    {exporting
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <Download className="w-3 h-3" />}
                    {exporting ? "Exporting…" : "Export PNG"}
                  </button>
                </div>

                {/* Score summary bar */}
                {existingRecords.length > 0 && (
                  <div className={cn(
                    "rounded-xl px-4 py-3 flex items-center justify-between border",
                    matchOutcome === "win"  ? "bg-emerald-500/10 border-emerald-500/25" :
                    matchOutcome === "loss" ? "bg-rose-500/10 border-rose-500/25" :
                    matchOutcome === "draw" ? "bg-amber-400/10 border-amber-400/25" :
                    "bg-surface border-surface-border"
                  )}>
                    <div className="text-center">
                      <p className="text-xs text-slate-400 truncate max-w-[90px]">{myTeam?.name ?? "My Team"}</p>
                      <p className="text-2xl font-black text-white">{myTotal}</p>
                    </div>
                    <div className="text-center px-3">
                      <p className={cn(
                        "text-xs font-bold uppercase tracking-widest",
                        matchOutcome === "win"  ? "text-emerald-400" :
                        matchOutcome === "loss" ? "text-rose-400" :
                        matchOutcome === "draw" ? "text-amber-400" : "text-slate-500"
                      )}>
                        {matchOutcome === "win" ? "WIN" : matchOutcome === "loss" ? "LOSS" : matchOutcome === "draw" ? "DRAW" : "—"}
                      </p>
                      <p className="text-slate-600 text-xs mt-0.5">pts</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-slate-400 truncate max-w-[90px]">{oppName}</p>
                      <p className="text-2xl font-black text-white">{oppTotal}</p>
                    </div>
                  </div>
                )}

                {existingRecords.map(r => {
                  const isMine = myPlayers.some(p => p.id === r.playerId)
                  return (
                    <LoggedResultRow key={r.id} record={r} isMine={isMine} onChanged={refetch} />
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
              <button onClick={addEntry} className="text-sm text-accent hover:text-accent/80 transition-colors">
                + Add another result
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Hidden export card — captured as PNG
// ---------------------------------------------------------------------------
import { forwardRef } from "react"

const MatchExportCard = forwardRef(function MatchExportCard(
  { myTeam, oppName, oppLogoUrl, round, date, records, myPlayers, myTotal, oppTotal, outcome },
  ref
) {
  const myName = myTeam?.name ?? "My Team"
  const myLogo = myTeam?.logoUrl

  const outcomeBg    = outcome === "win"  ? "#065f46" : outcome === "loss" ? "#4c0519" : outcome === "draw" ? "#78350f" : "#1e293b"
  const outcomeText  = outcome === "win"  ? "#34d399" : outcome === "loss" ? "#fb7185" : outcome === "draw" ? "#fbbf24" : "#94a3b8"
  const outcomeLabel = outcome === "win"  ? `🏆 ${myName} WINS!`
                     : outcome === "loss" ? `🏆 ${oppName} WINS!`
                     : outcome === "draw" ? "DRAW" : "—"

  return (
    <div
      ref={ref}
      style={{
        width: 480,
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        borderRadius: 20,
        overflow: "hidden",
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        color: "#f8fafc",
      }}
    >
      {/* Header */}
      <div style={{
        background: "#0f172a", padding: "16px 24px", borderBottom: "1px solid #1e293b",
        display: "flex", alignItems: "center", gap: 12
      }}>
        <img src={tefLogo} alt="TEF"
          style={{ width: 40, height: 40, objectFit: "contain", borderRadius: 8, flexShrink: 0 }} />
        <div>
          <p style={{ fontSize: 11, color: "#64748b", letterSpacing: 2, textTransform: "uppercase", margin: 0 }}>
            Round {round} · Tamil eFootball League
          </p>
          <p style={{ fontSize: 12, color: "#475569", margin: "3px 0 0" }}>
            {date?.slice(0, 10) ?? ""}
          </p>
        </div>
      </div>

      {/* Teams + Score */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 24px 20px" }}>
        {/* My Team */}
        <div style={{ flex: 1, textAlign: "center" }}>
          {myLogo ? (
            <img src={myLogo} alt={myName}
              style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", margin: "0 auto 10px", display: "block", border: "2px solid #334155" }} />
          ) : (
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#1e3a5f", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px", fontSize: 22, fontWeight: 900 }}>
              {myName.charAt(0)}
            </div>
          )}
          <p style={{ fontSize: 13, fontWeight: 700, margin: 0, color: "#f1f5f9" }}>{myName}</p>
          <p style={{ fontSize: 42, fontWeight: 900, margin: "4px 0 0", lineHeight: 1,
            color: outcome === "win" ? "#34d399" : outcome === "loss" ? "#fb7185" : "#f8fafc"
          }}>{myTotal}</p>
        </div>

        {/* VS + outcome */}
        <div style={{ textAlign: "center", padding: "0 12px" }}>
          <div style={{
            background: outcomeBg, borderRadius: 12, padding: "8px 14px",
            border: `1px solid ${outcomeText}44`
          }}>
            <p style={{ fontSize: 13, fontWeight: 900, color: outcomeText, margin: 0, letterSpacing: 0.5 }}>
              {outcomeLabel}
            </p>
          </div>
          <p style={{ fontSize: 11, color: "#475569", margin: "8px 0 0" }}>vs</p>
        </div>

        {/* Opponent */}
        <div style={{ flex: 1, textAlign: "center" }}>
          {oppLogoUrl ? (
            <img src={oppLogoUrl} alt={oppName}
              style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", margin: "0 auto 10px", display: "block", border: "2px solid #334155" }} />
          ) : (
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#2d1b3d", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px", fontSize: 22, fontWeight: 900, border: "2px solid #334155" }}>
              {oppName?.charAt(0)}
            </div>
          )}
          <p style={{ fontSize: 13, fontWeight: 700, margin: 0, color: "#f1f5f9" }}>{oppName}</p>
          <p style={{ fontSize: 42, fontWeight: 900, margin: "4px 0 0", lineHeight: 1,
            color: outcome === "loss" ? "#34d399" : outcome === "win" ? "#fb7185" : "#f8fafc"
          }}>{oppTotal}</p>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "#1e293b", margin: "0 24px" }} />

      {/* Player rows */}
      <div style={{ padding: "16px 24px 20px" }}>
        <p style={{ fontSize: 11, color: "#64748b", letterSpacing: 2, textTransform: "uppercase", margin: "0 0 12px" }}>
          Player Results
        </p>
        {records.map((r, i) => {
          const isMine    = myPlayers.some(p => p.id === r.playerId)
          const myPName   = isMine ? r.playerName  : r.opponentName
          const oppPName  = isMine ? r.opponentName : r.playerName
          const result    = isMine ? r.result : (r.result === "win" ? "loss" : r.result === "loss" ? "win" : "draw")
          const myS       = isMine ? r.playerScore  : r.opponentScore
          const oppS      = isMine ? r.opponentScore : r.playerScore

          const chipBg    = result === "win" ? "#065f46" : result === "loss" ? "#4c0519" : "#78350f"
          const chipColor = result === "win" ? "#34d399" : result === "loss" ? "#fb7185" : "#fbbf24"
          const chipLabel = result === "win" ? "WIN" : result === "loss" ? "LOSS" : "DRAW"

          return (
            <div key={r.id} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: i % 2 === 0 ? "#ffffff08" : "transparent",
              borderRadius: 10, padding: "10px 12px", marginBottom: 6
            }}>
              <span style={{ fontSize: 13, color: "#e2e8f0", flex: 1, textAlign: "left" }}>{myPName}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8", margin: "0 8px", fontVariantNumeric: "tabular-nums" }}>
                {r.isWalkover ? "WO" : `${myS ?? 0} – ${oppS ?? 0}`}
              </span>
              <span style={{ fontSize: 13, color: "#e2e8f0", flex: 1, textAlign: "right" }}>{oppPName}</span>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
                background: chipBg, color: chipColor, marginLeft: 10, minWidth: 38, textAlign: "center"
              }}>{chipLabel}</span>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div style={{ background: "#0f172a", padding: "12px 24px", borderTop: "1px solid #1e293b", textAlign: "center" }}>
        <p style={{ fontSize: 11, color: "#334155", margin: 0 }}>Tamil eFootball League · tamilefootballers.com</p>
      </div>
    </div>
  )
})

// ---------------------------------------------------------------------------
// LoggedResultRow
// ---------------------------------------------------------------------------
function LoggedResultRow({ record: r, isMine, onChanged }) {
  const editRecord   = useEditTeamRecord()
  const deleteRecord = useDeleteTeamRecord()
  const [editing, setEditing]       = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  const myName    = isMine ? r.playerName  : r.opponentName
  const oppName_  = isMine ? r.opponentName : r.playerName
  const result    = isMine ? r.result : (r.result === "win" ? "loss" : r.result === "loss" ? "win" : "draw")
  const myScore   = isMine ? r.playerScore : r.opponentScore
  const oppScore_ = isMine ? r.opponentScore : r.playerScore
  const isWalkoverGiven = r.isWalkover && result === "loss"
  const chip = isWalkoverGiven
    ? { value: "walkover", label: "WO", color: "bg-orange-400/15 text-orange-400 border-orange-400/30" }
    : RESULTS.find(x => x.value === result)

  const [editResult, setEditResult]     = useState(result)
  const [editMyScore, setEditMyScore]   = useState(myScore ?? "")
  const [editOppScore, setEditOppScore] = useState(oppScore_ ?? "")

  function handleSave() {
    editRecord.mutate({
      id: r.id,
      result:         editResult,
      playerScore:    Number(editMyScore),
      opponentScore:  Number(editOppScore),
    }, {
      onSuccess: () => { setEditing(false); onChanged?.() },
      onError:   (err) => alert(err?.response?.data?.error || "Failed to update result"),
    })
  }

  function handleDelete() {
    deleteRecord.mutate(r.id, {
      onSuccess: () => onChanged?.(),
      onError:   (err) => alert(err?.response?.data?.error || "Failed to delete result"),
    })
  }

  if (editing) {
    return (
      <div className="bg-pitch-800 rounded-lg px-3 py-2.5 space-y-2 border border-accent/25">
        <p className="text-xs text-slate-500">{myName} vs {oppName_}</p>
        <div className="flex items-center gap-2">
          <select value={editResult} onChange={e => setEditResult(e.target.value)}
            className="flex-1 bg-pitch-900 border border-surface-border rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-accent/40">
            {RESULTS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <input type="number" min="0" placeholder="0" value={editMyScore}
            onChange={e => setEditMyScore(e.target.value)}
            className="w-12 text-center bg-pitch-900 border border-surface-border rounded-md py-1.5 text-sm text-white focus:outline-none focus:border-accent/40" />
          <span className="text-slate-600 text-xs flex-shrink-0">—</span>
          <input type="number" min="0" placeholder="0" value={editOppScore}
            onChange={e => setEditOppScore(e.target.value)}
            className="w-12 text-center bg-pitch-900 border border-surface-border rounded-md py-1.5 text-sm text-white focus:outline-none focus:border-accent/40" />
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditing(false)}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border border-surface-border text-slate-400 hover:text-white text-xs transition-colors">
            <X className="w-3 h-3" /> Cancel
          </button>
          <button onClick={handleSave} disabled={editRecord.isPending}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-accent text-white font-semibold text-xs disabled:opacity-50 transition-colors">
            <Save className="w-3 h-3" /> {editRecord.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between bg-pitch-800 rounded-lg px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm text-slate-300 truncate">{myName}</span>
        {r.isWalkover ? (
          <span className="text-xs font-bold text-orange-400 flex-shrink-0">WO</span>
        ) : myScore != null && oppScore_ != null ? (
          <span className="text-xs text-slate-500 font-mono flex-shrink-0">{myScore}–{oppScore_}</span>
        ) : null}
        <span className="text-slate-600 text-xs flex-shrink-0">vs</span>
        <span className="text-sm text-slate-300 truncate">{oppName_}</span>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
        <span className={cn("text-xs font-semibold px-2 py-0.5 rounded border", chip?.color)}>
          {chip?.label}
        </span>
        {isMine && !confirmDel && (
          <>
            <button onClick={() => setEditing(true)}
              className="w-6 h-6 rounded-md hover:bg-surface flex items-center justify-center text-slate-500 hover:text-white transition-colors"
              title="Edit result">
              <Pencil className="w-3 h-3" />
            </button>
            <button onClick={() => setConfirmDel(true)}
              className="w-6 h-6 rounded-md hover:bg-rose-400/10 flex items-center justify-center text-slate-500 hover:text-rose-400 transition-colors"
              title="Delete result">
              <Trash2 className="w-3 h-3" />
            </button>
          </>
        )}
        {isMine && confirmDel && (
          <div className="flex items-center gap-1">
            <button onClick={() => setConfirmDel(false)}
              className="text-xs px-2 py-1 rounded-lg border border-surface-border text-slate-400 hover:text-white">
              No
            </button>
            <button onClick={handleDelete} disabled={deleteRecord.isPending}
              className="text-xs px-2 py-1 rounded-lg bg-rose-500 text-white font-semibold disabled:opacity-50">
              {deleteRecord.isPending ? "…" : "Yes"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// EntryRow
// ---------------------------------------------------------------------------
function EntryRow({ entry, myPlayers, oppPlayers, onChange, onSubmit, onRemove, submitting }) {
  const isWalkover = entry.result === "walkover"
  const canSubmit = entry.myPlayerId && entry.oppPlayerId && entry.result &&
    (isWalkover || (entry.playerScore !== "" && entry.oppScore !== ""))

  return (
    <div className="space-y-2 border border-surface-border rounded-xl p-3">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <select
          value={entry.myPlayerId}
          onChange={e => onChange("myPlayerId", e.target.value)}
          className="flex-1 min-w-0 bg-pitch-800 border border-surface-border rounded-lg px-2 py-2.5 text-sm text-white focus:outline-none focus:border-accent/40"
        >
          <option value="">— Your player —</option>
          {myPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <span className="text-slate-600 text-xs font-bold flex-shrink-0 text-center">vs</span>
        <select
          value={entry.oppPlayerId}
          onChange={e => onChange("oppPlayerId", e.target.value)}
          className="flex-1 min-w-0 bg-pitch-800 border border-surface-border rounded-lg px-2 py-2.5 text-sm text-white focus:outline-none focus:border-accent/40"
        >
          <option value="">— Opp player —</option>
          {oppPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <select
        value={entry.result}
        onChange={e => onChange("result", e.target.value)}
        className="w-full bg-pitch-800 border border-surface-border rounded-lg px-2 py-2.5 text-sm text-white focus:outline-none focus:border-accent/40"
      >
        <option value="">Result</option>
        <option value="win">Win</option>
        <option value="draw">Draw</option>
        <option value="loss">Loss</option>
        <option value="walkover">Walkover (I gave WO)</option>
        <option value="walkover_opp">Walkover (Opp gave WO)</option>
      </select>

      {!isWalkover ? (
        <div className="flex items-center gap-2">
          <input
            type="number" min="0" placeholder="My score"
            value={entry.playerScore}
            onChange={e => onChange("playerScore", e.target.value)}
            className="flex-1 min-w-0 text-center bg-pitch-800 border border-surface-border rounded-md py-2.5 text-sm text-white focus:outline-none focus:border-accent/40"
          />
          <span className="text-slate-600 text-xs flex-shrink-0">—</span>
          <input
            type="number" min="0" placeholder="Opp score"
            value={entry.oppScore}
            onChange={e => onChange("oppScore", e.target.value)}
            className="flex-1 min-w-0 text-center bg-pitch-800 border border-surface-border rounded-md py-2.5 text-sm text-white focus:outline-none focus:border-accent/40"
          />
        </div>
      ) : (
        <div className="text-center">
          <span className={entry.result === "walkover_opp"
            ? "text-xs text-emerald-400 bg-emerald-400/10 border border-emerald-400/25 px-3 py-1.5 rounded"
            : "text-xs text-orange-400 bg-orange-400/10 border border-orange-400/25 px-3 py-1.5 rounded"
          }>
            {entry.result === "walkover_opp" ? "3 – 0 (WO)" : "0 – 3 (WO)"}
          </span>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onSubmit}
          disabled={!canSubmit || submitting}
          className={cn(
            "flex-1 py-2 rounded-lg text-sm font-semibold transition-colors",
            canSubmit
              ? "bg-accent/15 text-accent border border-accent/25 hover:bg-accent/25"
              : "bg-pitch-800 text-slate-600 border border-surface-border cursor-not-allowed"
          )}
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Log result"}
        </button>
        <button
          onClick={onRemove}
          className="px-3 py-2 rounded-lg text-sm text-slate-600 hover:text-rose-400 border border-surface-border transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  )
}