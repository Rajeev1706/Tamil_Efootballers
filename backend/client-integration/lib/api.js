/**
 * lib/api.js
 *
 * Drop this into client/src/lib/api.js
 * Then replace mockData imports with the hooks in lib/queries.js
 */
import axios from "axios"

// ── Axios instance ────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://https://tamil-efootballers.onrender.com/api",
  withCredentials: true,
})

// Attach JWT from localStorage on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token")
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// On 401 → clear token and redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token")
      window.location.href = "/login"
    }
    return Promise.reject(err)
  }
)

export default api

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email, password) =>
    api.post("/auth/login", { email, password }).then(r => r.data),

  me: () =>
    api.get("/auth/me").then(r => r.data),
}

// ── Teams ─────────────────────────────────────────────────────────────────────
export const teamsApi = {
  list: () =>
    api.get("/teams").then(r => r.data),                     // → standings array

  get: (id) =>
    api.get(`/teams/${id}`).then(r => r.data),               // → team + players

  update: (id, body) =>
    api.patch(`/teams/${id}`, body).then(r => r.data),       // admin only
}

// ── Players ───────────────────────────────────────────────────────────────────
export const playersApi = {
  list: (params) =>
    api.get("/players", { params }).then(r => r.data),       // ?teamId= ?grade=

  get: (id) =>
    api.get(`/players/${id}`).then(r => r.data),             // full profile + matchHistory + record

  update: (id, body) =>
    api.patch(`/players/${id}`, body).then(r => r.data),     // admin: { grade?, bdrDelta? }
}

// ── Match records ─────────────────────────────────────────────────────────────
export const recordsApi = {
  list: () =>
    api.get("/records").then(r => r.data),

  create: (body) =>
    api.post("/records", body).then(r => r.data),            // { playerId, opponentId, result, date? }

  delete: (id) =>
    api.delete(`/records/${id}`).then(r => r.data),
}

// ── Fixtures ──────────────────────────────────────────────────────────────────
export const fixturesApi = {
  list: (params) =>
    api.get("/fixtures", { params }).then(r => r.data),      // ?teamId= ?status=

  recent: () =>
    api.get("/fixtures/recent").then(r => r.data),           // last 5 completed

  create: (body) =>
    api.post("/fixtures", body).then(r => r.data),           // admin

  saveResult: (id, homeScore, awayScore) =>
    api.patch(`/fixtures/${id}/result`, { homeScore, awayScore }).then(r => r.data),
}

// ── Trades ────────────────────────────────────────────────────────────────────
export const tradesApi = {
  list: (params) =>
    api.get("/trades", { params }).then(r => r.data),        // ?status=pending

  request: (playerId, toTeamId) =>
    api.post("/trades", { playerId, toTeamId }).then(r => r.data),

  review: (id, action) =>
    api.patch(`/trades/${id}/review`, { action }).then(r => r.data),   // admin

  cancel: (id) =>
    api.patch(`/trades/${id}/cancel`).then(r => r.data),
}
