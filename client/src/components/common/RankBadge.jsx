export default function RankBadge({ change }) {
  if (change == null || change === undefined) return null
  if (change === 0) return (
    <span className="text-[10px] text-slate-600 font-bold flex-shrink-0">—</span>
  )
  if (change > 0) return (
    <span className="text-[10px] font-bold flex-shrink-0" style={{ color: "#10b981" }}>▲{change}</span>
  )
  return (
    <span className="text-[10px] font-bold flex-shrink-0" style={{ color: "#ef4444" }}>▼{Math.abs(change)}</span>
  )
}