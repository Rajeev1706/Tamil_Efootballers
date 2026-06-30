import { useState } from "react"
import { Check, X, ArrowLeftRight, CheckCircle, XCircle, Repeat, Coins, Banknote, UserPlus, Clock } from "lucide-react"
import GradeBadge from "../common/GradeBadge"
import { useReviewTrade, useTrades } from "../../lib/queries"
import { getMVTier, cn } from "../../lib/utils"

const TYPE_CONFIG = {
  player_swap:        { icon: Repeat,   label: "Player swap" },
  player_plus_amount: { icon: Coins,    label: "Player + amount" },
  full_amount:        { icon: Banknote, label: "Full amount" },
  signing:            { icon: UserPlus, label: "Free agent signing" },
}

const STATUS_BADGE = {
  pending_team:      { color: "text-amber-400",   bg: "bg-amber-400/10 border-amber-400/25",   label: "Awaiting team" },
  rejected_by_team:  { color: "text-rose-400",    bg: "bg-rose-400/10 border-rose-400/25",     label: "Rejected by team" },
  pending_admin:     { color: "text-accent",      bg: "bg-accent/10 border-accent/25",         label: "Pending review" },
  approved:          { color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/25", label: "Approved" },
  rejected_by_admin: { color: "text-rose-400",    bg: "bg-rose-400/10 border-rose-400/25",     label: "Rejected" },
  cancelled:         { color: "text-slate-500",   bg: "bg-surface-border",                     label: "Cancelled" },
}

function TradeCard({ trade }) {
  const [decided, setDecided]   = useState(false)
  const [decision, setDecision] = useState(null)
  const reviewTrade             = useReviewTrade()
  const tier                    = getMVTier(trade.playerMV)
  const type = TYPE_CONFIG[trade.tradeType] || TYPE_CONFIG.full_amount
  const TypeIcon = type.icon

  const handleDecide = (action) => {
    reviewTrade.mutate({ id: trade.id, action }, {
      onSuccess: () => { setDecision(action); setDecided(true) },
      onError: (err) => alert(err.response?.data?.error || "Action failed"),
    })
  }

  return (
    <div className={cn("card p-5 transition-all",
      !decided && "hover:border-accent/20",
      decided && decision === "approved" && "border-emerald-400/25 bg-emerald-400/5",
      decided && decision === "rejected" && "border-rose-400/25 bg-rose-400/5",
    )}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <TypeIcon className="w-4 h-4 text-slate-500" />
          <span className="text-xs text-slate-500">{type.label} · {trade.requestedOn ? new Date(trade.requestedOn).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}</span>
        </div>
        {decided && (
          <span className={cn("flex items-center gap-1 text-xs font-bold", decision === "approved" ? "text-emerald-400" : "text-rose-400")}>
            {decision === "approved" ? <><CheckCircle className="w-3.5 h-3.5" />Approved</> : <><XCircle className="w-3.5 h-3.5" />Rejected</>}
          </span>
        )}
      </div>

      {/* Target player */}
      <div className="bg-pitch-800 rounded-xl p-4 border border-surface-border mb-3">
        <p className="text-xs text-slate-500 mb-2">Requesting</p>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-surface-border flex items-center justify-center text-sm font-bold text-slate-400">
            {trade.playerName.split(" ").map(n => n[0]).join("")}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-semibold text-white text-sm">{trade.playerName}</span>
              <GradeBadge grade={trade.playerGrade} />
            </div>
            <span className={cn("text-xs", tier.color)}>{tier.label} · MV {trade.playerMV}</span>
          </div>
        </div>
      </div>

      {/* Offer details */}
      {(trade.offeredPlayerName || trade.offeredAmount > 0) && (
        <div className="bg-pitch-800 rounded-xl p-4 border border-surface-border mb-3">
          <p className="text-xs text-slate-500 mb-2">In exchange for</p>
          <div className="flex items-center gap-3 flex-wrap">
            {trade.offeredPlayerName && (
              <div className="flex items-center gap-2 bg-pitch-900 rounded-lg px-3 py-1.5">
                <span className="text-sm font-medium text-white">{trade.offeredPlayerName}</span>
                <GradeBadge grade={trade.offeredPlayerGrade} />
              </div>
            )}
            {trade.offeredAmount > 0 && (
              <span className="flex items-center gap-1 text-sm font-bold font-mono text-emerald-400">
                <Coins className="w-3.5 h-3.5" /> {trade.offeredAmount}
              </span>
            )}
          </div>
        </div>
      )}

      {/* From / To */}
      <div className="flex items-center gap-2 mb-5">
        <div className="flex-1 bg-pitch-800 border border-surface-border rounded-lg px-3 py-2 text-center">
          <p className="text-xs text-slate-500 mb-0.5">Requesting Team</p>
          <p className="text-sm font-medium text-white truncate">{trade.fromTeam}</p>
        </div>
        <ArrowLeftRight className="w-4 h-4 text-accent flex-shrink-0" />
        <div className="flex-1 bg-pitch-800 border border-surface-border rounded-lg px-3 py-2 text-center">
          <p className="text-xs text-slate-500 mb-0.5">{trade.toTeam ? "Current Team" : "Status"}</p>
          <p className="text-sm font-medium text-white truncate">{trade.toTeam || "Free agent"}</p>
        </div>
      </div>

      {trade.toTeam && (
        <p className="text-xs text-emerald-400 flex items-center gap-1.5 mb-4">
          <CheckCircle className="w-3.5 h-3.5" /> {trade.toTeam} has already accepted this offer
        </p>
      )}

      {!decided ? (
        <div className="flex gap-3">
          <button onClick={() => handleDecide("rejected")} disabled={reviewTrade.isPending}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-rose-400/30 text-rose-400 text-sm font-semibold hover:bg-rose-400/10 transition-colors disabled:opacity-50">
            <X className="w-4 h-4" /> Reject
          </button>
          <button onClick={() => handleDecide("approved")} disabled={reviewTrade.isPending}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/25 transition-colors disabled:opacity-50">
            <Check className="w-4 h-4" /> Approve
          </button>
        </div>
      ) : (
        <p className="text-xs text-slate-500 text-center">
          {decision === "approved" ? "Player transfer completed." : "Request rejected."}
        </p>
      )}
    </div>
  )
}

function HistoryRow({ trade }) {
  const badge = STATUS_BADGE[trade.status] || STATUS_BADGE.pending_admin
  const type  = TYPE_CONFIG[trade.tradeType] || TYPE_CONFIG.full_amount
  const TypeIcon = type.icon
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-hover transition-colors">
      <TypeIcon className="w-4 h-4 text-slate-500 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">
          <span className="font-medium">{trade.fromTeam}</span>
          <span className="text-slate-600 mx-1.5">→</span>
          <span>{trade.playerName}</span>
          {trade.toTeam && <span className="text-slate-500"> (from {trade.toTeam})</span>}
        </p>
        {trade.rejectionReason && <p className="text-xs text-rose-400/70 italic mt-0.5">"{trade.rejectionReason}"</p>}
      </div>
      <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-lg border flex-shrink-0", badge.bg, badge.color)}>
        {badge.label}
      </span>
    </div>
  )
}

export default function TradeApproval({ trades }) {
  const [tab, setTab] = useState("pending")
  const { data: allTrades = [] } = useTrades()

  const pendingAdmin = trades // already filtered to pending_admin by parent
  const history = allTrades.filter(t => ["approved", "rejected_by_admin", "rejected_by_team", "cancelled"].includes(t.status))
  const awaitingTeam = allTrades.filter(t => t.status === "pending_team")

  return (
    <div>
      <div className="flex items-center gap-1 mb-5 bg-pitch-800 border border-surface-border rounded-xl p-1 w-fit">
        {[
          { id: "pending", label: "Pending your review", count: pendingAdmin.length },
          { id: "waiting",  label: "Awaiting team", count: awaitingTeam.length },
          { id: "history",  label: "History", count: history.length },
        ].map(({ id, label, count }) => (
          <button key={id} onClick={() => setTab(id)}
            className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              tab === id ? "bg-surface text-white border border-surface-border" : "text-slate-500 hover:text-slate-300"
            )}>
            {label}
            <span className={cn("text-xs px-1.5 py-0.5 rounded-md font-semibold",
              id === "pending" && count > 0 ? "bg-amber-400/20 text-amber-400" : "bg-surface-border text-slate-500"
            )}>{count}</span>
          </button>
        ))}
      </div>

      {tab === "pending" && (
        pendingAdmin.length === 0 ? (
          <div className="card py-16 text-center text-slate-500 text-sm">No pending trade requests awaiting your review.</div>
        ) : (
          <>
            <p className="text-sm text-slate-400 mb-5">Approving a trade immediately transfers the player and adjusts team purses.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {pendingAdmin.map(t => <TradeCard key={t.id} trade={t} />)}
            </div>
          </>
        )
      )}

      {tab === "waiting" && (
        <div className="card overflow-hidden">
          {awaitingTeam.length === 0 ? (
            <div className="px-5 py-12 text-center text-slate-500 text-sm">No requests currently awaiting team response.</div>
          ) : (
            <div className="divide-y divide-surface-border/60">
              {awaitingTeam.map(t => <HistoryRow key={t.id} trade={t} />)}
            </div>
          )}
        </div>
      )}

      {tab === "history" && (
        <div className="card overflow-hidden">
          {history.length === 0 ? (
            <div className="px-5 py-12 text-center text-slate-500 text-sm">No trade history yet.</div>
          ) : (
            <div className="divide-y divide-surface-border/60">
              {history.map(t => <HistoryRow key={t.id} trade={t} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}