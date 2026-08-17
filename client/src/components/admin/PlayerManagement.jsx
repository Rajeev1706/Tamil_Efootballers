import { useState, useEffect } from "react"
import { Pencil, Check, X, Trash2, Camera, Trophy, Search, Crown } from "lucide-react"
import GradeBadge from "../common/GradeBadge"
import PlayerAvatar from "../common/PlayerAvatar"
import ImageUpload from "./ImageUpload"
import { useUpdatePlayer, useDeletePlayer, useTeams, useTrophyYears } from "../../lib/queries"
import { teamsApi } from "../../lib/api"
import { getMVTier, cn } from "../../lib/utils"

const GRADES = ["S","A","B","C"]

function EditableRow({ player, onPlayerClick, trophyYearOptions = [] }) {
  const [editing, setEditing]         = useState(false)
  const [name, setName]               = useState(player.name)
  const [alias, setAlias]             = useState(player.alias ?? "")
  const [grade, setGrade]             = useState(player.grade)
  const [gradeCeiling, setGradeCeiling] = useState(player.gradeCeiling ?? "")
  const [gradeFloor, setGradeFloor]     = useState(player.gradeFloor ?? "")
  const [teamId, setTeamId]           = useState(player.teamId ?? "")
  const [bdrDelta, setBdrDelta]       = useState("")
  const [isCaptain, setIsCaptain]     = useState(player.isCaptain ?? false)
  const [auctionPrice, setAuctionPrice] = useState(player.auctionPrice ?? "")
  const [trophyYear, setTrophyYear] = useState(new Date().getFullYear())
  const [trophy1, setTrophy1] = useState(player.trophy1Count ?? 0)
  const [trophy2, setTrophy2] = useState(player.trophy2Count ?? 0)
  const [trophy3, setTrophy3] = useState(player.trophy3Count ?? 0)
  const [trophy4, setTrophy4] = useState(player.trophy4Count ?? 0)
  const [trophy5, setTrophy5] = useState(player.trophy5Count ?? 0)
  const [trophy6, setTrophy6] = useState(player.trophy6Count ?? 0)
  const [trophy7, setTrophy7] = useState(player.trophy7Count ?? 0)
  const [trophy8, setTrophy8] = useState(player.trophy8Count ?? 0)
  const [trophyBase, setTrophyBase] = useState({
    t1: player.trophy1Count ?? 0, t2: player.trophy2Count ?? 0,
    t3: player.trophy3Count ?? 0, t4: player.trophy4Count ?? 0,
    t5: player.trophy5Count ?? 0, t6: player.trophy6Count ?? 0,
    t7: player.trophy7Count ?? 0, t8: player.trophy8Count ?? 0,
  })

  const applyTrophyData = (p) => {
    const vals = {
      t1: p?.trophy1Count ?? 0, t2: p?.trophy2Count ?? 0,
      t3: p?.trophy3Count ?? 0, t4: p?.trophy4Count ?? 0,
      t5: p?.trophy5Count ?? 0, t6: p?.trophy6Count ?? 0,
      t7: p?.trophy7Count ?? 0, t8: p?.trophy8Count ?? 0,
    }
    setTrophy1(vals.t1); setTrophy2(vals.t2); setTrophy3(vals.t3)
    setTrophy4(vals.t4); setTrophy5(vals.t5); setTrophy6(vals.t6)
    setTrophy7(vals.t7); setTrophy8(vals.t8)
    setTrophyBase(vals)
  }

  // When year changes (and the row is open for editing), load that year's trophy counts.
  // Guard with `editing` so we never call teamsApi on mount for every player row —
  // only fetch when the admin has actually opened this specific row.
  const currentYear = trophyYearOptions.length > 0
    ? parseInt(trophyYearOptions[0].value)
    : new Date().getFullYear()
  useEffect(() => {
    if (!editing) return
    if (trophyYear === currentYear) {
      teamsApi.trophyCurrent().then(data => {
        const p = data.find(d => d.id === player.id)
        applyTrophyData(p ?? player)
      }).catch(() => applyTrophyData(player))
    } else {
      teamsApi.trophyHistoryYear(trophyYear).then(data => {
        const p = data.find(d => d.id === player.id)
        applyTrophyData(p ?? { trophy1Count:0, trophy2Count:0, trophy3Count:0, trophy4Count:0, trophy5Count:0, trophy6Count:0, trophy7Count:0, trophy8Count:0 })
      }).catch(() => applyTrophyData({ trophy1Count:0, trophy2Count:0, trophy3Count:0, trophy4Count:0, trophy5Count:0, trophy6Count:0, trophy7Count:0, trophy8Count:0 }))
    }
  }, [trophyYear, editing])
  const [confirmDel, setConfirmDel]   = useState(false)
  const updatePlayer                  = useUpdatePlayer()
  const deletePlayer                  = useDeletePlayer()
  const { data: teams = [] }          = useTeams()
  const tier                          = getMVTier(player.marketValue)
  const deltaNum                      = parseInt(bdrDelta) || 0

  const handleSave = async () => {
    const body = {}
    if (name.trim() && name.trim() !== player.name) body.name = name.trim()
    if (alias.trim() !== (player.alias ?? "")) body.alias = alias.trim()
    if (grade !== player.grade) body.grade = grade
    if (bdrDelta !== "") body.bdrDelta = deltaNum
    if (teamId !== String(player.teamId ?? "")) {
      body.teamId = teamId === "" ? null : parseInt(teamId)
    }
    if (isCaptain !== (player.isCaptain ?? false)) body.isCaptain = isCaptain
    if (!isCaptain && parseInt(auctionPrice) !== player.auctionPrice) {
      body.auctionPrice = parseInt(auctionPrice) || 0
    }
    // Grade ceiling / floor — send whenever they differ from what's stored
    const savedCeiling = player.gradeCeiling ?? ""
    const savedFloor   = player.gradeFloor   ?? ""
    if (gradeCeiling !== savedCeiling) body.gradeCeiling = gradeCeiling || null
    if (gradeFloor   !== savedFloor)   body.gradeFloor   = gradeFloor   || null
    // Diff trophy counts against the values that were loaded for this year
    // (trophyBase), NOT the stale player prop — so switching year then saving
    // always saves the right values for the right year.
    const trophyChanged = (
      trophy1 !== trophyBase.t1 || trophy2 !== trophyBase.t2 ||
      trophy3 !== trophyBase.t3 || trophy4 !== trophyBase.t4 ||
      trophy5 !== trophyBase.t5 || trophy6 !== trophyBase.t6 ||
      trophy7 !== trophyBase.t7 || trophy8 !== trophyBase.t8
    )

    if (trophyChanged) {
      await teamsApi.updateTrophyYear({
        playerId: player.id,
        year: trophyYear,
        trophy1Count: trophy1, trophy2Count: trophy2, trophy3Count: trophy3,
        trophy4Count: trophy4, trophy5Count: trophy5, trophy6Count: trophy6,
        trophy7Count: trophy7, trophy8Count: trophy8,
      })
      // Update base so further edits in the same session diff correctly
      setTrophyBase({ t1:trophy1, t2:trophy2, t3:trophy3, t4:trophy4, t5:trophy5, t6:trophy6, t7:trophy7 })
    }

    // Trophy counts are intentionally NOT added to body here — they're saved
    // via updateTrophyYear above (year-scoped), never through updatePlayer.
    if (!Object.keys(body).length && !trophyChanged) return setEditing(false)
    if (!Object.keys(body).length) { setEditing(false); setBdrDelta(""); return }
    updatePlayer.mutate({ id: player.id, ...body }, {
      onSuccess: () => { setEditing(false); setBdrDelta("") },
      onError:   (err) => alert(err.response?.data?.error || "Update failed"),
    })
  }

  const handleCancel = () => {
    setEditing(false)
    setBdrDelta("")
    setName(player.name)
    setAlias(player.alias ?? "")
    setGrade(player.grade)
    setGradeCeiling(player.gradeCeiling ?? "")
    setGradeFloor(player.gradeFloor ?? "")
    setTeamId(player.teamId ?? "")
    setIsCaptain(player.isCaptain ?? false)
    setAuctionPrice(player.auctionPrice ?? "")
    // Reset year selector back to current year and restore player's current counts
    setTrophyYear(new Date().getFullYear())
    const base = {
      t1: player.trophy1Count ?? 0, t2: player.trophy2Count ?? 0,
      t3: player.trophy3Count ?? 0, t4: player.trophy4Count ?? 0,
      t5: player.trophy5Count ?? 0, t6: player.trophy6Count ?? 0,
      t7: player.trophy7Count ?? 0,
    }
    setTrophy1(base.t1); setTrophy2(base.t2); setTrophy3(base.t3)
    setTrophy4(base.t4); setTrophy5(base.t5); setTrophy6(base.t6)
    setTrophy7(base.t7); setTrophy8(base.t8)
    setTrophyBase(base)
  }

  const handleDelete = () => {
    deletePlayer.mutate(player.id, {
      onSuccess: () => setConfirmDel(false),
      onError:   (err) => alert(err.response?.data?.error || "Delete failed"),
    })
  }

  if (confirmDel) {
    return (
      <tr className="border-b border-surface-border/60 bg-rose-400/5">
        <td colSpan={6} className="py-3.5 px-5">
          <div className="flex items-center gap-4">
            <p className="text-sm text-rose-400 flex-1">
              Delete <span className="font-semibold">{player.name}</span>? This removes all match records too.
            </p>
            <button onClick={() => setConfirmDel(false)}
              className="text-xs px-3 py-1.5 rounded-lg border border-surface-border text-slate-400 hover:text-white">
              Cancel
            </button>
            <button onClick={handleDelete} disabled={deletePlayer.isPending}
              className="text-xs px-3 py-1.5 rounded-lg bg-rose-500 text-white font-semibold disabled:opacity-50">
              {deletePlayer.isPending ? "Deleting…" : "Yes, delete"}
            </button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <>
      <tr className={cn(
        "border-b border-surface-border/60 transition-colors",
        editing ? "bg-pitch-800" : "hover:bg-surface-hover"
      )}>
        {/* Player */}
        <td className="py-3.5 px-5">
          <div className="flex items-center gap-3">
            <PlayerAvatar player={player} size="sm" />
            <div className="flex-1 min-w-0">
              {editing ? (
                <div className="flex flex-col gap-1 mb-1">
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Player name"
                    className="bg-pitch-900 border border-surface-border rounded-lg px-2.5 py-1 text-sm text-white focus:outline-none focus:border-accent/40 w-full max-w-[160px]"
                  />
                  <input
                    type="text"
                    value={alias}
                    onChange={e => setAlias(e.target.value)}
                    placeholder="In-game alias"
                    className="bg-pitch-900 border border-surface-border rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-accent/40 w-full max-w-[160px]"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onPlayerClick?.(player)}
                    className="text-sm font-medium text-white hover:text-accent transition-colors text-left">
                    {player.name}
                  </button>
                  {player.isCaptain && (
                    <Crown className="w-3.5 h-3.5 text-gold flex-shrink-0" title="Captain" />
                  )}
                </div>
              )}
              {editing ? (
                <select
                  value={teamId}
                  onChange={e => setTeamId(e.target.value)}
                  className="mt-1 bg-pitch-900 border border-surface-border rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-accent/40 w-full max-w-[160px]"
                >
                  <option value="">— No team —</option>
                  {teams.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-slate-500 mt-0.5">
                  {player.team || "No team"}
                </p>
              )}
            </div>
          </div>
        </td>

        {/* Grade */}
        <td className="py-3.5 px-4">
          {editing ? (
            <div className="flex flex-col gap-1.5">
              <select value={grade} onChange={e => setGrade(e.target.value)}
                className="bg-pitch-900 border border-surface-border rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-accent/40">
                {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <select value={gradeCeiling} onChange={e => setGradeCeiling(e.target.value)}
                title="Max grade ceiling"
                className="bg-pitch-900 border border-violet-500/30 rounded-lg px-2 py-1 text-[10px] text-violet-300 focus:outline-none">
                <option value="">🔺 No ceiling</option>
                {GRADES.map(g => <option key={g} value={g}>🔺 Max: {g}</option>)}
              </select>
              <select value={gradeFloor} onChange={e => setGradeFloor(e.target.value)}
                title="Min grade floor"
                className="bg-pitch-900 border border-amber-500/30 rounded-lg px-2 py-1 text-[10px] text-amber-300 focus:outline-none">
                <option value="">⚡ No floor</option>
                {GRADES.map(g => <option key={g} value={g}>🔒 Min: {g}</option>)}
              </select>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <GradeBadge grade={player.grade} />
              <div className="flex flex-col gap-0.5">
                {player.gradeCeiling && (
                  <span className="text-[9px] font-bold text-violet-400 bg-violet-400/10 border border-violet-400/25 px-1.5 py-0.5 rounded w-fit">
                    🔺 Max: {player.gradeCeiling}
                  </span>
                )}
                {player.gradeFloor ? (
                  <span className="text-[9px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/25 px-1.5 py-0.5 rounded w-fit">
                    🔒 Min: {player.gradeFloor}
                  </span>
                ) : !player.gradeCeiling ? (
                  <span className="text-[9px] font-bold text-sky-400 bg-sky-400/10 border border-sky-400/25 px-1.5 py-0.5 rounded w-fit">
                    ⚡ Auto
                  </span>
                ) : null}
              </div>
            </div>
          )}
        </td>

        {/* Auction */}
        <td className="py-3.5 px-4 text-center">
          {editing ? (
            <div className="flex flex-col items-center gap-1.5">
              <button
                onClick={() => setIsCaptain(c => !c)}
                className={cn(
                  "flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg border transition-all",
                  isCaptain ? "bg-gold/15 border-gold/40 text-gold" : "border-surface-border text-slate-500 hover:text-slate-300"
                )}
              >
                <Crown className="w-3 h-3" /> Captain
              </button>
              {!isCaptain && (
                <input
                  type="number" min="0" value={auctionPrice}
                  onChange={e => setAuctionPrice(e.target.value)}
                  className="w-20 bg-pitch-900 border border-surface-border rounded-lg px-2 py-1 text-sm text-white font-mono text-center focus:outline-none focus:border-accent/40"
                />
              )}
            </div>
          ) : player.isCaptain ? (
            <span className="text-xs font-bold text-gold bg-gold/10 border border-gold/30 px-2 py-1 rounded-lg">
              CAP
            </span>
          ) : (
            <span className="font-mono text-sm text-slate-400">{player.auctionPrice}</span>
          )}
        </td>

        {/* MV */}
        <td className="py-3.5 px-4 text-center">
          <p className="font-bold font-mono text-sm text-white">{player.marketValue}</p>
          <p className={cn("text-xs", tier.color)}>{tier.label}</p>
        </td>

        {/* BDR */}
        <td className="py-3.5 px-4">
          {editing ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-slate-400">{player.bdrPoints}</span>
                <input type="number" placeholder="±delta" value={bdrDelta}
                  onChange={e => setBdrDelta(e.target.value)}
                  className="w-24 bg-pitch-900 border border-surface-border rounded-lg px-2.5 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-accent/40 text-center" />
              </div>
              {bdrDelta !== "" && (
                <p className={cn("text-xs font-mono font-semibold",
                  deltaNum >= 0 ? "text-emerald-400" : "text-rose-400")}>
                  → {Math.max(0, player.bdrPoints + deltaNum).toLocaleString()} pts
                </p>
              )}
            </div>
          ) : (
            <span className="font-mono text-sm text-white">
              {player.bdrPoints?.toLocaleString()}
            </span>
          )}
        </td>

        {/* Actions */}
        <td className="py-3.5 px-5 text-right">
          {editing ? (
            <div className="flex items-center justify-end gap-2">
              <button onClick={handleCancel}
                className="w-8 h-8 rounded-lg border border-surface-border flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
              <button onClick={handleSave} disabled={updatePlayer.isPending}
                className="w-8 h-8 rounded-lg bg-accent hover:bg-accent-dim flex items-center justify-center text-white transition-colors disabled:opacity-50">
                <Check className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-1">
              <button onClick={() => setEditing(true)}
                className="w-8 h-8 rounded-lg hover:bg-surface flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                title="Edit">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setConfirmDel(true)}
                className="w-8 h-8 rounded-lg hover:bg-rose-400/10 flex items-center justify-center text-slate-400 hover:text-rose-400 transition-colors"
                title="Delete">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </td>
      </tr>

      {/* Image upload row */}
      {editing && (
        <tr className="border-b border-surface-border/60 bg-pitch-800">
          <td colSpan={6} className="px-5 py-4">
            <div className="flex items-center gap-4">
              <Camera className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <span className="text-xs text-slate-400 flex-shrink-0">Squad image</span>
              <ImageUpload player={player} onSuccess={() => {}} />
            </div>
          </td>
        </tr>
      )}

      {/* Trophy counts row */}
      {editing && (
        <tr className="border-b border-surface-border/60 bg-pitch-800">
          <td colSpan={6} className="px-5 py-4">
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-2 flex-shrink-0">
                <Trophy className="w-4 h-4 text-gold" />
                <span className="text-xs text-slate-400">Trophies</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-slate-500">Year:</span>
                <select
                  value={trophyYear}
                  onChange={e => setTrophyYear(parseInt(e.target.value))}
                  className="bg-pitch-900 border border-surface-border rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-accent/40"
                >
                  {trophyYearOptions?.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              {[
                { label: "Ballon d'Or",             value: trophy1, onChange: setTrophy1 },
                { label: "Dshann League",             value: trophy2, onChange: setTrophy2 },
                { label: "UCL",                     value: trophy4, onChange: setTrophy4 },
                { label: "Weekly",                  value: trophy3, onChange: setTrophy3 },
                { label: "Weekly Golden Boot",      value: trophy5, onChange: setTrophy5 },
                { label: "Dshann League Golden Boot", value: trophy6, onChange: setTrophy6 },
                { label: "UCL Golden Boot",         value: trophy7, onChange: setTrophy7 },
                { label: "Revolution",              value: trophy8, onChange: setTrophy8 },
              ].map(t => (
                <div key={t.label} className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">{t.label}</span>
                  <input
                    type="number" min="0" value={t.value}
                    onChange={e => t.onChange(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-16 bg-pitch-900 border border-surface-border rounded-lg px-2.5 py-1.5 text-sm text-white font-mono text-center focus:outline-none focus:border-accent/40"
                  />
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default function PlayerManagement({ players, onPlayerClick }) {
  const [search, setSearch]   = useState("")
  const [gradeFilter, setGradeFilter] = useState("All")
  const [teamFilter, setTeamFilter]   = useState("All")
  const { data: teams = [] }  = useTeams()
  const { data: trophyYearsData } = useTrophyYears()
  const trophyCurrentYear = trophyYearsData?.currentYear || new Date().getFullYear()
  const trophyPastYears   = trophyYearsData?.pastYears   || []
  const trophyYearOptions = [
    { value: String(trophyCurrentYear), label: `Current (${trophyCurrentYear})` },
    ...trophyPastYears.map(y => ({ value: String(y), label: String(y) }))
  ]

  const filtered = players.filter(p => {
    const matchName  = p.name.toLowerCase().includes(search.toLowerCase())
    const matchGrade = gradeFilter === "All" || p.grade === gradeFilter
    const matchTeam  = teamFilter  === "All" || p.team  === teamFilter
    return matchName && matchGrade && matchTeam
  })

  const allTeamNames = ["All", ...new Set(players.map(p => p.team).filter(Boolean))]

  return (
    <div>
      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search player name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-pitch-800 border border-surface-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent/40 transition-colors"
          />
        </div>
        <select
          value={gradeFilter}
          onChange={e => setGradeFilter(e.target.value)}
          className="bg-pitch-800 border border-surface-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent/40"
        >
          {["All","S","A","B","C"].map(g => <option key={g}>{g}</option>)}
        </select>
        <select
          value={teamFilter}
          onChange={e => setTeamFilter(e.target.value)}
          className="bg-pitch-800 border border-surface-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent/40 max-w-[160px]"
        >
          {allTeamNames.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>

      <p className="text-xs text-slate-500 mb-3">
        {filtered.length} of {players.length} player{players.length !== 1 ? "s" : ""}
        {search || gradeFilter !== "All" || teamFilter !== "All" ? " matched" : " total"}
      </p>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border">
                {["Player / Team","Grade","Auction","Market value","BDR points",""].map(h => (
                  <th key={h} className={cn(
                    "py-3 text-xs font-semibold text-slate-500 tracking-wide uppercase",
                    h === "Player / Team" || h === "" ? "px-5 text-left" : "px-4 text-center",
                    h === "" && "text-right"
                  )}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 text-sm">
                    {players.length === 0 ? "No players yet — add them in the Setup tab." : "No players match your search."}
                  </td>
                </tr>
              ) : (
                filtered.map(p => (
                  <EditableRow key={p.id} player={p} onPlayerClick={onPlayerClick} trophyYearOptions={trophyYearOptions} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}