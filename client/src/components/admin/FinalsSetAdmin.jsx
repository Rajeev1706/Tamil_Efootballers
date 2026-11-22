// components/admin/FinalsSetAdmin.jsx
// Admin panel: configure set-based finals for qualifier2, final, champions_final, europa_final
import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import api from "../../lib/api"

const MATCH_OPTIONS = [
  { label: "League Playoff — Qualifier 2",   source: "team_league_playoffs",   matchType: "qualifier2" },
  { label: "League Playoff — Final",         source: "team_league_playoffs",   matchType: "final"      },
  { label: "UCL Knockout — Champions Final", source: "team_knockout_matches",  matchType: "champions_final" },
  { label: "UCL Knockout — Europa Final",    source: "team_knockout_matches",  matchType: "europa_final"    },
]

const ACCENT = "#22d3ee"

function PlayerPicker({ label, players, selected, onChange, disabledIds = [] }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ color: "#94a3b8", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 8px" }}>
        {label}
      </p>
      <div style={{
        maxHeight: 200, overflowY: "auto",
        border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10,
        background: "rgba(0,0,0,0.3)",
      }}>
        {players.map(p => {
          const isSel = selected.includes(p.id)
          const isDisabled = disabledIds.includes(p.id) && !isSel
          return (
            <div
              key={p.id}
              onClick={() => {
                if (isDisabled) return
                onChange(isSel ? selected.filter(id => id !== p.id) : [...selected, p.id])
              }}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 12px",
                cursor: isDisabled ? "not-allowed" : "pointer",
                background: isSel ? "rgba(34,211,238,0.12)" : "transparent",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
                opacity: isDisabled ? 0.3 : 1,
                transition: "background 0.15s",
              }}
            >
              <div style={{
                width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                border: `2px solid ${isSel ? ACCENT : "rgba(255,255,255,0.2)"}`,
                background: isSel ? ACCENT : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {isSel && <span style={{ fontSize: 10, color: "#000", fontWeight: 900 }}>✓</span>}
              </div>
              <span style={{ fontSize: 13, color: isSel ? "white" : "#94a3b8" }}>{p.name}</span>
              <span style={{ marginLeft: "auto", fontSize: 10, color: "#475569" }}>{p.grade}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function FinalsSetAdmin() {
  const navigate    = useNavigate()
  const queryClient = useQueryClient()

  const [selectedOption, setSelectedOption] = useState(null)  // MATCH_OPTIONS item
  const [matchRow,       setMatchRow]       = useState(null)
  const [numSets,        setNumSets]        = useState(3)
  const [setSize,        setSetSize]        = useState(3)      // per set, same for all
  const [setsConfig,     setSetsConfig]     = useState([])     // [{ setNumber, t1Sel, t2Sel }]
  const [configId,       setConfigId]       = useState(null)
  const [step,           setStep]           = useState("match") // match | config | players | done

  // Fetch current season
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get("/settings").then(r => r.data),
  })
  const season = Number(settings?.current_season || 1)

  // Fetch match row once option is selected
  const { data: matchData, isLoading: matchLoading } = useQuery({
    queryKey: ["finals-match", selectedOption?.source, selectedOption?.matchType, season],
    queryFn: async () => {
      if (!selectedOption) return null
      const table = selectedOption.source
      const res = await api.get(`/finals-sets/match-lookup?source=${table}&matchType=${selectedOption.matchType}&season=${season}`)
      return res.data
    },
    enabled: !!selectedOption && !!season,
  })

  useEffect(() => {
    if (matchData?.match) setMatchRow(matchData.match)
  }, [matchData])

  // Fetch teams' players
  const { data: team1PlayersData } = useQuery({
    queryKey: ["players", matchRow?.team1_id],
    queryFn: () => api.get(`/players?teamId=${matchRow.team1_id}`).then(r => r.data),
    enabled: !!matchRow?.team1_id,
  })
  const { data: team2PlayersData } = useQuery({
    queryKey: ["players", matchRow?.team2_id],
    queryFn: () => api.get(`/players?teamId=${matchRow.team2_id}`).then(r => r.data),
    enabled: !!matchRow?.team2_id,
  })
  const team1Players = Array.isArray(team1PlayersData) ? team1PlayersData : (team1PlayersData?.players || [])
  const team2Players = Array.isArray(team2PlayersData) ? team2PlayersData : (team2PlayersData?.players || [])

  // Create config
  const createConfig = useMutation({
    mutationFn: (body) => api.post("/finals-sets/create", body).then(r => r.data),
    onSuccess: (data) => {
      setConfigId(data.config.id)
      // Init setsConfig state
      const init = data.config.sets.map(s => ({ setId: s.id, setNumber: s.set_number, t1Sel: [], t2Sel: [] }))
      setSetsConfig(init)
      setStep("players")
    },
    onError: (e) => alert(e?.response?.data?.error || "Failed to create config"),
  })

  // Save players
  const savePlayers = useMutation({
    mutationFn: (body) => api.post(`/finals-sets/${configId}/players`, body).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finals-sets", configId] })
      setStep("done")
    },
    onError: (e) => alert(e?.response?.data?.error || "Failed to save players"),
  })

  // All selected player ids across all sets (for disabling in other sets)
  const allT1Selected = setsConfig.flatMap(s => s.t1Sel)
  const allT2Selected = setsConfig.flatMap(s => s.t2Sel)

  function handleCreateConfig() {
    if (!matchRow) return alert("No match found for this category and season")
    const sets = Array.from({ length: numSets }, (_, i) => ({ setSize }))
    createConfig.mutate({
      matchId: matchRow.id,
      matchSource: selectedOption.source,
      numSets,
      sets,
      seasonNumber: season,
    })
    setStep("config-creating")
  }

  function handleSavePlayers() {
    // Validate
    for (const s of setsConfig) {
      if (s.t1Sel.length !== setSize || s.t2Sel.length !== setSize) {
        return alert(`Set ${s.setNumber} needs exactly ${setSize} players from each team`)
      }
    }
    const setsPlayers = setsConfig.map(s => ({
      setId:       s.setId,
      team1Id:     matchRow.team1_id,
      team2Id:     matchRow.team2_id,
      team1Players: s.t1Sel,
      team2Players: s.t2Sel,
    }))
    savePlayers.mutate({ setsPlayers })
  }

  const S = { // styles
    page:    { minHeight: "100vh", background: "#03060f", color: "white", fontFamily: "system-ui,-apple-system,sans-serif", padding: "32px 24px" },
    card:    { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20, marginBottom: 16 },
    label:   { color: "#94a3b8", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 },
    input:   { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 14px", color: "white", fontSize: 14, width: "100%", outline: "none" },
    btn:     (c="#22d3ee") => ({ padding: "12px 28px", background: c, color: c === "#22d3ee" ? "#030f14" : "white", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: "pointer" }),
    btnGhost:{ padding: "12px 28px", background: "transparent", color: "#64748b", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer" },
  }

  return (
    <div style={S.page}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <button onClick={() => navigate(-1)} style={{ ...S.btnGhost, padding: "8px 16px", fontSize: 13, marginBottom: 16 }}>← Back</button>
          <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0 }}>Finals Set Format Setup</h1>
          <p style={{ color: "#475569", fontSize: 14, margin: "6px 0 0" }}>
            Configure the set-based 1v1 format for qualifier 2, finals and knockout finals
          </p>
        </div>

        {/* Step: Select match */}
        {(step === "match" || step === "config" || step === "config-creating") && (
          <div style={S.card}>
            <p style={{ ...S.label }}>Select match</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {MATCH_OPTIONS.map(opt => (
                <div
                  key={opt.matchType}
                  onClick={() => { setSelectedOption(opt); setMatchRow(null); setStep("config") }}
                  style={{
                    padding: "12px 16px", borderRadius: 12, cursor: "pointer",
                    border: `1px solid ${selectedOption?.matchType === opt.matchType ? ACCENT : "rgba(255,255,255,0.08)"}`,
                    background: selectedOption?.matchType === opt.matchType ? "rgba(34,211,238,0.08)" : "rgba(255,255,255,0.02)",
                    transition: "all 0.15s",
                  }}
                >
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: selectedOption?.matchType === opt.matchType ? ACCENT : "white" }}>{opt.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step: Config (num sets, set size) */}
        {step === "config" && selectedOption && (
          <div style={S.card}>
            {matchLoading && <p style={{ color: "#475569" }}>Loading match…</p>}
            {matchRow && (
              <div style={{ marginBottom: 16, padding: "12px 16px", background: "rgba(34,211,238,0.06)", borderRadius: 10, border: "1px solid rgba(34,211,238,0.2)" }}>
                <p style={{ margin: 0, fontSize: 13, color: ACCENT, fontWeight: 700 }}>
                  Match found — Season {season}
                </p>
                <p style={{ margin: "4px 0 0", color: "#94a3b8", fontSize: 12 }}>
                  {matchRow.team1_name} vs {matchRow.team2_name}
                </p>
              </div>
            )}
            {matchData && !matchRow && (
              <p style={{ color: "#ef4444", fontSize: 13 }}>No match found for this category in season {season}</p>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
              <div>
                <label style={S.label}>Number of sets</label>
                <select value={numSets} onChange={e => setNumSets(Number(e.target.value))} style={{ ...S.input }}>
                  {[2,3,4,5].map(n => <option key={n} value={n}>{n} sets</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Players per set (each team)</label>
                <select value={setSize} onChange={e => setSetSize(Number(e.target.value))} style={{ ...S.input }}>
                  {[2,3,4,5].map(n => <option key={n} value={n}>{n} players</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginTop: 16, padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 10, fontSize: 12, color: "#64748b" }}>
              Total 1v1 matches: {numSets} sets × {setSize} matchups = <strong style={{ color: "#94a3b8" }}>{numSets * setSize} matches</strong>
            </div>

            <button
              onClick={handleCreateConfig}
              disabled={!matchRow || createConfig.isPending}
              style={{ ...S.btn(), marginTop: 20, opacity: !matchRow ? 0.4 : 1 }}
            >
              {createConfig.isPending ? "Creating…" : "Continue → Assign Players"}
            </button>
          </div>
        )}

        {/* Step: Assign players */}
        {step === "players" && configId && matchRow && (
          <>
            <div style={{ marginBottom: 16, padding: "12px 16px", background: "rgba(34,211,238,0.06)", borderRadius: 10, border: "1px solid rgba(34,211,238,0.2)", display: "flex", justifyContent: "space-between" }}>
              <div>
                <p style={{ margin: 0, fontSize: 13, color: ACCENT, fontWeight: 700 }}>{matchRow.team1_name} vs {matchRow.team2_name}</p>
                <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 12 }}>{numSets} sets · {setSize} players per team per set · {numSets * setSize} total matches</p>
              </div>
              <div style={{ textAlign: "right", fontSize: 11, color: "#475569" }}>
                Config ID: {configId}
              </div>
            </div>

            {setsConfig.map((s, si) => (
              <div key={s.setId} style={{ ...S.card, border: "1px solid rgba(255,255,255,0.1)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: ACCENT }}>Set {s.setNumber}</p>
                  <span style={{
                    fontSize: 11, padding: "3px 10px", borderRadius: 20,
                    background: (s.t1Sel.length === setSize && s.t2Sel.length === setSize) ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.05)",
                    color: (s.t1Sel.length === setSize && s.t2Sel.length === setSize) ? "#34d399" : "#475569",
                    border: `1px solid ${(s.t1Sel.length === setSize && s.t2Sel.length === setSize) ? "rgba(52,211,153,0.3)" : "rgba(255,255,255,0.08)"}`,
                  }}>
                    {s.t1Sel.length}/{setSize} · {s.t2Sel.length}/{setSize}
                  </span>
                </div>

                <div style={{ display: "flex", gap: 16 }}>
                  <PlayerPicker
                    label={matchRow.team1_name}
                    players={team1Players}
                    selected={s.t1Sel}
                    disabledIds={allT1Selected.filter(id => !s.t1Sel.includes(id))}
                    onChange={val => setSetsConfig(prev => prev.map((x, i) => i === si ? { ...x, t1Sel: val.slice(0, setSize) } : x))}
                  />
                  <div style={{ width: 1, background: "rgba(255,255,255,0.06)" }} />
                  <PlayerPicker
                    label={matchRow.team2_name}
                    players={team2Players}
                    selected={s.t2Sel}
                    disabledIds={allT2Selected.filter(id => !s.t2Sel.includes(id))}
                    onChange={val => setSetsConfig(prev => prev.map((x, i) => i === si ? { ...x, t2Sel: val.slice(0, setSize) } : x))}
                  />
                </div>
              </div>
            ))}

            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={handleSavePlayers}
                disabled={savePlayers.isPending}
                style={S.btn()}
              >
                {savePlayers.isPending ? "Saving…" : "Save Players & Continue to Reveal →"}
              </button>
            </div>
          </>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <div style={{ ...S.card, textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h2 style={{ margin: "0 0 8px", color: "#34d399" }}>Setup Complete!</h2>
            <p style={{ color: "#64748b", margin: "0 0 24px" }}>Players assigned. Ready for the draw reveal.</p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                onClick={() => navigate(`/finals/reveal/${configId}`)}
                style={S.btn()}
              >
                🎲 Start Set Reveal →
              </button>
              <button
                onClick={() => navigate(`/finals/${configId}`)}
                style={S.btnGhost}
              >
                View Finals Page
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}