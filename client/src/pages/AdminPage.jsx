import { useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { LayoutDashboard, Users, Activity, Calendar, CalendarDays, ArrowLeftRight, Shield, Settings, AlertTriangle, RotateCcw, Trophy, Gavel, RefreshCw, Zap, Flame } from "lucide-react"
import Layout from "../components/layout/Layout"
import AdminOverview from "../components/admin/AdminOverview"
import PlayerManagement from "../components/admin/PlayerManagement"
import MatchRecordEntry from "../components/admin/MatchRecordEntry"
import FixtureResults from "../components/admin/FixtureResults"
import TradeApproval from "../components/admin/TradeApproval"
import CreateTeam from "../components/admin/CreateTeam"
import CreatePlayer from "../components/admin/CreatePlayer"
import TeamLeagueResults from "../components/admin/TeamLeagueResults"
import UclGroupsAdmin from "../components/admin/UclGroupsAdmin"
import UclResults from "../components/admin/UclResults"
import UclKnockoutAdmin from "../components/admin/UclKnockoutAdmin"
import WeeklyAdmin from "../components/admin/WeeklyTournament"
import RevolutionAdmin from "../components/admin/RevolutionTournament"
import TlgAdmin from "../components/admin/TlgAdmin"
import TeamKnockoutAdmin from "../components/admin/TeamKnockoutAdmin"
import DuoTournamentAdmin from "../components/admin/DuoTournamentAdmin"
import ReplacementModule from "../components/common/ReplacementModule"
import Loading from "../components/common/Loading"
import { usePlayers, useRecords, useFixtures, useTrades, useSettings } from "../lib/queries"
import { useQueryClient } from "@tanstack/react-query"
import api, { teamsApi, settingsApi } from "../lib/api"
import { adminActivity } from "../data/mockData"
import { cn } from "../lib/utils"
import ManageTeams from "../components/admin/ManageTeams"
import SeasonRecordsAdmin from "../components/admin/SeasonRecordsAdmin"
import LeagueInfoAdmin from "../components/admin/LeagueInfoAdmin"
import SpecialEditionAdmin from "../components/admin/SpecialEditionAdmin"
import AdminTeamsTab from "../components/admin/AdminTeamsTab"

function RecalcTournamentHistoryCard() {
  const [loading, setLoading] = useState(false)
  const [done, setDone]       = useState(false)
  const [count, setCount]     = useState(0)

  async function handle() {
    setLoading(true)
    try {
      const res = await api.post("/players/recalc-tournament-history")
      setCount(res.data.total)
      setDone(true)
    } catch { alert("Failed to recalculate tournament history") }
    finally { setLoading(false) }
  }

  if (done) return (
    <div className="card p-6 border-emerald-500/30 bg-emerald-500/5 text-center">
      <p className="text-emerald-400 font-semibold text-lg mb-1">✅ Done!</p>
      <p className="text-sm text-slate-400">{count} history rows written from all tournament data.</p>
      <button onClick={() => setDone(false)} className="mt-3 text-xs text-slate-500 hover:text-white">Dismiss</button>
    </div>
  )

  return (
    <div className="card p-6 flex items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <Trophy className="w-5 h-5 text-gold flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-white font-semibold">Backfill Tournament History</p>
          <p className="text-sm text-slate-500 mt-0.5">Rebuilds player tournament history (Weekly/Revolution/UCL KO/Duo) from all existing data. Run once after deploying this feature.</p>
        </div>
      </div>
      <button onClick={handle} disabled={loading}
        className="flex-shrink-0 px-4 py-2 rounded-lg border border-gold/30 text-gold hover:bg-gold/10 text-sm font-semibold transition-colors disabled:opacity-40">
        {loading ? "Backfilling…" : "Backfill History"}
      </button>
    </div>
  )
}

function FinalizeUclGroupsCard() {
  const [loading, setLoading] = useState(false)
  const [done, setDone]       = useState(false)

  async function handle() {
    if (!window.confirm("Record current UCL group stage positions for all players? Only do this once after the UCL group stage ends.")) return
    setLoading(true)
    try {
      await api.post("/ucl/finalize-groups")
      setDone(true)
    } catch { alert("Failed to finalize UCL groups") }
    finally { setLoading(false) }
  }

  if (done) return (
    <div className="card p-6 border-emerald-500/30 bg-emerald-500/5 text-center">
      <p className="text-emerald-400 font-semibold text-lg mb-1">✅ UCL group positions recorded!</p>
      <button onClick={() => setDone(false)} className="mt-3 text-xs text-slate-500 hover:text-white">Dismiss</button>
    </div>
  )

  return (
    <div className="card p-6 flex items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <Trophy className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-white font-semibold">Finalize UCL Group Positions</p>
          <p className="text-sm text-slate-500 mt-0.5">Records each player's final group stage position in their tournament history. Run once when the UCL group stage is complete.</p>
        </div>
      </div>
      <button onClick={handle} disabled={loading}
        className="flex-shrink-0 px-4 py-2 rounded-lg border border-accent/30 text-accent hover:bg-accent/10 text-sm font-semibold transition-colors disabled:opacity-40">
        {loading ? "Saving…" : "Finalize Groups"}
      </button>
    </div>
  )
}

function TriggerWeeklyHonoursCard() {
  const [loading, setLoading] = useState(false)
  const [done, setDone]       = useState(null)

  async function handle() {
    if (!window.confirm("This will snapshot the #1 trending player and #1 power ranking player, show celebration cards on the dashboard, then reset both tables. Continue?")) return
    setLoading(true)
    try {
      const res = await api.post("/trending/trigger-celebration")
      setDone(res.data)
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to trigger celebration")
    } finally { setLoading(false) }
  }

  if (done) return (
    <div className="card p-6 border-emerald-500/30 bg-emerald-500/5 space-y-2">
      <p className="text-emerald-400 font-semibold text-lg">✅ Weekly Honours Triggered!</p>
      {done.trending && <p className="text-sm text-slate-400">🔥 Trending: <span className="text-white font-semibold">{done.trending.name}</span> — {done.trending.views} views</p>}
      {done.powerRank && <p className="text-sm text-slate-400">⚡ Power Ranking: <span className="text-white font-semibold">{done.powerRank.name}</span> — {done.powerRank.points}pts</p>}
      <p className="text-xs text-slate-500 mt-1">Celebration cards will appear on the dashboard for 48 hours. Both tables have been reset.</p>
      <button onClick={() => setDone(null)} className="text-xs text-slate-500 hover:text-white">Dismiss</button>
    </div>
  )

  return (
    <div className="card p-6 flex items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <Flame className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-white font-semibold">Trigger Weekly Honours</p>
          <p className="text-sm text-slate-500 mt-0.5">Snapshots the #1 trending player and #1 power ranking player, shows celebration cards side by side on the dashboard, then resets both tables.</p>
        </div>
      </div>
      <button onClick={handle} disabled={loading}
        className="flex-shrink-0 px-4 py-2 rounded-lg border border-orange-400/30 text-orange-400 hover:bg-orange-400/10 text-sm font-semibold transition-colors disabled:opacity-40 whitespace-nowrap">
        {loading ? "Triggering…" : "🏅 Trigger Now"}
      </button>
    </div>
  )
}

function GeneratePowerRankingsCard() {
  const [loading, setLoading] = useState(false)
  const [done, setDone]       = useState(null)

  async function handle() {
    setLoading(true)
    try {
      const res = await api.post("/power-rankings/generate")
      setDone(res.data)
    } catch { alert("Failed to generate rankings") }
    finally { setLoading(false) }
  }

  if (done) return (
    <div className="card p-6 border-emerald-500/30 bg-emerald-500/5 text-center">
      <p className="text-emerald-400 font-semibold text-lg mb-1">✅ Rankings generated!</p>
      <p className="text-sm text-slate-400">{done.count} players ranked for week {done.weekStart}</p>
      <button onClick={() => setDone(null)} className="mt-3 text-xs text-slate-500 hover:text-white">Dismiss</button>
    </div>
  )

  return (
    <div className="card p-6 flex items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <Zap className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-white font-semibold">Generate Weekly Power Rankings</p>
          <p className="text-sm text-slate-500 mt-0.5">Manually snapshot this week's rankings. Auto-runs every Sunday 7am IST.</p>
        </div>
      </div>
      <button onClick={handle} disabled={loading}
        className="flex-shrink-0 px-4 py-2 rounded-lg border border-accent/30 text-accent hover:bg-accent/10 text-sm font-semibold transition-colors disabled:opacity-40">
        {loading ? "Generating…" : "Generate Now"}
      </button>
    </div>
  )
}

function RecalcMVCard() {
  const [loading, setLoading] = useState(false)
  const [done, setDone]       = useState(false)
  const [count, setCount]     = useState(0)

  async function handleRecalc() {
    setLoading(true)
    try {
      const res = await api.post("/players/recalc-all-mv")
      setCount(res.data.updated)
      setDone(true)
    } catch (err) {
      alert("Recalculate failed")
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="card p-6 border-emerald-500/30 bg-emerald-500/5 text-center">
        <p className="text-emerald-400 font-semibold text-lg mb-1">✅ MV recalculated!</p>
        <p className="text-sm text-slate-400">Market values updated for {count} players using current season records.</p>
        <button onClick={() => setDone(false)} className="mt-3 text-xs text-slate-500 hover:text-white transition-colors">Dismiss</button>
      </div>
    )
  }

  return (
    <div className="card p-6 flex items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <Zap className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-white font-semibold">Recalculate Market Values</p>
          <p className="text-sm text-slate-500 mt-0.5">Recompute MV for all players based on current season match records. Use after formula changes.</p>
        </div>
      </div>
      <button onClick={handleRecalc} disabled={loading}
        className="flex-shrink-0 px-4 py-2 rounded-lg border border-accent/30 text-accent hover:bg-accent/10 text-sm font-semibold transition-colors disabled:opacity-40">
        {loading ? "Recalculating…" : "Recalculate MV"}
      </button>
    </div>
  )
}

function ResetMVCard() {
  const [confirm, setConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone]       = useState(false)

  async function handleReset() {
    setLoading(true)
    try {
      await api.post("/players/reset-mv")
      setDone(true)
      setConfirm(false)
    } catch (err) {
      alert("Reset failed")
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="card p-6 border-emerald-500/30 bg-emerald-500/5 text-center">
        <p className="text-emerald-400 font-semibold text-lg mb-1">✅ Market values reset!</p>
        <p className="text-sm text-slate-400">All player market values have been reset to 0.</p>
        <button onClick={() => setDone(false)} className="mt-3 text-xs text-slate-500 hover:text-white transition-colors">Dismiss</button>
      </div>
    )
  }

  if (confirm) {
    return (
      <div className="card p-6 border-rose-500/30 bg-rose-500/5 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-rose-400 font-semibold mb-1">Reset all market values to 0?</p>
            <p className="text-sm text-slate-400">All 97 player market values will be set to 0. Match records, trophies and BDR points are untouched.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setConfirm(false)}
            className="flex-1 py-2 rounded-lg border border-surface-border text-slate-400 hover:text-white text-sm transition-colors">
            Cancel
          </button>
          <button onClick={handleReset} disabled={loading}
            className="flex-1 py-2 rounded-lg bg-rose-500 text-white font-semibold text-sm disabled:opacity-40 hover:bg-rose-600 transition-colors">
            {loading ? "Resetting…" : "Yes, Reset"}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="card p-6 flex items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <RotateCcw className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-white font-semibold">Reset Market Values</p>
          <p className="text-sm text-slate-500 mt-0.5">Reset all player market values to 0. Match records and trophies are kept safe.</p>
        </div>
      </div>
      <button onClick={() => setConfirm(true)}
        className="flex-shrink-0 px-4 py-2 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-sm font-semibold transition-colors">
        Reset MV
      </button>
    </div>
  )
}

function IncrementYearCard() {
  const [confirm, setConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone]       = useState(false)
  const [result, setResult]   = useState(null)
  const [error, setError]     = useState(null)

  async function handleIncrement() {
    setLoading(true)
    setError(null)
    try {
      const res = await teamsApi.incrementYear()
      setResult(res)
      setDone(true)
      setConfirm(false)
    } catch (err) {
      setError(err?.response?.data?.error || "Year increment failed")
    } finally {
      setLoading(false)
    }
  }

  if (done) return (
    <div className="card p-6 border-emerald-500/30 bg-emerald-500/5 text-center">
      <p className="text-emerald-400 font-semibold text-lg mb-1">✅ Year incremented to {result?.newYear}!</p>
      <p className="text-sm text-slate-400">Trophy counts (except Ballon d'Or) reset. Team standings and fixtures cleared. Player records intact.</p>
      <button onClick={() => setDone(false)} className="mt-3 text-xs text-slate-500 hover:text-white transition-colors">Dismiss</button>
    </div>
  )

  if (confirm) return (
    <div className="card p-6 border-amber-500/30 bg-amber-500/5 space-y-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-amber-400 font-semibold mb-1">Increment Year?</p>
          <p className="text-sm text-slate-400">
            This will advance the year by 1, <strong>reset all trophy counts except Ballon d'Or</strong>,
            and clear team standings and fixtures. Player records, grades, BDR points, and the player list remain unchanged.
          </p>
        </div>
      </div>
      {error && <p className="text-sm text-rose-400">{error}</p>}
      <div className="flex gap-3">
        <button onClick={() => setConfirm(false)}
          className="flex-1 py-2 rounded-lg border border-surface-border text-slate-400 hover:text-white text-sm transition-colors">
          Cancel
        </button>
        <button onClick={handleIncrement} disabled={loading}
          className="flex-1 py-2 rounded-lg bg-amber-500 text-white font-semibold text-sm disabled:opacity-40 hover:bg-amber-600 transition-colors">
          {loading ? "Incrementing…" : "Yes, Increment Year"}
        </button>
      </div>
    </div>
  )

  return (
    <div className="card p-6 flex items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <CalendarDays className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-white font-semibold">Increment Year</p>
          <p className="text-sm text-slate-500 mt-0.5">
            Advance year by 1 · Reset trophy counts (except Ballon d'Or) · Clear team standings & fixtures · Player records unchanged.
          </p>
        </div>
      </div>
      <button onClick={() => setConfirm(true)}
        className="flex-shrink-0 px-4 py-2 rounded-lg border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 text-sm font-semibold transition-colors">
        Increment Year
      </button>
    </div>
  )
}


function RecalcGradesCard() {
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState(null)
  const [error, setError]     = useState(null)
  async function handleRecalc() {
    setLoading(true); setError(null); setResult(null)
    try {
      const data = await teamsApi.recalcGrades()
      setResult(data)
    } catch (err) {
      setError(err?.response?.data?.error || "Recalculation failed")
    } finally { setLoading(false) }
  }

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-white mb-1">⚡ Recalculate Grades</p>
          <p className="text-xs text-slate-500">
            Auto-updates player grades based on current season win rates.
            Does NOT reset the season or clear any data.
          </p>
        </div>
        <button onClick={handleRecalc} disabled={loading}
          className="flex-shrink-0 px-4 py-2 bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded-xl text-sm font-semibold hover:bg-sky-500/30 disabled:opacity-50 transition-all whitespace-nowrap">
          {loading ? "Recalculating..." : "Run Now"}
        </button>
      </div>
      {error && <p className="mt-3 text-xs text-rose-400">{error}</p>}
      {result && (
        <div className="mt-4 space-y-2">
          <p className="text-xs text-emerald-400 font-semibold">
            ✅ {result.updated} grade{result.updated !== 1 ? "s" : ""} updated
            ({result.eligible} eligible players in Season {result.season})
          </p>
          {result.changes.length > 0 && (
            <div className="bg-pitch-900 rounded-xl border border-surface-border p-3 space-y-1 max-h-48 overflow-y-auto">
              {result.changes.map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="text-slate-300 font-medium w-32 truncate">{c.name}</span>
                  <span className="text-slate-500">{c.from}</span>
                  <span className="text-slate-600">→</span>
                  <span className={c.to > c.from ? "text-emerald-400" : "text-rose-400"} style={{}}>{c.to}</span>
                  <span className="text-slate-600 ml-auto">#{c.rank} · {c.winRate}% WR</span>
                </div>
              ))}
            </div>
          )}
          {result.changes.length === 0 && (
            <p className="text-xs text-slate-500">No grade changes needed — all grades are current.</p>
          )}
        </div>
      )}
    </div>
  )
}

function SeasonResetCard() {
  const [confirm, setConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone]       = useState(false)
  const [error, setError]     = useState(null)

  async function handleReset() {
    setLoading(true)
    setError(null)
    try {
      await teamsApi.seasonReset()
      setDone(true)
      setConfirm(false)
    } catch (err) {
      setError(err?.response?.data?.error || "Season reset failed")
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="card p-6 border-emerald-500/30 bg-emerald-500/5 text-center">
        <p className="text-emerald-400 font-semibold text-lg mb-1">✅ New season started!</p>
        <p className="text-sm text-slate-400">Team stats, fixtures, trades, and the UCL competition were cleared. Player records and trophies are untouched.</p>
        <button onClick={() => setDone(false)} className="mt-3 text-xs text-slate-500 hover:text-white transition-colors">Dismiss</button>
      </div>
    )
  }

  if (confirm) {
    return (
      <div className="card p-6 border-rose-500/30 bg-rose-500/5 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-rose-400 font-semibold mb-1">Start a new season?</p>
            <p className="text-sm text-slate-400">
              This will reset every team's played/won/drawn/lost/points to 0, reset all player market values and recent form,
              and permanently <strong>delete every fixture, lineup, pending trade, and the entire UCL competition</strong>
              (groups, fixtures, and knockout bracket). The season number will advance by one. Player records, trophies,
              and match history stay intact.
            </p>
          </div>
        </div>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <div className="flex gap-3">
          <button onClick={() => setConfirm(false)}
            className="flex-1 py-2 rounded-lg border border-surface-border text-slate-400 hover:text-white text-sm transition-colors">
            Cancel
          </button>
          <button onClick={handleReset} disabled={loading}
            className="flex-1 py-2 rounded-lg bg-rose-500 text-white font-semibold text-sm disabled:opacity-40 hover:bg-rose-600 transition-colors">
            {loading ? "Starting…" : "Yes, Start New Season"}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="card p-6 flex items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <Trophy className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-white font-semibold">Start New Season</p>
          <p className="text-sm text-slate-500 mt-0.5">Archive the current season: reset team stats, clear fixtures/trades/UCL, and advance the season number.</p>
        </div>
      </div>
      <button onClick={() => setConfirm(true)}
        className="flex-shrink-0 px-4 py-2 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-sm font-semibold transition-colors">
        Start New Season
      </button>
    </div>
  )
}

function DeleteSeasonCard() {
  const [confirm, setConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone]       = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError]     = useState(null)

  async function handleDelete() {
    setLoading(true)
    setError(null)
    try {
      const result = await teamsApi.seasonDelete()
      setMessage(result.message)
      setDone(true)
      setConfirm(false)
    } catch (err) {
      setError(err?.response?.data?.error || "Season delete failed")
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="card p-6 border-emerald-500/30 bg-emerald-500/5 text-center">
        <p className="text-emerald-400 font-semibold text-lg mb-1">✅ Season deleted</p>
        <p className="text-sm text-slate-400">{message}</p>
        <button onClick={() => setDone(false)} className="mt-3 text-xs text-slate-500 hover:text-white transition-colors">Dismiss</button>
      </div>
    )
  }

  if (confirm) {
    return (
      <div className="card p-6 border-rose-500/30 bg-rose-500/5 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-rose-400 font-semibold mb-1">Delete the current season?</p>
            <p className="text-sm text-slate-400">
              This clears the current season's team stats, fixtures, trades, and UCL competition, then moves the season
              number back by one. <strong>This does not restore the previous season's actual data</strong> — that was
              already permanently deleted the moment this season started. The previous season will begin fresh, not
              as it was before. Player records and trophies are unaffected either way.
            </p>
          </div>
        </div>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <div className="flex gap-3">
          <button onClick={() => setConfirm(false)}
            className="flex-1 py-2 rounded-lg border border-surface-border text-slate-400 hover:text-white text-sm transition-colors">
            Cancel
          </button>
          <button onClick={handleDelete} disabled={loading}
            className="flex-1 py-2 rounded-lg bg-rose-500 text-white font-semibold text-sm disabled:opacity-40 hover:bg-rose-600 transition-colors">
            {loading ? "Deleting…" : "Yes, Delete Season"}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="card p-6 flex items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <RotateCcw className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-white font-semibold">Delete Current Season</p>
          <p className="text-sm text-slate-500 mt-0.5">Undo starting this season: clear its data and move the season number back by one.</p>
        </div>
      </div>
      <button onClick={() => setConfirm(true)}
        className="flex-shrink-0 px-4 py-2 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-sm font-semibold transition-colors">
        Delete Season
      </button>
    </div>
  )
}

const TABS = [
  { id: "setup",      label: "Setup",        icon: Settings        },
  { id: "overview",   label: "Overview",     icon: LayoutDashboard },
  { id: "teams",      label: "Teams",        icon: Shield          },
  { id: "players",    label: "Players",      icon: Users           },
  { id: "records",    label: "Match records", icon: Activity       },
  { id: "uclgroups",    label: "UCL Groups",    icon: Trophy },
  { id: "uclresults",   label: "UCL Results",   icon: Trophy },
  { id: "uclknockout",   label: "UCL Knockout",   icon: Trophy },
  { id: "weekly",     label: "Weekly",       icon: Trophy          },
  { id: "revolution", label: "Revolution",  icon: Trophy          },
  { id: "tlg",        label: "TLG",         icon: Trophy          },
  { id: "teamknockout",  label: "Team Knockout",  icon: Trophy },
  { id: "duo",           label: "Duo",            icon: Users  },
  { id: "replacement",label: "Replacement", icon: RefreshCw       },
  { id: "fixtures",   label: "Fixtures",     icon: Calendar        },
  { id: "teamresults",label: "Team Results", icon: Users           },
  { id: "trades",     label: "Trades",       icon: ArrowLeftRight  },
  { id: "auction",    label: "Auction",      icon: Gavel, href: "/admin/auction" },
]

// ── FeaturedPanelCard ─────────────────────────────────────────────────────────
const PANEL_OPTIONS = [
  { value: "standings",  label: "Dshann League (Default)" },
  { value: "ucl",        label: "UCL" },
  { value: "duo",        label: "Duo Tournament" },
  { value: "weekly",     label: "Weekly" },
  { value: "revolution", label: "Revolution Trophy" },
]

function FeaturedPanelCard() {
  const { data: settings = {} } = useSettings()
  const qc = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  // Use local state for immediate UI response — initialise from settings once loaded
  const [selected, setSelected] = useState(null)
  const current = selected ?? settings.featured_panel ?? "standings"

  async function handleChange(val) {
    setSelected(val)   // optimistic update immediately
    setSaving(true)
    setSaved(false)
    try {
      await settingsApi.update("featured_panel", val)
      // Persist to localStorage so dashboard reads it instantly on next load
      localStorage.setItem("featured_panel", val)
      // Invalidate settings cache so rest of app picks up the change
      qc.invalidateQueries({ queryKey: ["settings"] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setSelected(null) // revert on error
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card p-5 space-y-3">
      <div>
        <p className="text-sm font-semibold text-white mb-1">Homepage Featured View</p>
        <p className="text-xs text-slate-500">When someone opens the site, this tournament/view is shown first.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {PANEL_OPTIONS.map(opt => (
          <button key={opt.value} onClick={() => handleChange(opt.value)} disabled={saving}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-semibold transition-all ${
              current === opt.value
                ? "bg-accent text-white border-accent"
                : "bg-pitch-800 text-slate-400 border-surface-border hover:text-white hover:border-accent/40"
            }`}>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${current === opt.value ? "bg-white" : "bg-slate-600"}`} />
            {opt.label}
            {current === opt.value && <span className="ml-auto text-[10px] opacity-70">ACTIVE</span>}
          </button>
        ))}
      </div>
      {saved && <p className="text-xs text-emerald-400">✓ Saved — dashboard will now open on {PANEL_OPTIONS.find(o => o.value === current)?.label}</p>}
    </div>
  )
}


export default function AdminPage() {
  const navigate      = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get("tab") || "setup"
  const setActiveTab = (tab) => {
    const next = new URLSearchParams(searchParams)
    next.set("tab", tab)
    setSearchParams(next, { replace: false })
  }

  const { data: players  = [], isLoading: pLoading } = usePlayers()
  const { data: records  = [], isLoading: rLoading } = useRecords()
  const { data: fixtures = [], isLoading: fLoading } = useFixtures()
  const { data: trades   = [] }                      = useTrades()

  const pendingTrades = trades.filter(t => t.status === "pending_admin")
  const isLoading     = pLoading || rLoading || fLoading

  const stats = {
    pendingTrades:    pendingTrades.length,
    totalPlayers:     players.length,
    matchesLogged:    records.length,
    upcomingFixtures: fixtures.filter(f => f.status === "upcoming").length,
  }

  return (
    <Layout>
      {/* Admin header */}
      <div className="relative rounded-2xl overflow-hidden border border-surface-border mb-6">
        <div className="absolute inset-0 bg-gradient-to-r from-pitch-800 via-pitch-800 to-pitch-700" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(139,92,246,0.10),transparent_55%)]" />
        <div className="relative px-6 py-6 sm:px-8 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-violet-400/20 border border-violet-400/30 flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-0.5">Admin panel</p>
            <h1 className="text-xl font-extrabold text-white">League management</h1>
          </div>
          {pendingTrades.length > 0 && (
            <div className="ml-auto flex items-center gap-2 bg-amber-400/10 border border-amber-400/20 rounded-xl px-4 py-2">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-sm font-semibold text-amber-400">{pendingTrades.length} pending trades</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-surface-border overflow-x-auto -mb-px mb-0">
        {TABS.map(({ id, label, icon: Icon, href }) => {
          const isActive  = activeTab === id
          const showAlert = id === "trades" && pendingTrades.length > 0
          return (
            <button key={id} onClick={() => href ? navigate(href) : setActiveTab(id)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap",
                isActive
                  ? "border-violet-400 text-violet-400"
                  : "border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-600"
              )}>
              <Icon className="w-4 h-4" />
              {label}
              {showAlert && <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />}
            </button>
          )
        })}
      </div>

      <div className="mt-6">
        {/* Setup tab — create teams and players */}
{activeTab === "setup" && (
  <div className="space-y-8">
    <p className="text-sm text-slate-400">
      Create teams first, then add players. You can rename or delete at any time.
    </p>

    {/* Featured Panel */}
    <div>
      <p className="section-label mb-3">Dashboard Featured View</p>
      <FeaturedPanelCard />
    </div>

    {/* Teams */}
    <div>
      <p className="section-label mb-3">Teams</p>
<div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
  <ManageTeams players={players} />
  <CreateTeam onSuccess={() => {}} />
</div>
    </div>

    {/* Players */}
    <div>
      <p className="section-label mb-3">Players</p>
      <CreatePlayer onSuccess={() => {}} />
    </div>

    {/* League Info Board */}
    <div>
      <p className="section-label mb-3">League Info Board</p>
      <LeagueInfoAdmin />
    </div>

    {/* Special Editions */}
    <div>
      <p className="section-label mb-3">Special Editions</p>
      <SpecialEditionAdmin />
    </div>

    {/* Season Records / Hall of Fame */}
    <div>
      <p className="section-label mb-3">Hall of Fame</p>
      <SeasonRecordsAdmin />
    </div>

    {/* Market Value Reset */}
    <div>
      <p className="section-label mb-3">Market Value</p>
      <ResetMVCard />
      <RecalcMVCard />
      <GeneratePowerRankingsCard />
      <TriggerWeeklyHonoursCard />
      <RecalcTournamentHistoryCard />
      <FinalizeUclGroupsCard />
    </div>

    {/* Season Reset */}
    <div>
      <p className="section-label mb-3">Season</p>
      <div className="space-y-3">
        <IncrementYearCard />
        <RecalcGradesCard />
        <SeasonResetCard />
        <DeleteSeasonCard />
      </div>
    </div>
  </div>
)}

        {activeTab === "overview" && (
          <AdminOverview stats={stats} activity={adminActivity} onNavigate={setActiveTab} />
        )}
{activeTab === "teams" && <AdminTeamsTab />}
{activeTab === "players" && !isLoading && (
          <PlayerManagement players={players} onPlayerClick={p => navigate(`/player/${p.id}?ctx=admin&${searchParams.toString()}`)} />
        )}
        {activeTab === "records" && !isLoading && (
          <MatchRecordEntry players={players} initialRecords={records} />
        )}
        {activeTab === "teamresults" && !isLoading && (
          <TeamLeagueResults />
        )}
        {activeTab === "uclgroups" && !isLoading && (
          <UclGroupsAdmin />
        )}
        {activeTab === "uclresults" && !isLoading && <UclResults />}
        {activeTab === "uclknockout" && <UclKnockoutAdmin />}
        {activeTab === "weekly" && (
          <WeeklyAdmin />
        )}
        {activeTab === "revolution" && (
          <RevolutionAdmin />
        )}
        {activeTab === "tlg" && <TlgAdmin />}
        {activeTab === "teamknockout" && <TeamKnockoutAdmin />}
        {activeTab === "duo" && <DuoTournamentAdmin />}
        {activeTab === "replacement" && (
          <ReplacementModule players={players} />
        )}
        {activeTab === "fixtures" && !isLoading && (
          <FixtureResults fixtures={fixtures} />
        )}
        {activeTab === "trades" && (
          <TradeApproval trades={pendingTrades} />
        )}
        {isLoading && activeTab !== "setup" && activeTab !== "overview" && activeTab !== "trades" && (
          <Loading />
        )}
      </div>
    </Layout>
  )
}