import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { Calendar } from "lucide-react"
import api from "../../lib/api"
import { cn } from "../../lib/utils"

function getDominantResult(matches) {
  const wins   = matches.filter(m => m.result === "win").length
  const draws  = matches.filter(m => m.result === "draw").length
  const losses = matches.filter(m => m.result === "loss").length
  if (wins > losses && wins >= draws) return "win"
  if (losses > wins && losses >= draws) return "loss"
  if (draws >= wins && draws >= losses) return "draw"
  return null
}

const RESULT_STYLES = {
  win:  "bg-emerald-500",
  draw: "bg-amber-400",
  loss: "bg-rose-500",
  null: "bg-pitch-800",
}

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
const DAY_LABELS   = ["Mon","","Wed","","Fri","","Sun"]

export default function FormHeatmap({ playerId, seasonNumber }) {
  const [tooltip, setTooltip] = useState(null)

  const { data = [], isLoading } = useQuery({
    queryKey: ["form-heatmap", playerId, seasonNumber],
    queryFn:  () => api.get(`/players/${playerId}/form-heatmap?season=${seasonNumber}`).then(r => r.data),
    enabled:  !!playerId,
  })

  if (isLoading) return (
    <div className="card p-5 animate-pulse h-32" />
  )

  if (data.length === 0) return null

  // Build day map
  const dayMap = {}
  for (const m of data) {
    const day = m.date.slice(0, 10)
    if (!dayMap[day]) dayMap[day] = []
    dayMap[day].push(m)
  }

  // Build calendar grid — from first to last match date
  const dates = Object.keys(dayMap).sort()
  if (dates.length === 0) return null

  const firstDate = new Date(dates[0])
  const lastDate  = new Date(dates[dates.length - 1])

  // Start from Monday of first match week
  const startDate = new Date(firstDate)
  const dayOfWeek = (startDate.getDay() + 6) % 7  // Mon=0
  startDate.setDate(startDate.getDate() - dayOfWeek)

  // Build weeks array
  const weeks = []
  let current  = new Date(startDate)
  while (current <= lastDate) {
    const week = []
    for (let d = 0; d < 7; d++) {
      week.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }
    weeks.push(week)
  }

  // Month labels
  const monthPositions = []
  weeks.forEach((week, wi) => {
    const firstDay = week[0]
    if (firstDay.getDate() <= 7 || wi === 0) {
      monthPositions.push({ wi, label: MONTH_LABELS[firstDay.getMonth()] })
    }
  })

  const totalMatches = data.length
  const wins   = data.filter(m => m.result === "win").length
  const losses = data.filter(m => m.result === "loss").length
  const draws  = data.filter(m => m.result === "draw").length

  return (
    <div className="card p-5 space-y-3">
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

      <div className="overflow-x-auto">
        <div className="flex gap-0" style={{ minWidth: weeks.length * 13 }}>
          {/* Day labels */}
          <div className="flex flex-col gap-0.5 mr-1.5 flex-shrink-0">
            <div className="h-4" />
            {DAY_LABELS.map((d, i) => (
              <div key={i} className="h-[10px] flex items-center">
                <span className="text-[8px] text-slate-600 w-5">{d}</span>
              </div>
            ))}
          </div>

          {/* Weeks */}
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-0.5 flex-shrink-0" style={{ width: 12 }}>
              {/* Month label */}
              <div className="h-4 flex items-center">
                {monthPositions.find(m => m.wi === wi) && (
                  <span className="text-[8px] text-slate-500 whitespace-nowrap">
                    {monthPositions.find(m => m.wi === wi).label}
                  </span>
                )}
              </div>
              {/* Days */}
              {week.map((day, di) => {
                const key     = day.toISOString().slice(0, 10)
                const matches = dayMap[key] || []
                const result  = matches.length > 0 ? getDominantResult(matches) : null
                const style   = RESULT_STYLES[result] || RESULT_STYLES.null

                return (
                  <div key={di}
                    className={cn("w-[10px] h-[10px] rounded-[2px] cursor-default transition-opacity hover:opacity-70", style)}
                    onMouseEnter={() => matches.length > 0 && setTooltip({ key, matches, result })}
                    onMouseLeave={() => setTooltip(null)}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div className="px-3 py-2 bg-pitch-800 border border-surface-border rounded-lg text-xs">
          <p className="text-slate-400 mb-1">{new Date(tooltip.key).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</p>
          <p className="text-white font-medium">{tooltip.matches.length} match{tooltip.matches.length > 1 ? "es" : ""} — Dominant: <span className={cn(
            tooltip.result === "win" ? "text-emerald-400" : tooltip.result === "loss" ? "text-rose-400" : "text-amber-400"
          )}>{tooltip.result?.toUpperCase()}</span></p>
          {tooltip.matches.length > 1 && (
            <p className="text-slate-500 mt-0.5">
              {tooltip.matches.filter(m => m.result === "win").length}W {tooltip.matches.filter(m => m.result === "draw").length}D {tooltip.matches.filter(m => m.result === "loss").length}L
            </p>
          )}
        </div>
      )}

      <p className="text-xs text-slate-600">{totalMatches} matches this season</p>
    </div>
  )
}