import { useState } from "react"
import { Crown, Camera, X } from "lucide-react"
import GradeBadge from "../common/GradeBadge"
import { getMVTier, cn } from "../../lib/utils"
import PlayerAvatar from "../common/PlayerAvatar"
import ImageUpload from "../admin/ImageUpload"

const FormDot = ({ result }) => {
  const cls = { W: "bg-emerald-500", D: "bg-amber-400", L: "bg-rose-500" }
  return <span className={cn("w-2 h-2 rounded-full", cls[result] || "bg-slate-600")} title={result} />
}


function PlayerCard({ player, onPlayerClick, uploadingFor, setUploadingFor }) {
  const delta    = player.isCaptain ? 0 : player.marketValue - player.auctionPrice
  const tier     = getMVTier(player.marketValue)
  const isElite  = player.grade === "S"
  const isUploadOpen = uploadingFor === player.id

  return (
    <div className={cn(
      "card p-5 flex flex-col gap-4 transition-colors",
      isElite && "gold-border",
      !isUploadOpen && "hover:border-accent/30"
    )}>
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div
          className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
          onClick={() => onPlayerClick?.(player)}
        >
          <PlayerAvatar player={player} size="md" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-semibold text-white text-sm leading-tight">{player.name}</p>
              {player.isCaptain && <Crown className="w-3.5 h-3.5 text-gold flex-shrink-0" />}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">"{player.alias}"</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <GradeBadge grade={player.grade} size="md" />
          {/* Camera / upload toggle */}
          <button
            onClick={() => setUploadingFor(isUploadOpen ? null : player.id)}
            title={isUploadOpen ? "Close photo upload" : "Upload player photo"}
            className={cn(
              "w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
              isUploadOpen
                ? "bg-rose-500/15 border border-rose-500/30 text-rose-400 hover:bg-rose-500/25"
                : "bg-slate-700/50 border border-surface-border text-slate-400 hover:text-accent hover:border-accent/40"
            )}
          >
            {isUploadOpen ? <X className="w-3.5 h-3.5" /> : <Camera className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Inline squad image upload panel */}
      {isUploadOpen && (
        <div className="rounded-xl border border-accent/20 bg-accent/5 p-4 flex flex-col items-center gap-2">
          <p className="text-xs text-slate-400 font-medium">
            Squad photo for <span className="text-white">{player.name}</span>
          </p>
          <ImageUpload
            player={{ id: player.id, imageUrl: player.imageUrl || null }}
            onSuccess={() => setUploadingFor(null)}
          />
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2">
        <StatCell
          label="Auction"
          value={player.isCaptain ? "CAP" : player.auctionPrice}
          mono
          valueClass={player.isCaptain ? "text-gold" : undefined}
        />
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
        {player.isCaptain ? (
          <span className="text-xs font-semibold text-gold">Team captain</span>
        ) : (
          <span className={cn(
            "text-xs font-semibold font-mono",
            delta > 0 ? "text-emerald-400" : delta < 0 ? "text-rose-400" : "text-slate-500"
          )}>
            {delta > 0 ? `+${delta}` : delta} from auction
          </span>
        )}
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
  const [uploadingFor, setUploadingFor] = useState(null)

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
        {players.map(p => (
          <PlayerCard
            key={p.id}
            player={p}
            onPlayerClick={onPlayerClick}
            uploadingFor={uploadingFor}
            setUploadingFor={setUploadingFor}
          />
        ))}
      </div>
    </div>
  )
}