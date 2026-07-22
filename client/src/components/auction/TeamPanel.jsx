import { Crown } from "lucide-react"
import { cn } from "../../lib/utils"

// Chip for a regular auction purchase
function PurchaseChip({ player }) {
  return (
    <span className="team-player-tag">
      <span className="team-player-tag-name">{player.playerName}</span>
      {player.rtmUsed && <span className="team-player-tag-rtm" title="Right to Match">RTM</span>}
    </span>
  )
}

// Chip for a retained player — blue tint, "RET" label
function RetentionChip({ name, price }) {
  return (
    <span className="team-player-tag"
      style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.35)" }}>
      <span className="team-player-tag-name" style={{ color: "#93c5fd" }}>{name}</span>
      <span style={{ fontSize: "9px", color: "#60a5fa", fontWeight: 700, marginLeft: 3 }}>RET</span>
    </span>
  )
}

// Chip for the team captain — gold tint, crown icon
function CaptainChip({ name }) {
  return (
    <span className="team-player-tag"
      style={{ background: "rgba(217,164,65,0.15)", border: "1px solid rgba(217,164,65,0.40)" }}>
      <Crown size={9} style={{ color: "#D9A441", flexShrink: 0, marginRight: 2 }} />
      <span className="team-player-tag-name" style={{ color: "#F2C766" }}>{name}</span>
    </span>
  )
}

export default function TeamPanel({ title, teamList, sales, retentions = [], budgetPerTeam }) {
  return (
    <div className="side-panel">
      <h2>{title}</h2>
      {teamList.map(t => {
        const roster       = sales.filter(s => s.teamId === t.id)
        const teamRetained = retentions.filter(r => r.teamId === t.id)
        const captains     = t.captains || []
        const isLowBudget  = t.budget <= 100
        const total        = budgetPerTeam || t.budget
        const spentPct     = total > 0 ? Math.min(100, Math.round(((total - t.budget) / total) * 100)) : 0

        const hasAnyPlayers = captains.length > 0 || teamRetained.length > 0 || roster.length > 0

        return (
          <div key={t.id} className={cn("team-leader", isLowBudget && "low-budget")}>
            <div className="team-leader-top">
              {t.logoUrl
                ? <img src={t.logoUrl} alt="" className="circle-logo" />
                : <div className="circle-logo bg-pitch-800 flex items-center justify-center text-xs text-slate-500">{t.name[0]}</div>
              }
              <div className="team-info flex-1 min-w-0">
                <h4>{t.name}</h4>
                <p>💰 ₹{t.budget} left</p>
              </div>
            </div>

            <div className="team-budget-bar">
              <div
                className={cn("team-budget-bar-fill", isLowBudget && "low")}
                style={{ width: `${spentPct}%` }}
              />
            </div>

            {hasAnyPlayers && (
              <div className="team-players">
                {/* Captain chips — always first, gold */}
                {captains.map(c => <CaptainChip key={`cap-${c.id}`} name={c.name} />)}

                {/* Retention chips — blue */}
                {teamRetained.map(r => <RetentionChip key={`ret-${r.playerId}`} name={r.playerName} price={r.price} />)}

                {/* Regular auction purchases */}
                {roster.map(p => <PurchaseChip key={p.id} player={p} />)}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}