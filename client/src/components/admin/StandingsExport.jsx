import { useRef, useState } from "react"
import { toPng } from "html-to-image"
import { Download, Loader2, TableProperties } from "lucide-react"
import { useTeams } from "../../lib/queries"
import tefLogo from "../../../images/logo.png"

export default function StandingsExport() {
  const { data: teams = [], isLoading } = useTeams()
  const exportRef = useRef(null)
  const [exporting, setExporting] = useState(false)

  // Sort by pts desc, then GD, then GF
  const sorted = [...teams].sort((a, b) => {
    const ptsDiff = (b.points ?? 0) - (a.points ?? 0)
    if (ptsDiff !== 0) return ptsDiff
    const gdDiff  = ((b.gf ?? 0) - (b.ga ?? 0)) - ((a.gf ?? 0) - (a.ga ?? 0))
    if (gdDiff !== 0) return gdDiff
    return (b.gf ?? 0) - (a.gf ?? 0)
  })

  async function handleExport() {
    if (!exportRef.current) return
    setExporting(true)
    await new Promise(r => setTimeout(r, 300))
    try {
      const dataUrl = await toPng(exportRef.current, { cacheBust: true, pixelRatio: 2 })
      const link = document.createElement("a")
      link.download = `Dshann-League-Standings.png`
      link.href = dataUrl
      link.click()
    } catch (e) {
      console.error(e)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TableProperties className="w-4 h-4 text-accent" />
          <div>
            <p className="text-sm font-semibold text-white">League Standings Export</p>
            <p className="text-xs text-slate-500">Export current Dshann League table as a PNG image</p>
          </div>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting || isLoading || teams.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent/15 border border-accent/25 text-accent text-sm font-semibold hover:bg-accent/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {exporting
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Exporting…</>
            : <><Download className="w-4 h-4" /> Export PNG</>
          }
        </button>
      </div>

      {/* Hidden export card */}
      <div className="fixed -left-[9999px] -top-[9999px] pointer-events-none" aria-hidden>
        <StandingsCard ref={exportRef} teams={sorted} />
      </div>

      {/* Live mini-preview */}
      {!isLoading && teams.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-surface-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-surface-border bg-pitch-800">
                <th className="px-3 py-2 text-left text-slate-500 font-semibold w-6">#</th>
                <th className="px-3 py-2 text-left text-slate-500 font-semibold">Team</th>
                <th className="px-3 py-2 text-center text-slate-500 font-semibold">P</th>
                <th className="px-3 py-2 text-center text-slate-500 font-semibold">W</th>
                <th className="px-3 py-2 text-center text-slate-500 font-semibold">D</th>
                <th className="px-3 py-2 text-center text-slate-500 font-semibold">L</th>
                <th className="px-3 py-2 text-center text-slate-500 font-semibold">GF</th>
                <th className="px-3 py-2 text-center text-slate-500 font-semibold">GA</th>
                <th className="px-3 py-2 text-center text-slate-500 font-semibold">GD</th>
                <th className="px-3 py-2 text-center text-accent font-bold">Pts</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t, i) => (
                <tr key={t.id} className="border-b border-surface-border/50 last:border-0 hover:bg-white/5">
                  <td className="px-3 py-2 text-slate-500 font-mono">{i + 1}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {t.logoUrl
                        ? <img src={t.logoUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
                        : <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-[9px] font-bold text-slate-400">{t.name?.charAt(0)}</div>
                      }
                      <span className="text-slate-200 font-medium truncate max-w-[120px]">{t.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center text-slate-400">{t.played ?? 0}</td>
                  <td className="px-3 py-2 text-center text-slate-400">{t.won ?? 0}</td>
                  <td className="px-3 py-2 text-center text-slate-400">{t.drawn ?? 0}</td>
                  <td className="px-3 py-2 text-center text-slate-400">{t.lost ?? 0}</td>
                  <td className="px-3 py-2 text-center text-slate-400">{t.gf ?? 0}</td>
                  <td className="px-3 py-2 text-center text-slate-400">{t.ga ?? 0}</td>
                  <td className="px-3 py-2 text-center text-slate-400">{(t.gf ?? 0) - (t.ga ?? 0)}</td>
                  <td className="px-3 py-2 text-center text-accent font-bold">{t.points ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Hidden export card — captured as PNG
// ---------------------------------------------------------------------------
import { forwardRef } from "react"

const StandingsCard = forwardRef(function StandingsCard({ teams }, ref) {
  const now = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })

  return (
    <div
      ref={ref}
      style={{
        width: 600,
        background: "linear-gradient(160deg, #0a0f1e 0%, #0f172a 60%, #111827 100%)",
        borderRadius: 20,
        overflow: "hidden",
        fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
        color: "#f8fafc",
      }}
    >
      {/* Header */}
      <div style={{
        background: "linear-gradient(90deg, #1a2744 0%, #0f172a 100%)",
        padding: "20px 28px 18px",
        borderBottom: "1px solid #1e293b",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* TEF App Logo */}
          <img
            src={tefLogo}
            alt="TEF"
            style={{
              width: 52,
              height: 52,
              objectFit: "contain",
              borderRadius: 10,
              flexShrink: 0,
            }}
          />
          <div>
            <p style={{ margin: 0, fontSize: 11, color: "#64748b", letterSpacing: 3, textTransform: "uppercase" }}>
              Tamil eFootball League
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 900, color: "#f1f5f9", letterSpacing: 0.5 }}>
              Dshann League
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#475569" }}>Season Standings</p>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, fontSize: 11, color: "#475569" }}>{now}</p>
        </div>
      </div>

      {/* Column headers */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "28px 1fr 36px 36px 36px 36px 36px 36px 36px 44px",
        padding: "10px 24px",
        background: "#0d1626",
        borderBottom: "1px solid #1e293b",
      }}>
        {["#", "Team", "P", "W", "D", "L", "GF", "GA", "GD", "Pts"].map((h, i) => (
          <div key={h} style={{
            fontSize: 11, fontWeight: 700, color: h === "Pts" ? "#7c3aed" : "#475569",
            textAlign: i === 1 ? "left" : "center",
            letterSpacing: 1, textTransform: "uppercase"
          }}>{h}</div>
        ))}
      </div>

      {/* Rows */}
      <div style={{ padding: "8px 0 16px" }}>
        {teams.map((t, i) => {
          const gd  = (t.gf ?? 0) - (t.ga ?? 0)
          const isTop4 = i < 4
          const rowBg = i === 0 ? "#0d2b1a" : i === 1 ? "#0c1e2d" : i === 2 ? "#1a1506" : i === 3 ? "#0f1a2e" : "transparent"
          const posColor = i === 0 ? "#34d399" : i === 1 ? "#60a5fa" : i === 2 ? "#fbbf24" : i === 3 ? "#c084fc" : "#475569"

          return (
            <div key={t.id} style={{
              display: "grid",
              gridTemplateColumns: "28px 1fr 36px 36px 36px 36px 36px 36px 36px 44px",
              alignItems: "center",
              padding: "10px 24px",
              background: rowBg,
              borderBottom: i < teams.length - 1 ? "1px solid #ffffff08" : "none",
            }}>
              {/* Position */}
              <div style={{ fontSize: 12, fontWeight: 700, color: posColor, textAlign: "center" }}>
                {i + 1}
              </div>

              {/* Team name + logo */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {t.logoUrl ? (
                  <img src={t.logoUrl} alt=""
                    style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover",
                      border: isTop4 ? `2px solid ${posColor}44` : "2px solid #1e293b" }} />
                ) : (
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#1e3a5f",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 900, border: "2px solid #1e293b" }}>
                    {t.name?.charAt(0)}
                  </div>
                )}
                <span style={{ fontSize: 13, fontWeight: isTop4 ? 700 : 500, color: isTop4 ? "#f1f5f9" : "#cbd5e1" }}>
                  {t.name}
                </span>
              </div>

              {/* Stats */}
              {[t.played ?? 0, t.won ?? 0, t.drawn ?? 0, t.lost ?? 0, t.gf ?? 0, t.ga ?? 0].map((val, vi) => (
                <div key={vi} style={{ fontSize: 13, textAlign: "center", color: "#94a3b8" }}>{val}</div>
              ))}

              {/* GD */}
              <div style={{ fontSize: 13, textAlign: "center", color: gd > 0 ? "#34d399" : gd < 0 ? "#fb7185" : "#94a3b8" }}>
                {gd > 0 ? `+${gd}` : gd}
              </div>

              {/* Points */}
              <div style={{
                fontSize: 14, fontWeight: 900, textAlign: "center",
                color: isTop4 ? posColor : "#e2e8f0",
                background: isTop4 ? `${posColor}18` : "transparent",
                borderRadius: 8, padding: "3px 0",
              }}>{t.points ?? 0}</div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div style={{ background: "#080d18", padding: "12px 28px", borderTop: "1px solid #1e293b", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ margin: 0, fontSize: 11, color: "#334155" }}>tamilefootballers.com</p>
        <div style={{ display: "flex", gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399" }} />
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#60a5fa" }} />
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fbbf24" }} />
        </div>
      </div>
    </div>
  )
})