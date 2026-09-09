import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Trophy, ChevronDown, ChevronUp, Plus, Trash2, Check, Download, Loader2 } from "lucide-react"
import api, { teamsApi } from "../../lib/api"
import { cn } from "../../lib/utils"
import { useCachedImage } from "../../hooks/useCachedImage"

import teamLeagueTrophy from "../../../images/Team League.png"
import championshipImg  from "../../../images/championship.png"

// ── Common budget setter ───────────────────────────────────────────────────────
function BulkBudgetCard() {
  const qc = useQueryClient()
  const [budget, setBudget] = useState("")
  const [saved, setSaved]   = useState(false)

  const mut = useMutation({
    mutationFn: (b) => teamsApi.bulkBudget(b),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams"] })
      qc.refetchQueries({ queryKey: ["teams"] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  return (
    <div className="card p-5">
      <p className="text-sm font-bold text-white mb-1">Common Auction Budget</p>
      <p className="text-xs text-slate-500 mb-4">Sets the auction starting budget for every team. Also updates the active auction session's budget per team.</p>
      <div className="flex items-center gap-3">
        <span className="text-slate-400 text-sm">₹</span>
        <input
          type="number"
          value={budget}
          onChange={e => setBudget(e.target.value)}
          placeholder="e.g. 1000"
          className="bg-pitch-900 border border-surface-border rounded-lg px-3 py-2 text-sm text-white w-36 focus:outline-none focus:border-accent/40"
        />
        <button
          onClick={() => mut.mutate(Number(budget))}
          disabled={!budget || mut.isPending}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors",
            saved
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              : "bg-accent text-white hover:bg-accent/90 disabled:opacity-50"
          )}
        >
          {saved ? <><Check className="w-4 h-4" /> Applied!</> : "Apply to all teams"}
        </button>
      </div>
    </div>
  )
}


// ── Squad image generator ─────────────────────────────────────────────────────
async function downloadSquadImage(team) {
  // Fetch players for this team
  const res     = await api.get(`/players?teamId=${team.id}`)
  const players = res.data || []

  // Captain first, then sort by auction price desc
  const captain = players.find(p => p.isCaptain)
  const rest    = players
    .filter(p => !p.isCaptain)
    .sort((a, b) => (b.auctionPrice ?? 0) - (a.auctionPrice ?? 0))
  const ordered = [...(captain ? [captain] : []), ...rest]

  // Canvas setup
  const W = 700, ROW_H = 44, HEADER = 180, FOOTER = 40
  const H = HEADER + ordered.length * ROW_H + FOOTER
  const canvas = document.createElement("canvas")
  canvas.width  = W
  canvas.height = H
  const ctx = canvas.getContext("2d")

  // Background — try to load team logo as blurred bg
  if (team.logoUrl) {
    try {
      const img = await new Promise((res, rej) => {
        const i = new Image(); i.crossOrigin = "anonymous"
        i.onload = () => res(i); i.onerror = rej
        i.src = team.logoUrl
      })
      ctx.save()
      ctx.filter = "blur(40px) brightness(0.25)"
      ctx.drawImage(img, -100, -100, W + 200, H + 200)
      ctx.restore()
      ctx.filter = "none"
    } catch (_) {}
  }

  // Dark overlay
  ctx.fillStyle = "rgba(10,14,23,0.82)"
  ctx.fillRect(0, 0, W, H)

  // Team logo (circle)
  if (team.logoUrl) {
    try {
      const img = await new Promise((res, rej) => {
        const i = new Image(); i.crossOrigin = "anonymous"
        i.onload = () => res(i); i.onerror = rej
        i.src = team.logoUrl
      })
      ctx.save()
      ctx.beginPath()
      ctx.arc(W / 2, 62, 44, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(img, W / 2 - 44, 18, 88, 88)
      ctx.restore()
    } catch (_) {}
  }

  // Team name
  ctx.fillStyle = "#ffffff"
  ctx.font      = "bold 26px sans-serif"
  ctx.textAlign = "center"
  ctx.fillText(team.name, W / 2, 134)

  // Column headers
  const Y_HEAD = HEADER - 10
  ctx.fillStyle = "#64748b"
  ctx.font      = "bold 11px sans-serif"
  ctx.textAlign = "left"
  ctx.fillText("#",         36, Y_HEAD)
  ctx.fillText("PLAYER",    72, Y_HEAD)
  ctx.textAlign = "right"
  ctx.fillText("AUCTION ₹", W - 152, Y_HEAD)
  ctx.fillText("MV ₹",      W - 36,  Y_HEAD)

  // Divider
  ctx.strokeStyle = "#1e293b"
  ctx.lineWidth   = 1
  ctx.beginPath(); ctx.moveTo(24, HEADER - 2); ctx.lineTo(W - 24, HEADER - 2); ctx.stroke()

  // Player rows
  ordered.forEach((p, i) => {
    const y       = HEADER + i * ROW_H
    const isCap   = p.isCaptain
    const isEven  = i % 2 === 0

    // Row bg
    ctx.fillStyle = isEven ? "rgba(255,255,255,0.03)" : "transparent"
    ctx.fillRect(24, y + 4, W - 48, ROW_H - 2)

    // Serial
    ctx.fillStyle = "#475569"
    ctx.font      = "bold 12px monospace"
    ctx.textAlign = "left"
    ctx.fillText(String(i + 1).padStart(2, "0"), 36, y + ROW_H / 2 + 5)

    // Captain badge
    if (isCap) {
      ctx.fillStyle = "#f59e0b"
      ctx.font      = "bold 9px sans-serif"
      ctx.fillText("C", 62, y + ROW_H / 2 + 4)
    }

    // Player name
    ctx.fillStyle = isCap ? "#f59e0b" : "#f1f5f9"
    ctx.font      = isCap ? "bold 14px sans-serif" : "500 14px sans-serif"
    ctx.textAlign = "left"
    ctx.fillText(p.name, 72, y + ROW_H / 2 + 5)

    // Grade badge
    const gradeColors = { S: "#f59e0b", "A+": "#a78bfa", A: "#60a5fa", B: "#34d399", C: "#94a3b8" }
    ctx.fillStyle = gradeColors[p.grade] || "#94a3b8"
    ctx.font      = "bold 10px sans-serif"
    ctx.textAlign = "left"
    ctx.fillText(p.grade, 220, y + ROW_H / 2 + 5)

    // Auction price
    ctx.fillStyle = "#f97316"
    ctx.font      = "bold 13px monospace"
    ctx.textAlign = "right"
    ctx.fillText(p.auctionPrice > 0 ? `₹${p.auctionPrice}` : "—", W - 152, y + ROW_H / 2 + 5)

    // Market value
    ctx.fillStyle = "#22d3ee"
    ctx.font      = "bold 13px monospace"
    ctx.textAlign = "right"
    ctx.fillText(p.marketValue > 0 ? `₹${p.marketValue}` : "—", W - 36, y + ROW_H / 2 + 5)

    // Row divider
    ctx.strokeStyle = "#1e293b"
    ctx.lineWidth   = 0.5
    ctx.beginPath(); ctx.moveTo(24, y + ROW_H); ctx.lineTo(W - 24, y + ROW_H); ctx.stroke()
  })

  // Footer
  ctx.fillStyle = "#334155"
  ctx.font      = "11px sans-serif"
  ctx.textAlign = "center"
  ctx.fillText("Tamil Efootballers · Season 8", W / 2, H - 14)

  // Download
  const link    = document.createElement("a")
  link.download = `${team.name.replace(/\s+/g, "_")}_squad.png`
  link.href     = canvas.toDataURL("image/png")
  link.click()
}

// ── Per-team trophy manager ────────────────────────────────────────────────────
function TeamCard({ team }) {
  const qc           = useQueryClient()
  const logoSrc      = useCachedImage(team.logoUrl)
  const [open, setOpen]         = useState(false)
  const [downloading, setDl]    = useState(false)

  async function handleDownload(e) {
    e.stopPropagation()
    setDl(true)
    try { await downloadSquadImage({ ...team, logoUrl: team.logoUrl }) }
    finally { setDl(false) }
  }

  // Fetch trophies for this team when expanded
  const { data, isLoading } = useQuery({
    queryKey: ["team-trophies", String(team.id)],
    queryFn:  () => api.get(`/team-trophies/${team.id}`).then(r => r.data),
    enabled:  open,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ["team-trophies", String(team.id)] })

  // Add trophy
  const addMut = useMutation({
    mutationFn: ({ tournament, seasonNumber }) =>
      api.post("/team-trophies", { teamId: team.id, seasonNumber, tournament }).then(r => r.data),
    onSuccess: invalidate,
  })

  // Remove trophy
  const delMut = useMutation({
    mutationFn: (id) => api.delete(`/team-trophies/${id}`).then(r => r.data),
    onSuccess: invalidate,
  })

  const [tlSeason, setTlSeason]   = useState("")
  const [chSeason, setChSeason]   = useState("")

  const trophies        = data?.trophies || []
  const teamLeagueWins  = trophies.filter(t => t.tournament === "team_league")
  const championshipWins = trophies.filter(t => t.tournament === "championship")

  return (
    <div className="card overflow-hidden">
      {/* Team row */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors"
      >
        {logoSrc
          ? <img src={logoSrc} alt={team.name} className="w-9 h-9 rounded-xl object-cover border border-surface-border flex-shrink-0" />
          : <div className="w-9 h-9 rounded-xl bg-pitch-800 border border-surface-border flex items-center justify-center text-xs font-bold text-slate-400 flex-shrink-0">
              {team.name?.slice(0, 2).toUpperCase()}
            </div>
        }
        <div className="flex-1 text-left min-w-0">
          <p className="font-bold text-white text-sm">{team.name}</p>
          <p className="text-xs text-slate-500">{team.playerCount ?? "—"} players · Budget ₹{team.budget ?? 1000}</p>
        </div>
        <div className="flex items-center gap-3 mr-2">
          {teamLeagueWins.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-accent font-semibold">
              <img src={teamLeagueTrophy} className="w-4 h-4 object-contain" /> {teamLeagueWins.length}
            </span>
          )}
          {championshipWins.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-gold font-semibold">
              <img src={championshipImg} className="w-4 h-4 object-contain" /> {championshipWins.length}
            </span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-500 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" />}
      </button>

      {/* Expanded trophy management */}
      {open && (
        <div className="border-t border-surface-border px-4 py-4 space-y-5 bg-pitch-900/30">
          {isLoading ? (
            <p className="text-xs text-slate-500 text-center py-4">Loading...</p>
          ) : (
            <>
              {/* Team League */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <img src={teamLeagueTrophy} className="w-5 h-5 object-contain" />
                  <p className="text-xs font-bold text-white">Dshann League Titles</p>
                  <span className="text-xs text-accent font-bold ml-1">{teamLeagueWins.length}</span>
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {teamLeagueWins.length === 0
                    ? <span className="text-xs text-slate-600">None yet</span>
                    : teamLeagueWins.map(t => (
                      <div key={t.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-accent/30 bg-accent/10">
                        <span className="text-xs font-bold text-accent">Season {t.season_number}{t.year ? ` · ${t.year}` : ""}</span>
                        <button onClick={() => delMut.mutate(t.id)} className="text-slate-500 hover:text-rose-400 transition-colors">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))
                  }
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number" placeholder="Season #" value={tlSeason}
                    onChange={e => setTlSeason(e.target.value)}
                    className="bg-pitch-800 border border-surface-border rounded-lg px-3 py-1.5 text-xs text-white w-24 focus:outline-none focus:border-accent/40"
                  />
                  <button
                    onClick={() => { addMut.mutate({ tournament: "team_league", seasonNumber: Number(tlSeason) }); setTlSeason("") }}
                    disabled={!tlSeason || addMut.isPending}
                    className="flex items-center gap-1 bg-accent/20 text-accent border border-accent/30 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-accent/30 disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Title
                  </button>
                </div>
              </div>

              {/* Championship */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <img src={championshipImg} className="w-5 h-5 object-contain" />
                  <p className="text-xs font-bold text-white">Team of Champions</p>
                  <span className="text-xs text-gold font-bold ml-1">{championshipWins.length}</span>
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {championshipWins.length === 0
                    ? <span className="text-xs text-slate-600">None yet</span>
                    : championshipWins.map(t => (
                      <div key={t.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gold/30 bg-gold/10">
                        <span className="text-xs font-bold text-gold">Season {t.season_number}{t.year ? ` · ${t.year}` : ""}</span>
                        <button onClick={() => delMut.mutate(t.id)} className="text-slate-500 hover:text-rose-400 transition-colors">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))
                  }
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number" placeholder="Season #" value={chSeason}
                    onChange={e => setChSeason(e.target.value)}
                    className="bg-pitch-800 border border-surface-border rounded-lg px-3 py-1.5 text-xs text-white w-24 focus:outline-none focus:border-gold/40"
                  />
                  <button
                    onClick={() => { addMut.mutate({ tournament: "championship", seasonNumber: Number(chSeason) }); setChSeason("") }}
                    disabled={!chSeason || addMut.isPending}
                    className="flex items-center gap-1 bg-gold/10 text-gold border border-gold/30 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gold/20 disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Title
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function AdminTeamsTab() {
  const { data: teams = [], isLoading } = useQuery({
    queryKey: ["teams"],
    queryFn:  teamsApi.list,
  })

  return (
    <div className="space-y-6">

      {/* Common budget setter */}
      <div>
        <p className="section-label mb-3">Common Budget</p>
        <BulkBudgetCard />
      </div>

      {/* Per-team trophy management */}
      <div>
        <p className="section-label mb-3">Teams — Trophy Management</p>
        <p className="text-xs text-slate-500 mb-4">
          Trophies are awarded automatically when finals are logged. Use this to manually correct or add entries if the auto-award fails.
        </p>
        {isLoading ? (
          <p className="text-sm text-slate-500 text-center py-8">Loading teams...</p>
        ) : (
          <div className="space-y-2">
            {teams.map(team => <TeamCard key={team.id} team={team} />)}
          </div>
        )}
      </div>
    </div>
  )
}