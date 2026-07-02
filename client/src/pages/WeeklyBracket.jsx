import { useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Trophy, CheckCircle, Clock, Trash2 } from "lucide-react"
import { useWeeklyTournament, useSaveWeeklyResult, useResetWeeklyTournament } from "../lib/queries"
import { cn } from "../lib/utils"

const CARD_H   = 120   // fixed card height px
const BASE_SLOT = CARD_H + 10  // slot height for round 1

function getSlotH(round)        { return BASE_SLOT * Math.pow(2, round - 1) }
function getCardTop(round, idx) { const s = getSlotH(round); return idx * s + (s - CARD_H) / 2 }

function getRoundLabel(round, totalRounds) {
  const fromEnd = totalRounds - round
  if (fromEnd === 0) return "FINAL"
  if (fromEnd === 1) return "SEMI-FINAL"
  if (fromEnd === 2) return "QUARTER-FINAL"
  if (fromEnd === 3) return "ROUND OF 16"
  if (fromEnd === 4) return "ROUND OF 32"
  if (fromEnd === 5) return "ROUND OF 64"
  if (fromEnd === 6) return "ROUND OF 128"
  return `Round ${round}`
}

function MatchCard({ match, totalRounds, tournamentId, onSaved, style }) {
  const saveResult = useSaveWeeklyResult()
  const [score1, setScore1] = useState("")
  const [score2, setScore2] = useState("")
  const [tieWinner, setTieWinner] = useState("") // "p1" | "p2"
  const [editing, setEditing] = useState(false)

  const isCompleted    = match.status === "completed" || match.status === "bye"
  const isBye          = match.status === "bye"
  const hasBothPlayers = match.player1_id && match.player2_id
  const isHighlight    = (totalRounds - match.round) <= 2
  const isFinal        = match.round === totalRounds

  function openEdit() {
    setScore1(isCompleted && match.player1_score != null ? match.player1_score : "")
    setScore2(isCompleted && match.player2_score != null ? match.player2_score : "")
    setTieWinner("")
    setEditing(true)
  }

  const s1 = Number(score1), s2 = Number(score2)
  const scoresEntered = score1 !== "" && score2 !== ""
  const isTied = scoresEntered && s1 === s2
  const canSave = scoresEntered && (!isTied || tieWinner !== "")

  async function handleSave() {
    if (!canSave) return
    await saveResult.mutateAsync({
      matchId: match.id,
      player1Score: s1,
      player2Score: s2,
      tieWinnerId: isTied ? (tieWinner === "p1" ? match.player1_id : match.player2_id) : undefined,
      tournamentId,
    })
    setEditing(false)
    onSaved?.()
  }

  const p1IsWinner = match.winner_id === match.player1_id
  const p2IsWinner = match.winner_id === match.player2_id

  return (
    <div
      style={{ ...style, minHeight: CARD_H, height: editing ? "auto" : CARD_H, position: "absolute", zIndex: editing ? 50 : 1 }}
      className={cn(
        "w-full rounded-xl border overflow-hidden flex flex-col",
        isFinal     ? "border-gold/40 shadow-[0_0_20px_rgba(245,158,11,0.1)]" :
        isHighlight ? "border-accent/30" :
        isCompleted ? "border-emerald-400/20" : "border-surface-border"
      )}
    >
      {/* Round badge for QF/SF/Final */}
      {isHighlight && (
        <div className={cn("text-center text-xs font-bold uppercase tracking-wider py-0.5 flex-shrink-0",
          isFinal ? "bg-gold/20 text-gold" : "bg-accent/10 text-accent"
        )}>
          {getRoundLabel(match.round, totalRounds)}
        </div>
      )}

      {/* Player rows */}
      <div className="flex-1 flex flex-col bg-pitch-800/50 min-h-0">
        {[
          { name: match.player1Name, score: match.player1_score, id: match.player1_id, isWinner: p1IsWinner },
          { name: match.player2Name, score: match.player2_score, id: match.player2_id, isWinner: p2IsWinner },
        ].map((p, i) => (
          <div key={i} className={cn(
            "flex items-center justify-between px-2.5 flex-1 min-h-0",
            i === 0 ? "border-b border-surface-border/30" : "",
            isCompleted && p.isWinner ? "bg-emerald-400/8" : ""
          )}>
            <span className={cn("text-xs font-medium truncate flex-1",
              !p.id ? "text-slate-600 italic" :
              isCompleted && p.isWinner ? "text-emerald-400 font-bold" : "text-white"
            )}>
              {isBye && !p.id ? "BYE" : (p.name || "TBD")}
            </span>
            <div className="flex items-center gap-1.5 flex-shrink-0 ml-1">
              {isCompleted && p.score != null && (
                <span className={cn("text-xs font-bold font-mono",
                  p.isWinner ? "text-emerald-400" : "text-slate-500"
                )}>{p.score}</span>
              )}
              {isCompleted && p.isWinner && (
                <span className="text-xs font-bold text-emerald-400">W</span>
              )}
              {isCompleted && !p.isWinner && match.winner_id && p.id && (
                <span className="text-xs font-bold text-rose-400">L</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      {!editing && !isBye && hasBothPlayers && (
        <button
          onClick={openEdit}
          className={cn("text-xs py-1 border-t border-surface-border/30 transition-colors flex-shrink-0",
            isCompleted
              ? "text-slate-600 hover:text-amber-400 bg-pitch-900/40"
              : "text-slate-500 hover:text-accent bg-pitch-900/40"
          )}>
          {isCompleted ? "✎ Edit result" : "+ Enter result"}
        </button>
      )}

      {editing && (
        <div className="bg-pitch-900 border-t border-surface-border/30 px-2 py-1.5 space-y-1.5 flex-shrink-0">
          <div className="flex items-center gap-1">
            <div className="flex-1 text-center">
              <p className="text-xs text-slate-600 mb-0.5 truncate">{match.player1Name}</p>
              <input type="number" min="0" placeholder="0" value={score1}
                onChange={e => setScore1(e.target.value)}
                className="w-full text-center bg-pitch-800 border border-surface-border rounded text-xs text-white py-1 focus:outline-none focus:border-accent/40" />
            </div>
            <span className="text-slate-600 text-xs flex-shrink-0">vs</span>
            <div className="flex-1 text-center">
              <p className="text-xs text-slate-600 mb-0.5 truncate">{match.player2Name}</p>
              <input type="number" min="0" placeholder="0" value={score2}
                onChange={e => setScore2(e.target.value)}
                className="w-full text-center bg-pitch-800 border border-surface-border rounded text-xs text-white py-1 focus:outline-none focus:border-accent/40" />
            </div>
          </div>
          {scoresEntered && !isTied && (
            <p className={cn("text-xs text-center font-semibold",
              s1 > s2 ? "text-emerald-400" : "text-rose-400"
            )}>
              {s1 > s2 ? `${match.player1Name} wins` : `${match.player2Name} wins`}
            </p>
          )}
          {isTied && (
            <div>
              <p className="text-xs text-amber-400 text-center font-semibold mb-1.5">Scores tied — pick winner</p>
              <div className="flex gap-1.5">
                <button onClick={() => setTieWinner("p1")}
                  className={cn("flex-1 text-xs py-1.5 rounded-lg border font-semibold transition-colors",
                    tieWinner === "p1" ? "bg-emerald-400/20 border-emerald-400/40 text-emerald-400" : "border-surface-border text-slate-400 hover:text-white"
                  )}>
                  {match.player1Name}
                </button>
                <button onClick={() => setTieWinner("p2")}
                  className={cn("flex-1 text-xs py-1.5 rounded-lg border font-semibold transition-colors",
                    tieWinner === "p2" ? "bg-emerald-400/20 border-emerald-400/40 text-emerald-400" : "border-surface-border text-slate-400 hover:text-white"
                  )}>
                  {match.player2Name}
                </button>
              </div>
            </div>
          )}
          <div className="flex gap-1.5">
            <button onClick={() => setEditing(false)} className="flex-1 text-xs py-1 rounded border border-surface-border text-slate-400">Cancel</button>
            <button onClick={handleSave}
              disabled={!canSave || saveResult.isPending}
              className="flex-1 text-xs py-1 rounded bg-accent/20 text-accent border border-accent/30 font-semibold disabled:opacity-40">
              {saveResult.isPending ? "…" : "Save"}
            </button>
          </div>
        </div>
      )}

      {!isCompleted && !hasBothPlayers && !editing && (
        <div className="text-center text-xs text-slate-700 py-0.5 bg-pitch-900/40 border-t border-surface-border/30 flex-shrink-0">Awaiting</div>
      )}
      {isBye && (
        <div className="text-center text-xs text-slate-600 py-0.5 bg-pitch-900/40 border-t border-surface-border/30 flex-shrink-0">Bye — auto advance</div>
      )}
    </div>
  )
}

// SVG connector lines between two adjacent rounds
function Connectors({ round, roundMatches, nextRoundMatches, totalHeight }) {
  const W = 32 // connector width

  return (
    <svg width={W} height={totalHeight} style={{ flexShrink: 0, overflow: "visible" }}>
      {roundMatches.map((match, idx) => {
        const myTop    = getCardTop(round, idx) + CARD_H / 2
        const nextIdx  = Math.floor(idx / 2)
        const nextTop  = getCardTop(round + 1, nextIdx) + CARD_H / 2
        const isBottom = idx % 2 === 1

        return (
          <g key={match.id}>
            {/* Horizontal line from match card */}
            <line x1={0} y1={myTop} x2={W / 2} y2={myTop}
              stroke="#334155" strokeWidth={1.5} />
            {/* Vertical line connecting pair (only draw from bottom of pair) */}
            {isBottom && (
              <line x1={W / 2} y1={getCardTop(round, idx - 1) + CARD_H / 2}
                    x2={W / 2} y2={myTop}
                    stroke="#334155" strokeWidth={1.5} />
            )}
            {/* Horizontal line to next round (only from bottom of pair) */}
            {isBottom && (
              <line x1={W / 2} y1={nextTop} x2={W} y2={nextTop}
                stroke="#334155" strokeWidth={1.5} />
            )}
          </g>
        )
      })}
    </svg>
  )
}

export default function WeeklyBracket() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: tournament, refetch } = useWeeklyTournament(id)
  const resetTournament = useResetWeeklyTournament()
  const [confirmReset, setConfirmReset] = useState(false)

  if (!tournament) return (
    <div className="min-h-screen bg-pitch-900 flex items-center justify-center">
      <p className="text-slate-500">Loading…</p>
    </div>
  )

  const { matches = [], total_rounds: totalRounds = 1 } = tournament

  const rounds = []
  for (let r = 1; r <= totalRounds; r++) {
    rounds.push(matches.filter(m => m.round === r))
  }

  const r1Count    = rounds[0]?.length || 1
  const totalH     = r1Count * BASE_SLOT
  const champion   = matches.find(m => m.round === totalRounds && m.status === "completed")?.winnerName
  const CARD_WIDTH = 190

  return (
    <div className="min-h-screen bg-pitch-900 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/admin?tab=weekly")}
            className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" /> Admin
          </button>
          <Trophy className="w-5 h-5 text-accent" />
          <h1 className="text-lg font-extrabold text-white">{tournament.name}</h1>
          {tournament.status === "completed" && (
            <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/25 px-2 py-0.5 rounded-full">
              <CheckCircle className="w-3 h-3" /> Completed
            </span>
          )}
          {tournament.status === "active" && (
            <span className="flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-400/10 border border-amber-400/25 px-2 py-0.5 rounded-full">
              <Clock className="w-3 h-3" /> In Progress
            </span>
          )}
          {champion && <p className="text-sm text-gold">🏆 <span className="font-bold">{champion}</span></p>}
        </div>

        {tournament.status !== "completed" && (
          confirmReset ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-rose-400">Delete all fixtures?</span>
              <button onClick={() => setConfirmReset(false)} className="text-xs px-3 py-1.5 rounded-lg border border-surface-border text-slate-400">Cancel</button>
              <button onClick={async () => { await resetTournament.mutateAsync(id); navigate("/admin?tab=weekly") }}
                disabled={resetTournament.isPending}
                className="text-xs px-3 py-1.5 rounded-lg bg-rose-500 text-white font-semibold">
                {resetTournament.isPending ? "Deleting…" : "Yes, Delete"}
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmReset(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-400/30 text-rose-400 hover:bg-rose-400/10 text-xs font-semibold transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> Delete Fixture
            </button>
          )
        )}
      </div>

      {/* Bracket */}
      <div className="overflow-auto">
        <div style={{ minWidth: rounds.length * (CARD_WIDTH + 32) + CARD_WIDTH }}>
          {/* Column headers */}
          <div className="flex mb-3" style={{ paddingLeft: 0 }}>
            {rounds.map((_, rIdx) => (
              <div key={rIdx} style={{ width: CARD_WIDTH + (rIdx < rounds.length - 1 ? 32 : 0), flexShrink: 0 }}>
                <p className={cn("text-xs font-bold uppercase tracking-widest text-center",
                  rIdx === rounds.length - 1 ? "text-gold" : "text-slate-500"
                )}>
                  {getRoundLabel(rIdx + 1, totalRounds)}
                </p>
              </div>
            ))}
          </div>

          {/* Bracket columns */}
          <div className="flex" style={{ height: totalH }}>
            {rounds.map((roundMatches, rIdx) => {
              const round = rIdx + 1
              const isLast = rIdx === rounds.length - 1

              return (
                <div key={round} className="flex" style={{ flexShrink: 0 }}>
                  {/* Match column */}
                  <div style={{ width: CARD_WIDTH, height: totalH, position: "relative", flexShrink: 0 }}>
                    {roundMatches.map((match, idx) => (
                      <MatchCard
                        key={match.id}
                        match={match}
                        totalRounds={totalRounds}
                        tournamentId={parseInt(id)}
                        onSaved={refetch}
                        style={{ top: getCardTop(round, idx), left: 0, right: 0 }}
                      />
                    ))}
                  </div>

                  {/* SVG connectors to next round */}
                  {!isLast && (
                    <Connectors
                      round={round}
                      roundMatches={roundMatches}
                      nextRoundMatches={rounds[rIdx + 1]}
                      totalHeight={totalH}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Players list */}
      <div className="mt-8 border-t border-surface-border pt-5">
        <p className="text-xs text-slate-500 uppercase tracking-widest mb-3">{tournament.player_count} Players</p>
        <div className="flex flex-wrap gap-2">
          {tournament.players?.map(p => (
            <span key={p.player_id} className="px-2.5 py-1 bg-pitch-800 border border-surface-border rounded-lg text-xs text-slate-300">
              {p.name}{p.team && <span className="text-slate-600 ml-1">({p.team})</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}