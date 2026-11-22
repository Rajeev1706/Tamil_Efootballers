// pages/FinalsPage.jsx
// Public + admin view of the set-based finals — shows all sets, matchups, scores
import { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "../lib/api"
import { useAuth } from "../lib/auth"   // adjust path if needed

const SET_ACCENTS = ["#22d3ee", "#a78bfa", "#34d399", "#fb923c", "#f472b6"]

function hexRgb(hex) {
  const v = parseInt(hex.replace("#", ""), 16)
  return `${(v >> 16) & 255},${(v >> 8) & 255},${v & 255}`
}

// ── Score input row for a matchup ─────────────────────────────────────────────
function MatchupRow({ matchup, accent, onSave, isSaving }) {
  const rgb   = hexRgb(accent)
  const done  = matchup.status === "completed"
  const [s1, setS1] = useState(matchup.team1_score ?? "")
  const [s2, setS2] = useState(matchup.team2_score ?? "")

  const winner = done
    ? (matchup.team1_score > matchup.team2_score ? "t1"
     : matchup.team2_score > matchup.team1_score ? "t2" : "draw")
    : null

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "12px 14px", borderRadius: 10,
      background: done ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.05)",
      border: `1px solid ${done ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.09)"}`,
      marginBottom: 6,
    }}>
      {/* Player 1 */}
      <div style={{ flex: 1, textAlign: "left" }}>
        <p style={{
          margin: 0, fontSize: 13, fontWeight: 700,
          color: winner === "t1" ? accent : winner === "t2" ? "#475569" : "white",
        }}>{matchup.team1_player_name}</p>
      </div>

      {/* Scores */}
      {!done ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <input
            type="number" min="0" value={s1}
            onChange={e => setS1(e.target.value)}
            style={{ width: 44, textAlign: "center", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "6px", color: "white", fontSize: 14, fontWeight: 700, outline: "none" }}
          />
          <span style={{ color: "#334155", fontSize: 12, fontWeight: 700 }}>–</span>
          <input
            type="number" min="0" value={s2}
            onChange={e => setS2(e.target.value)}
            style={{ width: 44, textAlign: "center", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "6px", color: "white", fontSize: 14, fontWeight: 700, outline: "none" }}
          />
          <button
            onClick={() => onSave(matchup.id, Number(s1), Number(s2))}
            disabled={isSaving || s1 === "" || s2 === ""}
            style={{
              padding: "7px 14px", background: `rgba(${rgb},0.15)`,
              color: accent, border: `1px solid rgba(${rgb},0.4)`,
              borderRadius: 8, fontSize: 12, fontWeight: 700,
              cursor: isSaving || s1 === "" || s2 === "" ? "not-allowed" : "pointer",
              flexShrink: 0, opacity: s1 === "" || s2 === "" ? 0.4 : 1,
            }}
          >{isSaving ? "…" : "Save"}</button>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span style={{
            fontSize: 16, fontWeight: 900, fontVariantNumeric: "tabular-nums",
            color: winner === "t1" ? accent : "#94a3b8",
            textShadow: winner === "t1" ? `0 0 12px rgba(${rgb},0.5)` : "none",
          }}>{matchup.team1_score}</span>
          <span style={{ color: "#334155", fontSize: 12 }}>–</span>
          <span style={{
            fontSize: 16, fontWeight: 900, fontVariantNumeric: "tabular-nums",
            color: winner === "t2" ? "#f87171" : "#94a3b8",
            textShadow: winner === "t2" ? "0 0 12px rgba(248,113,113,0.5)" : "none",
          }}>{matchup.team2_score}</span>
        </div>
      )}

      {/* Player 2 */}
      <div style={{ flex: 1, textAlign: "right" }}>
        <p style={{
          margin: 0, fontSize: 13, fontWeight: 700,
          color: winner === "t2" ? "#f87171" : winner === "t1" ? "#475569" : "white",
        }}>{matchup.team2_player_name}</p>
      </div>
    </div>
  )
}

// ── Set card ──────────────────────────────────────────────────────────────────
function SetCard({ set, accent, isAdmin, onSaveScore, isSaving }) {
  const rgb        = hexRgb(accent)
  const done       = set.status === "completed"
  const matchups   = set.matchups || []
  const t1Wins     = matchups.filter(m => m.status === "completed" && m.team1_score > m.team2_score).length
  const t2Wins     = matchups.filter(m => m.status === "completed" && m.team2_score > m.team1_score).length
  const totalDone  = matchups.filter(m => m.status === "completed").length

  return (
    <div style={{
      borderRadius: 16, overflow: "hidden",
      border: `1px solid ${done ? `rgba(${rgb},0.3)` : "rgba(255,255,255,0.08)"}`,
      background: done ? `rgba(${rgb},0.04)` : "rgba(255,255,255,0.025)",
      marginBottom: 16,
    }}>
      {/* Set header */}
      <div style={{
        padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", gap: 12,
        background: `rgba(${rgb},0.07)`,
      }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: accent, boxShadow: `0 0 8px ${accent}` }} />
        <span style={{ color: accent, fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1 }}>Set {set.set_number}</span>
        <span style={{ color: "#334155", fontSize: 11 }}>{totalDone}/{matchups.length} played</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: accent }}>{t1Wins}W</span>
          <span style={{ color: "#1e293b", fontSize: 12 }}>·</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#f87171" }}>{t2Wins}W</span>
        </div>
        {done && (
          <span style={{ padding: "3px 10px", borderRadius: 20, background: `rgba(${rgb},0.15)`, color: accent, fontSize: 10, fontWeight: 700, border: `1px solid rgba(${rgb},0.3)` }}>
            DONE
          </span>
        )}
      </div>

      {/* Matchups */}
      <div style={{ padding: "12px 14px" }}>
        {matchups.length === 0 && (
          <p style={{ color: "#334155", fontSize: 13, textAlign: "center", margin: "12px 0" }}>Draw not done yet</p>
        )}
        {matchups.map(m => (
          <MatchupRow
            key={m.id}
            matchup={m}
            accent={accent}
            onSave={(mid, s1, s2) => onSaveScore(set.id, mid, s1, s2)}
            isSaving={isSaving}
          />
        ))}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function FinalsPage() {
  const { configId } = useParams()
  const navigate     = useNavigate()
  const queryClient  = useQueryClient()
  const { user }     = useAuth?.() || {}
  const isAdmin      = user?.role === "admin"

  const { data, isLoading, error } = useQuery({
    queryKey: ["finals-sets", configId],
    queryFn: () => api.get(`/finals-sets/${configId}`).then(r => r.data),
    enabled: !!configId,
  })

  const config = data?.config

  const [savingSet, setSavingSet] = useState(null)

  const scoreMut = useMutation({
    mutationFn: ({ setId, matchupId, t1, t2 }) =>
      api.post(`/finals-sets/${configId}/set/${setId}/score`, {
        scores: [{ matchupId, team1Score: t1, team2Score: t2 }],
      }).then(r => r.data),
    onSuccess: (d) => {
      queryClient.setQueryData(["finals-sets", configId], d)
      setSavingSet(null)
    },
    onError: (e) => { alert(e?.response?.data?.error || "Failed to save score"); setSavingSet(null) },
  })

  const forceWinnerMut = useMutation({
    mutationFn: (teamId) => api.post(`/finals-sets/${configId}/force-winner`, { winnerTeamId: teamId }).then(r => r.data),
    onSuccess: (d) => queryClient.setQueryData(["finals-sets", configId], d),
    onError: (e) => alert(e?.response?.data?.error || "Failed"),
  })

  function handleSaveScore(setId, matchupId, t1, t2) {
    setSavingSet(setId)
    scoreMut.mutate({ setId, matchupId, t1, t2 })
  }

  if (isLoading) return (
    <div style={{ minHeight: "100vh", background: "#03060f", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#334155", fontSize: 14, letterSpacing: 2, textTransform: "uppercase" }}>Loading Finals…</p>
    </div>
  )

  if (error || !config) return (
    <div style={{ minHeight: "100vh", background: "#03060f", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#ef4444" }}>Finals not found.</p>
    </div>
  )

  // Tally totals
  const allMatchups = (config.sets || []).flatMap(s => s.matchups || [])
  const done        = allMatchups.filter(m => m.status === "completed")

  // Count wins per team (need to know which team each player belongs to)
  // We rely on set.players to map player_id → team_id
  let t1Wins = 0, t2Wins = 0
  for (const set of config.sets || []) {
    const players = set.players || []
    // Build a map player_id → team_id for this set
    const playerTeam = {}
    players.forEach(p => { playerTeam[p.player_id] = p.team_id })

    for (const m of set.matchups || []) {
      if (m.status !== "completed" || !m.winner_player_id) continue
      const winnerTeam = playerTeam[m.winner_player_id]
      // We need team1_id and team2_id from the match
      // We'll use a simple heuristic: check team of team1_player vs team2_player
      const t1Team = playerTeam[m.team1_player_id]
      const t2Team = playerTeam[m.team2_player_id]
      if (winnerTeam === t1Team) t1Wins++
      else if (winnerTeam === t2Team) t2Wins++
    }
  }

  const isCompleted = config.status === "completed"
  const needsDecision = isCompleted && !config.winner_team_id

  // Get team names from players in first set
  const firstSetPlayers = config.sets?.[0]?.players || []
  const teamIds  = [...new Set(firstSetPlayers.map(p => p.team_id))]
  const team1Id  = teamIds[0]
  const team2Id  = teamIds[1]
  const team1Name = firstSetPlayers.find(p => p.team_id === team1Id)?.team_name || "Team 1"
  const team2Name = firstSetPlayers.find(p => p.team_id === team2Id)?.team_name || "Team 2"

  return (
    <div style={{ minHeight: "100vh", background: "#03060f", color: "white", fontFamily: "system-ui,-apple-system,sans-serif" }}>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 80% 40% at 50% 0%, rgba(34,211,238,0.055) 0%, transparent 65%)", zIndex: 0 }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 800, margin: "0 auto", padding: "32px 20px" }}>
        {/* Back */}
        <button onClick={() => navigate(-1)} style={{ padding: "8px 16px", background: "transparent", color: "#64748b", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, fontSize: 13, cursor: "pointer", marginBottom: 24 }}>← Back</button>

        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <p style={{ color: "#334155", fontSize: 11, textTransform: "uppercase", letterSpacing: 4, margin: "0 0 8px" }}>Tamil Efootballers · Finals</p>
          <h1 style={{ fontSize: 28, fontWeight: 900, margin: "0 0 6px" }}>
            {team1Name} <span style={{ color: "#334155" }}>vs</span> {team2Name}
          </h1>
          <p style={{ color: "#475569", fontSize: 13, margin: 0 }}>
            {config.num_sets} Sets · {allMatchups.length} 1v1 Matches
          </p>
        </div>

        {/* Score summary */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 20,
          padding: "20px 24px", borderRadius: 16, marginBottom: 28,
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
        }}>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: 1, margin: "0 0 4px" }}>{team1Name}</p>
            <p style={{ fontSize: 48, fontWeight: 900, margin: 0, color: "#22d3ee", fontVariantNumeric: "tabular-nums" }}>{t1Wins}</p>
          </div>
          <div style={{ textAlign: "center", padding: "0 12px" }}>
            <p style={{ fontSize: 11, color: "#334155", margin: "0 0 4px" }}>1v1 wins</p>
            <div style={{ width: 1, height: 40, background: "rgba(255,255,255,0.08)", margin: "0 auto" }} />
          </div>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: 1, margin: "0 0 4px" }}>{team2Name}</p>
            <p style={{ fontSize: 48, fontWeight: 900, margin: 0, color: "#f87171", fontVariantNumeric: "tabular-nums" }}>{t2Wins}</p>
          </div>
        </div>

        {/* Winner banner */}
        {isCompleted && config.winner_team_id && (
          <div style={{
            padding: "16px 20px", borderRadius: 14, marginBottom: 24, textAlign: "center",
            background: "linear-gradient(135deg,rgba(52,211,153,0.12),rgba(34,211,238,0.08))",
            border: "1px solid rgba(52,211,153,0.3)",
          }}>
            <p style={{ margin: 0, fontSize: 11, color: "#34d399", textTransform: "uppercase", letterSpacing: 2 }}>🏆 Winner</p>
            <p style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 900, color: "white" }}>
              {config.winner_team_id === team1Id ? team1Name : team2Name}
            </p>
          </div>
        )}

        {/* Needs decision */}
        {isCompleted && needsDecision && isAdmin && (
          <div style={{ padding: "16px 20px", borderRadius: 14, marginBottom: 24, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)" }}>
            <p style={{ margin: "0 0 12px", color: "#fbbf24", fontWeight: 700, fontSize: 14 }}>⚠️ Tie — Admin must pick winner</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => forceWinnerMut.mutate(team1Id)} style={{ flex: 1, padding: "10px", background: "rgba(34,211,238,0.15)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.3)", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                {team1Name} wins
              </button>
              <button onClick={() => forceWinnerMut.mutate(team2Id)} style={{ flex: 1, padding: "10px", background: "rgba(248,113,113,0.15)", color: "#f87171", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                {team2Name} wins
              </button>
            </div>
          </div>
        )}

        {/* Admin reveal link */}
        {isAdmin && config.status === "setup" && (
          <div style={{ marginBottom: 20, textAlign: "center" }}>
            <button
              onClick={() => navigate(`/finals/reveal/${configId}`)}
              style={{ padding: "12px 28px", background: "#22d3ee", color: "#030f14", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: "pointer" }}
            >
              🎲 Start Draw Reveal
            </button>
          </div>
        )}

        {/* Sets */}
        {(config.sets || []).map((set, i) => (
          <SetCard
            key={set.id}
            set={set}
            accent={SET_ACCENTS[i % SET_ACCENTS.length]}
            isAdmin={isAdmin}
            onSaveScore={handleSaveScore}
            isSaving={savingSet === set.id && scoreMut.isPending}
          />
        ))}
      </div>
    </div>
  )
}