import { useState, useRef } from "react"
import { Check, CheckCircle, Lock, Pencil, Trash2, X, Save, Plus, Calendar, Download, RefreshCw } from "lucide-react"
import {
  useSaveFixtureResult, useUpdateFixture, useDeleteFixture,
  useCreateFixture, useTeams, useUpdateRoundDate, useCloseFixture,
  useGenerateSeasonFixtures, useChangeLeagueFormat, useLeagueFormat
} from "../../lib/queries"
import { cn } from "../../lib/utils"
import { toPng } from "html-to-image"
import logoUrl from "../../../images/logo.png"

// ── Generate Full Season ───────────────────────────────────────────────────
function GenerateSeasonCard({ hasExistingFixtures }) {
  const [step, setStep]     = useState("idle")
  const [format, setFormat] = useState(null)
  const [result, setResult] = useState(null)
  const generate = useGenerateSeasonFixtures()

  const handleGenerate = () => {
    generate.mutate({ format }, {
      onSuccess: (data) => { setResult(data); setStep("idle") },
      onError: (err) => alert(err.response?.data?.error || "Failed to generate fixtures"),
    })
  }

  const reset = () => { setStep("idle"); setFormat(null) }

  if (hasExistingFixtures) {
    return (
      <div className="card px-4 py-3 flex items-center gap-2 text-xs text-slate-500">
        <Lock className="w-3.5 h-3.5 flex-shrink-0" />
        Fixtures already exist for this season — delete them all first if you want to auto-generate a fresh double round-robin schedule instead.
      </div>
    )
  }

  if (step === "pick-format") {
    return (
      <div className="card px-5 py-4">
        <p className="text-sm font-semibold text-white mb-1">Choose competition format</p>
        <p className="text-xs text-slate-500 mb-4">This decides how the Team League champion is determined at the end of the season.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <button onClick={() => setFormat("league")}
            className={`rounded-xl border p-4 text-left transition-colors ${format === "league" ? "border-accent bg-accent/10" : "border-surface-border hover:border-accent/40"}`}>
            <p className="font-semibold text-white text-sm mb-1">League Only</p>
            <p className="text-xs text-slate-400">Top of the table at the end of the regular season wins. No playoff bracket.</p>
          </button>
          <button onClick={() => setFormat("league_knockout")}
            className={`rounded-xl border p-4 text-left transition-colors ${format === "league_knockout" ? "border-accent bg-accent/10" : "border-surface-border hover:border-accent/40"}`}>
            <p className="font-semibold text-white text-sm mb-1">League + Knockout</p>
            <p className="text-xs text-slate-400">Top 4 qualify for an IPL-style playoff (Q1, Eliminator, Q2, Final). Champion decided in the Final.</p>
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={reset} className="text-xs px-3 py-1.5 rounded-lg border border-surface-border text-slate-400">Cancel</button>
          <button onClick={() => format && setStep("confirm")} disabled={!format}
            className="text-xs px-3 py-1.5 rounded-lg bg-accent text-white font-semibold disabled:opacity-40">
            Next
          </button>
        </div>
      </div>
    )
  }

  if (step === "confirm") {
    return (
      <div className="card px-5 py-4">
        <p className="text-sm font-semibold text-white mb-1">Confirm generation</p>
        <p className="text-xs text-slate-400 mb-1">Format: <span className="text-white font-semibold">{format === "league" ? "League Only" : "League + Knockout"}</span></p>
        <p className="text-xs text-slate-500 mb-4">Every team plays every other team twice. Cannot be undone without deleting all fixtures.</p>
        <div className="flex gap-2">
          <button onClick={() => setStep("pick-format")} className="text-xs px-3 py-1.5 rounded-lg border border-surface-border text-slate-400">Back</button>
          <button onClick={handleGenerate} disabled={generate.isPending}
            className="text-xs px-3 py-1.5 rounded-lg bg-accent text-white font-semibold disabled:opacity-50">
            {generate.isPending ? "Generating..." : "Generate Fixtures"}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="card px-4 py-3.5 flex items-center justify-between gap-3 flex-wrap">
      <div>
        <p className="text-sm font-semibold text-white">Auto-generate full season</p>
        <p className="text-xs text-slate-500 mt-0.5">
          Every team plays every other team twice — home and away — with the second half mirroring the first.
        </p>
        {result && (
          <p className="text-xs text-emerald-400 mt-1">
            Generated {result.roundsGenerated} rounds ({result.format === "league" ? "League Only" : "League + Knockout"})
          </p>
        )}
      </div>
      <button onClick={() => setStep("pick-format")} className="btn-primary text-sm px-4 py-2">
        + Auto-generate schedule
      </button>
    </div>
  )
}

// ── Format Switcher ────────────────────────────────────────────────────────
function FormatSwitcherCard() {
  const { data, isLoading } = useLeagueFormat()
  const changeFormat = useChangeLeagueFormat()
  const [confirming, setConfirming] = useState(null)

  if (isLoading || !data || data.totalFixtures === 0) return null
  if (data.pendingFixtures === 0) return null

  const current = data.format || "league_knockout"
  const currentLabel = current === "league" ? "League Only" : "League + Knockout"

  const handleChange = (format) => {
    changeFormat.mutate(format, {
      onSuccess: () => setConfirming(null),
      onError: (err) => { alert(err.response?.data?.error || "Failed to change format"); setConfirming(null) },
    })
  }

  return (
    <div className="card px-4 py-3.5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-white flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            Competition format
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Currently: <span className="text-white font-semibold">{currentLabel}</span>
            {" · "}{data.pendingFixtures} fixture{data.pendingFixtures !== 1 ? "s" : ""} remaining
          </p>
          <p className="text-xs text-slate-600 mt-0.5">Can be changed until the last fixture is closed.</p>
        </div>
        {confirming ? (
          <div className="flex flex-col gap-2 items-end">
            <p className="text-xs text-slate-400">
              Switch to <span className="text-white font-semibold">{confirming === "league" ? "League Only" : "League + Knockout"}</span>?
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirming(null)}
                className="text-xs px-3 py-1.5 rounded-lg border border-surface-border text-slate-400">Cancel</button>
              <button onClick={() => handleChange(confirming)} disabled={changeFormat.isPending}
                className="text-xs px-3 py-1.5 rounded-lg bg-accent text-white font-semibold disabled:opacity-50">
                {changeFormat.isPending ? "Saving..." : "Confirm"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            {current !== "league" && (
              <button onClick={() => setConfirming("league")}
                className="text-xs px-3 py-1.5 rounded-lg border border-surface-border text-slate-300 hover:border-accent/40 transition-colors">
                Switch to League Only
              </button>
            )}
            {current !== "league_knockout" && (
              <button onClick={() => setConfirming("league_knockout")}
                className="text-xs px-3 py-1.5 rounded-lg border border-surface-border text-slate-300 hover:border-accent/40 transition-colors">
                Switch to League + Knockout
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}


function CreateFixtureForm({ teams }) {
  const [homeTeamId, setHomeTeamId] = useState("")
  const [awayTeamId, setAwayTeamId] = useState("")
  const [round, setRound]           = useState("")
  const [date, setDate]             = useState("")
  const [success, setSuccess]       = useState(false)
  const [open, setOpen]             = useState(false)
  const createFixture               = useCreateFixture()

  const canCreate = homeTeamId && awayTeamId && round && date && homeTeamId !== awayTeamId

  const handleCreate = () => {
    createFixture.mutate({
      homeTeamId: parseInt(homeTeamId),
      awayTeamId: parseInt(awayTeamId),
      round:      parseInt(round),
      date,
    }, {
      onSuccess: () => {
        setSuccess(true)
        setHomeTeamId("")
        setAwayTeamId("")
        setRound("")
        setDate("")
        setTimeout(() => { setSuccess(false); setOpen(false) }, 1500)
      },
      onError: (err) => alert(err.response?.data?.error || "Failed to create fixture"),
    })
  }

  return (
    <div className="card overflow-hidden mb-6">
      {/* Header toggle */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-hover transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center">
            <Plus className="w-4 h-4 text-accent" />
          </div>
          <span className="text-sm font-semibold text-white">Create new fixture</span>
        </div>
        <span className={cn(
          "text-xs font-medium transition-colors",
          open ? "text-accent" : "text-slate-500"
        )}>
          {open ? "Close ▲" : "Open ▼"}
        </span>
      </button>

      {/* Form */}
      {open && (
        <div className="px-5 pb-5 border-t border-surface-border pt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Home team */}
            <div>
              <label className="text-xs font-medium text-slate-400 mb-1.5 block">Home team</label>
              <select
                value={homeTeamId}
                onChange={e => setHomeTeamId(e.target.value)}
                className="w-full bg-pitch-800 border border-surface-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent/40 transition-colors"
              >
                <option value="">— Select team —</option>
                {teams.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* Away team */}
            <div>
              <label className="text-xs font-medium text-slate-400 mb-1.5 block">Away team</label>
              <select
                value={awayTeamId}
                onChange={e => setAwayTeamId(e.target.value)}
                className="w-full bg-pitch-800 border border-surface-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent/40 transition-colors"
              >
                <option value="">— Select team —</option>
                {teams.filter(t => t.id !== parseInt(homeTeamId)).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* Round */}
            <div>
              <label className="text-xs font-medium text-slate-400 mb-1.5 block">Round number</label>
              <input
                type="number" min={1}
                value={round}
                onChange={e => setRound(e.target.value)}
                placeholder="e.g. 1"
                className="w-full bg-pitch-800 border border-surface-border rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent/40 transition-colors"
              />
            </div>

            {/* Date */}
            <div>
              <label className="text-xs font-medium text-slate-400 mb-1.5 block">Match date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full bg-pitch-800 border border-surface-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent/40 transition-colors"
              />
            </div>
          </div>

          {/* Preview */}
          {homeTeamId && awayTeamId && homeTeamId !== awayTeamId && (
            <div className="flex items-center justify-center gap-3 bg-pitch-900/60 border border-surface-border rounded-xl py-3 px-4">
              <span className="text-sm font-bold text-white">
                {teams.find(t => t.id === parseInt(homeTeamId))?.name}
              </span>
              <span className="text-xs font-bold text-accent bg-accent/15 border border-accent/25 px-2 py-0.5 rounded">
                H
              </span>
              <span className="text-slate-500 font-bold">vs</span>
              <span className="text-xs font-bold text-slate-400 bg-surface-border px-2 py-0.5 rounded">
                A
              </span>
              <span className="text-sm font-bold text-white">
                {teams.find(t => t.id === parseInt(awayTeamId))?.name}
              </span>
              {round && <span className="text-xs text-slate-500 ml-2">· Round {round}</span>}
              {date && (
                <span className="text-xs text-slate-500">
                  · {new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              )}
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={!canCreate || createFixture.isPending}
            className={cn(
              "w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2",
              canCreate
                ? "bg-accent hover:bg-accent-dim text-white"
                : "bg-surface-border text-slate-600 cursor-not-allowed"
            )}
          >
            {success ? (
              <><Check className="w-4 h-4" /> Fixture created!</>
            ) : createFixture.isPending ? (
              "Creating…"
            ) : (
              <><Calendar className="w-4 h-4" /> Create fixture</>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Score Input ───────────────────────────────────────────────────────────────
function ScoreInput({ value, onChange, disabled }) {
  return (
    <input
      type="number" min={0} max={20}
      value={value ?? ""}
      placeholder="0"
      onChange={e => {
        const raw = e.target.value
        if (raw === "") { onChange(""); return }
        onChange(Math.max(0, parseInt(raw) || 0))
      }}
      disabled={disabled}
      className="w-12 text-center bg-pitch-800 border border-surface-border rounded-lg py-2 text-lg font-bold font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-accent/40 disabled:opacity-40 disabled:cursor-not-allowed"
    />
  )
}

// ── Fixture Card ──────────────────────────────────────────────────────────────
function FixtureCard({ fixture }) {
  const { data: teams = [] } = useTeams()
  const saveResult    = useSaveFixtureResult()
  const closeFixture  = useCloseFixture()
  const updateFixture = useUpdateFixture()
  const deleteFixture = useDeleteFixture()

  const isCompleted = fixture.status === "completed"

  const [hs, setHs]       = useState(isCompleted ? (fixture.homeScore ?? "") : "")
  const [as_, setAs]      = useState(isCompleted ? (fixture.awayScore ?? "") : "")
  const [hg, setHg]       = useState(isCompleted ? (fixture.homeGoals ?? "") : "")
  const [ag, setAg]       = useState(isCompleted ? (fixture.awayGoals ?? "") : "")
  const [saved, setSaved] = useState(isCompleted)

  const [editing, setEditing]     = useState(false)
  const [editRound, setEditRound] = useState(fixture.round)
  const [editHome, setEditHome] = useState(fixture.homeTeamId)
  const [editAway, setEditAway] = useState(fixture.awayTeamId)
  const [confirmDel, setConfirmDel] = useState(false)

  const winner  = saved ? (hs > as_ ? "home" : hs < as_ ? "away" : "draw") : null
  const canSave = hs !== "" && as_ !== "" && hg !== "" && ag !== "" && !saved

  const handleClose = () => {
    closeFixture.mutate(fixture.id, {
      onSuccess: (fresh) => {
        setHs(fresh.homeScore ?? "")
        setAs(fresh.awayScore ?? "")
        setHg(fresh.homeGoals ?? "")
        setAg(fresh.awayGoals ?? "")
        setSaved(true)
      },
      onError: (err) => alert(err.response?.data?.error || "Failed to close fixture"),
    })
  }

  const handleSaveResult = () => {
    saveResult.mutate({
      id: fixture.id,
      homeScore: parseInt(hs),
      awayScore: parseInt(as_),
      homeGoals: parseInt(hg),
      awayGoals: parseInt(ag),
    }, {
      onSuccess: () => setSaved(true),
      onError:   (err) => alert(err.response?.data?.error || "Failed to save result"),
    })
  }

  const handleSaveEdit = () => {
    if (parseInt(editHome) === parseInt(editAway)) return alert("Home and away teams must differ")
    updateFixture.mutate({
      id: fixture.id,
      round:      parseInt(editRound),
      homeTeamId: parseInt(editHome),
      awayTeamId: parseInt(editAway),
    }, {
      onSuccess: () => setEditing(false),
      onError:   (err) => alert(err.response?.data?.error || "Update failed"),
    })
  }

  const handleDelete = () => {
    deleteFixture.mutate(fixture.id, {
      onError: (err) => alert(err.response?.data?.error || "Delete failed"),
    })
  }

  const formattedDate = fixture.date
    ? new Date(fixture.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    : "—"

  return (
    <div className={cn("card p-5 transition-all", saved && "border-accent/20", confirmDel && "border-rose-500/30")}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Round {fixture.round}</span>
          <span className="text-slate-700">·</span>
          <span className="text-xs text-slate-500">{formattedDate}</span>
        </div>

        <div className="flex items-center gap-1.5">
          {saved
            ? <span className="flex items-center gap-1 text-xs font-semibold text-accent"><Check className="w-3 h-3" /> Saved</span>
            : <span className="text-xs text-amber-400 font-medium">Pending</span>
          }

          {!isCompleted && !confirmDel && (
            <button
              onClick={() => setEditing(e => !e)}
              className={cn(
                "w-7 h-7 rounded-lg flex items-center justify-center transition-colors ml-1",
                editing ? "bg-accent/15 text-accent" : "hover:bg-surface text-slate-500 hover:text-white"
              )}
              title="Edit fixture"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}

          {!confirmDel ? (
            <button
              onClick={() => setConfirmDel(true)}
              className="w-7 h-7 rounded-lg hover:bg-rose-400/10 flex items-center justify-center text-slate-500 hover:text-rose-400 transition-colors"
              title="Delete fixture"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="flex items-center gap-1.5 ml-1">
              <span className="text-xs text-rose-400">Delete?</span>
              <button onClick={() => setConfirmDel(false)}
                className="text-xs px-2 py-1 rounded-lg border border-surface-border text-slate-400 hover:text-white">
                No
              </button>
              <button onClick={handleDelete} disabled={deleteFixture.isPending}
                className="text-xs px-2 py-1 rounded-lg bg-rose-500 text-white font-semibold disabled:opacity-50">
                {deleteFixture.isPending ? "…" : "Yes"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Edit panel */}
      {editing && !isCompleted && (
        <div className="mb-4 p-3 bg-pitch-900/60 rounded-xl border border-surface-border space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Round</label>
              <input type="number" min={1} value={editRound}
                onChange={e => setEditRound(e.target.value)}
                className="w-full bg-pitch-800 border border-surface-border rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-accent/40" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Home team</label>
              <select value={editHome} onChange={e => setEditHome(e.target.value)}
                className="w-full bg-pitch-800 border border-surface-border rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-accent/40">
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Away team</label>
              <select value={editAway} onChange={e => setEditAway(e.target.value)}
                className="w-full bg-pitch-800 border border-surface-border rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-accent/40">
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <p className="text-xs text-slate-600">Date is set per round now — use "Set date for Round {fixture.round}" above the fixture list.</p>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setEditing(false)}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-surface-border text-slate-400 hover:text-white transition-colors">
              <X className="w-3 h-3" /> Cancel
            </button>
            <button onClick={handleSaveEdit} disabled={updateFixture.isPending}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-accent text-white font-semibold disabled:opacity-50 transition-colors">
              <Save className="w-3 h-3" /> {updateFixture.isPending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      )}

      {/* Live tally — reflects player results already logged in the Team
          Dashboard for this fixture, same numbers already live on the
          League table. Purely informational, updates as captains log more. */}
      {!saved && (
        fixture.liveResultsLogged > 0 ? (
          <div className="mb-3 flex items-center justify-center gap-4 bg-pitch-800 rounded-lg py-2.5 px-3">
            <div className="text-center flex-1">
              <p className="text-lg font-bold text-white font-mono">{fixture.liveHomePts}<span className="text-xs text-slate-500 font-normal"> pts</span></p>
              <p className="text-xs text-slate-500 mt-0.5">{fixture.liveHomeGoals} goals</p>
            </div>
            <div className="text-center flex-shrink-0">
              <p className="text-xs text-emerald-400 font-semibold">LIVE</p>
              <p className="text-xs text-slate-600 mt-0.5">{fixture.liveResultsLogged} logged</p>
            </div>
            <div className="text-center flex-1">
              <p className="text-lg font-bold text-white font-mono">{fixture.liveAwayPts}<span className="text-xs text-slate-500 font-normal"> pts</span></p>
              <p className="text-xs text-slate-500 mt-0.5">{fixture.liveAwayGoals} goals</p>
            </div>
          </div>
        ) : (
          <p className="mb-3 text-xs text-slate-600 text-center">No player results logged yet for this fixture</p>
        )
      )}

      {/* Close Fixture — primary action: derives points/goals from whatever
          player results captains have already logged for this fixture live.
          Manual entry below stays available as an override, same as before. */}
      {!saved && (
        <button onClick={handleClose} disabled={closeFixture.isPending}
          className="w-full mb-3 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold
                     bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25
                     transition-colors disabled:opacity-50">
          <CheckCircle className="w-4 h-4" /> {closeFixture.isPending ? "Closing…" : "Close Fixture"}
        </button>
      )}
      {!saved && (
        <p className="text-xs text-slate-600 text-center -mt-1.5 mb-3">
          Closing uses the player results already logged in the Team Dashboard. Or enter a score manually below to override.
        </p>
      )}

      {/* Match score (points) row */}
      <div className="flex items-center gap-3">
        <div className={cn("flex-1 text-right", winner === "home" && "text-white", winner === "away" && "text-slate-500")}>
          <p className="text-sm font-semibold">{fixture.home}</p>
          <p className="text-xs text-accent mt-0.5">Home</p>
        </div>
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <span className="text-xs text-slate-500 uppercase tracking-wide">Match pts</span>
          <div className="flex items-center gap-2">
            <ScoreInput value={hs} onChange={setHs} disabled={saved} />
            <span className="text-slate-600 font-bold text-lg">–</span>
            <ScoreInput value={as_} onChange={setAs} disabled={saved} />
          </div>
        </div>
        <div className={cn("flex-1", winner === "away" && "text-white", winner === "home" && "text-slate-500")}>
          <p className="text-sm font-semibold">{fixture.away}</p>
          <p className="text-xs text-slate-500 mt-0.5">Away</p>
        </div>
      </div>

      {/* Goals row (for GF/GA/GD in league table) */}
      <div className="flex items-center gap-3">
        <div className="flex-1" />
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <span className="text-xs text-slate-500 uppercase tracking-wide">Goals (GD)</span>
          <div className="flex items-center gap-2">
            <ScoreInput value={hg} onChange={setHg} disabled={saved} />
            <span className="text-slate-600 font-bold text-lg">–</span>
            <ScoreInput value={ag} onChange={setAg} disabled={saved} />
          </div>
        </div>
        <div className="flex-1" />
      </div>

      {!saved ? (
        <button onClick={handleSaveResult} disabled={!canSave || saveResult.isPending}
          className={cn(
            "mt-4 w-full py-2 rounded-lg text-sm font-semibold transition-all",
            canSave ? "bg-accent hover:bg-accent-dim text-white" : "bg-surface-border text-slate-600 cursor-not-allowed"
          )}>
          {saveResult.isPending ? "Saving…" : "Save result"}
        </button>
      ) : (
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Lock className="w-3 h-3" /> Result locked
          </div>
          <button
            onClick={() => setSaved(false)}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-surface-border text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
          >
            <Pencil className="w-3 h-3" /> Edit result
          </button>
        </div>
      )}
    </div>
  )
}

// ── Export Card ───────────────────────────────────────────────────────────────
function FixtureExportCard({ round, fixtures, exportRef, visible }) {
  return (
    <div
      ref={exportRef}
      style={{
        position: "fixed",
        left: visible ? 0 : "-9999px",
        top: 0,
        width: 800,
        background: "#050810",
        padding: 36,
        fontFamily: "system-ui, sans-serif",
        overflow: "visible",
        zIndex: visible ? 9999 : -1,
        opacity: visible ? 1 : 0,
        pointerEvents: "none",
      }}
    >
      {/* Background watermark */}
      <img src={logoUrl} alt="" style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: 280, height: 280, objectFit: "contain",
        opacity: 0.04, pointerEvents: "none",
      }} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28, position: "relative" }}>
        <img src={logoUrl} alt="TEC" style={{ width: 44, height: 44, objectFit: "contain" }} />
        <div>
          <p style={{ color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: 2, margin: 0 }}>Tamil Efootballers · Team League</p>
          <p style={{ color: "#ffffff", fontSize: 22, fontWeight: 800, margin: 0 }}>Round {round} Fixtures</p>
        </div>
      </div>

      {/* Fixtures */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, position: "relative" }}>
        {fixtures.map(f => (
          <div key={f.id} style={{
            display: "flex", alignItems: "center",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12, padding: "14px 20px",
          }}>
            {/* Home team */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, justifyContent: "flex-end" }}>
              <p style={{ color: "#f1f5f9", fontSize: 15, fontWeight: 700, margin: 0 }}>{f.home}</p>
              {f.homeLogo
                ? <img src={f.homeLogo} alt="" style={{ width: 32, height: 32, objectFit: "contain", borderRadius: 4 }} />
                : <div style={{ width: 32, height: 32, borderRadius: 4, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ color: "#475569", fontSize: 12, fontWeight: 700 }}>{f.home?.[0]}</span>
                  </div>
              }
            </div>

            {/* Score / vs */}
            <div style={{ padding: "0 18px", textAlign: "center", flexShrink: 0 }}>
              {f.status === "completed"
                ? <span style={{ color: "#94a3b8", fontSize: 16, fontWeight: 800, fontFamily: "monospace" }}>{f.homeScore ?? 0} – {f.awayScore ?? 0}</span>
                : <span style={{ color: "#475569", fontSize: 13, fontWeight: 700 }}>vs</span>
              }
              <p style={{ color: "#334155", fontSize: 10, margin: "2px 0 0 0" }}>
                {f.date ? new Date(f.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : ""}
              </p>
            </div>

            {/* Away team */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
              {f.awayLogo
                ? <img src={f.awayLogo} alt="" style={{ width: 32, height: 32, objectFit: "contain", borderRadius: 4 }} />
                : <div style={{ width: 32, height: 32, borderRadius: 4, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ color: "#475569", fontSize: 12, fontWeight: 700 }}>{f.away?.[0]}</span>
                  </div>
              }
              <p style={{ color: "#f1f5f9", fontSize: 15, fontWeight: 700, margin: 0 }}>{f.away}</p>
            </div>
          </div>
        ))}
      </div>

      <p style={{ color: "#1e293b", fontSize: 10, textAlign: "right", marginTop: 20 }}>tamil-efootballers.vercel.app</p>
    </div>
  )
}

// ── Round Date Editor — sets one date for every fixture in a round ────────────
function RoundDateEditor({ round, roundFixtures }) {
  const updateRoundDate = useUpdateRoundDate()
  // Pre-fill with the round's existing date if every fixture already shares one
  const existingDates = [...new Set(roundFixtures.map(f => f.date ? new Date(f.date).toISOString().slice(0, 10) : null))]
  const initialDate = existingDates.length === 1 && existingDates[0] ? existingDates[0] : ""
  const [date, setDate]     = useState(initialDate)
  const [saved, setSaved]   = useState(false)

  function handleSave() {
    if (!date) return
    updateRoundDate.mutate({ round: Number(round), date }, {
      onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2000) },
      onError:   (err) => alert(err.response?.data?.error || "Failed to update round date"),
    })
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Calendar className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
      <span className="text-xs text-slate-400">Set date for Round {round}:</span>
      <input type="date" value={date} onChange={e => setDate(e.target.value)}
        className="bg-pitch-800 border border-surface-border rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-accent/40" />
      <button onClick={handleSave} disabled={!date || updateRoundDate.isPending}
        className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-accent text-white font-semibold disabled:opacity-50 transition-colors">
        <Save className="w-3 h-3" /> {updateRoundDate.isPending ? "Saving…" : "Apply to all fixtures in round"}
      </button>
      {saved && <span className="text-xs font-semibold text-accent flex items-center gap-1"><Check className="w-3 h-3" /> Updated {roundFixtures.length} fixture(s)</span>}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function FixtureResults({ fixtures }) {
  const { data: teams = [] } = useTeams()
  const [activeRound, setActiveRound]     = useState("all")
  const [exporting, setExporting]         = useState(false)
  const [showExportCard, setShowExportCard] = useState(false)
  const exportRef = useRef(null)

  const upcoming  = fixtures.filter(f => f.status === "upcoming")
  const completed = fixtures.filter(f => f.status === "completed")

  // Get unique rounds
  const rounds = [...new Set(fixtures.map(f => f.round))].filter(Boolean).sort((a, b) => a - b)

  const filteredUpcoming  = activeRound === "all" ? upcoming  : upcoming.filter(f => f.round === Number(activeRound))
  const filteredCompleted = activeRound === "all" ? completed : completed.filter(f => f.round === Number(activeRound))
  const roundFixtures     = fixtures.filter(f => f.round === Number(activeRound))

  async function handleExport() {
    if (!exportRef.current || activeRound === "all") return
    setShowExportCard(true)
    setExporting(true)
    await new Promise(r => setTimeout(r, 500))
    try {
      const el = exportRef.current
      const dataUrl = await toPng(el, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#050810",
        width: el.scrollWidth,
        height: el.scrollHeight,
      })
      const link = document.createElement("a")
      link.download = `Round-${activeRound}-Fixtures.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      alert("Export failed: " + err.message)
    } finally {
      setExporting(false)
      setShowExportCard(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Hidden export card */}
      {activeRound !== "all" && (
        <FixtureExportCard
          round={activeRound}
          fixtures={roundFixtures}
          exportRef={exportRef}
          visible={showExportCard}
        />
      )}

      {/* Auto-generate full season */}
      <GenerateSeasonCard hasExistingFixtures={fixtures.length > 0} />
      <FormatSwitcherCard />

      {/* Create fixture form */}
      <CreateFixtureForm teams={teams} />

      {/* Round filter + export */}
      {rounds.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-pitch-800 border border-surface-border rounded-xl p-1 overflow-x-auto">
            <button onClick={() => setActiveRound("all")}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors",
                activeRound === "all" ? "bg-surface text-white border border-surface-border" : "text-slate-500 hover:text-white"
              )}>All</button>
            {rounds.map(r => (
              <button key={r} onClick={() => setActiveRound(r)}
                className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors",
                  activeRound === r ? "bg-surface text-white border border-surface-border" : "text-slate-500 hover:text-white"
                )}>Round {r}</button>
            ))}
          </div>
          {activeRound !== "all" && (
            <button onClick={handleExport} disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent/15 text-accent border border-accent/25 text-xs font-semibold hover:bg-accent/25 transition-colors disabled:opacity-50">
              <Download className="w-3.5 h-3.5" />
              {exporting ? "Exporting…" : "Export PNG"}
            </button>
          )}
        </div>
      )}

      {activeRound !== "all" && (
        <RoundDateEditor round={activeRound} roundFixtures={roundFixtures} />
      )}

      {filteredUpcoming.length > 0 && (
        <div>
          <p className="section-label mb-4">Upcoming fixtures</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredUpcoming.map(f => <FixtureCard key={f.id} fixture={f} />)}
          </div>
        </div>
      )}

      {filteredCompleted.length > 0 && (
        <div>
          <p className="section-label mb-4">Completed fixtures</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredCompleted.map(f => <FixtureCard key={f.id} fixture={f} />)}
          </div>
        </div>
      )}

      {filteredUpcoming.length === 0 && filteredCompleted.length === 0 && (
        <div className="card py-16 text-center text-slate-500 text-sm">
          {activeRound === "all" ? "No fixtures yet — create one above." : `No fixtures for Round ${activeRound}.`}
        </div>
      )}
    </div>
  )
}