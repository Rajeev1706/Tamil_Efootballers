import axios from "axios"

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "https://tamil-efootballers.onrender.com/api",
  timeout: 15000, // 15s — prevents requests hanging forever on Render cold starts
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
  topScorers:   ()   => api.get("/teams/top-scorers").then(r => r.data),
  hallOfFame:      ()        => api.get("/teams/hall-of-fame").then(r => r.data),
  seasonReset:     ()        => api.post("/teams/season-reset").then(r => r.data),
  seasonRecords:   ()        => api.get("/teams/season-records").then(r => r.data),
  createSeasonRecord: (body) => api.post("/teams/season-records", body).then(r => r.data),
  updateSeasonRecord: (id, body) => api.patch(`/teams/season-records/${id}`, body).then(r => r.data),
  deleteSeasonRecord: (id)   => api.delete(`/teams/season-records/${id}`).then(r => r.data),
}

export const playersApi = {
  list:     (params) => api.get("/players", { params }).then(r => r.data),
  get:      (id)     => api.get(`/players/${id}`).then(r => r.data),
  create:   (body)   => api.post("/players", body).then(r => r.data),
  update:   (id, b)  => api.patch(`/players/${id}`, b).then(r => r.data),
  delete:   (id)     => api.delete(`/players/${id}`).then(r => r.data),
  unassign: (id)     => api.patch(`/players/${id}`, { teamId: null, teamIdProvided: true }).then(r => r.data),
}

export const leagueInfoApi = {
  list:   ()        => api.get("/league-info").then(r => r.data),
  create: (body)    => api.post("/league-info", body).then(r => r.data),
  update: (id, body)=> api.patch(`/league-info/${id}`, body).then(r => r.data),
  delete: (id)      => api.delete(`/league-info/${id}`).then(r => r.data),
}

export const weeklyApi = {
  list:         ()            => api.get("/weekly").then(r => r.data),
  get:          (id)          => api.get(`/weekly/${id}`).then(r => r.data),
  create:       (name)        => api.post("/weekly", { name }).then(r => r.data),
  setPlayers:   (id, playerIds) => api.post(`/weekly/${id}/players`, { playerIds }).then(r => r.data),
  start:        (id)          => api.post(`/weekly/${id}/start`).then(r => r.data),
  saveResult:   (matchId, player1Score, player2Score, tieWinnerId) =>
    api.patch(`/weekly/matches/${matchId}/result`, { player1Score, player2Score, tieWinnerId }).then(r => r.data),
  reset:        (id)          => api.post(`/weekly/${id}/reset`).then(r => r.data),
  deleteTournament: (id)      => api.delete(`/weekly/${id}`).then(r => r.data),
}

export const uclApi = {
  groups:        ()              => api.get("/ucl/groups").then(r => r.data),
  unassigned:    ()              => api.get("/ucl/unassigned").then(r => r.data),
  standings:     ()              => api.get("/ucl/standings").then(r => r.data),
  topScorers:    ()              => api.get("/ucl/top-scorers").then(r => r.data),
  createGroup:   (name)          => api.post("/ucl/groups", { name }).then(r => r.data),
  renameGroup:   (id, name)      => api.patch(`/ucl/groups/${id}`, { name }).then(r => r.data),
  deleteGroup:   (id)            => api.delete(`/ucl/groups/${id}`).then(r => r.data),
  assignPlayer:  (groupId, playerId) => api.post(`/ucl/groups/${groupId}/players`, { playerId }).then(r => r.data),
  unassignPlayer:(playerId)      => api.delete(`/ucl/players/${playerId}/group`).then(r => r.data),
}

export const settingsApi = {
  get:    ()           => api.get("/settings").then(r => r.data),
  update: (key, value) => api.patch("/settings", { key, value }).then(r => r.data),
}

export const recordsApi = {
  list:          ()         => api.get("/records").then(r => r.data),
  bySeason:      (season)   => api.get(`/records/season/${season}`).then(r => r.data),
  create:        (body)     => api.post("/records", body).then(r => r.data),
  update:        (id, body) => api.patch(`/records/${id}`, body).then(r => r.data),
  delete:        (id)       => api.delete(`/records/${id}`).then(r => r.data),
  createTeam:    (body)     => api.post("/records/team", body).then(r => r.data),
  byFixture:     (id)       => api.get(`/records/fixture/${id}`).then(r => r.data),
}

export const fixturesApi = {
  list:       (params)                  => api.get("/fixtures", { params }).then(r => r.data),
  recent:     ()                        => api.get("/fixtures/recent").then(r => r.data),
  create:     (body)                    => api.post("/fixtures", body).then(r => r.data),
  saveResult: (id, homeScore, awayScore, homeGoals, awayGoals) =>
    api.patch(`/fixtures/${id}/result`, { homeScore, awayScore, homeGoals, awayGoals }).then(r => r.data),
}

export const tradesApi = {
  list:       (params)                  => api.get("/trades", { params }).then(r => r.data),
  request:    (body)                     => api.post("/trades", body).then(r => r.data),
  teamReview: (id, action, reason)       => api.patch(`/trades/${id}/team-review`, { action, reason }).then(r => r.data),
  review:     (id, action)               => api.patch(`/trades/${id}/review`, { action }).then(r => r.data),
  cancel:     (id)                       => api.patch(`/trades/${id}/cancel`).then(r => r.data),
}

export const lineupsApi = {
  get:    (fixtureId)           => api.get(`/lineups/${fixtureId}`).then(r => r.data),
  save:   (fixtureId, matchups) => api.put(`/lineups/${fixtureId}`, { matchups }).then(r => r.data),
  delete: (fixtureId)           => api.delete(`/lineups/${fixtureId}`).then(r => r.data),
  h2h:    (p1Id, p2Id)          => api.get(`/lineups/h2h/${p1Id}/${p2Id}`).then(r => r.data),
}

export const favoritesApi = {
  list:   ()         => api.get("/favorites").then(r => r.data),
  add:    (playerId) => api.post(`/favorites/${playerId}`).then(r => r.data),
  remove: (playerId) => api.delete(`/favorites/${playerId}`).then(r => r.data),
}