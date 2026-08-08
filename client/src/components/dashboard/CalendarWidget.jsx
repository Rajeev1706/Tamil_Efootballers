import { useQuery } from "@tanstack/react-query"
import { Calendar, ChevronRight } from "lucide-react"
import { Link } from "react-router-dom"
import api from "../../lib/api"
import { cn } from "../../lib/utils"

const TOURNAMENT_COLORS = {
  team_league: "bg-gold/20 text-gold border-gold/40",
  weekly:      "bg-blue-400/20 text-blue-400 border-blue-400/40",
  ucl:         "bg-violet-400/20 text-violet-400 border-violet-400/40",
  playoff:     "bg-orange-400/20 text-orange-400 border-orange-400/40",
  auction:     "bg-emerald-400/20 text-emerald-400 border-emerald-400/40",
}
const TOURNAMENT_LABELS = {
  team_league: "Team League", weekly: "Weekly", ucl: "UCL", playoff: "Playoff", auction: "Auction"
}

export default function CalendarWidget() {
  const { data: events = [] } = useQuery({
    queryKey: ["calendar", "upcoming"],
    queryFn: () => api.get("/calendar/upcoming").then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  if (!events.length) return null

  const today = new Date().toISOString().split("T")[0]

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-white">Upcoming Fixtures</h2>
        </div>
        <Link to="/calendar" className="flex items-center gap-1 text-xs text-slate-400 hover:text-accent transition-colors">
          View calendar <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="divide-y divide-surface-border/50">
        {events.map(ev => {
          const date = new Date(ev.event_date + "T00:00:00")
          const dateStr = ev.event_date?.split("T")[0]
          const isToday = dateStr === today
          const formatted = date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
          const color = TOURNAMENT_COLORS[ev.tournament] || TOURNAMENT_COLORS.team_league
          const label = TOURNAMENT_LABELS[ev.tournament] || ev.tournament

          return (
            <div key={ev.id} className="flex items-center gap-4 px-5 py-3">
              <div className={cn("text-xs font-bold w-16 flex-shrink-0", isToday ? "text-accent" : "text-slate-400")}>
                {isToday ? "Today" : formatted}
              </div>
              <div className={cn("text-xs font-bold px-2 py-0.5 rounded border flex-shrink-0", color)}>
                {label}
              </div>
              <div className="text-xs font-semibold text-white">{ev.round_label}</div>
              {ev.notes && <div className="text-xs text-slate-500 truncate flex-1">{ev.notes}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}