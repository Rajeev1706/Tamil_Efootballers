import { useParams, useNavigate } from "react-router-dom"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Trophy, ArrowLeft } from "lucide-react"
import Layout from "../components/layout/Layout"
import { useCachedImage } from "../hooks/useCachedImage"
import api from "../lib/api"
import { cn } from "../lib/utils"

import teamLeagueTrophy from "../../images/Team League.png"

// ── Same shelf components as PlayerTrophyCabinet ──────────────────────────────

function SingleTrophy() {
  return (
    <div className="flex flex-col items-center gap-0 group flex-shrink-0 -mt-1">
      <div
        className="transition-all duration-300 group-hover:scale-105 sm:group-hover:-translate-y-2 mt-4"
        style={{ filter: "drop-shadow(0 4px 10px rgba(16,185,129,0.3))" }}
      >
        <img src={teamLeagueTrophy} alt="Team League" className="w-10 h-10 sm:w-20 sm:h-20 object-contain" />
      </div>
      <div
        className="mt-1 px-2 py-0.5 rounded text-center"
        style={{
          background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
          border: "1px solid rgba(16,185,129,0.25)",
          boxShadow: "inset 0 1px 0 rgba(16,185,129,0.1)",
        }}
      >
        <p className="text-[7px] sm:text-[11px] font-bold leading-tight max-w-[50px] sm:max-w-[80px] text-center"
          style={{ color: "#10b981" }}>
          Team League
        </p>
      </div>
    </div>
  )
}

function CabinetShelf({ items }) {
  return (
    <div className="relative">
      <div
        className="relative rounded-xl px-0 pt-2 sm:pt-3 pb-0"
        style={{ background: "rgba(0,0,0,0.25)", borderTop: "1px solid rgba(255,255,255,0.04)" }}
      >
        <div className="flex items-end justify-evenly w-full px-1 sm:px-6 overflow-x-auto">
          {items.map((_, i) => <SingleTrophy key={i} />)}
        </div>
        <div
          className="h-3 mt-2 relative"
          style={{
            background: "linear-gradient(180deg, #2a3344 0%, #1a2233 40%, #111827 100%)",
            boxShadow: "0 6px 20px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.08)",
          }}
        >
          <div className="absolute inset-0 opacity-20"
            style={{ backgroundImage: "repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(255,255,255,0.03) 40px, rgba(255,255,255,0.03) 41px)" }}
          />
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const TROPHIES_PER_SHELF = 5

export default function TeamTrophyDetail() {
  const { id }   = useParams()
  const navigate = useNavigate()

  const [seasonFilter, setSeasonFilter] = useState("overall")

  const { data, isLoading } = useQuery({
    queryKey: ["team-trophies", id],
    queryFn:  () => api.get(`/team-trophies/${id}`).then(r => r.data),
  })

  const allTrophies = data?.trophies || []
  const filteredTrophies = seasonFilter === "overall"
    ? allTrophies
    : allTrophies.filter(t => String(t.season_number) === seasonFilter)
  const allSeasons = [...new Set(allTrophies.map(t => t.season_number))].sort((a,b) => a-b)
  // t.year is auto-detected from season_calendar in the backend

  const logoSrc = useCachedImage(data?.team?.logoUrl)

  if (isLoading) return (
    <Layout>
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    </Layout>
  )

  if (!data?.team) return <Layout><p className="text-slate-500 text-center py-16">Team not found</p></Layout>

  const { team } = data
  const trophies = filteredTrophies
  const total = trophies.length

  // Build shelf arrays — one entry per trophy
  const shelves = []
  for (let i = 0; i < total; i += TROPHIES_PER_SHELF) {
    shelves.push(trophies.slice(i, i + TROPHIES_PER_SHELF))
  }

  return (
    <Layout>
      <button onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium mb-5 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Team header */}
      <div className="flex items-center gap-4 mb-8">
        {logoSrc
          ? <img src={logoSrc} alt={team.name} className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-gold/30 flex-shrink-0" />
          : <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gold/10 border-2 border-gold/30 flex items-center justify-center text-xl font-black text-gold flex-shrink-0">
              {team.name?.slice(0, 2).toUpperCase()}
            </div>
        }
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white">{team.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Trophy className="w-4 h-4 text-gold" />
            <span className="text-gold font-bold">{total} {total === 1 ? "Title" : "Titles"}</span>
          </div>
        </div>
      </div>

      {/* Season filter */}
      {allSeasons.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap mb-6">
          <button onClick={() => setSeasonFilter("overall")}
            className={cn("px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all",
              seasonFilter === "overall" ? "bg-accent text-white border-accent" : "bg-pitch-800/80 text-slate-400 border-surface-border hover:text-white backdrop-blur-sm")}>
            Overall
          </button>
          {allSeasons.map(s => (
            <button key={s} onClick={() => setSeasonFilter(String(s))}
              className={cn("px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all",
                seasonFilter === String(s) ? "bg-accent text-white border-accent" : "bg-pitch-800/80 text-slate-400 border-surface-border hover:text-white backdrop-blur-sm")}>
              Season {s}
            </button>
          ))}
        </div>
      )}

      {total === 0 ? (
        <div
          className="rounded-2xl p-16 text-center"
          style={{ background: "linear-gradient(180deg, #080d14 0%, #0d1520 100%)", border: "1px solid rgba(255,255,255,0.05)" }}
        >
          <div className="text-6xl mb-4 opacity-10">🏆</div>
          <p className="text-slate-600 font-semibold">No titles yet</p>
          <p className="text-slate-700 text-sm mt-1">The cabinet awaits its first glory</p>
        </div>
      ) : (
        <div className="rounded-2xl" style={{ background: "transparent" }}>
          {/* Cabinet header */}
          <div
            className="px-6 py-4 flex items-center justify-between"
            style={{ background: "rgba(0,0,0,0.3)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="flex items-center gap-3">
              <div className="w-1 h-8 rounded-full bg-gold" style={{ boxShadow: "0 0 8px rgba(245,158,11,0.6)" }} />
              <div>
                <p className="text-[9px] text-slate-600 uppercase tracking-[0.2em]">Tamil Efootballers</p>
                <p className="text-sm font-bold text-white">{team.name}'s Trophy Cabinet</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black text-gold font-mono" style={{ textShadow: "0 0 20px rgba(245,158,11,0.4)" }}>
                {total}
              </p>
              <p className="text-[9px] text-slate-600 uppercase tracking-widest">{total === 1 ? "Title" : "Titles"}</p>
            </div>
          </div>

          {/* Cabinet sides + shelves */}
          <div className="flex">
            <div className="w-1 sm:w-2 flex-shrink-0"
              style={{ background: "linear-gradient(90deg, #0a0f1a 0%, #111827 100%)", borderRight: "1px solid rgba(255,255,255,0.03)" }} />
            <div className="flex-1 py-4 space-y-1">
              {shelves.map((shelf, idx) => <CabinetShelf key={idx} items={shelf} />)}
            </div>
            <div className="w-1 sm:w-2 flex-shrink-0"
              style={{ background: "linear-gradient(270deg, #0a0f1a 0%, #111827 100%)", borderLeft: "1px solid rgba(255,255,255,0.03)" }} />
          </div>

          {/* Season labels below cabinet */}
          <div className="px-6 pt-4 pb-2">
            <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-3">Winning Seasons</p>
            <div className="flex flex-wrap gap-2">
              {trophies.map(t => (
                <div key={t.id}
                  className="px-3 py-1.5 rounded-xl border border-gold/30 bg-gold/10 text-gold text-xs font-bold">
                  Season {t.season_number}{t.year ? ` · ${t.year}` : ""}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}