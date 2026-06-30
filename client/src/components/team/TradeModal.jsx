import { useState } from "react"
import { X, ArrowLeftRight, AlertCircle, Repeat, Coins, Banknote } from "lucide-react"
import GradeBadge from "../common/GradeBadge"
import { cn } from "../../lib/utils"

const TYPES_FOR_OWNED = [
  { value: "player_swap",        label: "Player for Player", icon: Repeat,   desc: "Offer one of your players in exchange" },
  { value: "player_plus_amount", label: "Player + Amount",   icon: Coins,    desc: "Offer a player plus extra purse amount" },
  { value: "full_amount",        label: "Full Amount",       icon: Banknote, desc: "Pay cash only (at least market value)" },
]

export default function TradeModal({ player, myPlayers = [], myPurse = 0, onConfirm, onClose, isLoading }) {
  const isFreeAgent = !player?.team || !player?.teamId
  const [tradeType, setTradeType]   = useState(isFreeAgent ? "signing" : "full_amount")
  const [offeredPlayerId, setOfferedPlayerId] = useState("")
  const [amount, setAmount]         = useState("")

  if (!player) return null

  const minAmount = player.marketValue || 0
  const eligiblePlayers = myPlayers.filter(p => p.id !== player.id)

  const canSubmit = isFreeAgent
    ? true
    : tradeType === "player_swap"
      ? !!offeredPlayerId
      : tradeType === "player_plus_amount"
        ? !!offeredPlayerId && Number(amount) > 0 && Number(amount) <= myPurse
        : Number(amount) >= minAmount && Number(amount) <= myPurse

  function handleSubmit() {
    if (!canSubmit) return
    onConfirm({
      playerId: player.id,
      tradeType: isFreeAgent ? "signing" : tradeType,
      offeredPlayerId: offeredPlayerId ? Number(offeredPlayerId) : undefined,
      offeredAmount: isFreeAgent ? minAmount : (amount ? Number(amount) : undefined),
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(5,8,16,0.85)" }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="card-raised w-full max-w-md border border-surface-border rounded-2xl overflow-hidden max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border sticky top-0 bg-surface-raised z-10">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-accent" />
            <span className="font-semibold text-white text-sm">{isFreeAgent ? "Sign player" : "Trade request"}</span>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-surface flex items-center justify-center text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          {/* Player info */}
          <div className="bg-pitch-800 rounded-xl p-4 flex items-center gap-4 mb-5 border border-surface-border">
            <div className="w-11 h-11 rounded-xl bg-surface-border flex items-center justify-center text-sm font-bold text-slate-400 flex-shrink-0">
              {player.name.split(" ").map(n => n[0]).join("")}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-semibold text-white text-sm">{player.name}</span>
                <GradeBadge grade={player.grade} />
              </div>
              <p className="text-xs text-slate-500">{player.team || "Free agent"}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs text-slate-500 mb-0.5">Market value</p>
              <p className="font-bold font-mono text-accent text-sm">{player.marketValue}</p>
            </div>
          </div>

          {/* Purse display */}
          <div className="flex items-center justify-between bg-pitch-800/60 rounded-lg px-3.5 py-2.5 mb-5 border border-surface-border">
            <span className="text-xs text-slate-500">Your remaining purse</span>
            <span className="text-sm font-bold font-mono text-emerald-400">{myPurse}</span>
          </div>

          {isFreeAgent ? (
            <>
              {/* Free agent — fixed market value signing */}
              <div className="bg-pitch-800 rounded-xl p-4 border border-surface-border mb-5">
                <p className="text-xs text-slate-500 mb-1">Signing fee (market value)</p>
                <p className="text-2xl font-extrabold font-mono text-white">{minAmount}</p>
                {minAmount > myPurse && (
                  <p className="text-xs text-rose-400 mt-1.5">Insufficient purse to sign this player</p>
                )}
              </div>
              <div className="flex gap-2.5 bg-amber-400/8 border border-amber-400/20 rounded-xl p-3.5 mb-5">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-amber-400 mb-0.5">Pending admin approval</p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    This player has no team. Your signing request goes straight to the admin for approval.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Trade type selector */}
              <p className="text-xs text-slate-500 font-medium mb-2">Choose offer type</p>
              <div className="space-y-2 mb-4">
                {TYPES_FOR_OWNED.map(t => {
                  const Icon = t.icon
                  const active = tradeType === t.value
                  return (
                    <button
                      key={t.value}
                      onClick={() => { setTradeType(t.value); setOfferedPlayerId(""); setAmount("") }}
                      className={cn(
                        "w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-colors",
                        active ? "border-accent/40 bg-accent/10" : "border-surface-border hover:border-slate-600"
                      )}
                    >
                      <Icon className={cn("w-4 h-4 mt-0.5 flex-shrink-0", active ? "text-accent" : "text-slate-500")} />
                      <div>
                        <p className={cn("text-sm font-semibold", active ? "text-white" : "text-slate-300")}>{t.label}</p>
                        <p className="text-xs text-slate-500">{t.desc}</p>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Player select for swap/plus_amount */}
              {(tradeType === "player_swap" || tradeType === "player_plus_amount") && (
                <div className="mb-4">
                  <label className="text-xs text-slate-500 font-medium block mb-1.5">Offer one of your players</label>
                  <select
                    value={offeredPlayerId}
                    onChange={e => setOfferedPlayerId(e.target.value)}
                    className="w-full bg-pitch-800 border border-surface-border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent/40"
                  >
                    <option value="">— Select player —</option>
                    {eligiblePlayers.map(p => (
                      <option key={p.id} value={p.id}>{p.name} · MV {p.marketValue}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Amount input for plus_amount/full_amount */}
              {(tradeType === "player_plus_amount" || tradeType === "full_amount") && (
                <div className="mb-4">
                  <label className="text-xs text-slate-500 font-medium block mb-1.5">
                    {tradeType === "full_amount" ? `Offer amount (min ${minAmount})` : "Extra amount to offer"}
                  </label>
                  <input
                    type="number"
                    min={tradeType === "full_amount" ? minAmount : 1}
                    max={myPurse}
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder={tradeType === "full_amount" ? String(minAmount) : "0"}
                    className="w-full bg-pitch-800 border border-surface-border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent/40"
                  />
                  {Number(amount) > myPurse && (
                    <p className="text-xs text-rose-400 mt-1.5">Amount exceeds your remaining purse</p>
                  )}
                  {tradeType === "full_amount" && amount && Number(amount) < minAmount && (
                    <p className="text-xs text-rose-400 mt-1.5">Must be at least the market value ({minAmount})</p>
                  )}
                </div>
              )}

              {/* Notice */}
              <div className="flex gap-2.5 bg-amber-400/8 border border-amber-400/20 rounded-xl p-3.5 mb-5">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-amber-400 mb-0.5">Two-step approval</p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Your offer goes to <span className="text-white font-medium">{player.team}</span> first. If they accept, it's then sent to the admin for final approval.
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-surface-border text-sm font-medium text-slate-400 hover:text-white hover:border-slate-500 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || isLoading}
              className="flex-1 py-2.5 rounded-xl bg-accent hover:bg-accent-dim text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ArrowLeftRight className="w-4 h-4" />
              {isLoading ? "Sending…" : isFreeAgent ? "Send signing request" : "Send offer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}