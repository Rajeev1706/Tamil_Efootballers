import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Users } from "lucide-react"
import Layout from "../components/layout/Layout"
import api from "../lib/api"
import { cn } from "../lib/utils"
import duoTrophy from "../../images/duo.png"

const ROUND_LABELS = { r16: "Round of 16", qf: "Quarter Finals", sf: "Semi Finals", final: "Final" }

const GRADE_COLORS = {
  S: "bg-gold/20 text-gold border-gold/40",
  "A+": "bg-blue-400/20 text-blue-400 border-blue-400/40",
  A: "bg-blue-400/20 text-blue-400 border-blue-400/40",
  B: "bg-emerald-400/20 text-emerald-400 border-emerald-400/40",
  C: "bg-slate-500/20 text-slate-400 border-slate-500/40",
}

function GroupTable({ groupName, members }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-border bg-pitch-800/50">
        <h3 className="text-sm font-bold text-white">{groupName}</h3>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-slate-500 border-b border-surface-border/50">
            <th className="text-left px-4 py-2">Duo Team</th>
            <th className="px-2 py-2">P</th>
            <th className="px-2 py-2">W</th>
            <th className="px-2 py-2">D</th>
            <th className="px-2 py-2">L</th>
            <th className="px-2 py-2">GD</th>
            <th className="px-2 py-2 text-gold">Pts</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-border/30">
          {members.sort((a,b) => b.points - a.points || (b.gf-b.ga)-(a.gf-a.ga)).map((m, i) => (
            <tr key={m.duoPairId} className={i < 2 ? "bg-emerald-500/5" : ""}>
              <td className="px-4 py-2.5">
                <p className="font-semibold text-white text-sm">{m.duoName}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-slate-500 text-[10px]">{m.set1Name}</span>
                  <span className="text-slate-600 text-[10px]">+</span>
                  <span className="text-slate-500 text-[10px]">{m.set2Name}</span>
                </div>
              </td>
              <td className="text-center px-2 text-slate-400">{m.played}</td>
              <td className="text-center px-2 text-slate-400">{m.won}</td>
              <td className="text-center px-2 text-slate-400">{m.drawn}</td>
              <td className="text-center px-2 text-slate-400">{m.lost}</td>
              <td className="text-center px-2 text-slate-400">{m.gf - m.ga}</td>
              <td className="text-center px-2 font-bold text-gold">{m.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[9px] text-slate-600 px-4 py-1.5">Top 2 qualify for knockout</p>
    </div>
  )
}

function FixtureCard({ fixture }) {
  const isCompleted = fixture.status === "completed"
  const isKnockout  = !!fixture.knockout_round

  // Use admin-selected player names (populated at fixture generation for KO, admin-set for groups)
  const set1HomeName = fixture.set1HomePlayerName || fixture.homeSet1Name
  const set1AwayName = fixture.set1AwayPlayerName || fixture.awaySet1Name
  const set2HomeName = fixture.set2HomePlayerName || fixture.homeSet2Name
  const set2AwayName = fixture.set2AwayPlayerName || fixture.awaySet2Name

  // For knockout: winner determined by set wins or decider, not aggregate
  const homeSets = isKnockout && fixture.set1_home_score != null
    ? ((fixture.set1_home_score > fixture.set1_away_score ? 1 : 0) + (fixture.set2_home_score > fixture.set2_away_score ? 1 : 0))
    : null
  const awaySets = isKnockout && fixture.set1_home_score != null
    ? ((fixture.set1_away_score > fixture.set1_home_score ? 1 : 0) + (fixture.set2_away_score > fixture.set2_home_score ? 1 : 0))
    : null

  const homeWon = isKnockout
    ? fixture.winner_pair_id === fixture.home_pair_id
    : (fixture.set1_home_score ?? 0) + (fixture.set2_home_score ?? 0) > (fixture.set1_away_score ?? 0) + (fixture.set2_away_score ?? 0)
  const awayWon = isKnockout
    ? fixture.winner_pair_id === fixture.away_pair_id
    : (fixture.set1_away_score ?? 0) + (fixture.set2_away_score ?? 0) > (fixture.set1_home_score ?? 0) + (fixture.set2_home_score ?? 0)

  const hasDecider = !!fixture.koDeciderId

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className={cn("font-bold text-sm truncate", homeWon ? "text-white" : "text-slate-400")}>{fixture.homeDuoName}</p>
          <p className="text-xs text-slate-500 truncate">{fixture.homeSet1Name} & {fixture.homeSet2Name}</p>
        </div>
        {isCompleted ? (
          <div className="flex items-center gap-2 flex-shrink-0 text-center">
            {isKnockout ? (
              <>
                <span className={cn("text-xl font-black font-mono", homeWon ? "text-white" : "text-slate-500")}>{homeSets}</span>
                <span className="text-slate-600 text-xs">sets</span>
                <span className={cn("text-xl font-black font-mono", awayWon ? "text-white" : "text-slate-500")}>{awaySets}</span>
              </>
            ) : (
              <>
                <span className={cn("text-xl font-black font-mono", homeWon ? "text-white" : "text-slate-500")}>
                  {(fixture.set1_home_score ?? 0) + (fixture.set2_home_score ?? 0)}
                </span>
                <span className="text-slate-600">–</span>
                <span className={cn("text-xl font-black font-mono", awayWon ? "text-white" : "text-slate-500")}>
                  {(fixture.set1_away_score ?? 0) + (fixture.set2_away_score ?? 0)}
                </span>
              </>
            )}
          </div>
        ) : (
          <span className="text-xs text-slate-500 px-2">vs</span>
        )}
        <div className="flex-1 min-w-0 text-right">
          <p className={cn("font-bold text-sm truncate", awayWon ? "text-white" : "text-slate-400")}>{fixture.awayDuoName}</p>
          <p className="text-xs text-slate-500 truncate">{fixture.awaySet1Name} & {fixture.awaySet2Name}</p>
        </div>
      </div>
      {isCompleted && (
        <div className="mt-2 pt-2 border-t border-surface-border/50 space-y-1 text-xs text-slate-500">
          <div className="grid grid-cols-2 gap-2">
            <div>Set 1: {set1HomeName} {fixture.set1_home_score}–{fixture.set1_away_score} {set1AwayName}</div>
            <div className="text-right">Set 2: {set2HomeName} {fixture.set2_home_score}–{fixture.set2_away_score} {set2AwayName}</div>
          </div>
          {hasDecider && (
            <div className="text-center text-amber-400/80 font-semibold pt-0.5">
              Decider: {fixture.koDeciderHomePlayerName} {fixture.koDeciderHomeScore}–{fixture.koDeciderAwayScore} {fixture.koDeciderAwayPlayerName}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function DuoTournament() {
  const [activeTab, setActiveTab] = useState("groups")

  const { data, isLoading } = useQuery({
    queryKey: ["duo", "public"],
    queryFn:  () => api.get("/duo/current").then(r => r.data),
  })

  const groups = data?.groups || []
  const fixtures = data?.fixtures || []

  const groupMap = {}
  groups.forEach(row => {
    if (!groupMap[row.name]) groupMap[row.name] = []
    groupMap[row.name].push(row)
  })

  const groupFixtures   = fixtures.filter(f => !f.knockout_round)
  const knockoutFixtures = fixtures.filter(f => f.knockout_round)
  const knockoutRounds  = [...new Set(knockoutFixtures.map(f => f.knockout_round))].sort()

  const groupFixMap = groupFixtures.reduce((acc, f) => {
    (acc[f.groupName] = acc[f.groupName]||[]).push(f); return acc
  }, {})

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <img src={duoTrophy} alt="Duo Tournament" className="w-10 h-10 object-contain flex-shrink-0" />
          <div>
            <h1 className="text-2xl font-extrabold text-white">Duo Tournament</h1>
            <p className="text-sm text-slate-500">Season {data?.seasonNumber}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-20 text-slate-500">Loading...</div>
        ) : !data || groups.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>No duo tournament running yet.</p>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex gap-1 border-b border-surface-border">
              {["groups", "fixtures", "knockout"].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={cn("px-4 py-2 text-sm font-semibold capitalize transition-colors border-b-2 -mb-px",
                    activeTab === tab ? "border-accent text-accent" : "border-transparent text-slate-400 hover:text-white")}>
                  {tab}
                </button>
              ))}
            </div>

            {activeTab === "groups" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(groupMap).map(([name, members]) => (
                  <GroupTable key={name} groupName={name} members={members} />
                ))}
              </div>
            )}

            {activeTab === "fixtures" && (
              <div className="space-y-6">
                {Object.entries(groupFixMap).map(([groupName, gFixtures]) => (
                  <div key={groupName}>
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">{groupName}</h3>
                    <div className="space-y-2">
                      {gFixtures.map(f => <FixtureCard key={f.id} fixture={f} />)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "knockout" && (
              <div className="space-y-6">
                {knockoutRounds.length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-12">Knockout stage not started yet.</p>
                ) : knockoutRounds.map(round => (
                  <div key={round}>
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">{ROUND_LABELS[round] || round}</h3>
                    <div className="space-y-2">
                      {knockoutFixtures.filter(f => f.knockout_round === round).map(f => <FixtureCard key={f.id} fixture={f} />)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}