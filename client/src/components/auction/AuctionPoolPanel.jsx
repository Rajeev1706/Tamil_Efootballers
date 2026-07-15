import { useNavigate } from "react-router-dom"
import { Clock, XCircle } from "lucide-react"

const CARD_COLORS = { silver: "text-slate-300", gold: "text-gold", purple: "text-purple-300" }

// Two panels — Remaining (still pending in the pool) and Unsold (didn't
// sell in a previous round) — so anyone watching can see who's still
// left, not just the count shown in the header. When `clickable` is set,
// each entry navigates to that player's profile (used on the team
// captain page, where a captain actually needs to check stats before the
// next round; the public view shows the same lists read-only).
export default function PoolPanel({ pool = [], clickable = false }) {
  const navigate = useNavigate()
  const remaining = pool.filter(p => p.status === "pending")
  const unsold = pool.filter(p => p.status === "unsold_r1" || p.status === "unsold_r2")

  if (remaining.length === 0 && unsold.length === 0) return null

  const Row = ({ p }) => {
    const content = (
      <>
        <span className={cardDot(p.cardType)} />
        <span className="pool-panel-name">{p.name}</span>
        {p.status === "unsold_r2" && <span className="pool-panel-r2">R2</span>}
      </>
    )
    return clickable ? (
      <button onClick={() => navigate(`/player/${p.playerId}`)} className="pool-panel-row pool-panel-row-clickable">
        {content}
      </button>
    ) : (
      <div className="pool-panel-row">{content}</div>
    )
  }

  return (
    <div className="pool-panels">
      {remaining.length > 0 && (
        <div className="pool-panel">
          <h3><Clock className="w-3.5 h-3.5" /> Remaining <span className="pool-panel-count">{remaining.length}</span></h3>
          <div className="pool-panel-list">
            {remaining.map(p => <Row key={p.id} p={p} />)}
          </div>
        </div>
      )}
      {unsold.length > 0 && (
        <div className="pool-panel">
          <h3><XCircle className="w-3.5 h-3.5" /> Unsold <span className="pool-panel-count">{unsold.length}</span></h3>
          <div className="pool-panel-list">
            {unsold.map(p => <Row key={p.id} p={p} />)}
          </div>
        </div>
      )}
    </div>
  )
}

function cardDot(cardType) {
  const base = "pool-panel-dot"
  if (cardType === "gold") return `${base} pool-panel-dot-gold`
  if (cardType === "purple") return `${base} pool-panel-dot-purple`
  return `${base} pool-panel-dot-silver`
}