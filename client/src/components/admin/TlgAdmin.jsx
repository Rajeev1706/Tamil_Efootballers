/**
 * TlgAdmin.jsx — Admin panel for Dshann League Group Knockout format.
 * Tabs: Setup → Group Stage → Knockout
 */
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Users, Trophy, Swords, Plus, Trash2, ChevronRight, CheckCircle, Clock, AlertTriangle } from "lucide-react"
import {
  useTlgCurrent, useTlgList, useTlgCreate, useTlgDraw,
  useTlgSaveFixture, useTlgGenerateKnockout, useTlgSaveKnockout, useTlgDelete,
} from "../../lib/queries"
import { useTeams } from "../../lib/queries"
import { cn } from "../../lib/utils"
import { TeamLogoIcon } from "../common/TeamLogo"

const PHASE_LABELS = {
  champions_sf1:   "Semi-Final 1 (A1 vs B2)",
  champions_sf2:   "Semi-Final 2 (B1 vs A2)",
  champions_final: "🏆 Final",
  third_place:     "3rd Place",
  europa_qr1:      "Europa QR 1 (A3 vs B4)",
  europa_qr2:      "Europa QR 2 (B3 vs A4)",
  europa_final:    "🌍 Europa Final",
  seventh_place:   "7th Place",
}

// ── Fixture row with score entry ──────────────────────────────────────────────
function FixtureRow({ fixture, onSave, onClear }) {
  const [editing, setEditing]       = useState(false)
  const [homeScore, setHomeScore]   = useState("")
  const [awayScore, setAwayScore]   = useState("")
  const [walkoverMode, setWalkoverMode] = useState(false)
  const [saving, setSaving]         = useState(false)

  const isDone = fixture.status === "completed"

  function openEdit() {
    setHomeScore(isDone ? fixture.home_score : "")
    setAwayScore(isDone ? fixture.away_score : "")
    setWalkoverMode(false)
    setEditing(true)
  }

  async function handleSave(isWalkover = false, woHome = false) {
    setSaving(true)
    try {
      const h = isWalkover ? (woHome ? 0 : 3) : parseInt(homeScore)
      const a = isWalkover ? (woHome ? 3 : 0) : parseInt(awayScore)
      await onSave(fixture.id, h, a, isWalkover)
      setEditing(false)
    } finally { setSaving(false) }
  }

  const canSave = homeScore !== "" && awayScore !== ""

  return (
    <div className="border-b border-surface-border/50 last:border-0">
      {!editing ? (
        <div className="flex items-center gap-3 px-4 py-3 hover:bg-pitch-800/30 transition-colors">
          <span className="text-xs text-slate-600 w-6">{fixture.round}</span>
          <span className="flex-1 text-sm text-white truncate">{fixture.homeTeamName}</span>
          <div className="flex-shrink-0">
            {isDone ? (
              fixture.is_walkover ? (
                <span className="text-xs font-bold text-orange-400 bg-orange-400/10 border border-orange-400/25 px-2 py-0.5 rounded">WO</span>
              ) : (
                <span className="text-sm font-mono font-bold text-white bg-pitch-900 px-2 py-0.5 rounded">
                  {fixture.home_score} – {fixture.away_score}
                </span>
              )
            ) : (
              <span className="text-xs text-slate-600">vs</span>
            )}
          </div>
          <span className="flex-1 text-sm text-white text-right truncate">{fixture.awayTeamName}</span>
          <button onClick={openEdit} className="text-xs text-slate-500 hover:text-accent transition-colors ml-2">
            {isDone ? "✎ Edit" : "+ Score"}
          </button>
          {isDone && (
            <button onClick={() => onClear(fixture.id)} className="text-xs text-slate-600 hover:text-rose-400 transition-colors">✕</button>
          )}
        </div>
      ) : (
        <div className="px-4 py-3 bg-pitch-800/40 space-y-2">
          {walkoverMode ? (
            <>
              <p className="text-xs text-orange-400 font-semibold text-center">Who gave the walkover?</p>
              <div className="flex gap-2">
                <button onClick={() => handleSave(true, true)} disabled={saving}
                  className="flex-1 text-xs py-2 rounded-lg bg-orange-400/15 text-orange-400 border border-orange-400/30 font-semibold">
                  {fixture.homeTeamName}
                </button>
                <button onClick={() => handleSave(true, false)} disabled={saving}
                  className="flex-1 text-xs py-2 rounded-lg bg-orange-400/15 text-orange-400 border border-orange-400/30 font-semibold">
                  {fixture.awayTeamName}
                </button>
              </div>
              <button onClick={() => setWalkoverMode(false)} className="w-full text-xs py-1.5 rounded-lg border border-surface-border text-slate-400">← Back</button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white flex-1 truncate">{fixture.homeTeamName}</span>
                <input type="number" min="0" value={homeScore} onChange={e => setHomeScore(e.target.value)} placeholder="0"
                  className="w-12 text-center bg-pitch-900 border border-surface-border rounded-lg py-1.5 text-sm text-white font-mono focus:outline-none focus:border-accent/40" />
                <span className="text-slate-600 text-xs">–</span>
                <input type="number" min="0" value={awayScore} onChange={e => setAwayScore(e.target.value)} placeholder="0"
                  className="w-12 text-center bg-pitch-900 border border-surface-border rounded-lg py-1.5 text-sm text-white font-mono focus:outline-none focus:border-accent/40" />
                <span className="text-xs text-white flex-1 text-right truncate">{fixture.awayTeamName}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditing(false)} className="text-xs py-1.5 px-3 rounded-lg border border-surface-border text-slate-400">Cancel</button>
                <button onClick={() => setWalkoverMode(true)} className="text-xs py-1.5 px-3 rounded-lg bg-orange-400/10 text-orange-400 border border-orange-400/25 font-semibold">Walkover</button>
                <button onClick={() => handleSave(false)} disabled={!canSave || saving}
                  className="flex-1 text-xs py-1.5 rounded-lg bg-accent/20 text-accent border border-accent/30 font-semibold disabled:opacity-40">
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Knockout match row ────────────────────────────────────────────────────────
function KnockoutRow({ phase, match, seasonId, onSave }) {
  const [editing, setEditing]       = useState(false)
  const [homeScore, setHomeScore]   = useState("")
  const [awayScore, setAwayScore]   = useState("")
  const [walkoverMode, setWalkoverMode] = useState(false)
  const [saving, setSaving]         = useState(false)

  const isDone = match?.status === "completed"
  const hasBoth = match?.home_team_id && match?.away_team_id

  async function handleSave(isWalkover = false, woHome = false) {
    setSaving(true)
    try {
      const h = isWalkover ? (woHome ? 0 : 3) : parseInt(homeScore)
      const a = isWalkover ? (woHome ? 3 : 0) : parseInt(awayScore)
      await onSave(phase, seasonId, h, a, isWalkover)
      setEditing(false)
    } finally { setSaving(false) }
  }

  const canSave = homeScore !== "" && awayScore !== ""

  return (
    <div className="card overflow-hidden mb-2">
      <div className="px-4 py-2.5 border-b border-surface-border/50 bg-pitch-800/40">
        <span className="text-xs font-semibold text-slate-400">{PHASE_LABELS[phase]}</span>
      </div>
      <div className="px-4 py-3">
        {!hasBoth ? (
          <p className="text-xs text-slate-600 text-center">Awaiting previous round results</p>
        ) : !editing ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 flex-1">
              {match.homeTeamLogo && <TeamLogoIcon src={match.homeTeamLogo} size="sm" />}
              <span className="text-sm text-white">{match.homeTeamName}</span>
            </div>
            <div className="flex-shrink-0">
              {isDone ? (
                match.is_walkover ? (
                  <span className="text-xs font-bold text-orange-400 bg-orange-400/10 border border-orange-400/25 px-2 py-0.5 rounded">WO</span>
                ) : (
                  <span className="text-sm font-mono font-bold text-white bg-pitch-900 px-3 py-1 rounded">
                    {match.home_score} – {match.away_score}
                  </span>
                )
              ) : (
                <span className="text-xs text-slate-600">vs</span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-1 justify-end">
              <span className="text-sm text-white">{match.awayTeamName}</span>
              {match.awayTeamLogo && <TeamLogoIcon src={match.awayTeamLogo} size="sm" />}
            </div>
            {!isDone && (
              <button onClick={() => { setEditing(true); setWalkoverMode(false) }}
                className="text-xs text-accent hover:text-accent-dim transition-colors ml-2">
                + Score
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {walkoverMode ? (
              <>
                <p className="text-xs text-orange-400 font-semibold text-center">Who gave the walkover?</p>
                <div className="flex gap-2">
                  <button onClick={() => handleSave(true, true)} disabled={saving}
                    className="flex-1 text-xs py-2 rounded-lg bg-orange-400/15 text-orange-400 border border-orange-400/30 font-semibold">{match.homeTeamName}</button>
                  <button onClick={() => handleSave(true, false)} disabled={saving}
                    className="flex-1 text-xs py-2 rounded-lg bg-orange-400/15 text-orange-400 border border-orange-400/30 font-semibold">{match.awayTeamName}</button>
                </div>
                <button onClick={() => setWalkoverMode(false)} className="w-full text-xs py-1.5 rounded-lg border border-surface-border text-slate-400">← Back</button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white flex-1">{match.homeTeamName}</span>
                  <input type="number" min="0" value={homeScore} onChange={e => setHomeScore(e.target.value)} placeholder="0"
                    className="w-12 text-center bg-pitch-900 border border-surface-border rounded-lg py-1.5 text-sm text-white font-mono focus:outline-none focus:border-accent/40" />
                  <span className="text-slate-600 text-xs">–</span>
                  <input type="number" min="0" value={awayScore} onChange={e => setAwayScore(e.target.value)} placeholder="0"
                    className="w-12 text-center bg-pitch-900 border border-surface-border rounded-lg py-1.5 text-sm text-white font-mono focus:outline-none focus:border-accent/40" />
                  <span className="text-sm text-white flex-1 text-right">{match.awayTeamName}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditing(false)} className="text-xs py-1.5 px-3 rounded-lg border border-surface-border text-slate-400">Cancel</button>
                  <button onClick={() => setWalkoverMode(true)} className="text-xs py-1.5 px-3 rounded-lg bg-orange-400/10 text-orange-400 border border-orange-400/25 font-semibold">Walkover</button>
                  <button onClick={() => handleSave(false)} disabled={!canSave || saving}
                    className="flex-1 text-xs py-1.5 rounded-lg bg-accent/20 text-accent border border-accent/30 font-semibold disabled:opacity-40">
                    {saving ? "Saving…" : "Save"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        {isDone && match.winnerName && (
          <p className="text-xs text-emerald-400 mt-2 font-semibold text-center">✓ {match.winnerName} advances</p>
        )}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function TlgAdmin() {
  const navigate          = useNavigate()
  const { data: tlg }     = useTlgCurrent()
  const { data: teams = [] } = useTeams()
  const createTlg         = useTlgCreate()
  const drawTlg           = useTlgDraw()
  const saveFixture       = useTlgSaveFixture()
  const generateKnockout  = useTlgGenerateKnockout()
  const saveKnockout      = useTlgSaveKnockout()
  const deleteTlg         = useTlgDelete()

  const [selectedTeams, setSelectedTeams] = useState([])
  const [tab, setTab]                     = useState("setup")
  const [confirmDel, setConfirmDel]       = useState(false)

  function toggleTeam(id) {
    setSelectedTeams(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : prev.length < 8 ? [...prev, id] : prev
    )
  }

  async function handleDraw() {
    if (selectedTeams.length !== 8) return
    await drawTlg.mutateAsync({ id: tlg.id, teamIds: selectedTeams })
    navigate(`/tlg-draw/${tlg.id}`)
  }

  const groupFixtures = (group) => {
    const byRound = {}
    for (const f of group.fixtures) {
      if (!byRound[f.round]) byRound[f.round] = []
      byRound[f.round].push(f)
    }
    return Object.entries(byRound).map(([round, fixtures]) => ({ round: parseInt(round), fixtures }))
  }

  const champions = ["champions_sf1", "champions_sf2", "champions_final", "third_place"]
  const europa    = ["europa_qr1", "europa_qr2", "europa_final", "seventh_place"]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-gold" />
          <h2 className="text-sm font-semibold text-white">Dshann League Group Knockout</h2>
          {tlg && (
            <span className={cn("text-xs px-2 py-0.5 rounded-full border font-semibold",
              tlg.status === "completed" ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/25" :
              tlg.status === "knockout"  ? "bg-accent/10 text-accent border-accent/25" :
                                           "bg-amber-400/10 text-amber-400 border-amber-400/25"
            )}>
              {tlg.status}
            </span>
          )}
        </div>
        {!tlg ? (
          <button onClick={() => createTlg.mutate()} disabled={createTlg.isPending}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-accent text-white border border-accent/50 hover:bg-accent-dim transition-colors">
            <Plus className="w-3.5 h-3.5" /> Create Season
          </button>
        ) : (
          <button onClick={() => setConfirmDel(true)} className="text-xs text-slate-500 hover:text-rose-400 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {confirmDel && (
        <div className="card px-4 py-3 flex items-center gap-3 border-rose-500/20 bg-rose-500/5">
          <p className="text-sm text-rose-400 flex-1">Delete this TLG season? This cannot be undone.</p>
          <button onClick={() => setConfirmDel(false)} className="text-xs px-3 py-1.5 rounded-lg border border-surface-border text-slate-400">Cancel</button>
          <button onClick={() => { deleteTlg.mutate(tlg.id); setConfirmDel(false) }}
            className="text-xs px-3 py-1.5 rounded-lg bg-rose-500 text-white font-semibold">Delete</button>
        </div>
      )}

      {!tlg ? (
        <div className="card px-6 py-10 text-center">
          <Trophy className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No TLG season for this season yet.</p>
          <p className="text-xs text-slate-600 mt-1">Create one to set up the group knockout format.</p>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex border-b border-surface-border">
            {[
              { id: "setup",    label: "Setup",        icon: Users   },
              { id: "groups",   label: "Group Stage",  icon: Swords  },
              { id: "knockout", label: "Knockout",      icon: Trophy  },
            ].map(t => {
              const Icon = t.icon
              return (
                <button key={t.id} onClick={() => setTab(t.id)} className={cn(
                  "flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold transition-colors",
                  tab === t.id ? "text-accent border-b-2 border-accent" : "text-slate-500 hover:text-white"
                )}>
                  <Icon className="w-4 h-4" /> {t.label}
                </button>
              )
            })}
          </div>

          {/* Setup tab — team selection */}
          {tab === "setup" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">Select exactly 8 teams for the draw. ({selectedTeams.length}/8 selected)</p>
                {selectedTeams.length === 8 && (
                  <button onClick={handleDraw} disabled={drawTlg.isPending}
                    className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-gold/20 text-gold border border-gold/30 font-semibold hover:bg-gold/30 transition-colors">
                    <ChevronRight className="w-4 h-4" /> Start Draw
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                {teams.map(team => {
                  const selected = selectedTeams.includes(team.id)
                  return (
                    <button key={team.id} onClick={() => toggleTeam(team.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left",
                        selected
                          ? "bg-accent/10 border-accent/40 text-white"
                          : "bg-pitch-800/40 border-surface-border text-slate-400 hover:text-white hover:border-surface-border/80"
                      )}>
                      <div className={cn(
                        "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                        selected ? "bg-accent border-accent" : "border-slate-600"
                      )}>
                        {selected && <CheckCircle className="w-3 h-3 text-white" />}
                      </div>
                      {team.logoUrl && <TeamLogoIcon src={team.logoUrl} size="sm" />}
                      <span className="text-sm font-medium">{team.name}</span>
                    </button>
                  )
                })}
              </div>
              {tlg.groups?.length > 0 && (
                <div className="card px-4 py-3 border-amber-400/20 bg-amber-400/5">
                  <p className="text-xs text-amber-400">Groups already drawn. Starting draw again will regenerate all fixtures.</p>
                  <button onClick={() => navigate(`/tlg-draw/${tlg.id}`)}
                    className="text-xs text-accent mt-1 hover:underline">
                    View current draw →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Group Stage tab */}
          {tab === "groups" && (
            <div className="space-y-4">
              {(!tlg.groups || tlg.groups.length === 0) ? (
                <div className="card px-6 py-8 text-center">
                  <p className="text-slate-400 text-sm">No groups yet. Set up teams and start the draw first.</p>
                </div>
              ) : (
                <>
                  {tlg.groups.map(group => (
                    <div key={group.id} className="card overflow-hidden">
                      {/* Group header with standings */}
                      <div className="px-5 py-3 border-b border-surface-border bg-pitch-800/40">
                        <p className="text-sm font-bold text-white">Group {group.name}</p>
                      </div>
                      {/* Mini standings */}
                      <div className="px-4 py-2">
                        <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 text-[10px] text-slate-600 font-semibold uppercase mb-1 px-1">
                          <span>Team</span><span>P</span><span>GD</span><span>GF</span><span>Pts</span>
                        </div>
                        {group.standings.map((t, i) => (
                          <div key={t.id} className={cn(
                            "grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-center px-1 py-1 rounded text-xs",
                            i < 2 ? "text-accent font-semibold" : i < 4 ? "text-amber-400" : "text-slate-400"
                          )}>
                            <span className="flex items-center gap-1.5">
                              <span className="text-[10px] text-slate-600 w-3">{i + 1}</span>
                              {t.name}
                            </span>
                            <span>{t.played}</span>
                            <span>{t.gd >= 0 ? "+" : ""}{t.gd}</span>
                            <span>{t.gf}</span>
                            <span className="font-bold text-white">{t.points}</span>
                          </div>
                        ))}
                        <p className="text-[10px] text-slate-600 mt-1 px-1">🔵 Top 2 → Champions · 🟡 Bottom 2 → Europa</p>
                      </div>
                    </div>
                  ))}

                  {/* Generate knockout button */}
                  {tlg.status === "group" && (
                    <button onClick={() => generateKnockout.mutate(tlg.id)} disabled={generateKnockout.isPending}
                      className="w-full py-3 rounded-xl bg-accent/15 text-accent border border-accent/30 text-sm font-semibold hover:bg-accent/25 transition-colors disabled:opacity-40">
                      {generateKnockout.isPending ? "Generating…" : "⚡ Generate Knockout Bracket"}
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Knockout tab */}
          {tab === "knockout" && (
            <div className="space-y-6">
              {(!tlg.knockout || Object.keys(tlg.knockout).length === 0) ? (
                <div className="card px-6 py-8 text-center">
                  <p className="text-slate-400 text-sm">Knockout bracket not generated yet.</p>
                  <p className="text-xs text-slate-600 mt-1">Complete the group stage then click Generate Knockout Bracket.</p>
                </div>
              ) : (
                <>
                  <div>
                    <p className="section-label mb-3">🏆 Champions Bracket</p>
                    {champions.map(phase => (
                      <KnockoutRow key={phase} phase={phase} match={tlg.knockout[phase]} seasonId={tlg.id}
                        onSave={(p, sid, h, a, wo) => saveKnockout.mutateAsync({ phase: p, seasonId: sid, homeScore: h, awayScore: a, isWalkover: wo })} />
                    ))}
                  </div>
                  <div>
                    <p className="section-label mb-3">🌍 Europa Bracket</p>
                    {europa.map(phase => (
                      <KnockoutRow key={phase} phase={phase} match={tlg.knockout[phase]} seasonId={tlg.id}
                        onSave={(p, sid, h, a, wo) => saveKnockout.mutateAsync({ phase: p, seasonId: sid, homeScore: h, awayScore: a, isWalkover: wo })} />
                    ))}
                  </div>
                  {tlg.knockout["seventh_place"]?.status === "completed" && (
                    <div className="card px-4 py-3 border-rose-400/20 bg-rose-400/5">
                      <p className="text-xs text-rose-400 font-semibold">
                        ❌ Relegated: {tlg.knockout["seventh_place"].home_score < tlg.knockout["seventh_place"].away_score
                          ? tlg.knockout["seventh_place"].homeTeamName
                          : tlg.knockout["seventh_place"].awayTeamName}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}