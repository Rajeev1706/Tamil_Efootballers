import GradeBadge from "../common/GradeBadge"
import { getMVTier, cn } from "../../lib/utils"
import PlayerAvatar from "../common/PlayerAvatar"

const FormDot = ({ result }) => {
  const cls = { W: "bg-emerald-500", D: "bg-amber-400", L: "bg-rose-500" }
  return <span className={cn("w-2 h-2 rounded-full", cls[result] || "bg-slate-600")} title={result} />
}

function PlayerCard({ player, onPlayerClick }) {
  const delta    = player.marketValue - player.auctionPrice
  const tier     = getMVTier(player.marketValue)
  const isElite  = player.grade === "S"

  return (
    <div onClick={() => onPlayerClick?.(player)} className={cn(
      "card p-5 flex flex-col gap-4 hover:border-accent/30 transition-colors cursor-pointer",
      isElite && "gold-border"
    )}>
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
import PlayerAvatar from "../common/PlayerAvatar"

// In JSX:
<PlayerAvatar player={player} size="md" />
          <div>
            <p className="font-semibold text-white text-sm leading-tight">{player.name}</p>
            <p className="text-xs text-slate-500 mt-0.5">"{player.alias}"</p>
          </div>
        </div>
        <GradeBadge grade={player.grade} size="md" />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2">
        <StatCell label="Auction" value={player.auctionPrice} mono />
        <StatCell
          label="Market val"
          value={player.marketValue}
          mono
          valueClass={isElite ? "text-gold" : "text-accent"}
        />
        <StatCell label="BDR pts" value={player.bdrPoints.toLocaleString()} mono />
      </div>

      {/* Delta + tier */}
      <div className="flex items-center justify-between pt-1 border-t border-surface-border">
        <span className={cn(
          "text-xs font-semibold font-mono",
          delta > 0 ? "text-emerald-400" : delta < 0 ? "text-rose-400" : "text-slate-500"
        )}>
          {delta > 0 ? `+${delta}` : delta} from auction
        </span>
        <span className={cn("text-xs font-semibold", tier.color)}>{tier.label}</span>
      </div>

      {/* Form */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-slate-600 mr-1">Form</span>
        {player.form.map((r, i) => <FormDot key={i} result={r} />)}
      </div>
    </div>
  )
}

function StatCell({ label, value, mono, valueClass }) {
  return (
    <div className="bg-pitch-800 rounded-lg p-2.5 text-center">
      <p className="text-xs text-slate-600 mb-0.5">{label}</p>
      <p className={cn("text-sm font-bold", mono && "font-mono", valueClass || "text-white")}>{value}</p>
    </div>
  )
}

export default function Squad({ players, onPlayerClick }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white">
          My squad <span className="text-slate-500 font-normal ml-1">· {players.length} players</span>
        </h2>
        <span className="text-xs text-slate-500">
          Total MV <span className="text-accent font-semibold font-mono ml-1">
            {players.reduce((s, p) => s + p.marketValue, 0)}
          </span>
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {players.map(p => <PlayerCard key={p.id} player={p} onPlayerClick={onPlayerClick} />)}
      </div>
    </div>
  )
}
