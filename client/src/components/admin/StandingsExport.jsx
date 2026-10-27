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

  const posColors = ["#34d399", "#60a5fa", "#fbbf24", "#c084fc"]
  const rowBgs    = ["linear-gradient(90deg,#052e16,#064e3b22)", "linear-gradient(90deg,#0c1e3d,#1e3a5f22)", "linear-gradient(90deg,#2a1800,#78350f22)", "linear-gradient(90deg,#1a0a2e,#4c1d9522)"]

  return (
    <div
      ref={ref}
      style={{
        width: 700,
        background: "linear-gradient(160deg, #060d1a 0%, #0c1526 50%, #0f1e38 100%)",
        borderRadius: 20,
        overflow: "hidden",
        fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
        color: "#f8fafc",
      }}
    >
      {/* ── Header ── */}
      <div style={{
        background: "linear-gradient(90deg, #0f1e38 0%, #060d1a 100%)",
        padding: "20px 28px",
        borderBottom: "2px solid #1e3a5f",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <img src={tefLogo} alt="TEF"
            style={{ width: 56, height: 56, objectFit: "contain", borderRadius: 12, flexShrink: 0 }} />
          <div>
            <p style={{ margin: 0, fontSize: 11, color: "#64748b", letterSpacing: 3, textTransform: "uppercase" }}>
              Tamil eFootball League
            </p>
            <p style={{ margin: "5px 0 0", fontSize: 24, fontWeight: 900, color: "#f1f5f9", letterSpacing: 0.5 }}>
              DSHANN LEAGUE
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#60a5fa", fontWeight: 600, letterSpacing: 1 }}>
              SEASON STANDINGS
            </p>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, fontSize: 12, color: "#475569", fontWeight: 500 }}>{now}</p>
        </div>
      </div>

      {/* ── Column header bar ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "40px 1fr 38px 38px 38px 38px 42px 42px 46px 54px",
        padding: "10px 24px",
        background: "#0a1122",
        borderBottom: "1px solid #1e293b",
      }}>
        {["#", "TEAM", "P", "W", "D", "L", "GF", "GA", "GD", "PTS"].map((h, i) => (
          <div key={h} style={{
            fontSize: 10, fontWeight: 800,
            color: h === "PTS" ? "#a78bfa" : "#334155",
            textAlign: i <= 1 ? (i === 0 ? "center" : "left") : "center",
            letterSpacing: 1.5,
          }}>{h}</div>
        ))}
      </div>

      {/* ── Rows ── */}
      <div>
        {teams.map((t, i) => {
          const gd      = (t.gf ?? 0) - (t.ga ?? 0)
          const isTop4  = i < 4
          const posColor = isTop4 ? posColors[i] : "#334155"
          const rowBg   = isTop4 ? rowBgs[i] : "transparent"

          return (
            <div key={t.id} style={{
              display: "grid",
              gridTemplateColumns: "40px 1fr 38px 38px 38px 38px 42px 42px 46px 54px",
              alignItems: "center",
              padding: "11px 24px",
              background: rowBg,
              borderBottom: i < teams.length - 1 ? "1px solid #ffffff07" : "none",
            }}>
              {/* Position badge */}
              <div style={{ display: "flex", justifyContent: "center" }}>
                {isTop4 ? (
                  <div style={{
                    width: 22, height: 22, borderRadius: 6,
                    background: `${posColor}22`,
                    border: `1px solid ${posColor}55`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 900, color: posColor,
                  }}>{i + 1}</div>
                ) : (
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>{i + 1}</span>
                )}
              </div>

              {/* Team logo + name */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {t.logoUrl ? (
                  <img src={t.logoUrl} alt=""
                    style={{
                      width: 32, height: 32, borderRadius: "50%", objectFit: "cover",
                      border: isTop4 ? `2px solid ${posColor}66` : "2px solid #1e293b",
                      boxShadow: isTop4 ? `0 0 8px ${posColor}44` : "none",
                    }} />
                ) : (
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%", background: "#1e3a5f",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 900,
                    border: isTop4 ? `2px solid ${posColor}55` : "2px solid #1e293b",
                  }}>{t.name?.charAt(0)}</div>
                )}
                <span style={{
                  fontSize: 14, fontWeight: isTop4 ? 800 : 500,
                  color: isTop4 ? "#f1f5f9" : "#94a3b8",
                  letterSpacing: isTop4 ? 0.3 : 0,
                }}>{t.name}</span>
              </div>

              {/* Stats: P W D L GF GA */}
              {[t.played ?? 0, t.won ?? 0, t.drawn ?? 0, t.lost ?? 0, t.gf ?? 0, t.ga ?? 0].map((val, vi) => (
                <div key={vi} style={{
                  fontSize: 13, textAlign: "center",
                  color: vi === 1 && val > 0 ? "#34d399" : vi === 3 && val > 0 ? "#fb7185" : "#64748b",
                  fontWeight: vi === 1 || vi === 3 ? 700 : 400,
                }}>{val}</div>
              ))}

              {/* GD */}
              <div style={{
                fontSize: 13, textAlign: "center", fontWeight: 700,
                color: gd > 0 ? "#34d399" : gd < 0 ? "#fb7185" : "#475569",
              }}>
                {gd > 0 ? `+${gd}` : gd}
              </div>

              {/* Points */}
              <div style={{ display: "flex", justifyContent: "center" }}>
                <div style={{
                  fontSize: 15, fontWeight: 900, minWidth: 36, textAlign: "center",
                  color: isTop4 ? posColor : "#e2e8f0",
                  background: isTop4 ? `${posColor}20` : "#ffffff08",
                  border: isTop4 ? `1px solid ${posColor}44` : "1px solid #1e293b",
                  borderRadius: 8, padding: "3px 6px",
                }}>{t.points ?? 0}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Footer ── */}
      <div style={{
        background: "#060d1a", padding: "12px 28px",
        borderTop: "2px solid #1e3a5f",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
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