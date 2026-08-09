import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight, Calendar, Trophy, Zap, Star, Gavel } from "lucide-react"
import Layout from "../components/layout/Layout"
import api, { calendarApi } from "../lib/api"
import { cn } from "../lib/utils"

// ── Config ────────────────────────────────────────────────────────────────────

const TOURNAMENTS = {
  team_league: { label: "Team League", short: "TL", color: "bg-gold/20 text-gold border-gold/40",        dot: "bg-gold",         icon: Trophy },
  weekly:      { label: "Weekly",      short: "WK", color: "bg-blue-400/20 text-blue-400 border-blue-400/40", dot: "bg-blue-400",  icon: Zap    },
  ucl:         { label: "UCL",         short: "UCL",color: "bg-violet-400/20 text-violet-400 border-violet-400/40", dot: "bg-violet-400", icon: Star  },
  playoff:     { label: "Playoff",     short: "PO", color: "bg-orange-400/20 text-orange-400 border-orange-400/40", dot: "bg-orange-400", icon: Trophy },
  auction:     { label: "Auction",     short: "AUC",color: "bg-emerald-400/20 text-emerald-400 border-emerald-400/40", dot: "bg-emerald-400", icon: Gavel },
}

const STATUS_COLORS = {
  upcoming:  "text-slate-300",
  completed: "text-emerald-400",
  cancelled: "text-rose-400 line-through",
  today:     "text-accent font-bold",
}

// Auto status: past = completed, today = today, future = upcoming
function effectiveStatus(ev) {
  if (ev.status !== "upcoming") return ev.status
  const today = new Date(); today.setHours(0,0,0,0)
  const [y,m,d] = ev.event_date.split('T')[0].split('-')
  const eventDate = new Date(y, m-1, d)
  if (eventDate.getTime() === today.getTime()) return "today"
  return eventDate < today ? "completed" : "upcoming"
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"]

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

function getDaysInMonth(year, month) {
  // Returns array of Date objects for all days in the month
  const days = []
  const d = new Date(year, month, 1)
  while (d.getMonth() === month) {
    days.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }
  return days
}

function getFirstDayOfWeek(year, month) {
  // Monday = 0 ... Sunday = 6
  const day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1
}

function toLocalDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EventBadge({ event, compact = false }) {
  const t = TOURNAMENTS[event.tournament] || TOURNAMENTS.team_league
  if (compact) {
    return (
      <div className={cn("text-[9px] font-bold px-1 py-0.5 rounded border truncate leading-tight", t.color)}>
        {t.short} {event.round_label}
      </div>
    )
  }
  const Icon = t.icon
  return (
    <div className={cn("flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold", t.color)}>
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span>{t.label} · {event.round_label}</span>
    </div>
  )
}

function ExpandedDay({ events, dateStr }) {
  const [_y,_m,_d] = dateStr.split('-'); const date = new Date(_y, _m-1, _d)
  const formatted = date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })

  return (
    <div className="col-span-7 mx-1 mb-2">
      <div className="card overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
        <div className="px-4 py-3 border-b border-surface-border flex items-center gap-2">
          <Calendar className="w-4 h-4 text-accent" />
          <p className="text-sm font-semibold text-white">{formatted}</p>
        </div>
        <div className="p-4 space-y-2">
          {events.map(ev => {
            const t = TOURNAMENTS[ev.tournament] || TOURNAMENTS.team_league
            const Icon = t.icon
            return (
              <div key={ev.id} className={cn("flex items-start gap-3 p-3 rounded-xl border", t.color)}>
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", t.color)}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm">{t.label}</p>
                  <p className="text-xs opacity-80">{ev.round_label} · Season {ev.season_number}</p>
                  {ev.notes && <p className="text-xs opacity-60 mt-1">{ev.notes}</p>}
                  <p className={cn("text-xs font-semibold mt-1 capitalize", STATUS_COLORS[effectiveStatus(ev)])}>
                    {effectiveStatus(ev) === "today" ? "🔴 Today" : effectiveStatus(ev)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Main Calendar ─────────────────────────────────────────────────────────────

export default function SeasonCalendar() {
  const today = new Date()
  const [viewDate, setViewDate]       = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState(null)

  const monthKey = getMonthKey(viewDate)
  const { data: events = [] } = useQuery({
    queryKey: ["calendar", monthKey],
    queryFn: () => calendarApi.list(monthKey),
  })

  // Also fetch next month for continuity
  const nextMonthDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1)
  const { data: nextEvents = [] } = useQuery({
    queryKey: ["calendar", getMonthKey(nextMonthDate)],
    queryFn: () => calendarApi.list(getMonthKey(nextMonthDate)),
  })

  const allEvents = useMemo(() => [...events, ...nextEvents], [events, nextEvents])

  // Group events by date string
  const eventsByDate = useMemo(() => {
    const map = {}
    allEvents.forEach(ev => {
      const d = ev.event_date?.split("T")[0] ?? ev.event_date
      if (!map[d]) map[d] = []
      map[d].push(ev)
    })
    return map
  }, [allEvents])

  const year  = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const days  = getDaysInMonth(year, month)
  const firstDow = getFirstDayOfWeek(year, month) // 0=Mon

  const todayStr = toLocalDateStr(today)

  // Build calendar grid rows — each row = array of 7 days (nulls for padding)
  const grid = useMemo(() => {
    const cells = []
    for (let i = 0; i < firstDow; i++) cells.push(null)
    days.forEach(d => cells.push(d))
    while (cells.length % 7 !== 0) cells.push(null)

    const rows = []
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
    return rows
  }, [days, firstDow])

  // Selected day's events
  const selectedEvents = selectedDate ? (eventsByDate[selectedDate] || []) : []

  // Which row contains the selected date
  const selectedRowIndex = useMemo(() => {
    if (!selectedDate) return null
    for (let r = 0; r < grid.length; r++) {
      if (grid[r].some(d => d && toLocalDateStr(d) === selectedDate)) return r
    }
    return null
  }, [selectedDate, grid])

  const prevMonth = () => {
    setSelectedDate(null)
    setViewDate(new Date(year, month - 1, 1))
  }
  const nextMonth = () => {
    setSelectedDate(null)
    setViewDate(new Date(year, month + 1, 1))
  }

  const handleDayClick = (d) => {
    if (!d) return
    const str = toLocalDateStr(d)
    setSelectedDate(prev => prev === str ? null : str)
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-white">Season Calendar</h1>
            <p className="text-sm text-slate-400 mt-0.5">Full match schedule for the season</p>
          </div>
          {/* Legend */}
          <div className="hidden sm:flex items-center gap-3 flex-wrap justify-end">
            {Object.entries(TOURNAMENTS).map(([key, t]) => (
              <div key={key} className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className={cn("w-2 h-2 rounded-full", t.dot)} />
                {t.label}
              </div>
            ))}
          </div>
        </div>

        {/* Calendar card */}
        <div className="card overflow-hidden">

          {/* Month nav */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border">
            <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-surface-hover text-slate-400 hover:text-white transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-extrabold text-white">
              {MONTHS[month]} {year}
            </h2>
            <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-surface-hover text-slate-400 hover:text-white transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-surface-border">
            {DAYS.map(d => (
              <div key={d} className="text-center text-xs font-semibold text-slate-500 py-2">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="p-2">
            {grid.map((row, rowIdx) => (
              <>
                {/* Day cells row */}
                <div key={`row-${rowIdx}`} className="grid grid-cols-7 gap-1 mb-1">
                  {row.map((d, colIdx) => {
                    if (!d) return <div key={colIdx} className="min-h-[80px]" />
                    const str = toLocalDateStr(d)
                    const dayEvents = eventsByDate[str] || []
                    const isToday   = str === todayStr
                    const isSelected = str === selectedDate
                    const hasEvents  = dayEvents.length > 0

                    return (
                      <button
                        key={str}
                        onClick={() => handleDayClick(d)}
                        className={cn(
                          "min-h-[80px] rounded-xl p-1.5 text-left transition-all border",
                          isSelected
                            ? "border-accent bg-accent/10"
                            : hasEvents
                            ? "border-surface-border hover:border-accent/50 hover:bg-surface-hover cursor-pointer"
                            : "border-transparent cursor-default",
                          isToday && !isSelected && "border-accent/40 bg-accent/5"
                        )}
                      >
                        {/* Date number */}
                        <div className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mb-1",
                          isToday ? "bg-accent text-white" : "text-slate-300"
                        )}>
                          {d.getDate()}
                        </div>

                        {/* Event badges */}
                        <div className="space-y-0.5">
                          {dayEvents.slice(0, 2).map(ev => (
                            <EventBadge key={ev.id} event={ev} compact />
                          ))}
                          {dayEvents.length > 2 && (
                            <div className="text-[9px] text-slate-500 font-medium">
                              +{dayEvents.length - 2} more
                            </div>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* Expanded event detail — shows below the row of the selected date */}
                {selectedRowIndex === rowIdx && selectedDate && selectedEvents.length > 0 && (
                  <div key={`expand-${rowIdx}`} className="grid grid-cols-1 mb-1">
                    <ExpandedDay events={selectedEvents} dateStr={selectedDate} />
                  </div>
                )}
              </>
            ))}
          </div>

        </div>

        {/* Mobile legend */}
        <div className="sm:hidden flex items-center gap-3 flex-wrap mt-4">
          {Object.entries(TOURNAMENTS).map(([key, t]) => (
            <div key={key} className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className={cn("w-2 h-2 rounded-full", t.dot)} />
              {t.label}
            </div>
          ))}
        </div>

      </div>
    </Layout>
  )
}