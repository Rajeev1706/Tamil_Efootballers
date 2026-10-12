import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useQuery, useMutation } from "@tanstack/react-query"
import api from "../../lib/api"
import logoUrl from "../../../images/logo.png"

// One accent colour per group (A–H)
const GROUP_ACCENT = {
  "Group A": "#22d3ee",
  "Group B": "#a78bfa",
  "Group C": "#34d399",
  "Group D": "#fb923c",
  "Group E": "#f472b6",
  "Group F": "#facc15",
  "Group G": "#60a5fa",
  "Group H": "#f87171",
}

function hexRgb(hex) {
  const v = parseInt(hex.replace("#", ""), 16)
  return `${(v >> 16) & 255},${(v >> 8) & 255},${v & 255}`
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

// ── Flip card shown in the centre during a draw ───────────────────────────────
function DrawCard({ pair, flipped }) {
  const accent  = GROUP_ACCENT[pair.groupName] || "#22d3ee"
  const rgb     = hexRgb(accent)

  return (
    <div style={{ perspective: 900, width: 240, height: 310 }}>
      <div style={{
        width: "100%", height: "100%",
        position: "relative",
        transformStyle: "preserve-3d",
        transition: "transform 0.75s cubic-bezier(0.4,0,0.2,1)",
        transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
      }}>
        {/* ── Face-down side ── */}
        <div style={{
          position: "absolute", inset: 0,
          backfaceVisibility: "hidden",
          borderRadius: 20,
          background: "linear-gradient(145deg,#0c1424 0%,#111827 100%)",
          border: "2px solid rgba(255,255,255,0.08)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 14,
        }}>
          <div style={{
            width: 70, height: 70, borderRadius: "50%",
            background: "rgba(255,255,255,0.04)",
            border: "2px solid rgba(255,255,255,0.08)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 34, opacity: 0.25,
          }}>?</div>
          <img src={logoUrl} alt="" style={{ width: 36, height: 36, objectFit: "contain", opacity: 0.12 }} />
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.15)", letterSpacing: 3, textTransform: "uppercase", margin: 0 }}>Drawing…</p>
        </div>

        {/* ── Face-up side (team revealed) ── */}
        <div style={{
          position: "absolute", inset: 0,
          backfaceVisibility: "hidden",
          transform: "rotateY(180deg)",
          borderRadius: 20,
          background: "linear-gradient(145deg,#080f1e 0%,#0d1627 100%)",
          border: `2px solid ${accent}`,
          boxShadow: `0 0 48px rgba(${rgb},0.35), 0 0 0 1px rgba(${rgb},0.15) inset`,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 14,
          padding: "24px 20px",
        }}>
          {/* Group badge */}
          <span style={{
            fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 2,
            color: accent,
            background: `rgba(${rgb},0.15)`,
            border: `1px solid rgba(${rgb},0.4)`,
            padding: "4px 14px", borderRadius: 20,
          }}>{pair.groupName}</span>

          {/* Logo / initials */}
          {pair.logoUrl ? (
            <img src={pair.logoUrl} alt={pair.duoName} style={{
              width: 82, height: 82, borderRadius: 16, objectFit: "cover",
              border: "2px solid rgba(255,255,255,0.12)",
              boxShadow: `0 4px 24px rgba(0,0,0,0.5)`,
            }} />
          ) : (
            <div style={{
              width: 82, height: 82, borderRadius: 16,
              background: `rgba(${rgb},0.18)`,
              border: `2px solid rgba(${rgb},0.35)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 28, fontWeight: 900, color: accent,
            }}>
              {pair.duoName.slice(0, 2).toUpperCase()}
            </div>
          )}

          {/* Team name + players */}
          <div style={{ textAlign: "center" }}>
            <p style={{
              fontSize: 20, fontWeight: 900, color: "white",
              margin: "0 0 6px", lineHeight: 1.25,
              textShadow: `0 0 20px rgba(${rgb},0.5)`,
            }}>{pair.duoName}</p>
            <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>
              {pair.set1Name} &amp; {pair.set2Name}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── A single group column ─────────────────────────────────────────────────────
function GroupColumn({ group, revealedIds, flashGroup }) {
  const accent    = GROUP_ACCENT[group.groupName] || "#22d3ee"
  const rgb       = hexRgb(accent)
  const isFlash   = flashGroup === group.groupName
  const revealed  = group.pairs.filter(p => revealedIds.has(p.pairId))
  const emptySlots = group.pairs.length - revealed.length

  return (
    <div style={{
      borderRadius: 14, overflow: "hidden",
      background: isFlash ? `rgba(${rgb},0.1)` : "rgba(255,255,255,0.025)",
      border: `1px solid ${isFlash ? accent : "rgba(255,255,255,0.06)"}`,
      boxShadow: isFlash ? `0 0 28px rgba(${rgb},0.3)` : "none",
      transition: "all 0.35s ease",
    }}>
      {/* Column header */}
      <div style={{
        padding: "9px 12px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", gap: 8,
        background: isFlash ? `rgba(${rgb},0.12)` : "rgba(255,255,255,0.02)",
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: accent,
          boxShadow: isFlash ? `0 0 10px ${accent}` : "none",
          transition: "box-shadow 0.3s",
        }} />
        <span style={{
          color: accent, fontSize: 11, fontWeight: 800,
          textTransform: "uppercase", letterSpacing: 1,
        }}>{group.groupName}</span>
        <span style={{ marginLeft: "auto", color: "#334155", fontSize: 10 }}>
          {revealed.length}/{group.pairs.length}
        </span>
      </div>

      {/* Pairs */}
      <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 5 }}>
        {revealed.map(p => (
          <div key={p.pairId} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "7px 9px", borderRadius: 9,
            background: "rgba(255,255,255,0.05)",
            animation: "slideIn 0.45s cubic-bezier(0.22,1,0.36,1)",
          }}>
            {p.logoUrl ? (
              <img src={p.logoUrl} style={{ width: 24, height: 24, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
            ) : (
              <div style={{
                width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                background: `rgba(${rgb},0.2)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 7, fontWeight: 900, color: accent,
              }}>{p.duoName.slice(0, 2).toUpperCase()}</div>
            )}
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "white", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.duoName}
              </p>
              <p style={{ fontSize: 9, color: "#475569", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.set1Name} &amp; {p.set2Name}
              </p>
            </div>
          </div>
        ))}

        {/* Empty placeholder slots */}
        {Array.from({ length: emptySlots }).map((_, i) => (
          <div key={`empty-${i}`} style={{
            height: 40, borderRadius: 9,
            border: "1px dashed rgba(255,255,255,0.05)",
          }} />
        ))}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DuoDrawReveal() {
  const { season }   = useParams()
  const navigate     = useNavigate()

  // Fetch groups from admin endpoint (visible even before public reveal)
  const { data, isLoading, error } = useQuery({
    queryKey: ["duo-admin-groups", season],
    queryFn:  () => api.get(`/duo/admin-groups?season=${season}`).then(r => r.data),
    enabled:  !!season,
  })

  const groups = useMemo(() => data?.groups || [], [data])

  // Build reveal sequence: group by group — fill Group A completely, then B, then C…
  const revealSequence = useMemo(() => {
    if (!groups.length) return []
    const seq = []
    for (const g of groups) {
      for (const pair of g.pairs) {
        seq.push({ ...pair, groupName: g.groupName })
      }
    }
    return seq
  }, [groups])

  const [started,     setStarted]     = useState(false)  // intro screen until "Start Reveal"
  const [revealStep,  setRevealStep]  = useState(0)
  const [isDrawing,   setIsDrawing]   = useState(false)
  const [showCard,    setShowCard]    = useState(null)   // pair in the centre stage
  const [cardFlipped, setCardFlipped] = useState(false)
  const [revealedIds, setRevealedIds] = useState(new Set())
  const [flashGroup,  setFlashGroup]  = useState(null)
  const [autoPlay,    setAutoPlay]    = useState(false)
  const [allDone,     setAllDone]     = useState(false)
  const drawingRef = useRef(false)

  const revealMut = useMutation({
    mutationFn: () => api.post("/duo/reveal", { seasonNumber: Number(season) }).then(r => r.data),
    onSuccess:  () => navigate("/admin/duo-tournament"),
    onError:    (e) => alert(e?.response?.data?.error || "Failed to publish"),
  })

  const drawNext = useCallback(async () => {
    if (drawingRef.current) return
    const pair = revealSequence[revealStep]
    if (!pair) return

    drawingRef.current = true
    setIsDrawing(true)
    setShowCard(pair)
    setCardFlipped(false)

    await sleep(800)          // suspense: card face-down
    setCardFlipped(true)      // flip!
    await sleep(1400)         // viewer reads team name

    // Place team into group column
    setRevealedIds(prev => new Set([...prev, pair.pairId]))
    setFlashGroup(pair.groupName)

    await sleep(500)
    setFlashGroup(null)

    await sleep(200)
    setShowCard(null)
    setCardFlipped(false)

    const next = revealStep + 1
    setRevealStep(next)
    drawingRef.current = false
    setIsDrawing(false)

    if (next >= revealSequence.length) setAllDone(true)
  }, [revealStep, revealSequence])

  // Auto-draw: fires after each card settles
  useEffect(() => {
    if (!autoPlay || isDrawing || allDone) return
    const t = setTimeout(() => drawNext(), 700)
    return () => clearTimeout(t)
  }, [autoPlay, isDrawing, allDone, revealStep, drawNext])

  if (isLoading) return (
    <div style={{ minHeight: "100vh", background: "#03060f", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <img src={logoUrl} style={{ width: 56, height: 56, objectFit: "contain", opacity: 0.4, marginBottom: 16 }} />
        <p style={{ color: "#334155", fontSize: 14, letterSpacing: 2, textTransform: "uppercase" }}>Loading draw…</p>
      </div>
    </div>
  )

  if (error || !groups.length) return (
    <div style={{ minHeight: "100vh", background: "#03060f", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <p style={{ color: "#ef4444", fontSize: 14 }}>No group data found. Run the draw first.</p>
        <button onClick={() => navigate(-1)} style={{ marginTop: 16, padding: "10px 24px", background: "rgba(255,255,255,0.06)", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, cursor: "pointer" }}>← Back</button>
      </div>
    </div>
  )

  const remaining = revealSequence.length - revealStep

  // ── Intro screen (before reveal starts) ──────────────────────────────────────
  if (!started && groups.length > 0) return (
    <div style={{
      minHeight: "100vh",
      background: "#03060f",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: "system-ui, -apple-system, sans-serif",
      color: "white",
      position: "relative",
      padding: "24px 20px",
    }}>
      {/* Background glow */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 70% 50% at 50% 50%, rgba(34,211,238,0.07) 0%, transparent 70%)",
      }} />

      <div style={{ position: "relative", zIndex: 1, textAlign: "center", maxWidth: 480 }}>
        <img src={logoUrl} style={{ width: 64, height: 64, objectFit: "contain", opacity: 0.9, marginBottom: 28 }} />

        <p style={{ fontSize: 11, color: "#334155", textTransform: "uppercase", letterSpacing: 4, margin: "0 0 10px" }}>
          Tamil Efootballers · Duo Tournament
        </p>
        <h1 style={{ fontSize: 32, fontWeight: 900, margin: "0 0 6px", lineHeight: 1.15 }}>
          Group Stage Draw
        </h1>
        <p style={{ fontSize: 16, color: "#475569", margin: "0 0 40px" }}>Season {season}</p>

        {/* Group count summary */}
        <div style={{
          display: "flex", justifyContent: "center", gap: 8,
          flexWrap: "wrap", marginBottom: 44,
        }}>
          {groups.map(g => {
            const accent = GROUP_ACCENT[g.groupName] || "#22d3ee"
            return (
              <div key={g.groupName} style={{
                padding: "5px 14px", borderRadius: 20,
                background: `rgba(${hexRgb(accent)},0.1)`,
                border: `1px solid rgba(${hexRgb(accent)},0.3)`,
                fontSize: 11, fontWeight: 700, color: accent,
                letterSpacing: 1,
              }}>
                {g.groupName} · {g.pairs.length}
              </div>
            )
          })}
        </div>

        <p style={{ fontSize: 13, color: "#334155", marginBottom: 32 }}>
          {revealSequence.length} pairs across {groups.length} groups ready to be revealed
        </p>

        {/* Start Reveal button */}
        <button
          onClick={() => setStarted(true)}
          style={{
            padding: "16px 52px",
            background: "linear-gradient(135deg, #22d3ee, #60a5fa)",
            color: "#030f14",
            border: "none", borderRadius: 14,
            fontSize: 16, fontWeight: 900, letterSpacing: 0.5,
            cursor: "pointer",
            boxShadow: "0 0 40px rgba(34,211,238,0.35)",
            transition: "transform 0.15s, box-shadow 0.15s",
          }}
          onMouseEnter={e => { e.target.style.transform = "scale(1.04)"; e.target.style.boxShadow = "0 0 60px rgba(34,211,238,0.5)" }}
          onMouseLeave={e => { e.target.style.transform = "scale(1)";    e.target.style.boxShadow = "0 0 40px rgba(34,211,238,0.35)" }}
        >
          ▶ Start Reveal
        </button>

        <button
          onClick={() => navigate(-1)}
          style={{
            display: "block", margin: "20px auto 0",
            background: "transparent", color: "#334155",
            border: "none", fontSize: 13, cursor: "pointer",
          }}
        >← Back</button>
      </div>
    </div>
  )

  return (
    <div style={{
      minHeight: "100vh",
      background: "#03060f",
      color: "white",
      fontFamily: "system-ui, -apple-system, sans-serif",
      position: "relative",
      paddingBottom: 88,  // space for fixed controls bar
    }}>

      {/* Background radial glow */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 90% 45% at 50% 0%, rgba(34,211,238,0.055) 0%, transparent 65%)",
        zIndex: 0,
      }} />

      {/* ── Header ── */}
      <div style={{
        position: "relative", zIndex: 1,
        padding: "18px 24px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        display: "flex", alignItems: "center", gap: 16,
        background: "rgba(3,6,15,0.8)",
        backdropFilter: "blur(8px)",
      }}>
        <img src={logoUrl} style={{ width: 38, height: 38, objectFit: "contain", flexShrink: 0 }} />
        <div>
          <p style={{ color: "#334155", fontSize: 10, textTransform: "uppercase", letterSpacing: 3, margin: "0 0 2px" }}>
            Tamil Efootballers · Duo Tournament
          </p>
          <p style={{ color: "white", fontSize: 18, fontWeight: 800, margin: 0 }}>
            Group Stage Draw — Season {season}
          </p>
        </div>

        {/* Progress ring / counter */}
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <p style={{ color: "#334155", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 2px" }}>Revealed</p>
          <p style={{ color: "white", fontSize: 22, fontWeight: 900, fontVariantNumeric: "tabular-nums", margin: 0, lineHeight: 1 }}>
            {revealedIds.size}
            <span style={{ color: "#1e293b", fontWeight: 500, fontSize: 16 }}> / {revealSequence.length}</span>
          </p>
        </div>
      </div>

      {/* ── Groups grid ── */}
      <div style={{
        position: "relative", zIndex: 1,
        padding: "20px 20px 24px",
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 10,
      }}>
        {groups.map(g => (
          <GroupColumn
            key={g.groupName}
            group={g}
            revealedIds={revealedIds}
            flashGroup={flashGroup}
          />
        ))}
      </div>

      {/* ── Centre stage overlay (visible while drawing) ── */}
      {showCard && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 60,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: "rgba(3,6,15,0.82)",
          backdropFilter: "blur(6px)",
          animation: "fadeIn 0.25s ease",
        }}>
          {/* Spotlight ring */}
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background: "radial-gradient(ellipse 50% 60% at 50% 50%, rgba(34,211,238,0.06) 0%, transparent 70%)",
          }} />
          <DrawCard pair={showCard} flipped={cardFlipped} />
        </div>
      )}

      {/* ── Fixed controls bar ── */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
        padding: "14px 24px",
        background: "rgba(3,6,15,0.97)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", gap: 10,
        backdropFilter: "blur(8px)",
      }}>
        {!allDone ? (
          <>
            {/* Draw Next */}
            <button
              onClick={drawNext}
              disabled={isDrawing || autoPlay}
              style={{
                padding: "11px 26px",
                background: isDrawing || autoPlay ? "transparent" : "#22d3ee",
                color: isDrawing || autoPlay ? "#22d3ee" : "#030f14",
                border: "2px solid #22d3ee",
                borderRadius: 12, fontSize: 13, fontWeight: 800,
                cursor: isDrawing || autoPlay ? "not-allowed" : "pointer",
                transition: "all 0.2s", flexShrink: 0,
                opacity: isDrawing || autoPlay ? 0.5 : 1,
              }}
            >
              {isDrawing ? "Drawing…" : `Draw Next  (${remaining} left)`}
            </button>

            {/* Auto-draw toggle */}
            <button
              onClick={() => setAutoPlay(a => !a)}
              disabled={isDrawing && !autoPlay}
              style={{
                padding: "11px 20px",
                background: autoPlay ? "rgba(251,191,36,0.12)" : "rgba(255,255,255,0.05)",
                color: autoPlay ? "#fbbf24" : "#64748b",
                border: `2px solid ${autoPlay ? "#fbbf24" : "rgba(255,255,255,0.08)"}`,
                borderRadius: 12, fontSize: 13, fontWeight: 700,
                cursor: "pointer", transition: "all 0.2s", flexShrink: 0,
              }}
            >
              {autoPlay ? "⏸  Pause" : "▶  Auto Draw"}
            </button>

            {/* Progress bar */}
            <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden", minWidth: 60 }}>
              <div style={{
                height: "100%", borderRadius: 4,
                background: "linear-gradient(90deg, #22d3ee, #60a5fa)",
                width: `${revealSequence.length ? (revealedIds.size / revealSequence.length) * 100 : 0}%`,
                transition: "width 0.5s ease",
              }} />
            </div>
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>🎉</span>
              <span style={{ color: "#34d399", fontSize: 14, fontWeight: 700 }}>
                All {revealSequence.length} pairs drawn!
              </span>
            </div>
            <button
              onClick={() => revealMut.mutate()}
              disabled={revealMut.isPending}
              style={{
                padding: "11px 28px",
                background: revealMut.isPending ? "rgba(52,211,153,0.2)" : "#34d399",
                color: revealMut.isPending ? "#34d399" : "#030f0a",
                border: "2px solid #34d399",
                borderRadius: 12, fontSize: 13, fontWeight: 800,
                cursor: revealMut.isPending ? "not-allowed" : "pointer",
              }}
            >
              {revealMut.isPending ? "Publishing…" : "Publish Groups →"}
            </button>
          </>
        )}

        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          style={{
            marginLeft: "auto",
            padding: "11px 18px",
            background: "transparent", color: "#475569",
            border: "2px solid rgba(255,255,255,0.06)",
            borderRadius: 12, fontSize: 13, fontWeight: 600,
            cursor: "pointer", flexShrink: 0,
          }}
        >← Back</button>
      </div>

      {/* CSS keyframes */}
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-10px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        /* Mobile: 2-column groups */
        @media (max-width: 700px) {
          .duo-groups-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
      `}</style>
    </div>
  )
}