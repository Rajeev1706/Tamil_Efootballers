import { useState, useEffect, useRef } from "react"
import { tickSound, buzzerSound } from "../lib/legacyReveal"

const DURATION = 20

function computeTimeLeft(session) {
  if (!session?.currentPlayerId || !session?.timerStartedAt) return { timeLeft: DURATION, timerActive: false }
  const startedAt = new Date(session.timerStartedAt).getTime()
  const elapsedSeconds = (Date.now() - startedAt) / 1000
  const timeLeft = Math.max(0, Math.ceil(DURATION - elapsedSeconds))
  return { timeLeft, timerActive: timeLeft > 0 }
}

/**
 * The dramatic countdown — genuinely synced across every screen, not an
 * independent per-screen count. The server stamps `timerStartedAt` the
 * moment a new player comes up or any new bid lands; every screen
 * calculates its remaining time as `20 - (now - timerStartedAt)`, so
 * regardless of when a screen happened to load, it always shows the same
 * true remaining time as everyone else (down to normal clock accuracy).
 * Purely dramatic — it never auto-sells anything, the admin still has to
 * click. Shared identically by the admin panel, the team captain page,
 * and the public live view.
 */
export function useAuctionTimer(session) {
  const [{ timeLeft, timerActive }, setState] = useState(() => computeTimeLeft(session))
  const [shake, setShake] = useState(false)
  const [goingText, setGoingText] = useState("")
  const lastCheckedRef = useRef(null)
  const startedAtKey = session?.timerStartedAt || null

  // Recompute a few times a second from the shared server timestamp —
  // never from a locally-incremented counter, so it can never drift.
  useEffect(() => {
    if (!session?.currentPlayerId || !startedAtKey) {
      setState({ timeLeft: DURATION, timerActive: false })
      return
    }
    const tick = () => setState(computeTimeLeft(session))
    tick()
    const interval = setInterval(tick, 250)
    return () => clearInterval(interval)
  }, [session?.currentPlayerId, startedAtKey])

  // Reset per-round dramatic state whenever a genuinely new countdown
  // starts server-side (new player or new bid).
  useEffect(() => {
    setGoingText("")
    lastCheckedRef.current = null
  }, [startedAtKey])

  // Sound/shake/going-text effects — fire exactly once per threshold, as
  // this screen's own computed value crosses it, never retroactively for
  // thresholds already passed before this screen loaded.
  useEffect(() => {
    if (!timerActive && timeLeft !== 0) return
    const prev = lastCheckedRef.current
    lastCheckedRef.current = timeLeft
    if (prev === null || prev === timeLeft) return

    if (timeLeft <= 5 && timeLeft > 0) {
      tickSound.currentTime = 0
      tickSound.play().catch(() => {})
    }
    if (timeLeft <= 3 && timeLeft > 0) {
      setShake(true)
      setTimeout(() => setShake(false), 500)
    }
    if (timeLeft === 10) {
      setGoingText(`🔔 Going once… ${session.currentBidderTeamName} leads at ₹${session.currentBid}`)
    }
    if (timeLeft === 5) {
      setGoingText(`🔔 Going twice… ${session.currentBidderTeamName} leads at ₹${session.currentBid}`)
    }
    if (timeLeft === 0 && prev > 0) {
      buzzerSound.currentTime = 0
      buzzerSound.play().catch(() => {})
    }
  }, [timeLeft])

  return { timeLeft, timerActive, shake, goingText }
}