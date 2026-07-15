import { useEffect, useRef } from "react"
import { io } from "socket.io-client"
import { useQueryClient } from "@tanstack/react-query"

// Strips the trailing /api from the REST API base URL, since Socket.IO
// attaches directly to the HTTP server root, not under the Express /api
// router.
const SOCKET_URL = (import.meta.env.VITE_API_URL || "https://tamil-efootballers.onrender.com/api")
  .replace(/\/api\/?$/, "")

let sharedSocket = null
let lastSeenVersion = -1
let lastSeenTopSaleId = undefined

function getSocket() {
  if (!sharedSocket) {
    sharedSocket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      withCredentials: true,
    })
  }
  return sharedSocket
}

/**
 * Connects to the auction WebSocket and writes every incoming update
 * directly into React Query's cache — this is what makes the admin panel
 * and the public live view update the instant something happens, instead
 * of waiting on a polling interval. GET /current (via useAuctionCurrent's
 * normal query) still runs once on mount as the initial load, and keeps a
 * long-interval fallback poll in case the socket connection ever silently
 * drops.
 *
 * Also guards against a real out-of-order problem: under rapid actions
 * (e.g. clicking bid buttons fast), WebSocket messages can arrive at a
 * browser in a different order than they actually happened server-side.
 * Blindly displaying whatever arrives last made the bid amount visibly
 * jump backwards sometimes. Each session update carries a strictly
 * incrementing `version` — anything older than what's already been seen
 * gets silently dropped instead of overwriting newer data.
 *
 * When a player is actually sold, the winning team's roster (usePlayers,
 * used by the team dashboard's squad list) has no way of knowing that
 * happened on its own — it only fetches once on load, with no polling.
 * So whenever a genuinely NEW sale is detected (not on every broadcast,
 * which fires on every bid too — only when the sale actually changes),
 * this also invalidates the players list, so a captain's squad updates
 * automatically the moment they win someone, without needing a manual
 * page refresh.
 */
export function useAuctionSocket() {
  const qc = useQueryClient()
  const socketRef = useRef(null)

  useEffect(() => {
    const socket = getSocket()
    socketRef.current = socket

    const handleUpdate = (data) => {
      const incomingVersion = data?.session?.version
      if (incomingVersion != null) {
        if (incomingVersion < lastSeenVersion) return // stale, out-of-order — drop it
        lastSeenVersion = incomingVersion
      }
      qc.setQueryData(["auction-current"], data)

      const topSaleId = data?.sales?.[0]?.id ?? null
      if (lastSeenTopSaleId !== undefined && topSaleId !== lastSeenTopSaleId) {
        // Prefix match on ["players"] catches both the team roster list
        // (["players", params]) AND any individual player profile page
        // (["players", id]) in one go — no need to invalidate them
        // separately.
        qc.invalidateQueries({ queryKey: ["players"] })
      }
      lastSeenTopSaleId = topSaleId
    }

    socket.on("auction:update", handleUpdate)
    return () => { socket.off("auction:update", handleUpdate) }
  }, [qc])
}