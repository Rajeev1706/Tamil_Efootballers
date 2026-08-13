import { useParams, useNavigate } from "react-router-dom"
import { Trophy, ArrowLeft } from "lucide-react"
import { cn } from "../lib/utils"
import { useState } from "react"
import { usePlayer, useTrophyHistory, useTrophyHistoryYear, useTrophyYears } from "../lib/queries"
import { getAvatarById } from "../lib/avatars"
import Layout from "../components/layout/Layout"
import GradeBadge from "../components/common/GradeBadge"

import ballondorTrophy    from "../../images/ballondor.png"
import teamLeagueTrophy   from "../../images/Team League.png"
import weeklyTrophy       from "../../images/Weekly.png"
import uclTrophy          from "../../images/ucl.png"
import goldenBootTrophy   from "../../images/Golden Boot.png"
import teamLeagueGBTrophy from "../../images/team league_gb.png"
import uclGBTrophy        from "../../images/ucl_gb.png"
import duoTrophy          from "../../images/duo.png"
import duoBootTrophy      from "../../images/duoboot.png"
import revolutionTrophy   from "../../images/revolution.png"
import europaTrophy       from "../../images/europa.png"

const TROPHY_TYPES = [
  { key: "trophy1Count",  image: ballondorTrophy,    label: "Ballon d'Or",        color: "#f59e0b", glow: "rgba(245,158,11,0.45)"  },
  { key: "trophy2Count",  image: teamLeagueTrophy,   label: "Team League",        color: "#10b981", glow: "rgba(16,185,129,0.45)"  },
  { key: "trophy4Count",  image: uclTrophy,          label: "UCL",                color: "#818cf8", glow: "rgba(129,140,248,0.45)" },
  { key: "trophy3Count",  image: weeklyTrophy,       label: "Weekly",             color: "#38bdf8", glow: "rgba(56,189,248,0.45)"  },
  { key: "trophy5Count",  image: goldenBootTrophy,   label: "Weekly Golden Boot", color: "#fbbf24", glow: "rgba(251,191,36,0.45)"  },
  { key: "trophy6Count",  image: teamLeagueGBTrophy, label: "League Golden Boot", color: "#34d399", glow: "rgba(52,211,153,0.45)"  },
  { key: "trophy7Count",  image: uclGBTrophy,        label: "UCL Golden Boot",    color: "#a78bfa", glow: "rgba(167,139,250,0.45)" },
  { key: "trophy8Count",  image: revolutionTrophy,   label: "Revolution",         color: "#f43f5e", glow: "rgba(244,63,94,0.45)"   },
  { key: "trophy9Count",  image: europaTrophy,        label: "Europa",             color: "#8b5cf6", glow: "rgba(139,92,246,0.45)"  },
  { key: "trophy10Count", image: duoTrophy,          label: "Duo Tournament",     color: "#fb923c", glow: "rgba(251,146,60,0.45)"  },
  { key: "trophy11Count", image: duoBootTrophy,      label: "Duo Golden Boot",    color: "#f97316", glow: "rgba(249,115,22,0.45)"  },
]

const TROPHIES_PER_SHELF = 5  // keeps 5 per shelf - better mobile fit

function SingleTrophy({ type }) {
  return (
    <div className="flex flex-col items-center gap-0 group flex-shrink-0 -mt-1">
      {/* Trophy */}
      <div
        className="transition-all duration-300 group-hover:scale-105 sm:group-hover:-translate-y-2 sm:group-hover:scale-108 mt-4"
        style={{ filter: `drop-shadow(0 4px 10px ${type.glow.replace('0.45)', '0.2)')})` }}
      >
        <img
          src={type.image}
          alt={type.label}
          className="w-10 h-10 sm:w-20 sm:h-20 object-contain"
        />
      </div>
      {/* Reflection */}
      {/* Name plate */}
      <div
        className="mt-1 px-2 py-0.5 rounded text-center"
        style={{
          background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
          border: `1px solid ${type.color}35`,
          boxShadow: `inset 0 1px 0 ${type.color}15`,
        }}
      >
        <p className="text-[7px] sm:text-[11px] font-bold leading-tight max-w-[50px] sm:max-w-[80px] text-center"
          style={{ color: type.color }}>
          {type.label}
        </p>
      </div>
    </div>
  )
}

function CabinetShelf({ items, shelfNumber }) {
  return (
    <div className="relative">
      {/* Shelf interior */}
      <div
        className="relative rounded-xl px-0 pt-2 sm:pt-3 pb-0"
        style={{
          background: "rgba(0,0,0,0.25)",
          borderTop: "1px solid rgba(255,255,255,0.04)",
        }}
      >




        {/* Trophies */}
        <div className="flex items-end justify-evenly w-full px-1 sm:px-6 overflow-x-auto">
          {items.map((type, i) => (
            <SingleTrophy key={i} type={type} />
          ))}
        </div>

        {/* Shelf plank — wood grain effect */}
        <div
          className="h-3 mt-2 relative"
          style={{
            background: "linear-gradient(180deg, #2a3344 0%, #1a2233 40%, #111827 100%)",
            boxShadow: "0 6px 20px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.5)",
          }}
        >
          {/* Wood grain lines */}
          <div className="absolute inset-0 opacity-20"
            style={{ backgroundImage: "repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(255,255,255,0.03) 40px, rgba(255,255,255,0.03) 41px)" }}
          />
        </div>
      </div>
    </div>
  )
}

export default function PlayerTrophyCabinet() {
  const { id }   = useParams()
  const navigate = useNavigate()

  const [yearFilter, setYearFilter]     = useState("overall")
  const [trophyFilter, setTrophyFilter] = useState("all")

  const { data: trophyYearsData } = useTrophyYears()
  const currentYear = trophyYearsData?.currentYear || new Date().getFullYear()
  const pastYears   = trophyYearsData?.pastYears   || []

  const { data: player, isLoading }    = usePlayer(id)
  const { data: allTimeData = [] }     = useTrophyHistory()
  const { data: yearData = [] }        = useTrophyHistoryYear(yearFilter !== "overall" ? parseInt(yearFilter) : null)

  if (isLoading) return (
    <Layout>
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    </Layout>
  )

  if (!player) return (
    <Layout><p className="text-slate-500 text-center py-16">Player not found</p></Layout>
  )

  const preset        = getAvatarById(player.avatarId)
  const avatarSrc     = player.avatarUrl || preset?.thumb
  const allTimePlayer = allTimeData.find(p => p.id === player.id)
  const yearPlayer    = yearData.find(p => p.id === player.id)
  const trophySource  = yearFilter === "overall"
    ? (allTimePlayer || player)
    : (yearPlayer || { trophy1Count: 0, trophy2Count: 0, trophy3Count: 0, trophy4Count: 0, trophy5Count: 0, trophy6Count: 0, trophy7Count: 0, trophy8Count: 0, trophy9Count: 0, trophy10Count: 0, trophy11Count: 0 })


  // Trophy category groups
  const TROPHY_GROUPS = {
    all:      ["trophy1Count","trophy2Count","trophy3Count","trophy4Count","trophy5Count","trophy6Count","trophy7Count","trophy8Count","trophy9Count","trophy10Count","trophy11Count"],
    bdr:      ["trophy1Count"],
    league:   ["trophy2Count","trophy6Count"],
    ucl:      ["trophy4Count","trophy7Count"],
    weekly:   ["trophy3Count","trophy5Count"],
    duo:      ["trophy10Count","trophy11Count"],
  }

  const activeTrophyKeys = new Set(TROPHY_GROUPS[trophyFilter] || TROPHY_GROUPS.all)

  // Build flat array of every individual trophy instance
  // e.g. 5 BDR = 5 entries of the BDR type
  const allTrophyInstances = []
  TROPHY_TYPES.forEach(type => {
    if (!activeTrophyKeys.has(type.key)) return  // skip filtered out types
    const count = trophySource[type.key] || 0
    for (let i = 0; i < count; i++) {
      allTrophyInstances.push(type)
    }
  })

  const total = allTrophyInstances.length

  // Chunk into shelves of TROPHIES_PER_SHELF each
  const shelves = []
  for (let i = 0; i < allTrophyInstances.length; i += TROPHIES_PER_SHELF) {
    shelves.push(allTrophyInstances.slice(i, i + TROPHIES_PER_SHELF))
  }

  return (
    <Layout backgroundImage={player.avatarBgUrl || preset?.bg || null}>
      {/* Back */}
      <button onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium mb-5 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Player header */}
      <div className="flex items-center gap-4 mb-8">
        {avatarSrc
          ? <img src={avatarSrc} alt={player.name} className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-gold/30 flex-shrink-0" />
          : <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gold/10 border-2 border-gold/30 flex items-center justify-center text-xl font-black text-gold flex-shrink-0">
              {player.name?.split(" ").map(n => n[0]).join("")}
            </div>
        }
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-extrabold text-white">{player.name}</h1>
            <GradeBadge grade={player.grade} size="sm" />
          </div>
          {player.team && <p className="text-slate-400 text-sm">{player.team}</p>}
          <div className="flex items-center gap-2 mt-1">
            <Trophy className="w-4 h-4 text-gold" />
            <span className="text-gold font-bold">{total} {total === 1 ? "Trophy" : "Trophies"}</span>
          </div>
        </div>
      </div>

      {/* Year filter */}
      <div className="flex items-center gap-2 mb-4">
        <label className="text-xs text-slate-500 flex-shrink-0">Filter:</label>
        <select
          value={yearFilter}
          onChange={e => setYearFilter(e.target.value)}
          className="bg-pitch-800/80 border border-surface-border rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-accent backdrop-blur-sm"
        >
          <option value="overall">Overall (All Time)</option>
          <option value={String(currentYear)}>Current Year ({currentYear})</option>
          {pastYears.map(y => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
        </select>
      </div>

      {/* Trophy category filter */}
      <div className="flex gap-2 flex-wrap">
        {[
          { id: "all",    label: "All" },
          { id: "bdr",    label: "Ballon d'Or" },
          { id: "league", label: "Team League" },
          { id: "ucl",    label: "UCL" },
          { id: "weekly", label: "Weekly" },
          { id: "duo",    label: "Duo" },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setTrophyFilter(f.id)}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex-shrink-0",
              trophyFilter === f.id
                ? "bg-accent text-white border-accent"
                : "bg-pitch-800/80 text-slate-400 border-surface-border hover:text-white backdrop-blur-sm"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {total === 0 ? (
        <div
          className="rounded-2xl p-16 text-center"
          style={{
            background: "linear-gradient(180deg, #080d14 0%, #0d1520 100%)",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <div className="text-6xl mb-4 opacity-10">🏆</div>
          <p className="text-slate-600 font-semibold">No trophies yet</p>
          <p className="text-slate-700 text-sm mt-1">The cabinet awaits its first glory</p>
        </div>
      ) : (
        /* Cabinet outer frame */
        <div
          className="rounded-2xl"
          style={{
            background: "transparent",
            border: "none",
            boxShadow: "none",
          }}
        >
          {/* Cabinet header plate */}
          <div
            className="px-6 py-4 flex items-center justify-between"
            style={{
              background: "rgba(0,0,0,0.3)",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "none",
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-1 h-8 rounded-full bg-gold" style={{ boxShadow: "0 0 8px rgba(245,158,11,0.6)" }} />
              <div>
                <p className="text-[9px] text-slate-600 uppercase tracking-[0.2em]">Tamil Efootballers</p>
                <p className="text-sm font-bold text-white">{player.name}'s Trophy Cabinet</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black text-gold font-mono" style={{ textShadow: "0 0 20px rgba(245,158,11,0.4)" }}>
                {total}
              </p>
              <p className="text-[9px] text-slate-600 uppercase tracking-widest">Trophies</p>
            </div>
          </div>

          {/* Cabinet sides */}
          <div className="flex">
            {/* Left side panel */}
            <div className="w-1 sm:w-2 flex-shrink-0"
              style={{ background: "linear-gradient(90deg, #0a0f1a 0%, #111827 100%)", borderRight: "1px solid rgba(255,255,255,0.03)" }} />

            {/* Shelves */}
            <div className="flex-1 py-4 space-y-1">
              {shelves.map((shelfItems, idx) => (
                <CabinetShelf key={idx} items={shelfItems} shelfNumber={idx + 1} />
              ))}
            </div>

            {/* Right side panel */}
            <div className="w-1 sm:w-2 flex-shrink-0"
              style={{ background: "linear-gradient(270deg, #0a0f1a 0%, #111827 100%)", borderLeft: "1px solid rgba(255,255,255,0.03)" }} />
          </div>

          {/* Cabinet base */}
          <div
            className="h-4"
            style={{
              background: "transparent",
              borderTop: "none",
            }}
          />
        </div>
      )}
    </Layout>
  )
}