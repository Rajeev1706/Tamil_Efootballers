import { useState } from "react"
import { usePlayerPerformanceZones } from "../../lib/queries"
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip,
         ReferenceLine, CartesianGrid } from "recharts"
import { ChevronDown } from "lucide-react"
import { cn } from "../../lib/utils"

const RESULT_COLOR = { win: "#10b981", draw: "#f59e0b", loss: "#ef4444" }
const COMP_COLOR   = { league: "#10b981", ucl: "#3b82f6", weekly: "#f59e0b" }
const COMP_LABEL   = { league: "Team League", ucl: "UCL", weekly: "Weekly" }

const CustomDot = ({ cx, cy, payload }) => {
  if (cx == null || cy == null || !payload?.result) return null
  return <circle cx={cx} cy={cy} r={4} fill={RESULT_COLOR[payload.result]} stroke="#0f172a" strokeWidth={2} />
}

const SingleTooltip = ({ active, payload }) => {
  if (!active || !payload?.[0]) return null
  const d = payload[0].payload
  return (
    <div className="bg-pitch-900 border border-surface-border rounded-xl px-3 py-2.5 text-xs shadow-xl min-w-[150px]">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COMP_COLOR[d.competition] }} />
        <span className="font-semibold text-white">{d.label}</span>
      </div>
      <p className="text-slate-400">Result: <span className="font-bold" style={{ color: RESULT_COLOR[d.result] }}>{d.result?.toUpperCase()}</span></p>
      <p className="text-slate-400">Goals: <span className="text-white">{d.goalsScored} – {d.goalsConceded}</span></p>
      <p className="text-slate-400">This match: <span className="font-bold" style={{ color: d.delta > 0 ? "#10b981" : d.delta === 1 ? "#f59e0b" : "#ef4444" }}>
        {d.delta > 0 ? "+" : ""}{d.delta}
      </span></p>
      <p className="text-slate-400 mt-1">Running total: <span className="text-white font-bold">{d.cumulative}</span></p>
    </div>
  )
}

const TotalTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-pitch-900 border border-surface-border rounded-xl px-3 py-2.5 text-xs shadow-xl">
      <p className="text-slate-500 mb-1.5">Match {label}</p>
      {payload.map((p, i) => p.value != null && (
        <p key={i} style={{ color: p.color }}>{p.name}: <span className="font-bold">{p.value}</span></p>
      ))}
    </div>
  )
}

function SingleChart({ matches }) {
  const chartWidth = Math.max(600, matches.length * 28)
  return (
    <div style={{ width: chartWidth, height: 200 }}>
      <AreaChart width={chartWidth} height={200} data={matches} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
        <defs>
          <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
        <XAxis dataKey="index" tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `M${v}`} />
        <YAxis tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false} />
        <ReferenceLine y={0} stroke="#334155" strokeDasharray="3 3" />
        <Tooltip content={<SingleTooltip />} cursor={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: 1 }} />
        <Area type="monotone" dataKey="cumulative" stroke="#10b981" strokeWidth={2}
          fill="url(#perfGrad)" dot={<CustomDot />}
          activeDot={{ r: 6, fill: "#10b981", stroke: "#0f172a", strokeWidth: 2 }} />
      </AreaChart>
    </div>
  )
}

function TotalChart({ currentMatches, prevAvg, currentSeason }) {
  const maxLen = Math.max(currentMatches.length, prevAvg.length)
  const chartWidth = Math.max(600, maxLen * 28)
  const data = Array.from({ length: maxLen }, (_, i) => ({
    index:   i + 1,
    current: currentMatches[i]?.cumulative ?? null,
    prevAvg: prevAvg[i]?.cumulative ?? null,
    result:      currentMatches[i]?.result,
    competition: currentMatches[i]?.competition,
    label:       currentMatches[i]?.label,
  }))

  return (
    <div style={{ width: chartWidth, height: 200 }}>
      <LineChart width={chartWidth} height={200} data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
        <XAxis dataKey="index" tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `M${v}`} />
        <YAxis tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false} />
        <ReferenceLine y={0} stroke="#334155" strokeDasharray="3 3" />
        <Tooltip content={<TotalTooltip />} cursor={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: 1 }} />
        <Line type="monotone" dataKey="prevAvg" stroke="#64748b" strokeWidth={1.5}
          strokeDasharray="5 3" dot={false} connectNulls name="Prev seasons avg" />
        <Line type="monotone" dataKey="current" stroke="#10b981" strokeWidth={2.5}
          dot={<CustomDot />}
          activeDot={{ r: 6, fill: "#10b981", stroke: "#0f172a", strokeWidth: 2 }}
          connectNulls name={`Season ${currentSeason}`} />
      </LineChart>
    </div>
  )
}

export default function PerformanceZones({ playerId }) {
  const [seasonParam, setSeasonParam] = useState("current")
  const { data, isLoading } = usePlayerPerformanceZones(playerId, seasonParam)

  const mode           = data?.mode
  const currentSeason  = data?.currentSeason
  const availableSeasons = data?.availableSeasons ?? []

  // Single-season mode
  const matches = mode === "single" ? (data?.matches ?? []) : []

  // Total mode
  const currentMatches = mode === "all" ? (data?.currentMatches ?? []) : []
  const prevAvg        = mode === "all" ? (data?.prevAvg ?? []) : []

  // Stats always from the primary/current-season data
  const statSource = mode === "all" ? currentMatches : matches
  const stats = statSource.reduce((acc, m) => { acc[m.result] = (acc[m.result] || 0) + 1; return acc }, {})
  const allPoints = mode === "all"
    ? [...currentMatches.map(m => m.cumulative), ...prevAvg.map(m => m.cumulative)]
    : matches.map(m => m.cumulative)
  const peak    = allPoints.length ? Math.max(...allPoints) : 0
  const trough  = allPoints.length ? Math.min(...allPoints) : 0
  const current = mode === "all"
    ? (currentMatches[currentMatches.length - 1]?.cumulative ?? 0)
    : (matches[matches.length - 1]?.cumulative ?? 0)
  const hasData = mode === "all" ? (currentMatches.length > 0 || prevAvg.length > 0) : matches.length > 0

  const seasonLabel = (p) => {
    if (p === "current") return `Season ${currentSeason} · Current`
    if (p === "all")     return "Total (all seasons)"
    return `Season ${p}`
  }

  const matchCountLabel = mode === "all"
    ? `${currentMatches.length} this season · ${prevAvg.length > 0 ? `avg of ${availableSeasons.filter(s => s !== currentSeason).length} prev seasons` : "no previous seasons"}`
    : `${matches.length} matches · ${seasonLabel(seasonParam)}`

  return (
    <div className="card p-4 sm:p-6">
      {/* Header — stacks on mobile, side-by-side on desktop */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-4">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Season Performance</p>
          {hasData && <p className="text-xs text-slate-600 mt-0.5">{matchCountLabel}</p>}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {hasData && mode === "single" && statSource.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-emerald-400">{stats.win ?? 0}W</span>
              <span className="text-amber-400">{stats.draw ?? 0}D</span>
              <span className="text-red-400">{stats.loss ?? 0}L</span>
            </div>
          )}
          {hasData && mode === "all" && currentMatches.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 text-xs">this season:</span>
              <span className="text-emerald-400">{stats.win ?? 0}W</span>
              <span className="text-amber-400">{stats.draw ?? 0}D</span>
              <span className="text-red-400">{stats.loss ?? 0}L</span>
            </div>
          )}
          <div className="relative">
            <select value={seasonParam} onChange={e => setSeasonParam(e.target.value)}
              className="appearance-none bg-pitch-800 border border-surface-border rounded-lg pl-2.5 pr-7 py-1.5 text-xs text-white focus:outline-none focus:border-accent/40 cursor-pointer">
              <option value="current">Current Season</option>
              <option value="all">Total (all seasons)</option>
              {availableSeasons.filter(s => s !== currentSeason).map(s => (
                <option key={s} value={s}>Season {s}</option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-slate-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-slate-500 text-sm">Loading…</div>
      ) : !hasData ? (
        <div className="text-center py-10 text-slate-600 text-sm">No matches found for this period</div>
      ) : (
        <>
          <div className="flex gap-3 mb-4">
            <div className="flex-1 rounded-lg bg-emerald-400/10 border border-emerald-400/20 px-3 py-2 text-center">
              <p className="text-xs text-slate-500">High</p>
              <p className="text-lg font-bold text-emerald-400">+{peak}</p>
            </div>
            <div className="flex-1 rounded-lg bg-pitch-800 border border-surface-border px-3 py-2 text-center">
              <p className="text-xs text-slate-500">{mode === "all" ? "This season" : "Current"}</p>
              <p className="text-lg font-bold text-white">{current}</p>
            </div>
            <div className="flex-1 rounded-lg bg-red-400/10 border border-red-400/20 px-3 py-2 text-center">
              <p className="text-xs text-slate-500">Low</p>
              <p className="text-lg font-bold text-red-400">{trough}</p>
            </div>
          </div>

          {/* Horizontally scrollable on mobile — uses overflow-x: scroll explicitly
              to work even on devices where the body has overflow-x: hidden */}
          <div className="-mx-4 sm:mx-0 px-4 sm:px-0" style={{ overflowX: "scroll", WebkitOverflowScrolling: "touch" }}>
            <div style={{ minWidth: "600px" }}>
              {mode === "all"
                ? <TotalChart currentMatches={currentMatches} prevAvg={prevAvg} currentSeason={currentSeason} />
                : <SingleChart matches={matches} />
              }

              {mode === "all" && (
                <div className="flex gap-4 mt-2 text-xs">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <span className="w-5 border-t border-dashed border-slate-500 inline-block" />
                    Prev seasons avg
                  </span>
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <span className="w-5 border-t-2 border-emerald-400 inline-block" />
                    Season {currentSeason} (current)
                  </span>
                </div>
              )}

              {/* Match strip — only in single mode */}
              {mode === "single" && matches.length > 0 && (
                <>
                  <div className="mt-3 flex gap-0.5 rounded-lg overflow-hidden">
                    {matches.map((m, i) => (
                      <div key={i} title={`${m.label}: ${m.result}`}
                        className="flex-1 h-2"
                        style={{ backgroundColor: RESULT_COLOR[m.result], minWidth: "4px" }} />
                    ))}
                  </div>
                  <div className="flex justify-between text-xs text-slate-600 mt-1">
                    <span>Match 1</span><span>Match {matches.length}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Competition legend — outside the scroll container so it wraps naturally */}
          <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-surface-border/50">
            {Object.entries(COMP_LABEL).map(([k, v]) => {
              const src = mode === "all" ? currentMatches : matches
              const count = src.filter(m => m.competition === k).length
              if (!count) return null
              return (
                <span key={k} className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COMP_COLOR[k] }} />
                  {v} <span className="text-slate-600">({count})</span>
                </span>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}