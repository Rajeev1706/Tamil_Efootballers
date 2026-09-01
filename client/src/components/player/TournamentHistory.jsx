import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Trophy, ChevronDown } from "lucide-react"
import { playersApi } from "../../lib/api"
import { cn } from "../../lib/utils"

const VIEWS = [
  { value: "overall",    label: "Overall"    },
  { value: "weekly",     label: "Weekly"     },
  { value: "revolution", label: "Revolution" },
  { value: "ucl",       label: "UCL"        },
  { value: "duo",       label: "Duo"        },
]

// Round labels for display
const KO_ROUNDS = [
  { key: "winner", label: "🏆 Winner"       },
  { key: "final",  label: "Runner-up"       },
  { key: "sf",     label: "Semi Finals"     },
  { key: "qf",     label: "Quarter Finals"  },
  { key: "r16",    label: "Round of 16"     },
  { key: "r32",    label: "Round of 32"     },
  { key: "r64",    label: "Round of 64"     },
]

const UCL_GROUP_POSITIONS = [1, 2, 3, 4, 5, 6, 7, 8]
const DUO_GROUP_POSITIONS  = [1, 2, 3, 4]

function ordinal(n) {
  const s = ["th","st","nd","rd"]
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

// Single row in the breakdown table
function StatRow({ label, value, highlight }) {
  if (!value) return null
  return (
    <div className={cn(
      "flex items-center justify-between px-4 py-2.5 rounded-xl transition-colors",
      highlight ? "bg-gold/10 border border-gold/20" : "bg-pitch-800/60"
    )}>
      <span className={cn("text-sm", highlight ? "text-gold font-semibold" : "text-slate-400")}>{label}</span>
      <span className={cn("text-sm font-bold font-mono", highlight ? "text-gold" : "text-white")}>{value}</span>
    </div>
  )
}

// Section with a title and rows
function Section({ title, children }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] text-slate-600 uppercase tracking-widest font-semibold px-1">{title}</p>
      {children}
    </div>
  )
}

function KnockoutSection({ title, data, rounds = KO_ROUNDS }) {
  const hasData = rounds.some(r => data?.[r.key] > 0)
  if (!hasData) return (
    <Section title={title}>
      <p className="text-xs text-slate-600 px-1 py-2">No data yet</p>
    </Section>
  )
  return (
    <Section title={title}>
      {rounds.map(r => data?.[r.key] > 0 && (
        <StatRow key={r.key} label={r.label} value={`× ${data[r.key]}`} highlight={r.key === "winner"} />
      ))}
    </Section>
  )
}

function GroupSection({ title, data, positions }) {
  const hasData = positions.some(p => data?.[p] > 0)
  if (!hasData) return (
    <Section title={title}>
      <p className="text-xs text-slate-600 px-1 py-2">No data yet</p>
    </Section>
  )
  return (
    <Section title={title}>
      {positions.map(p => data?.[p] > 0 && (
        <StatRow key={p} label={ordinal(p) + " place"} value={`× ${data[p]}`} highlight={p === 1} />
      ))}
    </Section>
  )
}

// Weekly / Revolution view (knockout only)
function SimpleKOView({ data, name }) {
  return (
    <KnockoutSection title={`${name} — Knockout`} data={data} />
  )
}

// UCL view (group + knockout)
function UclView({ data }) {
  return (
    <div className="space-y-4">
      <GroupSection title="UCL — Group Stage" data={data?.group} positions={UCL_GROUP_POSITIONS} />
      <KnockoutSection title="UCL — Knockout" data={data?.knockout} />
    </div>
  )
}

// Duo view (group + knockout)
function DuoView({ data }) {
  const duoKoRounds = KO_ROUNDS.filter(r => !["r32","r64"].includes(r.key))
  return (
    <div className="space-y-4">
      <GroupSection title="Duo — Group Stage" data={data?.group} positions={DUO_GROUP_POSITIONS} />
      <KnockoutSection title="Duo — Knockout" data={data?.knockout} rounds={duoKoRounds} />
    </div>
  )
}

// Overall — sum everything up
function OverallView({ history }) {
  if (!history) return null
  const totalWins = (history.weekly?.winner || 0) + (history.revolution?.winner || 0) +
    (history.ucl?.knockout?.winner || 0) + (history.duo?.knockout?.winner || 0)
  const totalFinals = (history.weekly?.final || 0) + (history.revolution?.final || 0) +
    (history.ucl?.knockout?.final || 0) + (history.duo?.knockout?.final || 0)
  const totalSF = (history.weekly?.sf || 0) + (history.revolution?.sf || 0) +
    (history.ucl?.knockout?.sf || 0) + (history.duo?.knockout?.sf || 0)
  const totalQF = (history.weekly?.qf || 0) + (history.revolution?.qf || 0) +
    (history.ucl?.knockout?.qf || 0) + (history.duo?.knockout?.qf || 0)

  const hasAny = totalWins + totalFinals + totalSF + totalQF > 0

  if (!hasAny) return (
    <p className="text-xs text-slate-600 text-center py-6">No tournament history yet</p>
  )

  return (
    <Section title="Overall Knockout History">
      {totalWins  > 0 && <StatRow label="🏆 Tournaments Won" value={`× ${totalWins}`}  highlight />}
      {totalFinals > 0 && <StatRow label="Runner-up"           value={`× ${totalFinals}`} />}
      {totalSF    > 0 && <StatRow label="Semi Finals"        value={`× ${totalSF}`}    />}
      {totalQF    > 0 && <StatRow label="Quarter Finals"     value={`× ${totalQF}`}    />}
    </Section>
  )
}

export default function TournamentHistory({ playerId }) {
  const [view, setView]     = useState("overall")
  const [open, setOpen]     = useState(false)

  const { data: history, isLoading } = useQuery({
    queryKey: ["tournament-history", playerId],
    queryFn:  () => playersApi.tournamentHistory(playerId),
    enabled:  !!playerId,
    staleTime: 1000 * 60 * 5,
  })

  const currentView = VIEWS.find(v => v.value === view)

  return (
    <div className="card">
      {/* Header with dropdown */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-gold" />
          <h3 className="text-sm font-semibold text-white">Tournament History</h3>
        </div>
        <div className="relative z-20">
          <button
            onClick={() => setOpen(o => !o)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-pitch-800 border border-surface-border rounded-lg text-xs text-slate-300 hover:text-white transition-colors"
          >
            {currentView?.label}
            <ChevronDown className={cn("w-3 h-3 transition-transform", open && "rotate-180")} />
          </button>
          {open && (
            <div className="absolute right-0 top-full mt-1 z-50 bg-pitch-800 border border-surface-border rounded-xl shadow-xl overflow-hidden min-w-[140px]">
              {VIEWS.map(v => (
                <button
                  key={v.value}
                  onClick={() => { setView(v.value); setOpen(false) }}
                  className={cn(
                    "w-full text-left px-4 py-2.5 text-xs transition-colors",
                    view === v.value
                      ? "bg-accent/15 text-accent font-semibold"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  )}
                >
                  {v.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {isLoading ? (
          <p className="text-xs text-slate-500 text-center py-6">Loading…</p>
        ) : (
          <div>
            {view === "overall"    && <OverallView history={history} />}
            {view === "weekly"     && <SimpleKOView data={history?.weekly}    name="Weekly" />}
            {view === "revolution" && <SimpleKOView data={history?.revolution} name="Revolution" />}
            {view === "ucl"        && <UclView  data={history?.ucl} />}
            {view === "duo"        && <DuoView  data={history?.duo} />}
          </div>
        )}
      </div>
    </div>
  )
}