import { forwardRef, useRef, useState } from "react"
import { toPng } from "html-to-image"
import { Download, Loader2, Trophy } from "lucide-react"
import { useTopScorers } from "../../lib/queries"
import tefLogo from "../../../images/logo.png"

export default function GoldenBootExport() {
  const { data: scorers = [], isLoading } = useTopScorers()
  const exportRef = useRef(null)
  const [exporting, setExporting] = useState(false)

  const top10 = scorers.slice(0, 10)

  async function handleExport() {
    if (!exportRef.current) return
    setExporting(true)
    await new Promise(r => setTimeout(r, 300))
    try {
      const dataUrl = await toPng(exportRef.current, { cacheBust: true, pixelRatio: 2 })
      const link = document.createElement("a")
      link.download = "Dshann-League-Golden-Boot.png"
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
          <Trophy className="w-4 h-4 text-yellow-400" />
          <div>
            <p className="text-sm font-semibold text-white">Golden Boot Export</p>
            <p className="text-xs text-slate-500">Export top 10 scorers as a PNG image</p>
          </div>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting || isLoading || top10.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-400/10 border border-yellow-400/25 text-yellow-400 text-sm font-semibold hover:bg-yellow-400/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {exporting
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Exporting…</>
            : <><Download className="w-4 h-4" /> Export PNG</>
          }
        </button>
      </div>

      {/* Hidden export card */}
      <div className="fixed -left-[9999px] -top-[9999px] pointer-events-none" aria-hidden>
        <GoldenBootCard ref={exportRef} scorers={top10} />
      </div>

      {/* Live mini-preview */}
      {!isLoading && top10.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-surface-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-surface-border bg-pitch-800">
                <th className="px-3 py-2 text-left text-slate-500 font-semibold w-6">#</th>
                <th className="px-3 py-2 text-left text-slate-500 font-semibold">Player</th>
                <th className="px-3 py-2 text-left text-slate-500 font-semibold">Team</th>
                <th className="px-3 py-2 text-center text-yellow-400 font-bold">Goals</th>
              </tr>
            </thead>
            <tbody>
              {top10.map((p, i) => (
                <tr key={p.id} className="border-b border-surface-border/50 last:border-0 hover:bg-white/5">
                  <td className="px-3 py-2 text-slate-500 font-mono">{i + 1}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {p.avatarUrl
                        ? <img src={p.avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
                        : <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-[9px] font-bold text-slate-400">{p.name?.charAt(0)}</div>
                      }
                      <span className="text-slate-200 font-medium truncate max-w-[120px]">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-slate-400 truncate max-w-[100px]">{p.team}</td>
                  <td className="px-3 py-2 text-center text-yellow-400 font-bold">{p.goals}</td>
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

const GoldenBootCard = forwardRef(function GoldenBootCard({ scorers }, ref) {
  const now = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })

  // Top 3 get gold / silver / bronze; rest get a muted accent
  const medalColors = ["#f59e0b", "#94a3b8", "#cd7c2f"]
  const medalLabels = ["🥇", "🥈", "🥉"]

  return (
    <div
      ref={ref}
      style={{
        width: 560,
        background: "linear-gradient(160deg, #060d1a 0%, #0c1526 50%, #0f1e38 100%)",
        borderRadius: 20,
        overflow: "hidden",
        fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
        color: "#f8fafc",
      }}
    >
      {/* ── Header ── */}
      <div style={{
        background: "linear-gradient(90deg, #1a1200 0%, #0c0a00 50%, #060d1a 100%)",
        padding: "20px 28px",
        borderBottom: "2px solid #78350f55",
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
              GOLDEN BOOT
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#f59e0b", fontWeight: 600, letterSpacing: 1 }}>
              DSHANN LEAGUE · TOP SCORERS
            </p>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{
            fontSize: 32, lineHeight: 1,
            filter: "drop-shadow(0 0 12px #f59e0b88)",
          }}>⚽</div>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "#475569", fontWeight: 500 }}>{now}</p>
        </div>
      </div>

      {/* ── Column header bar ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "44px 1fr 160px 64px",
        padding: "10px 24px",
        background: "#0a1122",
        borderBottom: "1px solid #1e293b",
      }}>
        {["#", "PLAYER", "TEAM", "GOALS"].map((h, i) => (
          <div key={h} style={{
            fontSize: 10, fontWeight: 800,
            color: h === "GOALS" ? "#f59e0b" : "#334155",
            textAlign: i === 3 ? "center" : i === 0 ? "center" : "left",
            letterSpacing: 1.5,
          }}>{h}</div>
        ))}
      </div>

      {/* ── Rows ── */}
      <div>
        {scorers.map((p, i) => {
          const isTop3    = i < 3
          const rankColor = isTop3 ? medalColors[i] : "#334155"
          const rowBg     = i === 0
            ? "linear-gradient(90deg,#1a1000,#78350f22)"
            : i === 1
            ? "linear-gradient(90deg,#0f1520,#1e293b22)"
            : i === 2
            ? "linear-gradient(90deg,#140a00,#92400e22)"
            : "transparent"

          return (
            <div key={p.id} style={{
              display: "grid",
              gridTemplateColumns: "44px 1fr 160px 64px",
              alignItems: "center",
              padding: "10px 24px",
              background: rowBg,
              borderBottom: i < scorers.length - 1 ? "1px solid #ffffff07" : "none",
            }}>
              {/* Rank */}
              <div style={{ display: "flex", justifyContent: "center" }}>
                {isTop3 ? (
                  <span style={{ fontSize: 18, lineHeight: 1 }}>{medalLabels[i]}</span>
                ) : (
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>{i + 1}</span>
                )}
              </div>

              {/* Player avatar + name */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {p.avatarUrl ? (
                  <img src={p.avatarUrl} alt=""
                    style={{
                      width: 34, height: 34, borderRadius: "50%", objectFit: "cover",
                      border: isTop3 ? `2px solid ${rankColor}88` : "2px solid #1e293b",
                      boxShadow: isTop3 ? `0 0 8px ${rankColor}44` : "none",
                    }} />
                ) : (
                  <div style={{
                    width: 34, height: 34, borderRadius: "50%", background: "#1e3a5f",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 900,
                    border: isTop3 ? `2px solid ${rankColor}66` : "2px solid #1e293b",
                    color: "#94a3b8",
                  }}>{p.name?.charAt(0)}</div>
                )}
                <span style={{
                  fontSize: 14,
                  fontWeight: isTop3 ? 800 : 500,
                  color: isTop3 ? "#f1f5f9" : "#94a3b8",
                  letterSpacing: isTop3 ? 0.3 : 0,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 140,
                }}>{p.name}</span>
              </div>

              {/* Team logo + name */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {p.teamLogo ? (
                  <img src={p.teamLogo} alt=""
                    style={{ width: 22, height: 22, borderRadius: "50%", objectFit: "cover", border: "1px solid #1e293b", flexShrink: 0 }} />
                ) : (
                  <div style={{
                    width: 22, height: 22, borderRadius: "50%", background: "#1e3a5f",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 9, fontWeight: 900, color: "#64748b", flexShrink: 0,
                  }}>{p.team?.charAt(0)}</div>
                )}
                <span style={{
                  fontSize: 11, color: "#64748b", fontWeight: 500,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>{p.team}</span>
              </div>

              {/* Goals */}
              <div style={{ display: "flex", justifyContent: "center" }}>
                <div style={{
                  fontSize: isTop3 ? 17 : 14,
                  fontWeight: 900,
                  color: isTop3 ? rankColor : "#e2e8f0",
                  background: isTop3 ? `${rankColor}18` : "#ffffff08",
                  border: isTop3 ? `1px solid ${rankColor}44` : "1px solid #1e293b",
                  borderRadius: 8,
                  minWidth: 36, textAlign: "center",
                  padding: "3px 8px",
                  filter: i === 0 ? "drop-shadow(0 0 6px #f59e0b66)" : "none",
                }}>{p.goals}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Footer ── */}
      <div style={{
        background: "#060d1a", padding: "12px 28px",
        borderTop: "2px solid #78350f44",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <p style={{ margin: 0, fontSize: 11, color: "#334155" }}>tamilefootballers.com</p>
        <div style={{ display: "flex", gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b" }} />
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#94a3b8" }} />
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#cd7c2f" }} />
        </div>
      </div>
    </div>
  )
})