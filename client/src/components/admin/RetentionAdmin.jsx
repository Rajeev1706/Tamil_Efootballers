import { useState, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { Download, Plus, X, ChevronDown } from "lucide-react"
import api, { teamsApi } from "../../lib/api"
import { cn } from "../../lib/utils"
import tefLogo from "../../../images/logo.png"

// ── helpers ───────────────────────────────────────────────────────────────────
const GRADE_COLORS = { S: "#f59e0b", "A+": "#a78bfa", A: "#60a5fa", B: "#34d399", C: "#94a3b8" }

function usePlayers(teamId) {
  return useQuery({
    queryKey: ["players-team", teamId],
    queryFn: async () => {
      const res = await api.get(`/players?teamId=${teamId}`)
      return res.data || []
    },
    enabled: !!teamId,
  })
}

function useAllPlayers() {
  return useQuery({
    queryKey: ["players-all"],
    queryFn: async () => {
      const res = await api.get("/players")
      return (res.data || []).sort((a, b) => a.name.localeCompare(b.name))
    },
  })
}

// ── TeamCard (per-team configuration) ────────────────────────────────────────
function TeamCard({ team, config, onChange, allTeams }) {
  const { data: players = [] }    = usePlayers(team.id)
  const { data: allPlayers = [] } = useAllPlayers()
  const [playerDropdown, setPlayerDropdown] = useState(false)
  const [captainDropdown, setCaptainDropdown] = useState(false)
  const [captainSearch, setCaptainSearch] = useState("")

  const purse       = config.purse ?? ""
  const captain     = config.captain ?? null   // { id, name, grade }
  const retentions  = config.retentions ?? []  // [{ player, priceType }]

  const totalSpent    = retentions.reduce((s, r) => {
    const price = r.priceType === "base" ? (r.player.baseValue ?? 0) : (r.player.auctionPrice ?? 0)
    return s + price
  }, 0)
  const remaining = purse !== "" ? Math.max(0, Number(purse) - totalSpent) : null

  function addRetention(player) {
    if (retentions.find(r => r.player.id === player.id)) return
    onChange({ retentions: [...retentions, { player, priceType: "auction" }] })
    setPlayerDropdown(false)
  }

  function removeRetention(playerId) {
    onChange({ retentions: retentions.filter(r => r.player.id !== playerId) })
  }

  function togglePriceType(playerId) {
    onChange({
      retentions: retentions.map(r =>
        r.player.id === playerId
          ? { ...r, priceType: r.priceType === "auction" ? "base" : "auction" }
          : r
      )
    })
  }

  const availablePlayers = players.filter(p => !retentions.find(r => r.player.id === p.id))

  return (
    <div className="card p-4 space-y-3">
      {/* Team header */}
      <div className="flex items-center gap-3">
        {team.logoUrl
          ? <img src={team.logoUrl} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
          : <div className="w-9 h-9 rounded-full bg-pitch-700 flex-shrink-0" />
        }
        <p className="font-bold text-white text-sm">{team.name}</p>
      </div>

      {/* Purse */}
      <div>
        <label className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Purse (₹)</label>
        <input
          type="number" min="0" value={purse}
          onChange={e => onChange({ purse: e.target.value })}
          placeholder="e.g. 1000"
          className="mt-1 w-full bg-pitch-800 border border-surface-border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent"
        />
        {remaining !== null && (
          <p className="text-xs mt-1">
            <span className="text-slate-500">Spent: </span>
            <span className="text-orange-400 font-semibold">₹{totalSpent}</span>
            <span className="text-slate-500 mx-1">·</span>
            <span className="text-slate-500">Remaining: </span>
            <span className={cn("font-semibold", remaining === 0 ? "text-rose-400" : "text-emerald-400")}>₹{remaining}</span>
          </p>
        )}
      </div>

      {/* Captain */}
      <div>
        <label className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Captain</label>
        <div className="relative mt-1">
          <button
            onClick={() => setCaptainDropdown(v => !v)}
            className="w-full flex items-center justify-between gap-2 bg-pitch-800 border border-surface-border rounded-lg px-3 py-2 text-sm text-left hover:border-accent/50 transition-colors">
            {captain
              ? <span className="text-amber-400 font-semibold">{captain.name}</span>
              : <span className="text-slate-500">Select captain…</span>
            }
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
          </button>
          {captainDropdown && (
            <div className="absolute z-20 mt-1 w-full bg-pitch-800 border border-surface-border rounded-xl shadow-xl">
              <div className="p-2 border-b border-surface-border">
                <input
                  autoFocus
                  type="text"
                  placeholder="Search player…"
                  value={captainSearch}
                  onChange={e => setCaptainSearch(e.target.value)}
                  className="w-full bg-pitch-900 border border-surface-border rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent"
                />
              </div>
              <div className="max-h-48 overflow-y-auto">
                <button
                  onClick={() => { onChange({ captain: null }); setCaptainDropdown(false); setCaptainSearch("") }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-500 hover:text-white hover:bg-white/5 transition-colors">
                  — None —
                </button>
                {allPlayers
                  .filter(p => !captainSearch || p.name.toLowerCase().includes(captainSearch.toLowerCase()))
                  .map(p => (
                    <button key={p.id}
                      onClick={() => { onChange({ captain: p }); setCaptainDropdown(false); setCaptainSearch("") }}
                      className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-white/5 transition-colors">
                      <span style={{ color: GRADE_COLORS[p.grade] }} className="text-xs font-bold w-5">{p.grade}</span>
                      <span className="text-white">{p.name}</span>
                      {p.teamName && <span className="text-slate-600 text-xs ml-auto truncate">{p.teamName}</span>}
                    </button>
                  ))
                }
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Retained players */}
      <div>
        <label className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Retained Players</label>
        <div className="mt-1 space-y-1.5">
          {retentions.map(r => {
            const price = r.priceType === "base" ? (r.player.baseValue ?? 0) : (r.player.auctionPrice ?? 0)
            return (
              <div key={r.player.id} className="flex items-center gap-2 bg-pitch-800 border border-surface-border rounded-lg px-2.5 py-1.5">
                <span style={{ color: GRADE_COLORS[r.player.grade] }} className="text-xs font-bold w-5 flex-shrink-0">{r.player.grade}</span>
                <span className="text-sm text-white flex-1 truncate">{r.player.name}</span>
                <button
                  onClick={() => togglePriceType(r.player.id)}
                  className={cn("text-xs font-semibold px-2 py-0.5 rounded border transition-colors flex-shrink-0",
                    r.priceType === "auction"
                      ? "text-orange-400 border-orange-400/30 bg-orange-400/10"
                      : "text-cyan-400 border-cyan-400/30 bg-cyan-400/10"
                  )}>
                  {r.priceType === "auction" ? `₹${price} A` : `₹${price} B`}
                </button>
                <button onClick={() => removeRetention(r.player.id)} className="text-slate-600 hover:text-rose-400 transition-colors flex-shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}
          {/* Add player dropdown */}
          <div className="relative">
            <button
              onClick={() => setPlayerDropdown(v => !v)}
              disabled={availablePlayers.length === 0}
              className="flex items-center gap-1.5 text-xs text-accent border border-accent/25 rounded-lg px-2.5 py-1.5 hover:bg-accent/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
              <Plus className="w-3 h-3" />
              Add player
            </button>
            {playerDropdown && (
              <div className="absolute z-20 mt-1 w-56 bg-pitch-800 border border-surface-border rounded-xl shadow-xl max-h-48 overflow-y-auto">
                {availablePlayers.map(p => (
                  <button key={p.id}
                    onClick={() => addRetention(p)}
                    className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-white/5 transition-colors">
                    <span style={{ color: GRADE_COLORS[p.grade] }} className="text-xs font-bold w-5">{p.grade}</span>
                    <span className="text-white">{p.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Canvas image export ───────────────────────────────────────────────────────
async function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload  = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ")
  let line = ""
  let cy = y
  for (const word of words) {
    const test = line ? line + " " + word : word
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cy)
      line = word
      cy += lineHeight
    } else {
      line = test
    }
  }
  if (line) ctx.fillText(line, x, cy)
  return cy
}

async function generateRetentionImage(teams, configs) {
  const COLS     = 4
  const ROWS     = Math.ceil(teams.length / COLS)
  const CARD_W   = 320
  const CARD_PAD = 20
  const HEADER_H = 130
  const FOOTER_H = 40
  const ROW_H    = 30

  // Tight card heights — only as tall as the content needs
  const cardHeights = teams.map((_, i) => {
    const cfg      = configs[i] || {}
    const retCount = (cfg.retentions || []).length
    const hasPurse = Number(cfg.purse) > 0
    // header strip (56) + captain line (38) + divider (10) + purse row (hasPurse ? 22 : 0)
    // + retained header (retCount > 0 ? 32 : 0) + rows + no-ret line (retCount === 0 ? 30 : 0) + bottom pad (16)
    const base = 56 + 38 + 10 + (hasPurse ? 22 : 0)
    const retSection = retCount > 0
      ? 32 + retCount * ROW_H
      : 30
    return base + retSection + 16
  })

  // Max height per row
  const rowHeights = Array.from({ length: ROWS }, (_, r) => {
    let max = 0
    for (let c = 0; c < COLS; c++) {
      const idx = r * COLS + c
      if (idx < teams.length) max = Math.max(max, cardHeights[idx])
    }
    return max
  })

  const GAP    = 16
  const SIDE   = 24
  const totalW = COLS * CARD_W + (COLS - 1) * GAP + SIDE * 2
  const totalH = HEADER_H
    + rowHeights.reduce((s, h) => s + h + GAP, 0)
    + FOOTER_H

  const canvas = document.createElement("canvas")
  canvas.width  = totalW
  canvas.height = totalH
  const ctx = canvas.getContext("2d")

  // ── Background ──
  ctx.fillStyle = "#0a0e17"
  ctx.fillRect(0, 0, totalW, totalH)

  // ── Header ──
  // Logo
  try {
    const logo = await loadImage(tefLogo)
    ctx.save()
    ctx.beginPath()
    ctx.arc(totalW / 2, 42, 32, 0, Math.PI * 2)
    ctx.clip()
    ctx.drawImage(logo, totalW / 2 - 32, 10, 64, 64)
    ctx.restore()
  } catch (_) {}

  ctx.fillStyle = "#ffffff"
  ctx.font      = "bold 22px sans-serif"
  ctx.textAlign = "center"
  ctx.fillText("RETENTION LIST", totalW / 2, 94)

  ctx.fillStyle = "#64748b"
  ctx.font      = "13px sans-serif"
  ctx.fillText("Tamil Efootballers  ·  DHSANN League", totalW / 2, 116)

  // Divider
  ctx.strokeStyle = "rgba(255,255,255,0.08)"
  ctx.lineWidth   = 1
  ctx.beginPath(); ctx.moveTo(SIDE, HEADER_H - 8); ctx.lineTo(totalW - SIDE, HEADER_H - 8); ctx.stroke()

  // ── Team cards ──
  let rowY = HEADER_H

  for (let r = 0; r < ROWS; r++) {
    const cardH = rowHeights[r]
    for (let c = 0; c < COLS; c++) {
      const idx = r * COLS + c
      if (idx >= teams.length) break

      const team = teams[idx]
      const cfg  = configs[idx] || {}
      const retentions = cfg.retentions || []
      const captain    = cfg.captain
      const purse      = Number(cfg.purse) || 0
      const totalSpent = retentions.reduce((s, ret) => {
        const price = ret.priceType === "base" ? (ret.player.baseValue ?? 0) : (ret.player.auctionPrice ?? 0)
        return s + price
      }, 0)
      const remaining = purse > 0 ? Math.max(0, purse - totalSpent) : null

      const cardX = SIDE + c * (CARD_W + GAP)
      const cardY = rowY

      // Card bg
      ctx.fillStyle = "rgba(255,255,255,0.04)"
      ctx.beginPath()
      ctx.roundRect(cardX, cardY, CARD_W, cardH, 12)
      ctx.fill()

      ctx.strokeStyle = "rgba(255,255,255,0.08)"
      ctx.lineWidth   = 1
      ctx.beginPath()
      ctx.roundRect(cardX, cardY, CARD_W, cardH, 12)
      ctx.stroke()

      // Team logo circle
      if (team.logoUrl) {
        try {
          const logoImg = await loadImage(team.logoUrl)
          ctx.save()
          ctx.beginPath()
          ctx.arc(cardX + CARD_PAD + 20, cardY + 28, 20, 0, Math.PI * 2)
          ctx.clip()
          ctx.drawImage(logoImg, cardX + CARD_PAD, cardY + 8, 40, 40)
          ctx.restore()
        } catch (_) {}
      }

      // Team name
      ctx.fillStyle = "#ffffff"
      ctx.font      = "bold 13px sans-serif"
      ctx.textAlign = "left"
      const nameX = cardX + CARD_PAD + 48
      ctx.fillText(team.name, nameX, cardY + 23, CARD_W - CARD_PAD - 56)

      // Remaining purse badge (top right of card)
      if (remaining !== null) {
        const badgeColor = remaining === 0 ? "#ef4444" : "#22c55e"
        ctx.fillStyle = badgeColor + "22"
        ctx.beginPath()
        ctx.roundRect(cardX + CARD_W - CARD_PAD - 70, cardY + 10, 68, 20, 6)
        ctx.fill()
        ctx.fillStyle = badgeColor
        ctx.font      = "bold 11px monospace"
        ctx.textAlign = "right"
        ctx.fillText(`₹${remaining}`, cardX + CARD_W - CARD_PAD - 6, cardY + 24)
      }

      // Captain line
      if (captain) {
        ctx.fillStyle = "#f59e0b"
        ctx.font      = "bold 10px sans-serif"
        ctx.textAlign = "left"
        ctx.fillText(`© ${captain.name}`, nameX, cardY + 38, CARD_W - CARD_PAD - 56)
      }

      // Divider
      ctx.strokeStyle = "rgba(255,255,255,0.07)"
      ctx.lineWidth   = 1
      ctx.beginPath(); ctx.moveTo(cardX + CARD_PAD, cardY + 56); ctx.lineTo(cardX + CARD_W - CARD_PAD, cardY + 56); ctx.stroke()

      // Purse row
      let contentY = cardY + 72
      if (purse > 0) {
        ctx.fillStyle = "#475569"
        ctx.font      = "11px sans-serif"
        ctx.textAlign = "left"
        ctx.fillText("PURSE", cardX + CARD_PAD, contentY)
        ctx.fillStyle = "#94a3b8"
        ctx.font      = "bold 11px monospace"
        ctx.textAlign = "right"
        ctx.fillText(`₹${purse}`, cardX + CARD_W - CARD_PAD, contentY)
        contentY += 18
      }

      // Retained header
      if (retentions.length > 0) {
        ctx.fillStyle = "#334155"
        ctx.font      = "bold 10px sans-serif"
        ctx.textAlign = "left"
        ctx.fillText("RETAINED", cardX + CARD_PAD, contentY + 4)
        ctx.textAlign = "right"
        ctx.fillText("PRICE", cardX + CARD_W - CARD_PAD, contentY + 4)
        contentY += 16

        ctx.strokeStyle = "rgba(255,255,255,0.05)"
        ctx.lineWidth   = 1
        ctx.beginPath(); ctx.moveTo(cardX + CARD_PAD, contentY); ctx.lineTo(cardX + CARD_W - CARD_PAD, contentY); ctx.stroke()
        contentY += 10

        retentions.forEach((ret, ri) => {
          const price     = ret.priceType === "base" ? (ret.player.baseValue ?? 0) : (ret.player.auctionPrice ?? 0)
          const rowBg     = ri % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent"
          ctx.fillStyle   = rowBg
          ctx.fillRect(cardX + CARD_PAD - 4, contentY - 10, CARD_W - CARD_PAD * 2 + 8, ROW_H - 4)

          const gradeColor = GRADE_COLORS[ret.player.grade] || "#94a3b8"
          ctx.fillStyle    = gradeColor
          ctx.font         = "bold 10px sans-serif"
          ctx.textAlign    = "left"
          ctx.fillText(ret.player.grade, cardX + CARD_PAD, contentY + 8)

          ctx.fillStyle = "#f1f5f9"
          ctx.font      = "13px sans-serif"
          ctx.fillText(ret.player.name, cardX + CARD_PAD + 20, contentY + 8, CARD_W - CARD_PAD * 2 - 80)

          ctx.fillStyle = ret.priceType === "base" ? "#22d3ee" : "#f97316"
          ctx.font      = "bold 12px monospace"
          ctx.textAlign = "right"
          ctx.fillText(`₹${price}`, cardX + CARD_W - CARD_PAD, contentY + 8)

          contentY += ROW_H
        })
      } else {
        ctx.fillStyle = "#334155"
        ctx.font      = "12px sans-serif"
        ctx.textAlign = "center"
        ctx.fillText("No retentions", cardX + CARD_W / 2, contentY + 20)
      }
    }
    rowY += cardH + GAP
  }

  // ── Footer ──
  ctx.fillStyle = "#1e293b"
  ctx.font      = "11px sans-serif"
  ctx.textAlign = "center"
  ctx.fillText("Tamil Efootballers  ·  DHSANN League", totalW / 2, totalH - 14)

  return canvas
}

// ── Main component ────────────────────────────────────────────────────────────
export default function RetentionAdmin() {
  const { data: allTeams = [] } = useQuery({
    queryKey: ["teams-all"],
    queryFn: () => teamsApi.listAll(),
  })

  // selectedTeamIds: array of team ids in order
  const [selectedIds, setSelectedIds]   = useState([])
  const [configs, setConfigs]           = useState({}) // teamId → { purse, captain, retentions }
  const [teamPickerOpen, setTeamPickerOpen] = useState(false)
  const [exporting, setExporting]       = useState(false)
  const exportRef                       = useRef(null)

  const selectedTeams = selectedIds.map(id => allTeams.find(t => t.id === id)).filter(Boolean)

  function toggleTeam(team) {
    if (selectedIds.includes(team.id)) {
      setSelectedIds(ids => ids.filter(id => id !== team.id))
      setConfigs(prev => { const n = { ...prev }; delete n[team.id]; return n })
    } else if (selectedIds.length < 8) {
      setSelectedIds(ids => [...ids, team.id])
    }
  }

  function updateConfig(teamId, patch) {
    setConfigs(prev => ({ ...prev, [teamId]: { ...(prev[teamId] || {}), ...patch } }))
  }

  async function handleExport() {
    if (selectedTeams.length === 0) return
    setExporting(true)
    try {
      const cfgArray = selectedTeams.map(t => configs[t.id] || {})
      const canvas   = await generateRetentionImage(selectedTeams, cfgArray)
      const link     = document.createElement("a")
      link.download  = "Retention list.png"
      link.href      = canvas.toDataURL("image/png")
      link.click()
    } catch (err) {
      console.error(err)
      alert("Export failed: " + (err?.message || "Unknown error"))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-white">Retention Builder</h2>
          <p className="text-sm text-slate-500 mt-0.5">Select up to 8 teams, set purse, captain and retained players, then export as an image.</p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting || selectedTeams.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent/15 text-accent border border-accent/25 text-sm font-semibold hover:bg-accent/25 transition-colors disabled:opacity-40">
          <Download className="w-4 h-4" />
          {exporting ? "Generating…" : "Export PNG"}
        </button>
      </div>

      {/* Team selector */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-white">Selected Teams <span className="text-slate-500 font-normal">({selectedIds.length}/8)</span></p>
          <button
            onClick={() => setTeamPickerOpen(v => !v)}
            className="flex items-center gap-1.5 text-xs text-accent border border-accent/25 rounded-lg px-3 py-1.5 hover:bg-accent/10 transition-colors">
            <Plus className="w-3.5 h-3.5" />
            Add team
          </button>
        </div>

        {/* Selected team chips */}
        {selectedTeams.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedTeams.map(t => (
              <div key={t.id} className="flex items-center gap-1.5 bg-pitch-800 border border-surface-border rounded-lg px-2.5 py-1 text-sm">
                {t.logoUrl && <img src={t.logoUrl} alt="" className="w-5 h-5 rounded-full object-cover" />}
                <span className="text-white font-medium">{t.name}</span>
                <button onClick={() => toggleTeam(t)} className="text-slate-600 hover:text-rose-400 transition-colors ml-0.5">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Team picker dropdown */}
        {teamPickerOpen && (
          <div className="border border-surface-border rounded-xl bg-pitch-800 overflow-hidden">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1 p-2 max-h-64 overflow-y-auto">
              {allTeams.map(t => {
                const isSelected = selectedIds.includes(t.id)
                const isDisabled = !isSelected && selectedIds.length >= 8
                return (
                  <button key={t.id}
                    onClick={() => toggleTeam(t)}
                    disabled={isDisabled}
                    className={cn(
                      "flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition-colors text-left",
                      isSelected
                        ? "bg-accent/15 border border-accent/30 text-accent"
                        : isDisabled
                          ? "opacity-30 cursor-not-allowed text-slate-500"
                          : "hover:bg-white/5 text-slate-300 hover:text-white"
                    )}>
                    {t.logoUrl && <img src={t.logoUrl} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0" />}
                    <span className="truncate font-medium">{t.name}</span>
                  </button>
                )
              })}
            </div>
            <div className="border-t border-surface-border p-2">
              <button onClick={() => setTeamPickerOpen(false)} className="w-full text-xs text-slate-500 hover:text-white py-1 transition-colors">Done</button>
            </div>
          </div>
        )}
      </div>

      {/* Per-team config grid */}
      {selectedTeams.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {selectedTeams.map(team => (
            <TeamCard
              key={team.id}
              team={team}
              config={configs[team.id] || {}}
              onChange={patch => updateConfig(team.id, patch)}
              allTeams={allTeams}
            />
          ))}
        </div>
      )}

      {selectedTeams.length === 0 && (
        <div className="text-center py-16 text-slate-600">
          <p className="text-lg font-semibold">No teams selected</p>
          <p className="text-sm mt-1">Click "Add team" above to get started.</p>
        </div>
      )}
    </div>
  )
}