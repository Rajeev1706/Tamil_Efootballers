import { useState, useRef } from "react"
import { Trophy, Pencil, Trash2, Download } from "lucide-react"
import { cn } from "../../lib/utils"
import { useUclFixtures } from "../../lib/queries"
import { uclApi } from "../../lib/api"
import { useQueryClient } from "@tanstack/react-query"
import { toPng } from "html-to-image"
import logoUrl from "../../../images/logo.png"

function FixtureCard({ fix, onChanged }) {
  const qc = useQueryClient()
  const [score1, setScore1]       = useState(fix.player1Score ?? "")
  const [score2, setScore2]       = useState(fix.player2Score ?? "")
  const [editing, setEditing]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  const isCompleted = fix.status === "completed"
  const s1 = Number(score1), s2 = Number(score2)
  const preview = score1 !== "" && score2 !== ""
    ? s1 > s2 ? `${fix.player1Name} wins` : s1 < s2 ? `${fix.player2Name} wins` : "Draw"
    : null

  function openEdit() {
    setScore1(fix.player1Score ?? "")
    setScore2(fix.player2Score ?? "")
    setEditing(true)
  }

  async function handleSave() {
    if (score1 === "" || score2 === "") return
    setSaving(true)
    try {
      await uclApi.saveFixture(fix.id, Number(score1), Number(score2))
      qc.invalidateQueries({ queryKey: ["ucl-fixtures"] })
      qc.invalidateQueries({ queryKey: ["ucl-standings"] })
      setEditing(false)
      onChanged?.()
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to save")
    } finally { setSaving(false) }
  }

  async function handleClear() {
    try {
      await uclApi.clearFixture(fix.id)
      qc.invalidateQueries({ queryKey: ["ucl-fixtures"] })
      qc.invalidateQueries({ queryKey: ["ucl-standings"] })
      setConfirmDel(false)
      onChanged?.()
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to clear")
    }
  }

  const resultChip = isCompleted
    ? fix.player1Score > fix.player2Score
      ? { label: "HOME WIN", color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/25" }
      : fix.player1Score < fix.player2Score
        ? { label: "AWAY WIN", color: "text-rose-400 bg-rose-400/10 border-rose-400/25" }
        : { label: "DRAW",     color: "text-amber-400 bg-amber-400/10 border-amber-400/25" }
    : null

  if (confirmDel) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-rose-500/5 border border-rose-400/20 rounded-xl">
        <p className="text-sm text-rose-400 flex-1">Clear result for {fix.player1Name} vs {fix.player2Name}?</p>
        <button onClick={() => setConfirmDel(false)} className="text-xs px-3 py-1.5 border border-surface-border rounded-lg text-slate-400">Cancel</button>
        <button onClick={handleClear} className="text-xs px-3 py-1.5 bg-rose-500 text-white rounded-lg font-semibold">Clear</button>
      </div>
    )
  }

  if (editing) {
    return (
      <div className="px-4 py-3 bg-pitch-800 border border-accent/20 rounded-xl space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-white flex-1 truncate font-medium">{fix.player1Name}</span>
          <input type="number" min="0" placeholder="0" value={score1}
            onChange={e => setScore1(e.target.value)}
            className="w-12 text-center bg-pitch-900 border border-surface-border rounded-lg py-1.5 text-sm text-white font-mono focus:outline-none focus:border-accent/40" />
          <span className="text-slate-600 text-xs">–</span>
          <input type="number" min="0" placeholder="0" value={score2}
            onChange={e => setScore2(e.target.value)}
            className="w-12 text-center bg-pitch-900 border border-surface-border rounded-lg py-1.5 text-sm text-white font-mono focus:outline-none focus:border-accent/40" />
          <span className="text-sm text-white flex-1 text-right truncate font-medium">{fix.player2Name}</span>
        </div>
        {preview && (
          <p className={cn("text-xs text-center font-semibold",
            s1 > s2 ? "text-emerald-400" : s1 < s2 ? "text-rose-400" : "text-amber-400"
          )}>{preview}</p>
        )}
        <div className="flex gap-2">
          <button onClick={() => setEditing(false)} className="flex-1 text-xs py-1.5 rounded-lg border border-surface-border text-slate-400">Cancel</button>
          <button onClick={handleSave} disabled={score1 === "" || score2 === "" || saving}
            className="flex-1 text-xs py-1.5 rounded-lg bg-accent/20 text-accent border border-accent/30 font-semibold disabled:opacity-40">
            {saving ? "Saving…" : "Save result"}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(
      "flex items-center gap-3 px-4 py-3 rounded-xl border group transition-colors",
      isCompleted ? "bg-pitch-800/50 border-surface-border/40 hover:border-surface-border" : "bg-pitch-800/30 border-surface-border hover:border-accent/20"
    )}>
      <span className={cn("text-sm flex-1 truncate font-medium",
        isCompleted && fix.player1Score > fix.player2Score ? "text-emerald-400 font-bold" : "text-white"
      )}>{fix.player1Name}</span>

      {isCompleted ? (
        <span className="text-sm font-bold font-mono text-slate-300 flex-shrink-0">{fix.player1Score} – {fix.player2Score}</span>
      ) : (
        <button onClick={openEdit}
          className="text-xs px-3 py-1 rounded-lg border border-accent/30 text-accent hover:bg-accent/10 transition-colors flex-shrink-0">
          + Score
        </button>
      )}

      <span className={cn("text-sm flex-1 text-right truncate font-medium",
        isCompleted && fix.player2Score > fix.player1Score ? "text-emerald-400 font-bold" : "text-white"
      )}>{fix.player2Name}</span>

      {isCompleted && resultChip && (
        <span className={cn("text-xs font-bold px-2 py-0.5 rounded-lg border flex-shrink-0", resultChip.color)}>
          {resultChip.label}
        </span>
      )}

      {isCompleted && (
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button onClick={openEdit} className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-accent">
            <Pencil className="w-3 h-3" />
          </button>
          <button onClick={() => setConfirmDel(true)} className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-rose-400">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  )
}

function GroupSection({ groupName, fixtures, onChanged }) {
  const completed = fixtures.filter(f => f.status === "completed").length
  const total     = fixtures.length
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <p className="text-xs font-bold text-accent uppercase tracking-wide">{groupName}</p>
        <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold",
          completed === total && total > 0 ? "bg-emerald-400/10 text-emerald-400"
          : completed > 0 ? "bg-amber-400/10 text-amber-400"
          : "bg-slate-700 text-slate-500"
        )}>{completed}/{total}</span>
      </div>
      <div className="space-y-1.5">
        {fixtures.map(f => <FixtureCard key={f.id} fix={f} onChanged={onChanged} />)}
      </div>
    </div>
  )
}

// Hidden export card — rendered off-screen, captured as image
function RoundExportCard({ round, byGroup, exportRef, visible }) {
  const groupCount = Object.keys(byGroup).length
  // 2 rows for 8 groups (4 cols), 1 row for fewer
  const cols = Math.min(4, groupCount)

  return (
    <div
      ref={exportRef}
      style={{
        position: "fixed",
        left: visible ? 0 : "-9999px",
        top: visible ? 0 : 0,
        width: 960,
        background: "#050810",
        padding: 32,
        fontFamily: "system-ui, sans-serif",
        overflow: "visible",
        zIndex: visible ? 9999 : -1,
        opacity: visible ? 1 : 0,
        pointerEvents: "none",
      }}
    >
      {/* Background logo watermark */}
      <img
        src={logoUrl}
        alt=""
        style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: 320, height: 320, objectFit: "contain",
          opacity: 0.04, pointerEvents: "none", userSelect: "none",
        }}
      />
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, position: "relative" }}>
        <img src={logoUrl} alt="TEC" style={{ width: 44, height: 44, objectFit: "contain" }} />
        <div>
          <p style={{ color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: 2, margin: 0 }}>Tamil Efootballers · UCL Group Stage</p>
          <p style={{ color: "#ffffff", fontSize: 20, fontWeight: 800, margin: 0 }}>Round {round} Fixtures</p>
        </div>
      </div>

      {/* Groups grid — 4 cols, wraps to 2 rows for 8 groups */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 16 }}>
        {Object.entries(byGroup).sort(([a], [b]) => a.localeCompare(b)).map(([groupName, groupFixtures]) => (
          <div key={groupName} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 16 }}>
            <p style={{ color: "#10b981", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12, margin: "0 0 12px 0" }}>{groupName}</p>
            {groupFixtures.map(f => (
              <div key={f.id} style={{ marginBottom: 8, padding: "8px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <p style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 600, margin: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.player1Name}</p>
                  <span style={{ color: "#475569", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                    {f.status === "completed" ? `${f.player1Score} – ${f.player2Score}` : "vs"}
                  </span>
                  <p style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 600, margin: 0, flex: 1, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.player2Name}</p>
                </div>
                {f.status === "completed" && (
                  <p style={{
                    margin: "4px 0 0 0", fontSize: 10, fontWeight: 700, textAlign: "center",
                    color: f.player1Score > f.player2Score ? "#10b981" : f.player1Score < f.player2Score ? "#f87171" : "#f59e0b"
                  }}>
                    {f.player1Score > f.player2Score ? `${f.player1Name} wins` : f.player1Score < f.player2Score ? `${f.player2Name} wins` : "Draw"}
                  </p>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      <p style={{ color: "#1e293b", fontSize: 10, textAlign: "right", marginTop: 16, margin: "16px 0 0 0" }}>
        tamil-efootballers.vercel.app
      </p>
    </div>
  )
}

export default function UclResults() {
  const { data: fixtures = [], isLoading, refetch } = useUclFixtures()
  const [activeRound, setActiveRound] = useState("all")
  const [exporting, setExporting]     = useState(false)
  const exportRef = useRef(null)

  const maxRound = fixtures.length > 0 ? Math.max(...fixtures.map(f => f.roundNumber)) : 0
  const rounds   = Array.from({ length: maxRound }, (_, i) => i + 1)

  const filtered = activeRound === "all"
    ? fixtures
    : fixtures.filter(f => f.roundNumber === Number(activeRound))

  // Group fixtures by group name
  const byGroup = {}
  for (const f of filtered) {
    if (!byGroup[f.groupName]) byGroup[f.groupName] = []
    byGroup[f.groupName].push(f)
  }

  const [showExportCard, setShowExportCard] = useState(false)

  async function handleExport() {
    if (!exportRef.current || activeRound === "all") return
    setShowExportCard(true)
    setExporting(true)
    // Wait for DOM to fully render
    await new Promise(r => setTimeout(r, 500))
    try {
      const el = exportRef.current
      const dataUrl = await toPng(el, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#050810",
        width: el.scrollWidth,
        height: el.scrollHeight,
      })
      const link = document.createElement("a")
      link.download = `UCL-Round-${activeRound}-Fixtures.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      alert("Export failed: " + err.message)
    } finally {
      setExporting(false)
      setShowExportCard(false)
    }
  }

  if (isLoading) return <p className="text-sm text-slate-500 text-center py-8">Loading…</p>

  if (fixtures.length === 0) {
    return (
      <div className="card px-6 py-12 text-center">
        <Trophy className="w-8 h-8 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400 font-medium">No UCL fixtures generated yet</p>
        <p className="text-sm text-slate-600 mt-1">Complete the group draw first — fixtures are auto-generated on Done</p>
      </div>
    )
  }

  const totalCompleted = fixtures.filter(f => f.status === "completed").length
  const roundFixtures  = activeRound !== "all"
    ? fixtures.filter(f => f.roundNumber === Number(activeRound))
    : []
  const roundByGroup   = {}
  for (const f of roundFixtures) {
    if (!roundByGroup[f.groupName]) roundByGroup[f.groupName] = []
    roundByGroup[f.groupName].push(f)
  }

  return (
    <div className="space-y-5">
      {/* Export card — visible only during export capture */}
      {activeRound !== "all" && (
        <RoundExportCard
          round={activeRound}
          byGroup={roundByGroup}
          exportRef={exportRef}
          visible={showExportCard}
        />
      )}

      {/* Summary + round tabs + export */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-slate-400">{totalCompleted}/{fixtures.length} fixtures logged</p>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-pitch-800 border border-surface-border rounded-xl p-1 overflow-x-auto">
            <button onClick={() => setActiveRound("all")}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors",
                activeRound === "all" ? "bg-surface text-white border border-surface-border" : "text-slate-500 hover:text-white"
              )}>All</button>
            {rounds.map(r => (
              <button key={r} onClick={() => setActiveRound(r)}
                className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors",
                  activeRound === r ? "bg-surface text-white border border-surface-border" : "text-slate-500 hover:text-white"
                )}>Round {r}</button>
            ))}
          </div>
          {activeRound !== "all" && (
            <button onClick={handleExport} disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent/15 text-accent border border-accent/25 text-xs font-semibold hover:bg-accent/25 transition-colors disabled:opacity-50">
              <Download className="w-3.5 h-3.5" />
              {exporting ? "Exporting…" : "Export PNG"}
            </button>
          )}
        </div>
      </div>

      {/* Fixtures by group */}
      <div className="space-y-6">
        {Object.entries(byGroup).sort(([a], [b]) => a.localeCompare(b)).map(([groupName, groupFixtures]) => (
          <GroupSection key={groupName} groupName={groupName} fixtures={groupFixtures} onChanged={refetch} />
        ))}
      </div>
    </div>
  )
}