import { useState } from "react"
import { ArrowLeftRight, Clock, CheckCircle, XCircle, Repeat, Coins, Banknote, UserPlus, X, Check } from "lucide-react"
import GradeBadge from "../common/GradeBadge"
import { useTeamReviewTrade, useCancelTrade } from "../../lib/queries"
import { cn } from "../../lib/utils"

const STATUS_CONFIG = {
  pending_team:     { icon: Clock,       color: "text-amber-400",   bg: "bg-amber-400/10 border-amber-400/25",   label: "Awaiting their response" },
  rejected_by_team: { icon: XCircle,     color: "text-rose-400",    bg: "bg-rose-400/10 border-rose-400/25",     label: "Rejected" },
  pending_admin:    { icon: Clock,       color: "text-accent",      bg: "bg-accent/10 border-accent/25",         label: "Awaiting admin approval" },
  approved:         { icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/25", label: "Approved" },
  rejected_by_admin:{ icon: XCircle,     color: "text-rose-400",    bg: "bg-rose-400/10 border-rose-400/25",     label: "Rejected by admin" },
  cancelled:        { icon: X,           color: "text-slate-500",   bg: "bg-surface-border",                     label: "Cancelled" },
}

const TYPE_CONFIG = {
  player_swap:        { icon: Repeat,   label: "Player swap" },
  player_plus_amount: { icon: Coins,    label: "Player + amount" },
  full_amount:        { icon: Banknote, label: "Full amount offer" },
  signing:            { icon: UserPlus, label: "Free agent signing" },
}

function TradeDetail({ trade }) {
  const type = TYPE_CONFIG[trade.tradeType] || TYPE_CONFIG.full_amount
  const Icon = type.icon
  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-500">
      <Icon className="w-3 h-3" />
      <span>{type.label}</span>
      {trade.offeredPlayerName && <span className="text-slate-400">· offering {trade.offeredPlayerName}</span>}
      {trade.offeredAmount > 0 && <span className="text-emerald-400 font-mono">+{trade.offeredAmount}</span>}
    </div>
  )
}

function TradeRow({ trade, isInbox, onAccept, onReject, onCancel, busy }) {
  const cfg = STATUS_CONFIG[trade.status] || STATUS_CONFIG.pending_admin
  const Icon = cfg.icon
  const [showReject, setShowReject] = useState(false)
  const [reason, setReason]         = useState("")

  const canRespond = isInbox && trade.status === "pending_team"
  const canCancel   = !isInbox && (trade.status === "pending_team" || trade.status === "pending_admin")

  return (
    <div className="px-5 py-4 hover:bg-surface-hover transition-colors">
      <div className="flex items-center gap-4">
        <div className="w-8 h-8 rounded-lg bg-surface-border flex items-center justify-center flex-shrink-0">
          <ArrowLeftRight className="w-4 h-4 text-slate-400" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium text-white">{trade.playerName}</span>
            <GradeBadge grade={trade.playerGrade} />
          </div>
          <p className="text-xs text-slate-500 truncate mb-1">
            {trade.fromTeam} <span className="text-slate-600 mx-1">→</span> {trade.toTeam || "Free agent"}
          </p>
          <TradeDetail trade={trade} />
          {trade.status === "rejected_by_team" && trade.rejectionReason && (
            <p className="text-xs text-rose-400/80 mt-1 italic">"{trade.rejectionReason}"</p>
          )}
        </div>

        <div className="text-right flex-shrink-0">
          <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border", cfg.bg, cfg.color)}>
            <Icon className="w-3 h-3" />
            {cfg.label}
          </span>
          <p className="text-xs text-slate-600 mt-1">
            {trade.requestedOn ? new Date(trade.requestedOn).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : ""}
          </p>
        </div>
      </div>

      {/* Inbox actions */}
      {canRespond && !showReject && (
        <div className="flex gap-2 mt-3 ml-12">
          <button onClick={() => onAccept(trade.id)} disabled={busy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/25 transition-colors disabled:opacity-50">
            <Check className="w-3.5 h-3.5" /> Accept
          </button>
          <button onClick={() => setShowReject(true)} disabled={busy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-400/30 text-rose-400 text-xs font-semibold hover:bg-rose-400/10 transition-colors disabled:opacity-50">
            <X className="w-3.5 h-3.5" /> Reject
          </button>
        </div>
      )}

      {canRespond && showReject && (
        <div className="mt-3 ml-12 flex items-center gap-2">
          <input
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Reason (optional)"
            className="flex-1 bg-pitch-800 border border-surface-border rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-rose-400/40"
          />
          <button onClick={() => { onReject(trade.id, reason); setShowReject(false) }} disabled={busy}
            className="px-3 py-1.5 rounded-lg bg-rose-500 text-white text-xs font-semibold disabled:opacity-50">
            Confirm
          </button>
          <button onClick={() => setShowReject(false)}
            className="px-3 py-1.5 rounded-lg border border-surface-border text-slate-400 text-xs">
            Cancel
          </button>
        </div>
      )}

      {/* Cancel sent request */}
      {canCancel && (
        <div className="mt-3 ml-12">
          <button onClick={() => onCancel(trade.id)} disabled={busy}
            className="text-xs text-slate-500 hover:text-rose-400 transition-colors underline decoration-dotted">
            Withdraw request
          </button>
        </div>
      )}
    </div>
  )
}

export default function Trades({ trades, myPurse = 0 }) {
  const [tab, setTab] = useState("received")
  const teamReview     = useTeamReviewTrade()
  const cancelTrade    = useCancelTrade()

  const sent     = trades.filter(t => t.direction === "sent")
  const received = trades.filter(t => t.direction === "received")
  const history  = trades.filter(t => ["approved", "rejected_by_team", "rejected_by_admin", "cancelled"].includes(t.status))

  const shown = tab === "sent" ? sent : tab === "received" ? received : history

  const pendingReceived = received.filter(t => t.status === "pending_team").length

  const handleAccept = (id) => {
    teamReview.mutate({ id, action: "accepted" }, {
      onError: (err) => alert(err.response?.data?.error || "Failed to accept"),
    })
  }
  const handleReject = (id, reason) => {
    teamReview.mutate({ id, action: "rejected", reason }, {
      onError: (err) => alert(err.response?.data?.error || "Failed to reject"),
    })
  }
  const handleCancel = (id) => {
    cancelTrade.mutate(id, {
      onError: (err) => alert(err.response?.data?.error || "Failed to cancel"),
    })
  }

  return (
    <div>
      {/* Purse display */}
      <div className="flex items-center justify-between bg-pitch-800 border border-surface-border rounded-xl px-4 py-3 mb-5">
        <span className="text-sm text-slate-400">Remaining purse</span>
        <span className="text-lg font-bold font-mono text-emerald-400">{myPurse}</span>
      </div>

      {/* Tab toggle */}
      <div className="flex items-center gap-1 mb-5 bg-pitch-800 border border-surface-border rounded-xl p-1 w-fit">
        {[
          { id: "received", label: "Inbox",   count: received.length, alert: pendingReceived },
          { id: "sent",     label: "Sent",     count: sent.length },
          { id: "history",  label: "History",  count: history.length },
        ].map(({ id, label, count, alert }) => (
          <button key={id} onClick={() => setTab(id)}
            className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              tab === id ? "bg-surface text-white border border-surface-border" : "text-slate-500 hover:text-slate-300"
            )}>
            {label}
            <span className={cn("text-xs px-1.5 py-0.5 rounded-md font-semibold",
              alert ? "bg-amber-400/20 text-amber-400" : "bg-surface-border text-slate-500"
            )}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Trade list */}
      <div className="card overflow-hidden">
        {shown.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-slate-500 text-sm">No {tab} trade requests.</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-border/60">
            {shown.map(t => (
              <TradeRow
                key={t.id}
                trade={t}
                isInbox={tab === "received"}
                onAccept={handleAccept}
                onReject={handleReject}
                onCancel={handleCancel}
                busy={teamReview.isPending || cancelTrade.isPending}
              />
            ))}
          </div>
        )}
      </div>

      {tab === "received" && pendingReceived > 0 && (
        <p className="text-xs text-slate-500 mt-3 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          {pendingReceived} incoming request{pendingReceived > 1 ? "s" : ""} waiting for your response.
        </p>
      )}
    </div>
  )
}