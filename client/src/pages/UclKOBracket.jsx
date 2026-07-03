import { useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Trophy, CheckCircle, Clock, Trash2 } from "lucide-react"
import { useUclKnockout, useSaveUclKnockoutResult, useResetUclKnockout, useUpdateUclKnockoutMatchPlayers } from "../lib/queries"
import { cn } from "../lib/utils"

const CARD_H   = 120
const BASE_SLOT = CARD_H + 10

function getSlotH(round)        { return BASE_SLOT * Math.pow(2, round - 1) }
function getCardTop(round, idx) { const s = getSlotH(round); return idx * s + (s - CARD_H) / 2 }

function getRoundLabel(round, totalRounds) {
  const fromEnd = totalRounds - round
  if (fromEnd === 0) return "FINAL"
  if (fromEnd === 1) return "SEMI-FINAL"
  if (fromEnd === 2) return "QUARTER-FINAL"
  if (fromEnd === 3) return "ROUND OF 16"
  if (fromEnd === 4) return "ROUND OF 32"
  return `Round ${round}`
}

function MatchCard({ match, totalRounds, tournamentId, allPlayers, onSaved, style }) {
  const saveResult    = useSaveUclKnockoutResult()
  const updatePlayers = useUpdateUclKnockoutMatchPlayers()
  const [score1, setScore1]           = useState("")
  const [score2, setScore2]           = useState("")
  const [tieWinner, setTieWinner]     = useState("")
  const [editing, setEditing]         = useState(false)
  const [editingPlayers, setEditingPlayers] = useState(false)
  const [p1Id, setP1Id]               = useState(match.player1_id || "")
  const [p2Id, setP2Id]               = useState(match.player2_id || "")

  const isCompleted    = match.status === "completed"
  const hasBothPlayers = match.player1_id && match.player2_id
  const isHighlight    = (totalRounds - match.round) <= 2
  const isFinal        = match.round === totalRounds

  const s1 = Number(score1), s2 = Number(score2)
  const scoresEntered = score1 !== "" && score2 !== ""
  const isTied = scoresEntered && s1 === s2
  const canSave = scoresEntered && (!isTied || tieWinner !== "")

  function openEdit() { setScore1(isCompleted && match.player1_score != null ? match.player1_score : ""); setScore2(isCompleted && match.player2_score != null ? match.player2_score : ""); setTieWinner(""); setEditing(true) }

  async function handleSave() {
    if (!canSave) return
    await saveResult.mutateAsync({ matchId: match.id, player1Score: s1, player2Score: s2, tieWinnerId: isTied ? (tieWinner === "p1" ? match.player1_id : match.player2_id) : undefined, tournamentId })
    setEditing(false); onSaved?.()
  }

  const p1IsWinner = match.winner_id === match.player1_id
  const p2IsWinner = match.winner_id === match.player2_id

  return (
    <div style={{ ...style, minHeight: CARD_H, height: (editing || editingPlayers) ? "auto" : CARD_H, position: "absolute", zIndex: (editing || editingPlayers) ? 50 : 1 }}
      className={cn("w-full rounded-xl border overflow-hidden flex flex-col",
        isFinal ? "border-gold/40 shadow-[0_0_20px_rgba(245,158,11,0.1)]" :
        isHighlight ? "border-accent/30" :
        isCompleted ? "border-emerald-400/20" : "border-surface-border"
      )}>

      {isHighlight && (
        <div className={cn("text-center text-xs font-bold uppercase tracking-wider py-0.5 flex-shrink-0",
          isFinal ? "bg-gold/20 text-gold" : "bg-accent/10 text-accent")}>
          {getRoundLabel(match.round, totalRounds)}
        </div>
      )}

      <div className="flex-1 flex flex-col bg-pitch-800/50 min-h-0">
        {[
          { name: match.player1Name, score: match.player1_score, id: match.player1_id, group: match.player1Group, isWinner: p1IsWinner },
          { name: match.player2Name, score: match.player2_score, id: match.player2_id, group: match.player2Group, isWinner: p2IsWinner },
        ].map((p, i) => (
          <div key={i} className={cn("flex items-center justify-between px-2.5 flex-1 min-h-0",
            i === 0 ? "border-b border-surface-border/30" : "",
            isCompleted && p.isWinner ? "bg-emerald-400/8" : ""
          )}>
            <div className="flex-1 min-w-0">
              <span className={cn("text-xs font-medium truncate block", !p.id ? "text-slate-600 italic" : isCompleted && p.isWinner ? "text-emerald-400 font-bold" : "text-white")}>
                {p.name || "TBD"}
              </span>
              {p.group && <span className="text-xs text-slate-600">{p.group}</span>}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0 ml-1">
              {isCompleted && p.score != null && <span className={cn("text-xs font-bold font-mono", p.isWinner ? "text-emerald-400" : "text-slate-500")}>{p.score}</span>}
              {isCompleted && p.isWinner && <span className="text-xs font-bold text-emerald-400">W</span>}
              {isCompleted && !p.isWinner && match.winner_id && p.id && <span className="text-xs font-bold text-rose-400">L</span>}
            </div>
          </div>
        ))}
      </div>

      {!editing && !editingPlayers && !isCompleted && hasBothPlayers && (
        <button onClick={openEdit} className="text-xs text-slate-500 hover:text-accent py-1 bg-pitch-900/40 border-t border-surface-border/30 transition-colors flex-shrink-0">+ Enter result</button>
      )}
      {!editing && !editingPlayers && isCompleted && hasBothPlayers && (
        <button onClick={openEdit} className="text-xs text-slate-600 hover:text-amber-400 py-1 bg-pitch-900/40 border-t border-surface-border/30 transition-colors flex-shrink-0">✎ Edit result</button>
      )}
      {!editing && !editingPlayers && !hasBothPlayers && (
        <div className="text-center text-xs text-slate-700 py-0.5 bg-pitch-900/40 border-t border-surface-border/30 flex-shrink-0">Awaiting</div>
      )}

      {editing && (
        <div className="bg-pitch-900 border-t border-surface-border/30 px-2 py-1.5 space-y-1.5 flex-shrink-0">
          <div className="flex items-center gap-1">
            <div className="flex-1 text-center">
              <p className="text-xs text-slate-600 mb-0.5 truncate">{match.player1Name}</p>
              <input type="number" min="0" placeholder="0" value={score1} onChange={e => setScore1(e.target.value)}
                className="w-full text-center bg-pitch-800 border border-surface-border rounded text-xs text-white py-1 focus:outline-none focus:border-accent/40" />
            </div>
            <span className="text-slate-600 text-xs flex-shrink-0">vs</span>
            <div className="flex-1 text-center">
              <p className="text-xs text-slate-600 mb-0.5 truncate">{match.player2Name}</p>
              <input type="number" min="0" placeholder="0" value={score2} onChange={e => setScore2(e.target.value)}
                className="w-full text-center bg-pitch-800 border border-surface-border rounded text-xs text-white py-1 focus:outline-none focus:border-accent/40" />
            </div>
          </div>
          {scoresEntered && !isTied && (
            <p className={cn("text-xs text-center font-semibold", s1 > s2 ? "text-emerald-400" : "text-rose-400")}>
              {s1 > s2 ? `${match.player1Name} wins` : `${match.player2Name} wins`}
            </p>
          )}
          {isTied && (
            <div>
              <p className="text-xs text-amber-400 text-center font-semibold mb-1">Tied — pick winner</p>
              <div className="flex gap-1.5">
                <button onClick={() => setTieWinner("p1")} className={cn("flex-1 text-xs py-1 rounded border", tieWinner === "p1" ? "bg-emerald-400/20 border-emerald-400/40 text-emerald-400" : "border-surface-border text-slate-400")}>{match.player1Name}</button>
                <button onClick={() => setTieWinner("p2")} className={cn("flex-1 text-xs py-1 rounded border", tieWinner === "p2" ? "bg-emerald-400/20 border-emerald-400/40 text-emerald-400" : "border-surface-border text-slate-400")}>{match.player2Name}</button>
              </div>
            </div>
          )}
          <div className="flex gap-1.5">
            <button onClick={() => setEditing(false)} className="flex-1 text-xs py-1 rounded border border-surface-border text-slate-400">Cancel</button>
            <button onClick={handleSave} disabled={!canSave || saveResult.isPending}
              className="flex-1 text-xs py-1 rounded bg-accent/20 text-accent border border-accent/30 font-semibold disabled:opacity-40">
              {saveResult.isPending ? "…" : "Save"}
            </button>
          </div>
        </div>
      )}

      {editingPlayers && (
        <div className="bg-pitch-900 border-t border-surface-border/30 px-2 py-2 space-y-1.5 flex-shrink-0">
          <p className="text-xs text-slate-500">Edit players</p>
          {[["Home", p1Id, setP1Id, p2Id], ["Away", p2Id, setP2Id, p1Id]].map(([label, val, setter, other]) => (
            <div key={label}>
              <p className="text-xs text-slate-600 mb-0.5">{label}</p>
              <select value={val} onChange={e => setter(e.target.value)}
                className="w-full bg-pitch-800 border border-surface-border rounded text-xs text-white py-1.5 px-2 focus:outline-none focus:border-accent/40">
                <option value="">— Bye —</option>
                {allPlayers.filter(p => !other || String(p.id) !== String(other)).map(p => (
                  <option key={p.id} value={p.id}>{p.name}{p.groupName ? ` (${p.groupName})` : ""}</option>
                ))}
              </select>
            </div>
          ))}
          <div className="flex gap-1.5 pt-1">
            <button onClick={() => setEditingPlayers(false)} className="flex-1 text-xs py-1.5 rounded border border-surface-border text-slate-400">Cancel</button>
            <button onClick={async () => { await updatePlayers.mutateAsync({ matchId: match.id, player1Id: p1Id ? Number(p1Id) : null, player2Id: p2Id ? Number(p2Id) : null }); setEditingPlayers(false); onSaved?.() }}
              disabled={updatePlayers.isPending}
              className="flex-1 text-xs py-1.5 rounded bg-accent/20 text-accent border border-accent/30 font-semibold disabled:opacity-40">
              {updatePlayers.isPending ? "…" : "Save"}
            </button>
          </div>
        </div>
      )}

      {!editingPlayers && !editing && (
        <button onClick={() => { setP1Id(match.player1_id ? String(match.player1_id) : ""); setP2Id(match.player2_id ? String(match.player2_id) : ""); setEditingPlayers(true) }}
          className="text-xs text-slate-600 hover:text-accent py-0.5 bg-pitch-900/20 border-t border-surface-border/20 transition-colors flex-shrink-0 w-full">
          ✎ Edit players
        </button>
      )}
    </div>
  )
}

function Connectors({ round, roundMatches, totalHeight }) {
  const W = 32
  return (
    <svg width={W} height={totalHeight} style={{ flexShrink: 0, overflow: "visible" }}>
      {roundMatches.map((match, idx) => {
        const myTop  = getCardTop(round, idx) + CARD_H / 2
        const nextIdx = Math.floor(idx / 2)
        const nextTop = getCardTop(round + 1, nextIdx) + CARD_H / 2
        const isBottom = idx % 2 === 1
        return (
          <g key={match.id}>
            <line x1={0} y1={myTop} x2={W / 2} y2={myTop} stroke="#334155" strokeWidth={1.5} />
            {isBottom && <line x1={W/2} y1={getCardTop(round, idx-1)+CARD_H/2} x2={W/2} y2={myTop} stroke="#334155" strokeWidth={1.5} />}
            {isBottom && <line x1={W/2} y1={nextTop} x2={W} y2={nextTop} stroke="#334155" strokeWidth={1.5} />}
          </g>
        )
      })}
    </svg>
  )
}

export default function UclKnockoutBracket() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: tournament, refetch } = useUclKnockout(id)
  const resetTournament = useResetUclKnockout()
  const [confirmReset, setConfirmReset] = useState(false)

  if (!tournament) return <div className="min-h-screen bg-pitch-900 flex items-center justify-center"><p className="text-slate-500">Loading…</p></div>

  const { matches = [] } = tournament
  const totalRounds = 5 // fixed: R32→R16→QF→SF→Final

  const rounds = []
  for (let r = 1; r <= totalRounds; r++) rounds.push(matches.filter(m => m.round === r))

  const r1Count  = rounds[0]?.length || 16
  const totalH   = r1Count * BASE_SLOT
  const champion = matches.find(m => m.round === totalRounds && m.status === "completed")?.winnerName
  const CARD_WIDTH = 190

  return (
    <div className="min-h-screen bg-pitch-900 p-4 md:p-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/admin?tab=uclknockout")} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" /> Admin
          </button>
          <Trophy className="w-5 h-5 text-accent" />
          <h1 className="text-lg font-extrabold text-white">{tournament.name}</h1>
          {tournament.status === "completed" && <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/25 px-2 py-0.5 rounded-full"><CheckCircle className="w-3 h-3" /> Completed</span>}
          {tournament.status === "active" && <span className="flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-400/10 border border-amber-400/25 px-2 py-0.5 rounded-full"><Clock className="w-3 h-3" /> In Progress</span>}
          {champion && <p className="text-sm text-gold">🏆 <span className="font-bold">{champion}</span></p>}
        </div>
        {tournament.status !== "completed" && (
          confirmReset ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-rose-400">Delete all fixtures?</span>
              <button onClick={() => setConfirmReset(false)} className="text-xs px-3 py-1.5 rounded-lg border border-surface-border text-slate-400">Cancel</button>
              <button onClick={async () => { await resetTournament.mutateAsync(id); navigate("/admin?tab=uclknockout") }} disabled={resetTournament.isPending}
                className="text-xs px-3 py-1.5 rounded-lg bg-rose-500 text-white font-semibold">
                {resetTournament.isPending ? "…" : "Yes, Delete"}
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmReset(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-400/30 text-rose-400 hover:bg-rose-400/10 text-xs font-semibold">
              <Trash2 className="w-3.5 h-3.5" /> Delete Fixture
            </button>
          )
        )}
      </div>

      <div className="overflow-auto">
        <div style={{ minWidth: rounds.length * (CARD_WIDTH + 32) + CARD_WIDTH }}>
          <div className="flex mb-3">
            {rounds.map((_, rIdx) => (
              <div key={rIdx} style={{ width: CARD_WIDTH + (rIdx < rounds.length - 1 ? 32 : 0), flexShrink: 0 }}>
                <p className={cn("text-xs font-bold uppercase tracking-widest text-center", rIdx === rounds.length - 1 ? "text-gold" : "text-slate-500")}>
                  {getRoundLabel(rIdx + 1, totalRounds)}
                </p>
              </div>
            ))}
          </div>

          <div className="flex" style={{ height: totalH }}>
            {rounds.map((roundMatches, rIdx) => {
              const round = rIdx + 1
              const isLast = rIdx === rounds.length - 1
              return (
                <div key={round} className="flex" style={{ flexShrink: 0 }}>
                  <div style={{ width: CARD_WIDTH, height: totalH, position: "relative", flexShrink: 0 }}>
                    {roundMatches.map((match, idx) => (
                      <MatchCard key={match.id} match={match} totalRounds={totalRounds} tournamentId={parseInt(id)}
                        allPlayers={tournament.players || []} onSaved={refetch}
                        style={{ top: getCardTop(round, idx), left: 0, right: 0 }} />
                    ))}
                  </div>
                  {!isLast && <Connectors round={round} roundMatches={roundMatches} totalHeight={totalH} />}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="mt-8 border-t border-surface-border pt-5">
        <p className="text-xs text-slate-500 uppercase tracking-widest mb-3">32 Players</p>
        <div className="flex flex-wrap gap-2">
          {tournament.players?.map(p => (
            <span key={p.id} className="px-2.5 py-1 bg-pitch-800 border border-surface-border rounded-lg text-xs text-slate-300">
              {p.name}{p.groupName && <span className="text-slate-600 ml-1">({p.groupName})</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}