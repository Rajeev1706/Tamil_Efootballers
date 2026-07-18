import { useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Trophy, CheckCircle, Clock, Trash2 } from "lucide-react"
import { useUclKnockout, useSaveUclKnockoutResult, useResetUclKnockout, useUpdateUclKnockoutMatchPlayers } from "../lib/queries"
import { cn } from "../lib/utils"
import Confetti from "../components/common/Confetti"
import PlayerAvatarIcon from "../components/common/PlayerAvatarIcon"

const TOTAL_ROUNDS = 5 // fixed: R32 → R16 → QF → SF → Final, always

function getRoundLabel(round, totalRounds) {
  const fromEnd = totalRounds - round
  if (fromEnd === 0) return "Final"
  if (fromEnd === 1) return "Semi-Final"
  if (fromEnd === 2) return "Quarter-Final"
  if (fromEnd === 3) return "Round of 16"
  if (fromEnd === 4) return "Round of 32"
  return `Round ${round}`
}

function MatchRow({ match, totalRounds, tournamentId, allPlayers, onSaved }) {
  const saveResult    = useSaveUclKnockoutResult()
  const updatePlayers = useUpdateUclKnockoutMatchPlayers()
  const [score1, setScore1] = useState("")
  const [score2, setScore2] = useState("")
  const [tieWinner, setTieWinner] = useState("")
  const [editing, setEditing]     = useState(false)
  const [editingPlayers, setEditingPlayers] = useState(false)
  const [p1Id, setP1Id] = useState(match.player1_id || "")
  const [p2Id, setP2Id] = useState(match.player2_id || "")
  const [justSaved, setJustSaved] = useState(false)

  const isCompleted    = match.status === "completed"
  const hasBothPlayers = match.player1_id && match.player2_id

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
    setJustSaved(true)
    onSaved?.()
  }

  const p1IsWinner = match.winner_id === match.player1_id
  const p2IsWinner = match.winner_id === match.player2_id

  return (
    <div className={cn("border-b border-surface-border/50", justSaved && "animate-result-flash")}>
      <div className="flex items-center px-5 py-3.5">
        <span className="text-xs text-slate-600 font-mono w-9 flex-shrink-0">#{match.match_number}</span>
        <div className="flex-1 min-w-0 text-left flex items-center gap-2">
          {match.player1_id && (
            <PlayerAvatarIcon player={{ avatarId: match.player1AvatarId, avatarUrl: match.player1AvatarUrl, name: match.player1Name }} />
          )}
          <div className="min-w-0">
            <span className={cn("font-medium truncate block",
              !match.player1_id ? "text-slate-600 italic" :
              isCompleted && p1IsWinner ? "text-emerald-400" : "text-white"
            )}>
              {match.player1Name ?? "TBD"}
            </span>
            {match.player1Group && <span className="text-xs text-slate-600">{match.player1Group}</span>}
          </div>
        </div>

        <div className="px-4 flex-shrink-0">
          {isCompleted ? (
            <span className="text-sm font-mono font-bold text-white bg-pitch-800 px-3 py-1 rounded-lg">
              {match.player1_score} - {match.player2_score}
            </span>
          ) : (
            <span className="text-xs text-slate-600">vs</span>
          )}
        </div>

        <div className="flex-1 min-w-0 text-right flex items-center justify-end gap-2">
          <div className="min-w-0">
            <span className={cn("font-medium truncate block",
              !match.player2_id ? "text-slate-600 italic" :
              isCompleted && p2IsWinner ? "text-emerald-400" : "text-white"
            )}>
              {match.player2Name ?? "TBD"}
            </span>
            {match.player2Group && <span className="text-xs text-slate-600">{match.player2Group}</span>}
          </div>
          {match.player2_id && (
            <PlayerAvatarIcon player={{ avatarId: match.player2AvatarId, avatarUrl: match.player2AvatarUrl, name: match.player2Name }} />
          )}
        </div>
      </div>

      {!editing && !editingPlayers && (
        <div className="flex items-center justify-center gap-5 pb-3 -mt-1">
          {hasBothPlayers && (
            <button onClick={openEdit}
              className="text-xs text-slate-500 hover:text-accent transition-colors">
              {isCompleted ? "✎ Edit result" : "+ Enter result"}
            </button>
          )}
          <button
            onClick={() => {
              setP1Id(match.player1_id ? String(match.player1_id) : "")
              setP2Id(match.player2_id ? String(match.player2_id) : "")
              setEditingPlayers(true)
            }}
            className="text-xs text-slate-500 hover:text-accent transition-colors">
            ✎ Edit players
          </button>
        </div>
      )}

      {!editing && !editingPlayers && !isCompleted && !hasBothPlayers && (
        <p className="text-center text-xs text-slate-700 pb-2 -mt-1">Awaiting</p>
      )}

      {editing && (
        <div className="bg-pitch-900/60 border-t border-surface-border/30 px-5 py-3 space-y-2">
          <div className="flex items-center justify-center gap-3 max-w-sm mx-auto">
            <div className="flex-1 text-center">
              <p className="text-xs text-slate-500 mb-1 truncate">{match.player1Name}</p>
              <input type="number" min="0" placeholder="0" value={score1}
                onChange={e => setScore1(e.target.value)}
                className="w-full text-center bg-pitch-800 border border-surface-border rounded-lg text-sm text-white py-1.5 focus:outline-none focus:border-accent/40" />
            </div>
            <span className="text-slate-600 text-xs flex-shrink-0 pt-4">vs</span>
            <div className="flex-1 text-center">
              <p className="text-xs text-slate-500 mb-1 truncate">{match.player2Name}</p>
              <input type="number" min="0" placeholder="0" value={score2}
                onChange={e => setScore2(e.target.value)}
                className="w-full text-center bg-pitch-800 border border-surface-border rounded-lg text-sm text-white py-1.5 focus:outline-none focus:border-accent/40" />
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
            <div className="max-w-sm mx-auto">
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

          <div className="flex gap-2 max-w-sm mx-auto">
            <button onClick={() => setEditing(false)} className="flex-1 text-xs py-1.5 rounded-lg border border-surface-border text-slate-400">Cancel</button>
            <button onClick={handleSave}
              disabled={!canSave || saveResult.isPending}
              className="flex-1 text-xs py-1.5 rounded-lg bg-accent/20 text-accent border border-accent/30 font-semibold disabled:opacity-40">
              {saveResult.isPending ? "…" : "Save"}
            </button>
          </div>
        </div>
      )}

      {editingPlayers && (
        <div className="bg-pitch-900/60 border-t border-surface-border/30 px-5 py-3 space-y-2 max-w-sm mx-auto">
          <p className="text-xs text-slate-500 mb-1 text-center">Edit players</p>
          <div>
            <p className="text-xs text-slate-600 mb-0.5">Player 1</p>
            <select value={p1Id} onChange={e => setP1Id(e.target.value)}
              className="w-full bg-pitch-800 border border-surface-border rounded-lg text-xs text-white py-1.5 px-2 focus:outline-none focus:border-accent/40">
              <option value="">— TBD —</option>
              {allPlayers.filter(p => !p2Id || String(p.id) !== String(p2Id)).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-xs text-slate-600 mb-0.5">Player 2</p>
            <select value={p2Id} onChange={e => setP2Id(e.target.value)}
              className="w-full bg-pitch-800 border border-surface-border rounded-lg text-xs text-white py-1.5 px-2 focus:outline-none focus:border-accent/40">
              <option value="">— TBD —</option>
              {allPlayers.filter(p => !p1Id || String(p.id) !== String(p1Id)).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => setEditingPlayers(false)}
              className="flex-1 text-xs py-1.5 rounded-lg border border-surface-border text-slate-400">Cancel</button>
            <button
              onClick={async () => {
                await updatePlayers.mutateAsync({
                  matchId: match.id,
                  player1Id: p1Id ? Number(p1Id) : null,
                  player2Id: p2Id ? Number(p2Id) : null,
                })
                setEditingPlayers(false)
                onSaved?.()
              }}
              disabled={updatePlayers.isPending}
              className="flex-1 text-xs py-1.5 rounded-lg bg-accent/20 text-accent border border-accent/30 font-semibold disabled:opacity-40">
              {updatePlayers.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function UclKnockoutBracket() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: tournament, refetch } = useUclKnockout(id)
  const resetTournament = useResetUclKnockout()
  const [confirmReset, setConfirmReset] = useState(false)
  const [activeRound, setActiveRound] = useState(1)

  if (!tournament) return (
    <div className="min-h-screen bg-pitch-900 flex items-center justify-center">
      <p className="text-slate-500">Loading…</p>
    </div>
  )

  const { matches = [] } = tournament
  const totalRounds = TOTAL_ROUNDS
  const rounds = Array.from({ length: totalRounds }, (_, i) => i + 1)
  const currentRound = rounds.includes(activeRound) ? activeRound : rounds[0]
  const roundMatches = matches.filter(m => m.round === currentRound)
  const champion = matches.find(m => m.round === totalRounds && m.status === "completed")?.winnerName

  return (
    <div className="min-h-screen bg-pitch-900 p-4 md:p-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/admin?tab=uclknockout")}
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
          {champion && (
            <p className="text-sm text-gold animate-champion-pop">
              🏆 <span className="font-bold">{champion}</span>
            </p>
          )}
        </div>

        {champion && <Confetti fixed />}
        {tournament.status !== "completed" && (
          confirmReset ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-rose-400">Delete all fixtures?</span>
              <button onClick={() => setConfirmReset(false)} className="text-xs px-3 py-1.5 rounded-lg border border-surface-border text-slate-400">Cancel</button>
              <button onClick={async () => { await resetTournament.mutateAsync(id); navigate("/admin?tab=uclknockout") }}
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

      <div className="card overflow-hidden">
        <div className="flex gap-1.5 px-5 py-3 overflow-x-auto border-b border-surface-border/60">
          {rounds.map(r => (
            <button key={r} onClick={() => setActiveRound(r)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors",
                r === currentRound ? "bg-accent text-white" : "bg-pitch-800 text-slate-500 hover:text-white"
              )}>
              {getRoundLabel(r, totalRounds)}
            </button>
          ))}
        </div>

        {roundMatches.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-slate-500">No fixtures in this round yet</p>
          </div>
        ) : (
          <div>
            {roundMatches.map(match => (
              <MatchRow
                key={match.id}
                match={match}
                totalRounds={totalRounds}
                tournamentId={parseInt(id)}
                allPlayers={tournament.players || []}
                onSaved={refetch}
              />
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 border-t border-surface-border pt-5">
        <p className="text-xs text-slate-500 uppercase tracking-widest mb-3">{tournament.players?.length || 32} Players</p>
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