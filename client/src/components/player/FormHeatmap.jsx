import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react"
import api from "../../lib/api"
import { cn } from "../../lib/utils"

function getDominantResult(matches) {
  const wins   = matches.filter(m => m.result === "win").length
  const losses = matches.filter(m => m.result === "loss").length
  const draws  = matches.filter(m => m.result === "draw").length
  if (wins > losses && wins >= draws) return "win"
  if (losses > wins && losses >= draws) return "loss"
  return "draw"
}

const MONTH_NAMES = ["January","February","March","April","May","June",
                     "July","August","September","October","November","December"]
const DAY_LABELS  = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]

const CELL_STYLE = {
  win:     { bg: "bg-emerald-500",    text: "text-white",     border: "border-emerald-400/50" },
  draw:    { bg: "bg-amber-400",      text: "text-white",     border: "border-amber-300/50"   },
  loss:    { bg: "bg-rose-500",       text: "text-white",     border: "border-rose-400/50"    },
  empty:   { bg: "bg-pitch-800/50",   text: "text-slate-700", border: "border-white/5"        },
  outside: { bg: "bg-transparent",    text: "text-slate-800", border: "border-transparent"    },
}

export default function FormHeatmap({ playerId, seasonNumber }) {
  const [viewDate, setViewDate] = useState(null) // null = auto to latest match month

  const { data = [], isLoading } = useQuery({
    queryKey: ["form-heatmap", playerId, seasonNumber],
    queryFn:  () => api.get(`/players/${playerId}/form-heatmap?season=${seasonNumber}`).then(r => r.data),
    enabled:  !!playerId,
  })

  if (isLoading || data.length === 0) return null

  // Build day map
  const dayMap = {}
  for (const m of data) {
    const day = m.date.slice(0, 10)
    if (!dayMap[day]) dayMap[day] = []
    dayMap[day].push(m)
  }

  const allDates = Object.keys(dayMap).sort()
  const lastMatchDate = new Date(allDates[allDates.length - 1])

  // Current view month
  const activeDate = viewDate || new Date(lastMatchDate.getFullYear(), lastMatchDate.getMonth(), 1)
  const year  = activeDate.getFullYear()
  const month = activeDate.getMonth()

  // First day of month (adjust for Mon=0)
  const firstOfMonth = new Date(year, month, 1)
  const lastOfMonth  = new Date(year, month + 1, 0)
  const startOffset  = (firstOfMonth.getDay() + 6) % 7  // Mon=0

  // Build calendar grid (6 rows × 7 cols)
  const cells = []
  for (let i = 0; i < 42; i++) {
    const dayNum = i - startOffset + 1
    if (dayNum < 1 || dayNum > lastOfMonth.getDate()) {
      cells.push(null)
    } else {
      cells.push(new Date(year, month, dayNum))
    }
  }

  // Remove trailing empty rows
  let rows = []
  for (let r = 0; r < 6; r++) {
    const row = cells.slice(r * 7, r * 7 + 7)
    if (row.some(d => d !== null)) rows.push(row)
  }

  // Month stats
  const monthMatches = allDates
    .filter(d => d.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`))
    .flatMap(d => dayMap[d])
  const mWins   = monthMatches.filter(m => m.result === "win").length
  const mDraws  = monthMatches.filter(m => m.result === "draw").length
  const mLosses = monthMatches.filter(m => m.result === "loss").length

  const canPrev = new Date(year, month - 1, 1) >= new Date(new Date(allDates[0]).getFullYear(), new Date(allDates[0]).getMonth(), 1)
  const canNext = new Date(year, month + 1, 1) <= new Date(lastMatchDate.getFullYear(), lastMatchDate.getMonth(), 1)

  function prevMonth() { setViewDate(new Date(year, month - 1, 1)) }
  function nextMonth() { setViewDate(new Date(year, month + 1, 1)) }

  return (
    <div className="card p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-500" />
          <p className="text-sm font-semibold text-white">Match Activity</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" />{mWins}W</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-400 inline-block" />{mDraws}D</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-rose-500 inline-block" />{mLosses}L</span>
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={prevMonth}
          disabled={!canPrev}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400
                     hover:bg-pitch-800 hover:text-white disabled:opacity-20 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <p className="text-sm font-bold text-white">
          {MONTH_NAMES[month]} {year}
        </p>
        <button
          onClick={nextMonth}
          disabled={!canNext}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400
                     hover:bg-pitch-800 hover:text-white disabled:opacity-20 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_LABELS.map(d => (
          <div key={d} className="text-center text-[10px] text-slate-600 font-semibold py-1">{d}</div>
        ))}
      </div>

      {/* Calendar rows */}
      <div className="space-y-1">
        {rows.map((row, ri) => (
          <div key={ri} className="grid grid-cols-7 gap-1">
            {row.map((day, ci) => {
              if (!day) return <div key={ci} />
              const key     = day.toISOString().slice(0, 10)
              const matches = dayMap[key] || []
              const result  = matches.length > 0 ? getDominantResult(matches) : null
              const style   = result ? CELL_STYLE[result] : CELL_STYLE.empty

              return (
                <div
                  key={ci}
                  className={cn(
                    "rounded-lg border flex flex-col items-center justify-center py-2 transition-all",
                    style.bg, style.border,
                    matches.length > 0 && "cursor-default hover:opacity-80"
                  )}
                >
                  <span className={cn("text-xs font-bold", style.text)}>
                    {day.getDate()}
                  </span>
                  {matches.length > 0 && (
                    <span className="text-[9px] font-medium opacity-80" style={{ color: "inherit" }}>
                      {matches.length > 1 ? `${matches.length}m` : result?.slice(0,1).toUpperCase()}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-600 mt-3">{monthMatches.length} matches in {MONTH_NAMES[month]}</p>
    </div>
  )
}