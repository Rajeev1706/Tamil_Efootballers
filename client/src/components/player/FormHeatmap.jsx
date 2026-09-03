import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { Calendar } from "lucide-react"
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

const RESULT_BG = {
  win:  "bg-emerald-500/80 border-emerald-400/40",
  draw: "bg-amber-400/80 border-amber-300/40",
  loss: "bg-rose-500/80 border-rose-400/40",
}
const RESULT_TEXT = {
  win: "text-emerald-200", draw: "text-amber-200", loss: "text-rose-200"
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

export default function FormHeatmap({ playerId, seasonNumber }) {
  const [tooltip, setTooltip] = useState(null)

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

  const dates = Object.keys(dayMap).sort()
  const firstDate = new Date(dates[0])
  const lastDate  = new Date(dates[dates.length - 1])

  // Start from Monday of first match week
  const startDate = new Date(firstDate)
  const dow = (startDate.getDay() + 6) % 7
  startDate.setDate(startDate.getDate() - dow)

  // Build weeks
  const weeks = []
  let current = new Date(startDate)
  while (current <= lastDate) {
    const week = []
    for (let d = 0; d < 7; d++) {
      week.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }
    weeks.push(week)
  }

  const totalMatches = data.length
  const wins   = data.filter(m => m.result === "win").length
  const losses = data.filter(m => m.result === "loss").length
  const draws  = data.filter(m => m.result === "draw").length

  return (
    <div className="card p-5 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-500" />
          <p className="text-sm font-semibold text-white">Match Activity</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />{wins}W</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" />{draws}D</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" />{losses}L</span>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: weeks.length * 34 + 40 }}>
          {/* Month + date headers */}
          <div className="flex ml-10">
            {weeks.map((week, wi) => {
              // Show month label at start of each month
              const firstDay = week[0]
              const showMonth = wi === 0 || firstDay.getDate() <= 7
              return (
                <div key={wi} className="flex-shrink-0" style={{ width: 30, marginRight: 4 }}>
                  {showMonth && (
                    <p className="text-[9px] text-slate-400 font-semibold whitespace-nowrap mb-1">
                      {MONTH_NAMES[firstDay.getMonth()]}
                    </p>
                  )}
                  {!showMonth && <div className="mb-1 h-3" />}
                </div>
              )
            })}
          </div>

          {/* Day rows */}
          {DAY_LABELS.map((dayLabel, di) => (
            <div key={di} className="flex items-center mb-1">
              {/* Day label */}
              <span className="text-[9px] text-slate-600 w-9 flex-shrink-0 font-medium">{dayLabel}</span>

              {/* Cells */}
              {weeks.map((week, wi) => {
                const day = week[di]
                const key = day.toISOString().slice(0, 10)
                const matches = dayMap[key] || []
                const result  = matches.length > 0 ? getDominantResult(matches) : null
                const isFuture = day > new Date()
                const isOutOfRange = day < firstDate || day > lastDate

                return (
                  <div
                    key={wi}
                    className={cn(
                      "flex-shrink-0 rounded-sm border flex items-center justify-center cursor-default transition-opacity",
                      result ? RESULT_BG[result] : "bg-pitch-800/60 border-white/5",
                      (isFuture || isOutOfRange) && "opacity-20"
                    )}
                    style={{ width: 30, height: 22, marginRight: 4 }}
                    onMouseEnter={() => matches.length > 0 && setTooltip({ key, matches, result })}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    <span className={cn(
                      "text-[9px] font-semibold select-none",
                      result ? RESULT_TEXT[result] : "text-slate-700"
                    )}>
                      {day.getDate()}
                    </span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div className="px-3 py-2 bg-pitch-800 border border-surface-border rounded-lg text-xs">
          <p className="text-slate-400 mb-1">
            {new Date(tooltip.key).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
          </p>
          <p className="text-white font-medium">
            {tooltip.matches.length} match{tooltip.matches.length > 1 ? "es" : ""} —{" "}
            <span className={cn(
              tooltip.result === "win" ? "text-emerald-400" :
              tooltip.result === "loss" ? "text-rose-400" : "text-amber-400"
            )}>
              {tooltip.result === "win" ? "Win" : tooltip.result === "loss" ? "Loss" : "Draw"}
            </span>
          </p>
          {tooltip.matches.length > 1 && (
            <p className="text-slate-500 mt-0.5">
              {tooltip.matches.filter(m => m.result === "win").length}W{" "}
              {tooltip.matches.filter(m => m.result === "draw").length}D{" "}
              {tooltip.matches.filter(m => m.result === "loss").length}L
            </p>
          )}
        </div>
      )}

      <p className="text-xs text-slate-600">{totalMatches} matches this season</p>
    </div>
  )
}