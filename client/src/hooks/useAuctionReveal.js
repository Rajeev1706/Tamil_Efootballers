import { useEffect, useRef } from "react"
import { revealForAuction, showSoldFullScreen, showPreRevealBanner, tickSound, buzzerSound } from "../lib/legacyReveal"
import { detectBidPattern, getPoolMilestone } from "../lib/auctionNarrative"

/**
 * Watches auction data for a new player coming up (triggers the cinematic
 * reveal), a new sale landing (triggers the SOLD full-screen summary),
 * pool-size milestones (Final 5 / Last Player Standing banners), and live
 * bid-pattern changes (bidding wars/fightbacks/intruders). Used identically
 * by both the admin screen and the public live view, so everyone sees the
 * exact same thing at the exact same moment — anything involving
 * randomness (thunder) is decided server-side, this hook only ever plays
 * back what the server already decided.
 */
export function useAuctionReveal(data, { onRevealDone, onSoldDone, onBidPattern, showMilestoneBanners = true } = {}) {
  const prevPlayerIdRef = useRef(undefined)
  const prevTopSaleIdRef = useRef(undefined)
  const prevSalesCountRef = useRef(undefined)
  const salesInitializedRef = useRef(false)
  const shownMilestonesRef = useRef(new Set())
  const lastBidPatternKeyRef = useRef(null)

  useEffect(() => {
    if (!data?.session) return
    const { session, teams = [] } = data
    const teamLogoById = Object.fromEntries(teams.map(t => [t.id, t.logoUrl]))

    if (
      prevPlayerIdRef.current !== undefined
      && session.currentPlayerId
      && session.currentPlayerId !== prevPlayerIdRef.current
      && !data.skipReveal
    ) {
      tickSound.currentTime = 0
      tickSound.play().catch(() => {})
      const thunderCombo = session.isThunder ? { from: session.thunderFrom, to: session.thunderTo } : null
      revealForAuction(
        session.currentPlayerName,
        session.isThunder,
        thunderCombo,
        session.currentPlayerCardType,
        session.currentPlayerPrevTeamId ? teamLogoById[session.currentPlayerPrevTeamId] : null,
        () => onRevealDone?.()
      )
      lastBidPatternKeyRef.current = null // fresh player, fresh bid history
    }
    prevPlayerIdRef.current = session.currentPlayerId
  }, [data?.session?.currentPlayerId])

  useEffect(() => {
    // Wait for actual data before doing anything — but unlike before,
    // don't require sales to be non-empty just to record the baseline.
    // Otherwise a fresh session (0 sales at first load) never properly
    // initializes, and the very first sale of the whole auction gets
    // silently skipped instead of triggering the SOLD screen.
    if (!data?.sales) return
    const { sales, pool = [], teams = [] } = data
    const topSale = sales[0]

    if (!salesInitializedRef.current) {
      prevTopSaleIdRef.current = topSale?.id ?? null
      prevSalesCountRef.current = sales.length
      salesInitializedRef.current = true
      return
    }

    const isGenuinelyNewSale = topSale
      && topSale.id !== prevTopSaleIdRef.current
      && sales.length > (prevSalesCountRef.current ?? 0)

    if (isGenuinelyNewSale) {
      const teamLogoById = Object.fromEntries(teams.map(t => [t.id, t.logoUrl]))
      buzzerSound.currentTime = 0
      buzzerSound.play().catch(() => {})
      const poolEntry = pool.find(p => p.playerId === topSale.playerId)
      showSoldFullScreen({
        player: topSale.playerName,
        prevLogoUrl: poolEntry?.prevTeamId ? teamLogoById[poolEntry.prevTeamId] : null,
        newLogoUrl: teamLogoById[topSale.teamId],
        amount: topSale.price,
        afterDone: () => onSoldDone?.(),
      })
    }
    prevTopSaleIdRef.current = topSale?.id ?? null
    prevSalesCountRef.current = sales.length
  }, [data?.sales?.[0]?.id, data?.sales?.length])

  // Pool-size milestones — Final 5 / Last Player Standing. Each milestone
  // only ever fires once per session (tracked by type, not by count, so
  // it can't re-fire if the pool count briefly changes and comes back).
  useEffect(() => {
    if (!data?.pool || !showMilestoneBanners) return
    const milestone = getPoolMilestone(data.pool)
    if (milestone && !shownMilestonesRef.current.has(milestone.type)) {
      shownMilestonesRef.current.add(milestone.type)
      const gradient = milestone.type === "lastPlayer"
        ? "linear-gradient(135deg,#1a0030,#6a0dad,#b44fff)"
        : "linear-gradient(135deg,#c0392b,#e74c3c,#ff6b6b)"
      showPreRevealBanner(milestone.title, milestone.subtitle, gradient)
    }
  }, [data?.pool])

  // Live bid-pattern detection — war/fightback/intruder, from the current
  // player's real bid-by-bid history (recentBids), which is shared and
  // persisted server-side so every screen detects the identical pattern.
  useEffect(() => {
    if (!data?.recentBids || !onBidPattern) return
    const pattern = detectBidPattern(data.recentBids)
    if (pattern) {
      const key = `${data.session?.currentPlayerId}-${pattern.type}-${data.recentBids.length}`
      if (key !== lastBidPatternKeyRef.current) {
        lastBidPatternKeyRef.current = key
        onBidPattern(pattern.html)
      }
    }
  }, [data?.recentBids])
}