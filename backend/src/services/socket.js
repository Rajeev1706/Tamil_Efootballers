// services/socket.js
// Holds the single shared Socket.IO server instance and a helper to push
// the current auction state to every connected client the instant
// something changes — this is what gives the admin panel and the public
// live view genuinely instant sync, instead of everyone polling on a
// timer and waiting up to that interval to see anything new.

let ioInstance = null

export function setSocketServer(io) {
  ioInstance = io
}

export async function broadcastAuctionUpdate(getFullAuctionState, extra = {}) {
  if (!ioInstance) return
  try {
    const state = await getFullAuctionState()
    ioInstance.emit("auction:update", { ...state, ...extra })
  } catch (err) {
    console.error("[socket] Failed to broadcast auction update:", err.message)
  }
}