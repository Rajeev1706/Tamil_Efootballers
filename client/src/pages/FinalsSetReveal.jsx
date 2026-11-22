// pages/FinalsSetReveal.jsx
// Animated reveal page for finals set matchups — set by set, matchup by matchup
import { useState, useEffect, useCallback, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "../lib/api"
import logoUrl from "../../images/logo.png"

const SET_ACCENTS = ["#22d3ee", "#a78bfa", "#34d399", "#fb923c", "#f472b6"]

function hexRgb(hex) {
  const v = parseInt(hex.replace("#", ""), 16)
  return `${(v >> 16) & 255},${(v >> 8) & 255},${v & 255}`
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ── Flip card for a matchup ───────────────────────────────────────────────────
function MatchupCard({ matchup, flipped, accent }) {
  const rgb = hexRgb(accent)
  return (
    <div style={{ perspective: 900, width: 300, height: 200 }}>
      <div style={{
        width: "100%", height: "100%", position: "relative",
        transformStyle: "preserve-3d",
        transition: "transform 0.75s cubic-bezier(0.4,0,0.2,1)",
        transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
      }}>
        {/* Face down */}
        <div style={{
          position: "absolute", inset: 0, backfaceVisibility: "hidden",
          borderRadius: 20,
          background: "linear-gradient(145deg,#0c1424 0%,#111827 100%)",
          border: "2px solid rgba(255,255,255,0.08)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 12,
        }}>
          <div style={{ fontSize: 40, opacity: 0.2 }}>⚔️</div>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.15)", letterSpacing: 3, textTransform: "uppercase", margin: 0 }}>Drawing…</p>
        </div>

        {/* Face up — matchup revealed */}
        <div style={{
          position: "absolute", inset: 0, backfaceVisibility: "hidden",
          transform: "rotateY(180deg)", borderRadius: 20,
          background: "linear-gradient(145deg,#080f1e 0%,#0d1627 100%)",
          border: `2px solid ${accent}`,
          boxShadow: `0 0 48px rgba(${rgb},0.35), 0 0 0 1px rgba(${rgb},0.15) inset`,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 10, padding: "20px 24px",
        }}>
          <span style={{
            fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 2,
            color: accent, background: `rgba(${rgb},0.15)`,
            border: `1px solid rgba(${rgb},0.4)`, padding: "3px 12px", borderRadius: 20,
          }}>{matchup.setLabel}</span>

          <div style={{ display: "flex", alignItems: "center", gap: 16, width: "100%", justifyContent: "center" }}>
            <div style={{ textAlign: "center", flex: 1 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, margin: "0 auto 8px",
                background: `rgba(${rgb},0.18)`, border: `2px solid rgba(${rgb},0.35)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, fontWeight: 900, color: accent,
              }}>{matchup.team1PlayerName.slice(0,2).toUpperCase()}</div>
              <p style={{ fontSize: 13, fontWeight: 800, color: "white", margin: 0, lineHeight: 1.3 }}>
                {matchup.team1PlayerName}
              </p>
              <p style={{ fontSize: 10, color: "#475569", margin: "3px 0 0" }}>{matchup.team1Name}</p>
            </div>

            <div style={{ fontSize: 20, color: "#334155", fontWeight: 900, flexShrink: 0 }}>VS</div>

            <div style={{ textAlign: "center", flex: 1 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, margin: "0 auto 8px",
                background: "rgba(248,113,113,0.18)", border: "2px solid rgba(248,113,113,0.35)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, fontWeight: 900, color: "#f87171",
              }}>{matchup.team2PlayerName.slice(0,2).toUpperCase()}</div>
              <p style={{ fontSize: 13, fontWeight: 800, color: "white", margin: 0, lineHeight: 1.3 }}>
                {matchup.team2PlayerName}
              </p>
              <p style={{ fontSize: 10, color: "#475569", margin: "3px 0 0" }}>{matchup.team2Name}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Set column showing matchups as they're revealed ───────────────────────────
function SetColumn({ set, revealedMatchupIds, flashSetId, accent }) {
  const rgb    = hexRgb(accent)
  const isFlash = flashSetId === set.id
  const revealed = set.matchups.filter(m => revealedMatchupIds.has(m.id))
  const emptySlots = (set.set_size || 3) - revealed.length

  return (
    <div style={{
      borderRadius: 14, overflow: "hidden", flex: 1,
      background: isFlash ? `rgba(${rgb},0.08)` : "rgba(255,255,255,0.025)",
      border: `1px solid ${isFlash ? accent : "rgba(255,255,255,0.06)"}`,
      boxShadow: isFlash ? `0 0 28px rgba(${rgb},0.25)` : "none",
      transition: "all 0.35s ease",
    }}>
      {/* Header */}
      <div style={{
        padding: "10px 14px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", gap: 8,
        background: isFlash ? `rgba(${rgb},0.1)` : "rgba(255,255,255,0.02)",
      }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: accent, boxShadow: isFlash ? `0 0 10px ${accent}` : "none", transition: "box-shadow 0.3s" }} />
        <span style={{ color: accent, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1 }}>
          Set {set.set_number}
        </span>
        <span style={{ marginLeft: "auto", color: "#334155", fontSize: 10 }}>
          {revealed.length}/{set.set_size || 3}
        </span>
      </div>

      {/* Matchups */}
      <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 5 }}>
        {revealed.map(m => (
          <div key={m.id} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 10px", borderRadius: 9,
            background: "rgba(255,255,255,0.05)",
            animation: "slideIn 0.45s cubic-bezier(0.22,1,0.36,1)",
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "white", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {m.team1_player_name}
            </span>
            <span style={{ fontSize: 9, color: "#334155", fontWeight: 600, flexShrink: 0 }}>VS</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "white", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right" }}>
              {m.team2_player_name}
            </span>
          </div>
        ))}
        {Array.from({ length: emptySlots }).map((_, i) => (
          <div key={`e-${i}`} style={{ height: 36, borderRadius: 9, border: "1px dashed rgba(255,255,255,0.05)" }} />
        ))}
      </div>
    </div>
  )
}

// ── Main reveal page ──────────────────────────────────────────────────────────
export default function FinalsSetReveal() {
  const { configId } = useParams()
  const navigate     = useNavigate()
  const queryClient  = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ["finals-sets", configId],
    queryFn: () => api.get(`/finals-sets/${configId}`).then(r => r.data),
    enabled: !!configId,
  })

  const config = data?.config

  // Draw all undone sets on backend before reveal
  const drawMut = useMutation({
    mutationFn: async () => {
      for (const set of (config?.sets || [])) {
        if (set.status === "pending") {
          await api.post(`/finals-sets/${configId}/set/${set.id}/draw`)
        }
      }
      return api.get(`/finals-sets/${configId}`).then(r => r.data)
    },
    onSuccess: (d) => {
      queryClient.setQueryData(["finals-sets", configId], d)
    },
  })

  // Build flat reveal sequence: set by set, matchup by matchup
  const revealSequence = (() => {
    if (!config?.sets) return []
    return config.sets.flatMap(set =>
      (set.matchups || []).map(m => ({
        matchupId:        m.id,
        setId:            set.id,
        setNumber:        set.set_number,
        setLabel:         `Set ${set.set_number}`,
        team1PlayerName:  m.team1_player_name,
        team2PlayerName:  m.team2_player_name,
        team1Name:        set.players?.find(p => p.player_id === m.team1_player_id)?.team_name || "",
        team2Name:        set.players?.find(p => p.player_id === m.team2_player_id)?.team_name || "",
      }))
    )
  })()

  const [started,     setStarted]     = useState(false)
  const [drawnSets,   setDrawnSets]   = useState(false)
  const [revealStep,  setRevealStep]  = useState(0)
  const [isDrawing,   setIsDrawing]   = useState(false)
  const [showCard,    setShowCard]    = useState(null)
  const [cardFlipped, setCardFlipped] = useState(false)
  const [revealedIds, setRevealedIds] = useState(new Set())
  const [flashSetId,  setFlashSetId]  = useState(null)
  const [autoPlay,    setAutoPlay]    = useState(false)
  const [allDone,     setAllDone]     = useState(false)
  const drawingRef = useRef(false)

  // Run draws before showing intro
  useEffect(() => {
    if (config && !drawnSets) {
      setDrawnSets(true)
      drawMut.mutate()
    }
  }, [config])

  const drawNext = useCallback(async () => {
    if (drawingRef.current) return
    const item = revealSequence[revealStep]
    if (!item) return

    drawingRef.current = true
    setIsDrawing(true)
    setShowCard(item)
    setCardFlipped(false)

    await sleep(700)
    setCardFlipped(true)
    await sleep(1400)

    setRevealedIds(prev => new Set([...prev, item.matchupId]))
    setFlashSetId(item.setId)

    await sleep(500)
    setFlashSetId(null)
    await sleep(200)
    setShowCard(null)
    setCardFlipped(false)

    const next = revealStep + 1
    setRevealStep(next)
    drawingRef.current = false
    setIsDrawing(false)

    if (next >= revealSequence.length) setAllDone(true)
  }, [revealStep, revealSequence])

  useEffect(() => {
    if (!autoPlay || isDrawing || allDone) return
    const t = setTimeout(() => drawNext(), 700)
    return () => clearTimeout(t)
  }, [autoPlay, isDrawing, allDone, revealStep, drawNext])

  if (isLoading || drawMut.isPending) return (
    <div style={{ minHeight: "100vh", background: "#03060f", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <img src={logoUrl} style={{ width: 56, height: 56, objectFit: "contain", opacity: 0.4, marginBottom: 16 }} />
        <p style={{ color: "#334155", fontSize: 14, letterSpacing: 2, textTransform: "uppercase" }}>
          {drawMut.isPending ? "Preparing draw…" : "Loading…"}
        </p>
      </div>
    </div>
  )

  if (error || !config) return (
    <div style={{ minHeight: "100vh", background: "#03060f", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#ef4444" }}>Config not found.</p>
    </div>
  )

  // ── Intro screen ──────────────────────────────────────────────────────────────
  if (!started) return (
    <div style={{
      minHeight: "100vh", background: "#03060f",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: "system-ui,-apple-system,sans-serif", color: "white", padding: "24px",
      position: "relative",
    }}>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 70% 50% at 50% 50%, rgba(34,211,238,0.07) 0%, transparent 70%)" }} />
      <div style={{ position: "relative", zIndex: 1, textAlign: "center", maxWidth: 480 }}>
        <img src={logoUrl} style={{ width: 64, height: 64, objectFit: "contain", opacity: 0.9, marginBottom: 24 }} />
        <p style={{ fontSize: 11, color: "#334155", textTransform: "uppercase", letterSpacing: 4, margin: "0 0 10px" }}>
          Tamil Efootballers · Finals
        </p>
        <h1 style={{ fontSize: 32, fontWeight: 900, margin: "0 0 6px" }}>Set Draw Reveal</h1>
        <p style={{ fontSize: 15, color: "#475569", margin: "0 0 32px" }}>
          {config.num_sets} Sets · {revealSequence.length} Matchups
        </p>

        <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap", marginBottom: 36 }}>
          {config.sets.map((s, i) => {
            const accent = SET_ACCENTS[i % SET_ACCENTS.length]
            return (
              <div key={s.id} style={{
                padding: "5px 14px", borderRadius: 20,
                background: `rgba(${hexRgb(accent)},0.1)`,
                border: `1px solid rgba(${hexRgb(accent)},0.3)`,
                fontSize: 11, fontWeight: 700, color: accent, letterSpacing: 1,
              }}>
                Set {s.set_number} · {s.set_size} matches
              </div>
            )
          })}
        </div>

        <button
          onClick={() => setStarted(true)}
          style={{
            padding: "16px 52px",
            background: "linear-gradient(135deg, #22d3ee, #60a5fa)",
            color: "#030f14", border: "none", borderRadius: 14,
            fontSize: 16, fontWeight: 900, letterSpacing: 0.5, cursor: "pointer",
            boxShadow: "0 0 40px rgba(34,211,238,0.35)",
          }}
        >▶ Start Reveal</button>
        <button onClick={() => navigate(-1)} style={{ display: "block", margin: "18px auto 0", background: "transparent", color: "#334155", border: "none", fontSize: 13, cursor: "pointer" }}>
          ← Back
        </button>
      </div>
    </div>
  )

  const remaining = revealSequence.length - revealStep

  return (
    <div style={{ minHeight: "100vh", background: "#03060f", color: "white", fontFamily: "system-ui,-apple-system,sans-serif", position: "relative", paddingBottom: 80 }}>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 90% 45% at 50% 0%, rgba(34,211,238,0.055) 0%, transparent 65%)", zIndex: 0 }} />

      {/* Header */}
      <div style={{ position: "relative", zIndex: 1, padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 16, background: "rgba(3,6,15,0.8)", backdropFilter: "blur(8px)" }}>
        <img src={logoUrl} style={{ width: 36, height: 36, objectFit: "contain", flexShrink: 0 }} />
        <div>
          <p style={{ color: "#334155", fontSize: 10, textTransform: "uppercase", letterSpacing: 3, margin: "0 0 2px" }}>Tamil Efootballers · Finals</p>
          <p style={{ color: "white", fontSize: 17, fontWeight: 800, margin: 0 }}>Set Draw Reveal</p>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <p style={{ color: "#334155", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 2px" }}>Revealed</p>
          <p style={{ color: "white", fontSize: 22, fontWeight: 900, fontVariantNumeric: "tabular-nums", margin: 0, lineHeight: 1 }}>
            {revealedIds.size}<span style={{ color: "#1e293b", fontWeight: 500, fontSize: 16 }}> / {revealSequence.length}</span>
          </p>
        </div>
      </div>

      {/* Sets grid */}
      <div style={{ position: "relative", zIndex: 1, padding: "20px", display: "flex", gap: 12, overflowX: "auto" }}>
        {config.sets.map((set, i) => (
          <SetColumn
            key={set.id}
            set={set}
            revealedMatchupIds={revealedIds}
            flashSetId={flashSetId}
            accent={SET_ACCENTS[i % SET_ACCENTS.length]}
          />
        ))}
      </div>

      {/* Centre overlay card */}
      {showCard && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 60,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          background: "rgba(3,6,15,0.85)", backdropFilter: "blur(6px)",
          animation: "fadeIn 0.25s ease",
        }}>
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 50% 60% at 50% 50%, rgba(34,211,238,0.06) 0%, transparent 70%)" }} />
          <MatchupCard
            matchup={showCard}
            flipped={cardFlipped}
            accent={SET_ACCENTS[(showCard.setNumber - 1) % SET_ACCENTS.length]}
          />
        </div>
      )}

      {/* Controls bar */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
        padding: "12px 24px", background: "rgba(3,6,15,0.97)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", gap: 10,
        backdropFilter: "blur(8px)",
      }}>
        {!allDone ? (
          <>
            <button
              onClick={drawNext}
              disabled={isDrawing || autoPlay}
              style={{
                padding: "11px 24px",
                background: isDrawing || autoPlay ? "transparent" : "#22d3ee",
                color: isDrawing || autoPlay ? "#22d3ee" : "#030f14",
                border: "2px solid #22d3ee", borderRadius: 12,
                fontSize: 13, fontWeight: 800, cursor: isDrawing || autoPlay ? "not-allowed" : "pointer",
                opacity: isDrawing || autoPlay ? 0.5 : 1, flexShrink: 0,
              }}
            >{isDrawing ? "Drawing…" : `Draw Next (${remaining} left)`}</button>

            <button
              onClick={() => setAutoPlay(a => !a)}
              style={{
                padding: "11px 20px",
                background: autoPlay ? "rgba(251,191,36,0.12)" : "rgba(255,255,255,0.05)",
                color: autoPlay ? "#fbbf24" : "#64748b",
                border: `2px solid ${autoPlay ? "#fbbf24" : "rgba(255,255,255,0.08)"}`,
                borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0,
              }}
            >{autoPlay ? "⏸ Pause" : "▶ Auto"}</button>

            <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden", minWidth: 60 }}>
              <div style={{ height: "100%", borderRadius: 4, background: "linear-gradient(90deg,#22d3ee,#60a5fa)", width: `${revealSequence.length ? (revealedIds.size / revealSequence.length) * 100 : 0}%`, transition: "width 0.5s ease" }} />
            </div>
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 20 }}>🎉</span>
            <span style={{ color: "#34d399", fontSize: 14, fontWeight: 700 }}>All matchups drawn!</span>
            <button
              onClick={() => navigate(`/finals/${configId}`)}
              style={{ padding: "11px 24px", background: "#34d399", color: "#030f0a", border: "none", borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: "pointer" }}
            >Go to Finals Page →</button>
          </div>
        )}
        <button onClick={() => navigate(-1)} style={{ marginLeft: "auto", padding: "11px 16px", background: "transparent", color: "#475569", border: "2px solid rgba(255,255,255,0.06)", borderRadius: 12, fontSize: 13, cursor: "pointer", flexShrink: 0 }}>← Back</button>
      </div>

      <style>{`
        @keyframes slideIn { from { opacity:0; transform:translateY(-10px) scale(0.97); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes fadeIn  { from { opacity:0; } to { opacity:1; } }
      `}</style>
    </div>
  )
}