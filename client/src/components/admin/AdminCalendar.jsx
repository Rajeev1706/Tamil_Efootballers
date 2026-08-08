import { useState, useRef, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus, Pencil, Trash2, Calendar, Save, X, ChevronLeft, ChevronRight } from "lucide-react"
import api from "../../lib/api"
import { cn } from "../../lib/utils"

const TOURNAMENTS = [
  { value: "team_league", label: "Team League" },
  { value: "weekly",      label: "Weekly Tournament" },
  { value: "ucl",         label: "UCL" },
  { value: "playoff",     label: "Playoff" },
  { value: "auction",     label: "Auction" },
]
const STATUS_OPTIONS = ["upcoming", "completed", "cancelled"]
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"]
const DAYS   = ["Mo","Tu","We","Th","Fr","Sa","Su"]

const calendarApi = {
  list:   (season) => api.get(`/calendar?season=${season}`).then(r => r.data),
  create: (data)   => api.post("/calendar", data).then(r => r.data),
  update: (id, data) => api.put(`/calendar/${id}`, data).then(r => r.data),
  remove: (id)     => api.delete(`/calendar/${id}`).then(r => r.data),
}

// ── Mini Calendar Picker ──────────────────────────────────────────────────────
function CalendarPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // Parse current value
  const selected = value ? new Date(value + "T00:00:00") : null
  const today = new Date()

  const [view, setView] = useState(() => {
    if (selected) return new Date(selected.getFullYear(), selected.getMonth(), 1)
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })

  const year  = view.getFullYear()
  const month = view.getMonth()

  // Build grid
  const firstDow = (() => { const d = new Date(year, month, 1).getDay(); return d === 0 ? 6 : d - 1 })()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  const rows = []
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  const selectDay = (day) => {
    if (!day) return
    const str = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    onChange(str)
    setOpen(false)
  }

  const displayValue = selected
    ? selected.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "Select date"

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          "w-full flex items-center gap-2 bg-pitch-900 border rounded-lg px-3 py-2 text-sm text-left transition-colors",
          open ? "border-accent text-white" : "border-surface-border text-slate-300 hover:border-slate-500"
        )}
      >
        <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <span className={selected ? "text-white" : "text-slate-500"}>{displayValue}</span>
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 bg-pitch-800 border border-surface-border rounded-xl shadow-2xl p-3 w-64">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setView(new Date(year, month - 1, 1))}
              className="p-1 rounded-lg hover:bg-pitch-700 text-slate-400 hover:text-white">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-bold text-white">{MONTHS[month]} {year}</span>
            <button onClick={() => setView(new Date(year, month + 1, 1))}
              className="p-1 rounded-lg hover:bg-pitch-700 text-slate-400 hover:text-white">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map(d => (
              <div key={d} className="text-center text-[10px] font-semibold text-slate-500 py-1">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          {rows.map((row, ri) => (
            <div key={ri} className="grid grid-cols-7">
              {row.map((day, ci) => {
                if (!day) return <div key={ci} />
                const isSelected = selected &&
                  selected.getFullYear() === year &&
                  selected.getMonth() === month &&
                  selected.getDate() === day
                const isToday =
                  today.getFullYear() === year &&
                  today.getMonth() === month &&
                  today.getDate() === day

                return (
                  <button
                    key={ci}
                    onClick={() => selectDay(day)}
                    className={cn(
                      "w-8 h-8 mx-auto flex items-center justify-center rounded-lg text-xs font-medium transition-colors",
                      isSelected ? "bg-accent text-white" :
                      isToday    ? "border border-accent/50 text-accent" :
                                   "text-slate-300 hover:bg-pitch-700 hover:text-white"
                    )}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Event Form ────────────────────────────────────────────────────────────────
function EventForm({ initial, onSave, onCancel, season }) {
  const [form, setForm] = useState({
    seasonNumber: season || initial?.season_number || "",
    eventDate:    initial?.event_date ? initial.event_date.split('T')[0] : "",
    tournament:   initial?.tournament || "team_league",
    roundLabel:   initial?.round_label || "",
    notes:        initial?.notes || "",
    status:       initial?.status || "upcoming",
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="card p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Season #</label>
          <input type="number" value={form.seasonNumber} onChange={e => set("seasonNumber", e.target.value)}
            className="w-full bg-pitch-900 border border-surface-border rounded-lg px-3 py-2 text-sm text-white" />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Date</label>
          <CalendarPicker value={form.eventDate} onChange={v => set("eventDate", v)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Tournament</label>
          <select value={form.tournament} onChange={e => set("tournament", e.target.value)}
            className="w-full bg-pitch-900 border border-surface-border rounded-lg px-3 py-2 text-sm text-white">
            {TOURNAMENTS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Round Label</label>
          <input type="text" placeholder="e.g. R12, W2, UCL MD3" value={form.roundLabel} onChange={e => set("roundLabel", e.target.value)}
            className="w-full bg-pitch-900 border border-surface-border rounded-lg px-3 py-2 text-sm text-white" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Status</label>
          <select value={form.status} onChange={e => set("status", e.target.value)}
            className="w-full bg-pitch-900 border border-surface-border rounded-lg px-3 py-2 text-sm text-white">
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Notes (optional)</label>
          <input type="text" placeholder="e.g. Double header week" value={form.notes} onChange={e => set("notes", e.target.value)}
            className="w-full bg-pitch-900 border border-surface-border rounded-lg px-3 py-2 text-sm text-white" />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={() => onSave(form)} className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-accent/90">
          <Save className="w-4 h-4" /> Save
        </button>
        <button onClick={onCancel} className="flex items-center gap-2 bg-pitch-800 text-slate-300 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-pitch-700">
          <X className="w-4 h-4" /> Cancel
        </button>
      </div>
    </div>
  )
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

const TOURNAMENT_LABELS = { team_league: "Team League", weekly: "Weekly", ucl: "UCL", playoff: "Playoff", auction: "Auction" }
const TOURNAMENT_COLORS = { team_league: "text-gold", weekly: "text-blue-400", ucl: "text-violet-400", playoff: "text-orange-400", auction: "text-emerald-400" }

export default function AdminCalendar() {
  const qc = useQueryClient()
  const [season, setSeason] = useState(7)
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState(null)

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["calendar", "admin", season],
    queryFn: () => calendarApi.list(season),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ["calendar"] })

  const createMut = useMutation({ mutationFn: calendarApi.create, onSuccess: () => { invalidate(); setAdding(false) } })
  const updateMut = useMutation({ mutationFn: ({ id, ...data }) => calendarApi.update(id, data), onSuccess: () => { invalidate(); setEditId(null) } })
  const deleteMut = useMutation({ mutationFn: calendarApi.remove, onSuccess: invalidate })

  const grouped = events.reduce((acc, ev) => {
    const month = ev.event_date?.slice(0, 7)
    if (!acc[month]) acc[month] = []
    acc[month].push(ev)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-bold text-white">Season Calendar</h2>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">Season</label>
            <input type="number" value={season} onChange={e => setSeason(Number(e.target.value))}
              className="w-16 bg-pitch-900 border border-surface-border rounded-lg px-2 py-1 text-sm text-white text-center" />
          </div>
        </div>
        <button onClick={() => setAdding(true)} className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-accent/90">
          <Plus className="w-4 h-4" /> Add Event
        </button>
      </div>

      {adding && <EventForm season={season} onSave={data => createMut.mutate(data)} onCancel={() => setAdding(false)} />}

      {isLoading ? (
        <div className="text-slate-500 text-sm text-center py-8">Loading...</div>
      ) : events.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>No events for Season {season}. Add some events to build the calendar.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).sort().map(([month, monthEvents]) => (
            <div key={month}>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                {(() => { const [y,m] = month.split('-'); return new Date(y, m-1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) })()}
              </h3>
              <div className="space-y-2">
                {monthEvents.map(ev => (
                  <div key={ev.id}>
                    {editId === ev.id ? (
                      <EventForm initial={ev} season={season} onSave={data => updateMut.mutate({ id: ev.id, ...data })} onCancel={() => setEditId(null)} />
                    ) : (
                      <div className="flex items-center gap-4 px-4 py-3 bg-pitch-800 rounded-xl border border-surface-border hover:border-accent/30 transition-colors group">
                        <div className="text-sm font-mono text-slate-400 w-20 flex-shrink-0">
                          {(() => { const d = ev.event_date?.split('T')[0]; const [y,m,day] = d.split('-'); return new Date(y, m-1, day).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) })()}
                        </div>
                        <div className={cn("text-sm font-bold w-28 flex-shrink-0", TOURNAMENT_COLORS[ev.tournament] || "text-white")}>
                          {TOURNAMENT_LABELS[ev.tournament] || ev.tournament}
                        </div>
                        <div className="text-sm font-semibold text-white w-20 flex-shrink-0">{ev.round_label}</div>
                        <div className="flex-1 text-xs text-slate-500 truncate">{ev.notes || ""}</div>
                        <div className={cn("text-xs font-semibold capitalize flex-shrink-0",
                          effectiveStatus(ev) === "completed" ? "text-emerald-400" : effectiveStatus(ev) === "cancelled" ? "text-rose-400" : effectiveStatus(ev) === "today" ? "text-accent font-bold" : "text-slate-400")}>
                          {effectiveStatus(ev) === "today" ? "🔴 Today" : effectiveStatus(ev)}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setEditId(ev.id)} className="p-1.5 rounded-lg hover:bg-pitch-700 text-slate-400 hover:text-white">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deleteMut.mutate(ev.id)} className="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-400">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}