import axios from "axios"

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "https://tamil-efootballers.onrender.com/api",
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token")
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

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

export const authApi = {
  login: (email, password) =>
    api.post("/auth/login", { email, password }).then(r => r.data),
  me: () =>
    api.get("/auth/me").then(r => r.data),
  changePassword: (currentPassword, newPassword) =>
    api.post("/auth/change-password", { currentPassword, newPassword }).then(r => r.data),
}

export const teamsApi = {
  list:           ()       => api.get("/teams").then(r => r.data),
  get:            (id)     => api.get(`/teams/${id}`).then(r => r.data),
  create:         (body)   => api.post("/teams", body).then(r => r.data),
  update:         (id, b)  => api.patch(`/teams/${id}`, b).then(r => r.data),
  updateSettings: (id, b)  => api.patch(`/teams/${id}/settings`, b).then(r => r.data),
  changePassword: (id, newPassword) =>
    api.patch(`/teams/${id}/password`, { newPassword }).then(r => r.data),
  delete:         (id)     => api.delete(`/teams/${id}`).then(r => r.data),
}

export const playersApi = {
  list:   (params) => api.get("/players", { params }).then(r => r.data),
  get:    (id)     => api.get(`/players/${id}`).then(r => r.data),
  create: (body)   => api.post("/players", body).then(r => r.data),
  update: (id, b)  => api.patch(`/players/${id}`, b).then(r => r.data),
  delete: (id)     => api.delete(`/players/${id}`).then(r => r.data),
}

export const recordsApi = {
  list:   ()     => api.get("/records").then(r => r.data),
  create: (body) => api.post("/records", body).then(r => r.data),
  delete: (id)   => api.delete(`/records/${id}`).then(r => r.data),
}

export const fixturesApi = {
  list:       (params)                   => api.get("/fixtures", { params }).then(r => r.data),
  recent:     ()                         => api.get("/fixtures/recent").then(r => r.data),
  create:     (body)                     => api.post("/fixtures", body).then(r => r.data),
  update:     (id, body)                 => api.patch(`/fixtures/${id}`, body).then(r => r.data),
  delete:     (id)                       => api.delete(`/fixtures/${id}`).then(r => r.data),
  saveResult: (id, homeScore, awayScore) =>
    api.patch(`/fixtures/${id}/result`, { homeScore, awayScore }).then(r => r.data),
}

export const tradesApi = {
  list:    (params)              => api.get("/trades", { params }).then(r => r.data),
  request: (playerId, toTeamId)  =>
    api.post("/trades", { playerId, toTeamId }).then(r => r.data),
  review:  (id, action)          => api.patch(`/trades/${id}/review`, { action }).then(r => r.data),
  cancel:  (id)                  => api.patch(`/trades/${id}/cancel`).then(r => r.data),
}

export const lineupsApi = {
  get:    (fixtureId)            => api.get(`/lineups/${fixtureId}`).then(r => r.data),
  save:   (fixtureId, matchups)  => api.put(`/lineups/${fixtureId}`, { matchups }).then(r => r.data),
  delete: (fixtureId)            => api.delete(`/lineups/${fixtureId}`).then(r => r.data),
  h2h:    (p1Id, p2Id)           => api.get(`/lineups/h2h/${p1Id}/${p2Id}`).then(r => r.data),
}