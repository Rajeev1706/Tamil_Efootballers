import { useState } from "react"
import { ClipboardList, ChevronRight, X, Save, Trash2, History, Check, ChevronDown, Download } from "lucide-react"
import GradeBadge from "../common/GradeBadge"
import { useLineup, useSaveLineup, useClearLineup, useH2H } from "../../lib/queries"
import { cn } from "../../lib/utils"
import tecLogo from "../../../images/logo.png"

// ── H2H Popup ────────────────────────────────────────────────────────────────
function H2HPopup({ p1, p2, onClose }) {
  const { data: history = [], isLoading } = useH2H(p1?.id, p2?.id)

  const p1Wins   = history.filter(m => m.result === "win"  && m.p1Name === p1?.name).length
  const p2Wins   = history.filter(m => m.result === "win"  && m.p2Name === p1?.name).length
  const draws    = history.filter(m => m.result === "draw").length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-pitch-800 border border-surface-border rounded-2xl w-full max-w-md shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-semibold text-white">Head-to-head</span>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-surface flex items-center justify-center text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Players */}
        <div className="px-5 py-4 border-b border-surface-border">
          <div className="flex items-center justify-between gap-3">
            <div className="text-center flex-1">
              <p className="text-sm font-bold text-white">{p1?.name}</p>
              <GradeBadge grade={p1?.grade} size="sm" />
            </div>
            <span className="text-xs font-bold text-slate-500">VS</span>
            <div className="text-center flex-1">
              <p className="text-sm font-bold text-white">{p2?.name}</p>
              <GradeBadge grade={p2?.grade} size="sm" />
            </div>
          </div>

          {history.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="bg-emerald-400/10 border border-emerald-400/20 rounded-xl p-3 text-center">
                <p className="text-xl font-extrabold font-mono text-emerald-400">{p1Wins}</p>
                <p className="text-xs text-slate-500 mt-0.5">{p1?.name?.split(" ")[0]} wins</p>
              </div>
              <div className="bg-amber-400/10 border border-amber-400/20 rounded-xl p-3 text-center">
                <p className="text-xl font-extrabold font-mono text-amber-400">{draws}</p>
                <p className="text-xs text-slate-500 mt-0.5">Draws</p>
              </div>
              <div className="bg-emerald-400/10 border border-emerald-400/20 rounded-xl p-3 text-center">
                <p className="text-xl font-extrabold font-mono text-emerald-400">{p2Wins}</p>
                <p className="text-xs text-slate-500 mt-0.5">{p2?.name?.split(" ")[0]} wins</p>
              </div>
            </div>
          )}
        </div>

        {/* History list */}
        <div className="max-h-64 overflow-y-auto">
          {isLoading ? (
            <p className="text-center text-slate-500 text-sm py-8">Loading…</p>
          ) : history.length === 0 ? (
            <p className="text-center text-slate-500 text-sm py-8">No matches between these players yet.</p>
          ) : (
            <div className="divide-y divide-surface-border/50">
              {history.map(m => {
                const isP1    = m.p1Name === p1?.name
                const result  = isP1 ? m.result : m.result === "win" ? "loss" : m.result === "loss" ? "win" : "draw"
                const resColor = result === "win" ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/25"
                               : result === "loss" ? "text-rose-400 bg-rose-400/10 border-rose-400/25"
                               : "text-amber-400 bg-amber-400/10 border-amber-400/25"
                return (
                  <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="text-xs text-slate-600 w-16 flex-shrink-0">
                      {m.date ? new Date(m.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}
                    </span>
                    <span className="text-xs text-slate-400 flex-1">
                      {m.p1Name} vs {m.p2Name}
                    </span>
                    {m.playerScore != null && (
                      <span className="text-xs font-mono font-bold text-white">{m.playerScore}-{m.opponentScore}</span>
                    )}
                    <span className={cn("text-xs font-bold px-2 py-0.5 rounded border flex-shrink-0", resColor)}>
                      {result.toUpperCase()}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-surface-border">
          <button onClick={onClose} className="w-full text-sm text-slate-400 hover:text-white transition-colors py-1">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Matchup Row ───────────────────────────────────────────────────────────────
function MatchupRow({ slot, myPlayers, oppPlayers, matchup, onChange, onViewH2H }) {
  const myP  = myPlayers.find(p => p.id === matchup?.myPlayerId)  || null
  const oppP = oppPlayers.find(p => p.id === matchup?.oppPlayerId) || null

  return (
    <div className="grid grid-cols-[1fr_32px_1fr_80px] gap-3 items-center px-5 py-3 border-b border-surface-border/50 last:border-b-0">
      {/* My player select */}
      <select
        value={matchup?.myPlayerId || ""}
        onChange={e => onChange(slot, "myPlayerId", e.target.value ? parseInt(e.target.value) : null)}
        className="bg-pitch-900 border border-surface-border rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/40 transition-colors w-full"
      >
        <option value="">— Pick player —</option>
        {myPlayers.map(p => (
          <option key={p.id} value={p.id}>{p.name} ({p.grade})</option>
        ))}
      </select>

      {/* VS */}
      <span className="text-xs font-bold text-slate-600 text-center">VS</span>

      {/* Opp player select */}
      <select
        value={matchup?.oppPlayerId || ""}
        onChange={e => onChange(slot, "oppPlayerId", e.target.value ? parseInt(e.target.value) : null)}
        className="bg-pitch-900 border border-surface-border rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/40 transition-colors w-full"
      >
        <option value="">— Pick player —</option>
        {oppPlayers.map(p => (
          <option key={p.id} value={p.id}>{p.name} ({p.grade})</option>
        ))}
      </select>

      {/* H2H button */}
      <button
        onClick={() => myP && oppP && onViewH2H(myP, oppP)}
        disabled={!myP || !oppP}
        className={cn(
          "flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-xl border transition-all",
          myP && oppP
            ? "text-violet-400 bg-violet-400/10 border-violet-400/25 hover:bg-violet-400/20"
            : "text-slate-600 bg-surface-border border-surface-border cursor-not-allowed"
        )}
        title="View head-to-head history"
      >
        <History className="w-3 h-3" /> H2H
      </button>
    </div>
  )
}

// ── Fixture Card ──────────────────────────────────────────────────────────────
function FixtureCard({ fixture, myTeamName, myPlayers, allPlayers, teamLogoUrl, onExpand, isExpanded }) {
  const isHome    = fixture.home === myTeamName
  const opponent  = isHome ? fixture.away : fixture.home
  const oppTeamId = isHome ? fixture.awayTeamId : fixture.homeTeamId
  const oppPlayers = allPlayers.filter(p => p.teamId === oppTeamId)

  const { data: savedLineup = [] } = useLineup(fixture.id)
  const saveLineup  = useSaveLineup()
  const clearLineup = useClearLineup()

  // Local matchup state: array of { slot, myPlayerId, oppPlayerId }
  const [matchups, setMatchups] = useState(() => {
    const base = myPlayers.map((_, i) => ({ slot: i + 1, myPlayerId: null, oppPlayerId: null }))
    return base
  })
  const [initialized, setInitialized] = useState(false)
  const [h2hTarget, setH2hTarget]     = useState(null) // { p1, p2 }
  const [saved, setSaved]             = useState(false)

  // Load saved lineup into local state when expanded
  const handleExpand = () => {
    if (!isExpanded) {
      if (savedLineup.length > 0 && !initialized) {
        setMatchups(savedLineup.map(m => ({
          slot:        m.slot,
          myPlayerId:  m.myPlayerId,
          oppPlayerId: m.oppPlayerId,
        })))
        setInitialized(true)
      } else if (!initialized) {
        setMatchups(myPlayers.map((_, i) => ({ slot: i + 1, myPlayerId: null, oppPlayerId: null })))
        setInitialized(true)
      }
    }
    onExpand()
  }

  const handleChange = (slot, field, value) => {
    setMatchups(prev => prev.map(m => m.slot === slot ? { ...m, [field]: value } : m))
  }

  const addSlot = () => {
    const nextSlot = matchups.length + 1
    setMatchups(prev => [...prev, { slot: nextSlot, myPlayerId: null, oppPlayerId: null }])
  }

  const removeSlot = (slot) => {
    setMatchups(prev => prev.filter(m => m.slot !== slot).map((m, i) => ({ ...m, slot: i + 1 })))
  }

  const handleSave = () => {
    const valid = matchups.filter(m => m.myPlayerId && m.oppPlayerId)
    if (valid.length === 0) return alert("Add at least one matchup before saving.")
    saveLineup.mutate({ fixtureId: fixture.id, matchups: valid }, {
      onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2000) },
      onError: (err) => alert(err.response?.data?.error || "Save failed"),
    })
  }

  const handleClear = () => {
    if (!confirm("Clear the saved lineup for this fixture?")) return
    clearLineup.mutate(fixture.id, {
      onSuccess: () => {
        setMatchups(myPlayers.map((_, i) => ({ slot: i + 1, myPlayerId: null, oppPlayerId: null })))
        setInitialized(false)
      },
    })
  }

  function handleExport() {
    const filledMatchups = matchups.filter(m => m.myPlayerId && m.oppPlayerId)
    if (filledMatchups.length === 0) return alert("Add at least one matchup to export.")

    const myTeam  = myTeamName
    const oppTeam = opponent
    const padding = 40
    const rowH    = 44
    const headerH = 110
    const footerH = 44
    const width   = 700
    const height  = headerH + filledMatchups.length * rowH + footerH + padding

    const canvas  = document.createElement("canvas")
    canvas.width  = width * 2
    canvas.height = height * 2
    const ctx     = canvas.getContext("2d")
    ctx.scale(2, 2)

    function drawContent() {
      // Dark overlay for readability
      ctx.fillStyle = "rgba(5, 10, 18, 0.78)"
      ctx.fillRect(0, 0, width, height)

      // Green top bar
      ctx.fillStyle = "#00c896"
      ctx.fillRect(0, 0, width, 5)

      // Title
      ctx.fillStyle = "#ffffff"
      ctx.font      = "bold 22px system-ui, sans-serif"
      ctx.textAlign = "center"
      ctx.fillText("FIXTURE LINEUP", width / 2, 40)

      // Round + date
      ctx.fillStyle = "#94a3b8"
      ctx.font      = "13px system-ui, sans-serif"
      ctx.fillText(`Round ${fixture.round}  ·  ${fixture.date?.slice(0, 10) ?? ""}`, width / 2, 62)

      // Team names
      ctx.fillStyle = "#00c896"
      ctx.font      = "bold 17px system-ui, sans-serif"
      ctx.textAlign = "left"
      ctx.fillText(myTeam.toUpperCase(), padding, 92)
      ctx.textAlign = "right"
      ctx.fillText(oppTeam.toUpperCase(), width - padding, 92)
      ctx.fillStyle = "#475569"
      ctx.font      = "bold 13px system-ui, sans-serif"
      ctx.textAlign = "center"
      ctx.fillText("vs", width / 2, 92)

      // Divider
      ctx.strokeStyle = "rgba(255,255,255,0.12)"
      ctx.lineWidth   = 1
      ctx.beginPath()
      ctx.moveTo(padding, headerH - 6)
      ctx.lineTo(width - padding, headerH - 6)
      ctx.stroke()

      // Matchup rows
      filledMatchups.forEach((m, i) => {
        const myP  = myPlayers.find(p => p.id === m.myPlayerId)
        const oppP = (allPlayers || []).find(p => p.id === m.oppPlayerId)
        const y    = headerH + i * rowH
        const midY = y + rowH / 2 + 5

        if (i % 2 === 0) {
          ctx.fillStyle = "rgba(255,255,255,0.04)"
          ctx.fillRect(0, y, width, rowH)
        }

        ctx.fillStyle = "#e2e8f0"
        ctx.font      = "14px system-ui, sans-serif"
        ctx.textAlign = "left"
        ctx.fillText(myP?.name ?? "—", padding, midY)

        ctx.fillStyle = "#334155"
        ctx.font      = "12px system-ui, sans-serif"
        ctx.textAlign = "center"
        ctx.fillText("vs", width / 2, midY)

        ctx.fillStyle = "#e2e8f0"
        ctx.font      = "14px system-ui, sans-serif"
        ctx.textAlign = "right"
        ctx.fillText(oppP?.name ?? "—", width - padding, midY)
      })

      // Footer
      ctx.fillStyle = "rgba(0,0,0,0.4)"
      ctx.fillRect(0, height - footerH, width, footerH)
      ctx.fillStyle = "#475569"
      ctx.font      = "11px system-ui, sans-serif"
      ctx.textAlign = "center"
      ctx.fillText("tamil-efootballers.vercel.app", width / 2, height - footerH + 26)
    }

    function drawWithLogo() {
      drawContent()
      const logo   = new Image()
      logo.onload  = () => {
        const logoSize = 70
        ctx.drawImage(logo, padding - 15, 8, logoSize, logoSize)
        triggerDownload()
      }
      logo.onerror = () => triggerDownload()
      logo.src = tecLogo
    }

    function triggerDownload() {
      const link    = document.createElement("a")
      link.download = `lineup-${myTeam}-vs-${oppTeam}-R${fixture.round}.png`
      link.href     = canvas.toDataURL("image/png")
      link.click()
    }

    if (teamLogoUrl) {
      const img    = new Image()
      img.crossOrigin = "anonymous"
      img.onload  = () => {
        ctx.drawImage(img, 0, 0, width, height)
        drawWithLogo()
      }
      img.onerror = () => {
        ctx.fillStyle = "#0d1117"
        ctx.fillRect(0, 0, width, height)
        drawWithLogo()
      }
      img.src = teamLogoUrl
    } else {
      ctx.fillStyle = "#0d1117"
      ctx.fillRect(0, 0, width, height)
      drawWithLogo()
    }
  }

  const formattedDate = fixture.date
    ? new Date(fixture.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "TBD"

  return (
    <div className="card overflow-hidden">
      {/* Fixture header — click to expand */}
      <button
        onClick={handleExpand}
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-surface-hover transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={cn(
              "text-xs font-semibold px-1.5 py-0.5 rounded",
              isHome ? "bg-accent/15 text-accent" : "bg-slate-700/60 text-slate-400"
            )}>
              {isHome ? "H" : "A"}
            </span>
            <span className="text-sm font-bold text-white">vs {opponent}</span>
            {savedLineup.length > 0 && (
              <span className="text-xs font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full">
                ✓ Lineup saved
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">Round {fixture.round} · {formattedDate}</p>
        </div>
        <ChevronDown className={cn("w-4 h-4 text-slate-500 transition-transform flex-shrink-0", isExpanded && "rotate-180")} />
      </button>

      {/* Expanded lineup builder */}
      {isExpanded && (
        <div className="border-t border-surface-border">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_32px_1fr_80px] gap-3 px-5 py-2.5 bg-pitch-900/50">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Your player</span>
            <span />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {opponent} player
            </span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">History</span>
          </div>

          {/* Matchup rows */}
          {matchups.map((m, idx) => {
            // Exclude players already selected in OTHER rows from each dropdown
            const usedMyIds  = matchups.filter((x, i) => i !== idx && x.myPlayerId).map(x => x.myPlayerId)
            const usedOppIds = matchups.filter((x, i) => i !== idx && x.oppPlayerId).map(x => x.oppPlayerId)
            const availableMyPlayers  = myPlayers.filter(p => !usedMyIds.includes(p.id))
            const availableOppPlayers = oppPlayers.filter(p => !usedOppIds.includes(p.id))
            return (
            <div key={m.slot} className="relative group">
              <MatchupRow
                slot={m.slot}
                myPlayers={availableMyPlayers}
                oppPlayers={availableOppPlayers}
                matchup={m}
                onChange={handleChange}
                onViewH2H={(p1, p2) => setH2hTarget({ p1, p2 })}
              />
              {matchups.length > 1 && (
                <button
                  onClick={() => removeSlot(m.slot)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 rounded flex items-center justify-center text-slate-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            )
          })}

          {/* Add matchup + actions */}
          <div className="px-5 py-4 flex items-center justify-between gap-3 bg-pitch-900/30 border-t border-surface-border/50">
            <button
              onClick={addSlot}
              className="text-xs text-accent hover:text-white border border-accent/30 hover:border-accent/60 bg-accent/5 hover:bg-accent/10 px-3 py-1.5 rounded-lg transition-all"
            >
              + Add matchup
            </button>

            <div className="flex items-center gap-2">
              {savedLineup.length > 0 && (
                <>
                  <button
                    onClick={handleExport}
                    className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-white bg-violet-400/10 hover:bg-violet-400/20 border border-violet-400/25 px-3 py-1.5 rounded-lg transition-all"
                  >
                    <Download className="w-3 h-3" /> Export
                  </button>
                  <button
                    onClick={handleClear}
                    disabled={clearLineup.isPending}
                    className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-white bg-rose-400/10 hover:bg-rose-400/20 border border-rose-400/25 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                  >
                    <Trash2 className="w-3 h-3" /> Clear
                  </button>
                </>
              )}
              <button
                onClick={handleSave}
                disabled={saveLineup.isPending}
                className="flex items-center gap-1.5 text-xs font-semibold text-white bg-accent hover:bg-accent-dim px-4 py-1.5 rounded-lg transition-all disabled:opacity-50"
              >
                {saved
                  ? <><Check className="w-3 h-3" /> Saved!</>
                  : <><Save className="w-3 h-3" /> {saveLineup.isPending ? "Saving…" : "Save lineup"}</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* H2H popup */}
      {h2hTarget && (
        <H2HPopup
          p1={h2hTarget.p1}
          p2={h2hTarget.p2}
          onClose={() => setH2hTarget(null)}
        />
      )}
    </div>
  )
}

// ── Main FixtureMaker ─────────────────────────────────────────────────────────
export default function FixtureMaker({ fixtures, myTeamName, myPlayers, allPlayers, teamLogoUrl }) {
  const upcoming = fixtures.filter(
    f => f.status === "upcoming" && f.home === myTeamName
  )
  const [expandedId, setExpandedId] = useState(null)

  if (upcoming.length === 0) {
    return (
      <div className="card px-5 py-16 text-center">
        <ClipboardList className="w-8 h-8 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400 text-sm font-medium">No upcoming fixtures</p>
        <p className="text-slate-600 text-xs mt-1">Upcoming fixtures will appear here once scheduled by the admin.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <ClipboardList className="w-4 h-4 text-accent" />
        <h2 className="text-sm font-semibold text-white">Fixture maker</h2>
        <span className="text-xs text-slate-500 ml-1">— Plan your player matchups for upcoming fixtures</span>
      </div>

      {upcoming.map(fixture => (
        <FixtureCard
          key={fixture.id}
          fixture={fixture}
          myTeamName={myTeamName}
          myPlayers={myPlayers}
          allPlayers={allPlayers}
          teamLogoUrl={teamLogoUrl}
          isExpanded={expandedId === fixture.id}
          onExpand={() => setExpandedId(id => id === fixture.id ? null : fixture.id)}
        />
      ))}
    </div>
  )
}