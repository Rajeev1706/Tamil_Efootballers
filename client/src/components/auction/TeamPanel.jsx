import { cn } from "../../lib/utils"

// A side-panel column of team cards — logo, name, a budget progress bar,
// and the roster they've bought so far this auction, each chip showing
// what that player actually cost. Ported layout concept from the
// original app's left/right team panels (teams are split across both
// sides, flanking the central auction area). Shared identically by the
// admin screen, the team captain page, and the public live view.
export default function TeamPanel({ title, teamList, sales, budgetPerTeam }) {
  return (
    <div className="side-panel">
      <h2>{title}</h2>
      {teamList.map(t => {
        const roster = sales.filter(s => s.teamId === t.id)
        const isLowBudget = t.budget <= 100
        const total = budgetPerTeam || t.budget
        const spentPct = total > 0 ? Math.min(100, Math.round(((total - t.budget) / total) * 100)) : 0

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

            {roster.length > 0 && (
              <div className="team-players">
                {roster.map(p => (
                  <span key={p.id} className="team-player-tag">
                    <span className="team-player-tag-name">{p.playerName}</span>
                    {p.rtmUsed && <span className="team-player-tag-rtm" title="Right to Match">RTM</span>}
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}