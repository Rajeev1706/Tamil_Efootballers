import { useState } from "react"
import { usePlayers, usePlayerCompareStats } from "../../lib/queries"
import PlayerAvatarIcon from "../common/PlayerAvatarIcon"
import { getAvatarById } from "../../lib/avatars"
import { cn } from "../../lib/utils"
import ballondorTrophy    from "../../../images/ballondor.png"
import teamLeagueTrophy   from "../../../images/Team League.png"
import weeklyTrophy       from "../../../images/Weekly.png"
import uclTrophy          from "../../../images/ucl.png"
import goldenBootTrophy   from "../../../images/Golden Boot.png"
import teamLeagueGBTrophy from "../../../images/team league_gb.png"
import uclGBTrophy        from "../../../images/ucl_gb.png"

const TROPHY_DEFS = [
  { key: "trophy1_count", image: ballondorTrophy,    label: "Ballon d'Or"   },
  { key: "trophy2_count", image: teamLeagueTrophy,   label: "Team League"   },
  { key: "trophy4_count", image: uclTrophy,          label: "UCL"           },
  { key: "trophy3_count", image: weeklyTrophy,       label: "Weekly"        },
  { key: "trophy5_count", image: goldenBootTrophy,   label: "Wkly GB"       },
  { key: "trophy6_count", image: teamLeagueGBTrophy, label: "TL GB"         },
  { key: "trophy7_count", image: uclGBTrophy,        label: "UCL GB"        },
]

function resolveAvatar(p) {
  if (!p) return null
  if (p.avatarUrl) return p.avatarUrl
  const preset = getAvatarById(p.avatarId)
  return preset?.thumb ?? null
}

function StatBar({ label, a, b, higherIsBetter = true }) {
  const aNum = Number(a) || 0
  const bNum = Number(b) || 0
  const total = aNum + bNum
  const aFrac = total > 0 ? aNum / total : 0.5
  const aLeads = higherIsBetter ? aNum > bNum : aNum < bNum
  const bLeads = higherIsBetter ? bNum > aNum : bNum < aNum
  return (
    <div className="mb-2.5">
      <div className="flex items-center justify-between mb-1">
        <span className={cn("text-sm font-bold w-14 text-right tabular-nums", aLeads ? "text-accent" : "text-white")}>{a}</span>
        <span className="text-xs text-slate-500 flex-1 text-center px-2">{label}</span>
        <span className={cn("text-sm font-bold w-14 text-left tabular-nums", bLeads ? "text-accent" : "text-white")}>{b}</span>
      </div>
      <div className="h-1 rounded-full bg-pitch-800 overflow-hidden flex">
        <div className="bg-accent transition-all duration-700 rounded-l-full" style={{ width: `${Math.round(aFrac * 100)}%` }} />
        <div className="flex-1 bg-violet-500 rounded-r-full" />
      </div>
    </div>
  )
}

function PlayerCard({ data, side, onPlayerClick }) {
  const p = data?.player
  const s = data?.stats
  if (!p) return null

  const avatarThumb = resolveAvatar(p)
  const trophyTotal = s?.trophies ? Object.values(s.trophies).reduce((a, b) => a + b, 0) : 0
  const borderColor = side === "a" ? "border-accent/40" : "border-violet-500/40"

  return (
    <div className={cn("flex flex-col rounded-2xl border bg-pitch-800 overflow-hidden", borderColor)}>
      {/* Avatar image — fills top of card cleanly */}
      <button onClick={() => onPlayerClick?.(p)} className="block w-full aspect-square overflow-hidden bg-pitch-900 relative">
        {avatarThumb
          ? <img src={avatarThumb} alt={p.name} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-slate-600 text-4xl font-bold">{p.name[0]}</div>
        }
      </button>

      {/* Info */}
      <div className="p-4">
        <p className="font-bold text-white text-base leading-tight truncate">{p.name}</p>
        {p.alias && <p className="text-xs text-slate-500 mb-1 truncate">"{p.alias}"</p>}
        <p className="text-xs text-slate-400 mb-3 truncate">{p.team ?? "Unassigned"}</p>

        {/* Current season values */}
        <div className="space-y-1.5 text-xs mb-3 pb-3 border-b border-surface-border/50">
          <p className="text-slate-600 uppercase tracking-widest text-[10px] mb-1">Current Season</p>
          <div className="flex justify-between"><span className="text-slate-400">Market Value</span><span className="text-white font-semibold">{p.marketValue ?? 0}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">BDR Points</span><span className="text-white font-semibold">{p.bdrPoints ?? 0} pts</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Auction Price</span>
            {p.isCaptain
              ? <span className="text-xs font-bold text-gold bg-gold/15 border border-gold/30 px-2 py-0.5 rounded-full">CAPTAIN</span>
              : <span className="text-white font-semibold">{p.auctionPrice ?? 0}</span>
            }
          </div>
        </div>

        {/* All-time stats */}
        <div className="space-y-1.5 text-xs">
          <p className="text-slate-600 uppercase tracking-widest text-[10px] mb-1">All-Time</p>
          <div className="flex justify-between"><span className="text-slate-400">Win Rate</span><span className="text-accent font-semibold">{s?.winRate ?? 0}%</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Goals</span><span className="text-accent font-semibold">{s?.goals ?? 0}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Avg Goals</span><span className="text-white font-semibold">{s?.avgGoals ?? "0.0"}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Matches</span><span className="text-white font-semibold">{s?.total ?? 0}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">W / D / L</span><span className="text-white font-semibold">{s?.wins ?? 0}/{s?.draws ?? 0}/{s?.losses ?? 0}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">League W/D/L</span><span className="text-white font-semibold">{s?.leagueWins ?? 0}/{s?.leagueDraws ?? 0}/{s?.leagueLosses ?? 0}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">UCL W/D/L</span><span className="text-white font-semibold">{s?.uclWins ?? 0}/{s?.uclDraws ?? 0}/{s?.uclLosses ?? 0}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Weekly W/D/L</span><span className="text-white font-semibold">{s?.weeklyWins ?? 0}/{s?.weeklyDraws ?? 0}/{s?.weeklyLosses ?? 0}</span></div>
          {trophyTotal > 0 && (
            <>
              <div className="flex justify-between pt-1 border-t border-surface-border/30">
                <span className="text-slate-400">Trophies</span>
                <span className="text-gold font-semibold">{trophyTotal} total</span>
              </div>
            </>
          )}
        </div>

        {/* Trophy Case — icons + counts, only for trophies the player has */}
        {trophyTotal > 0 && (
          <div className="mt-3 pt-3 border-t border-surface-border/50 flex flex-wrap gap-1.5">
            {TROPHY_DEFS.filter(t => (s?.trophies?.[t.key] ?? 0) > 0).map(t => (
              <div key={t.key} className="flex items-center gap-1 bg-pitch-900/60 rounded-lg px-1.5 py-1">
                <img src={t.image} alt={t.label} className="w-5 h-5 object-contain flex-shrink-0" />
                <span className="text-xs font-bold text-white">{s.trophies[t.key]}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function PlayerPicker({ label, players, value, onChange, exclude }) {
  const [search, setSearch] = useState("")
  const filtered = players.filter(p =>
    p.id !== exclude &&
    (p.name.toLowerCase().includes(search.toLowerCase()) ||
     p.alias?.toLowerCase().includes(search.toLowerCase()))
  )
  const selected = players.find(p => p.id === value)

  return (
    <div className="flex-1">
      <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">{label}</p>
      {selected ? (
        <button onClick={() => onChange(null)}
          className="w-full flex items-center gap-2 bg-pitch-800 border border-surface-border hover:border-accent/40 transition-colors rounded-xl px-3 py-2 text-left">
          <PlayerAvatarIcon player={selected} size="w-8 h-8" />
          <span className="font-semibold text-white text-sm flex-1 truncate">{selected.name}</span>
          <span className="text-xs text-slate-500">✕</span>
        </button>
      ) : (
        <div className="relative">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search player..."
            className="w-full bg-pitch-800 border border-surface-border rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/40 placeholder:text-slate-600" />
          {search && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-pitch-900 border border-surface-border rounded-xl overflow-hidden z-20 max-h-48 overflow-y-auto shadow-xl">
              {filtered.slice(0, 8).map(p => (
                <button key={p.id} onClick={() => { onChange(p.id); setSearch("") }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-pitch-800 transition-colors text-left">
                  <PlayerAvatarIcon player={p} size="w-7 h-7" />
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{p.name}</p>
                    <p className="text-xs text-slate-500 truncate">{p.team ?? "Unassigned"}</p>
                  </div>
                </button>
              ))}
              {filtered.length === 0 && <p className="text-xs text-slate-500 px-3 py-2">No players found</p>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function PlayerComparison({ onPlayerClick }) {
  const { data: players = [] } = usePlayers()
  const [playerAId, setPlayerAId] = useState(null)
  const [playerBId, setPlayerBId] = useState(null)

  const { data: dataA, isLoading: loadA } = usePlayerCompareStats(playerAId)
  const { data: dataB, isLoading: loadB } = usePlayerCompareStats(playerBId)

  const sA = dataA?.stats
  const sB = dataB?.stats
  const bothReady = !!sA && !!sB

  return (
    <div className="card p-5 sm:p-6">
      <h2 className="text-sm text-slate-500 uppercase tracking-widest font-semibold mb-4">Player Comparison</h2>

      <div className="flex gap-3 mb-6">
        <PlayerPicker label="Player A" players={players} value={playerAId} onChange={setPlayerAId} exclude={playerBId} />
        <div className="flex items-end pb-2"><span className="text-slate-600 font-bold">vs</span></div>
        <PlayerPicker label="Player B" players={players} value={playerBId} onChange={setPlayerBId} exclude={playerAId} />
      </div>

      {!playerAId && !playerBId && (
        <div className="text-center py-12 text-slate-600 text-sm">Select two players above to compare</div>
      )}

      {(loadA || loadB) && <div className="text-center py-8 text-slate-500 text-sm">Loading…</div>}

      {bothReady && (
        <>
          <div style={{ overflowX: "scroll", WebkitOverflowScrolling: "touch" }} className="-mx-5 sm:mx-0 px-5 sm:px-0 mb-6">
            <div className="grid gap-3 min-w-[480px]" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <PlayerCard data={dataA} side="a" onPlayerClick={onPlayerClick} />
            <PlayerCard data={dataB} side="b" onPlayerClick={onPlayerClick} />
          </div>
          </div>

          <div className="card p-4">
            <p className="text-xs text-slate-500 uppercase tracking-widest mb-4">Head to Head <span className="text-slate-600">(all-time)</span></p>
            <StatBar label="Market Value"  a={dataA.player.marketValue} b={dataB.player.marketValue} />
            <StatBar label="BDR Points"    a={dataA.player.bdrPoints}   b={dataB.player.bdrPoints}   />
            <StatBar label="Win Rate %"    a={sA.winRate}    b={sB.winRate}    />
            <StatBar label="Goals"         a={sA.goals}      b={sB.goals}      />
            <StatBar label="Matches"       a={sA.total}      b={sB.total}      />
            <StatBar label="Wins"          a={sA.wins}       b={sB.wins}       />
            <StatBar label="Draws"         a={sA.draws}      b={sB.draws}      />
            <StatBar label="Losses"        a={sA.losses}     b={sB.losses}     higherIsBetter={false} />
            <StatBar label="League Wins"   a={sA.leagueWins} b={sB.leagueWins} />
            <StatBar label="League Draws"  a={sA.leagueDraws} b={sB.leagueDraws} />
            <StatBar label="League Losses" a={sA.leagueLosses} b={sB.leagueLosses} higherIsBetter={false} />
            <StatBar label="UCL Wins"      a={sA.uclWins}    b={sB.uclWins}    />
            <StatBar label="UCL Draws"     a={sA.uclDraws}   b={sB.uclDraws}   />
            <StatBar label="UCL Losses"    a={sA.uclLosses}  b={sB.uclLosses}  higherIsBetter={false} />
            <StatBar label="Weekly Wins"   a={sA.weeklyWins} b={sB.weeklyWins} />
            <StatBar label="Weekly Draws"  a={sA.weeklyDraws} b={sB.weeklyDraws} />
            <StatBar label="Weekly Losses" a={sA.weeklyLosses} b={sB.weeklyLosses} higherIsBetter={false} />
          </div>
        </>
      )}
    </div>
  )
}