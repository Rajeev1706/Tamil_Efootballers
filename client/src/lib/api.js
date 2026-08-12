import axios from "axios"

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "https://tamil-efootballers.onrender.com/api",
  timeout: 60000, // 60s — Render free tier cold starts take 30-90s; 15s was cutting them off
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
      const hadToken = !!localStorage.getItem("token")
      localStorage.removeItem("token")
      // Only redirect to login if the user was actually logged in before —
      // public visitors hitting a protected endpoint should NOT be kicked
      // to login, they just shouldn't see that data.
      if (hadToken) window.location.href = "/login"
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
  playoffsCurrent: ()      => api.get("/teams/playoffs/current").then(r => r.data),
  create:         (body)   => api.post("/teams", body).then(r => r.data),
  update:         (id, b)  => api.patch(`/teams/${id}`, b).then(r => r.data),
  updateSettings: (id, b)  => api.patch(`/teams/${id}/settings`, b).then(r => r.data),
  changePassword: (id, newPassword) =>
    api.patch(`/teams/${id}/password`, { newPassword }).then(r => r.data),
  delete:         (id)     => api.delete(`/teams/${id}`).then(r => r.data),
  topScorers:   ()   => api.get("/teams/top-scorers").then(r => r.data),
  bestLeaguePerformer: (id) => api.get(`/teams/${id}/best-league-performer`).then(r => r.data),
  hallOfFame:      ()        => api.get("/teams/hall-of-fame").then(r => r.data),
  seasonReset:     ()        => api.post("/teams/season-reset").then(r => r.data),
  recalcGrades:    ()        => api.post("/teams/recalc-grades").then(r => r.data),
  incrementYear:   ()        => api.post("/teams/increment-year").then(r => r.data),
  trophyHistory:    ()       => api.get("/teams/trophy-history").then(r => r.data),
  trophyHistoryYear: (year)  => api.get(`/teams/trophy-history/${year}`).then(r => r.data),
  trophyCurrent:    ()       => api.get("/teams/trophy-current").then(r => r.data),
  trophyYears:      ()       => api.get("/teams/trophy-years").then(r => r.data),
  updateTrophyYear:  (data)  => api.post("/teams/update-trophy-year", data).then(r => r.data),
  seasonDelete:    ()        => api.post("/teams/season-delete").then(r => r.data),
  seasonRecords:   ()        => api.get("/teams/season-records").then(r => r.data),
  createSeasonRecord: (body) => api.post("/teams/season-records", body).then(r => r.data),
  updateSeasonRecord: (id, body) => api.patch(`/teams/season-records/${id}`, body).then(r => r.data),
  deleteSeasonRecord: (id)   => api.delete(`/teams/season-records/${id}`).then(r => r.data),
}

export const playersApi = {
  list:            (params) => api.get("/players", { params }).then(r => r.data),
  get:             (id)     => api.get(`/players/${id}`).then(r => r.data),
  create:          (body)   => api.post("/players", body).then(r => r.data),
  update:          (id, b)  => api.patch(`/players/${id}`, b).then(r => r.data),
  delete:          (id)     => api.delete(`/players/${id}`).then(r => r.data),
  unassign:        (id)     => api.patch(`/players/${id}`, { teamId: null, teamIdProvided: true }).then(r => r.data),
  setAvatar:       (id, body) => api.patch(`/players/${id}/avatar`, body).then(r => r.data),
  compareStats:    (id)          => api.get(`/players/${id}/compare-stats`).then(r => r.data),
  performanceZones:(id, season)  => api.get(`/players/${id}/performance-zones`, { params: { season } }).then(r => r.data),
  percentiles:     (id)          => api.get(`/players/${id}/percentiles`).then(r => r.data),
  seasonSummary:   (id)          => api.get(`/players/${id}/season-summary`).then(r => r.data),
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
  current:      ()            => api.get("/weekly/public/current").then(r => r.data),
  topScorers:   ()            => api.get("/weekly/public/top-scorers").then(r => r.data),
  create:       (name)        => api.post("/weekly", { name }).then(r => r.data),
  setPlayers:   (id, playerIds) => api.post(`/weekly/${id}/players`, { playerIds }).then(r => r.data),
  start:        (id)          => api.post(`/weekly/${id}/start`).then(r => r.data),
  saveResult:    (matchId, player1Score, player2Score, tieWinnerId, isWalkover = false) =>
    api.patch(`/weekly/matches/${matchId}/result`, { player1Score, player2Score, tieWinnerId, isWalkover }).then(r => r.data),
  updateMatchPlayers: (matchId, body) =>
    api.patch(`/weekly/matches/${matchId}/players`, body).then(r => r.data),
  reset:        (id)          => api.post(`/weekly/${id}/reset`).then(r => r.data),
  deleteTournament: (id)      => api.delete(`/weekly/${id}`).then(r => r.data),
}

export const revolutionApi = {
  list:         ()            => api.get("/revolution").then(r => r.data),
  get:          (id)          => api.get(`/revolution/${id}`).then(r => r.data),
  current:      ()            => api.get("/revolution/public/current").then(r => r.data),
  topScorers:   ()            => api.get("/revolution/public/top-scorers").then(r => r.data),
  create:       (name)        => api.post("/revolution", { name }).then(r => r.data),
  setPlayers:   (id, playerIds) => api.post(`/revolution/${id}/players`, { playerIds }).then(r => r.data),
  start:        (id)          => api.post(`/revolution/${id}/start`).then(r => r.data),
  saveResult:    (matchId, player1Score, player2Score, tieWinnerId, isWalkover = false) =>
    api.patch(`/revolution/matches/${matchId}/result`, { player1Score, player2Score, tieWinnerId, isWalkover }).then(r => r.data),
  updateMatchPlayers: (matchId, body) =>
    api.patch(`/revolution/matches/${matchId}/players`, body).then(r => r.data),
  reset:        (id)          => api.post(`/revolution/${id}/reset`).then(r => r.data),
  deleteTournament: (id)      => api.delete(`/revolution/${id}`).then(r => r.data),
}

export const scoutingApi = {
  getReport: (myTeamId, oppTeamId) => api.get(`/scouting/${myTeamId}/${oppTeamId}`).then(r => r.data),
}

export const uclApi = {
  groups:            ()              => api.get("/ucl/groups").then(r => r.data),
  adminGroups:       ()              => api.get("/ucl/admin-groups").then(r => r.data),
  unassigned:        ()              => api.get("/ucl/unassigned").then(r => r.data),
  standings:         ()              => api.get("/ucl/standings").then(r => r.data),
  topScorers:        ()              => api.get("/ucl/top-scorers").then(r => r.data),
  generate:          (playerIds)     => api.post("/ucl/generate", { playerIds }).then(r => r.data),
  activate:          ()              => api.post("/ucl/activate").then(r => r.data),
  fixtures:          ()              => api.get("/ucl/fixtures").then(r => r.data),
  fixturesPublic:    (groupId)       => api.get(`/ucl/fixtures/public/${groupId}`).then(r => r.data),
  saveFixture:       (id, s1, s2, isWalkover = false) => api.patch(`/ucl/fixtures/${id}`, { player1Score: s1, player2Score: s2, isWalkover }).then(r => r.data),
  clearFixture:      (id)           => api.delete(`/ucl/fixtures/${id}/result`).then(r => r.data),
  resetGroupFixtures:       (id) => api.post(`/ucl/groups/${id}/reset-fixtures`).then(r => r.data),
  regenerateGroupFixtures:  (id) => api.post(`/ucl/groups/${id}/regenerate-fixtures`).then(r => r.data),
  createGroup:       (name)          => api.post("/ucl/groups", { name }).then(r => r.data),
  renameGroup:       (id, name)      => api.patch(`/ucl/groups/${id}`, { name }).then(r => r.data),
  deleteGroup:       (id)            => api.delete(`/ucl/groups/${id}`).then(r => r.data),
  assignPlayer:      (groupId, playerId) => api.post(`/ucl/groups/${groupId}/players`, { playerId }).then(r => r.data),
  unassignPlayer:    (playerId)                    => api.delete(`/ucl/players/${playerId}/group`).then(r => r.data),
  replacePlayer:     (playerId, replacementId)      => api.post(`/ucl/players/${playerId}/replace`, { replacementId }).then(r => r.data),
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
  updateTeam:    (id, body) => api.patch(`/records/team/${id}`, body).then(r => r.data),
  deleteTeam:    (id)       => api.delete(`/records/team/${id}`).then(r => r.data),
  byFixture:     (id)       => api.get(`/records/fixture/${id}`).then(r => r.data),
}

export const fixturesApi = {
  list:       (params)                  => api.get("/fixtures", { params }).then(r => r.data),
  recent:     ()                        => api.get("/fixtures/recent").then(r => r.data),
  create:     (body)                    => api.post("/fixtures", body).then(r => r.data),
  generateSeason: (body)                => api.post("/fixtures/generate", body).then(r => r.data),
  changeFormat:   (format)              => api.patch("/fixtures/format", { format }).then(r => r.data),
  getFormat:      ()                    => api.get("/fixtures/format").then(r => r.data),
  getFormatPublic:()                    => api.get("/fixtures/format/public").then(r => r.data),
  update:     (id, body)                => api.patch(`/fixtures/${id}`, body).then(r => r.data),
  updateRoundDate: (round, date)        => api.patch(`/fixtures/round/${round}/date`, { date }).then(r => r.data),
  delete:     (id)                      => api.delete(`/fixtures/${id}`).then(r => r.data),
  saveResult: (id, homeScore, awayScore, homeGoals, awayGoals) =>
    api.patch(`/fixtures/${id}/result`, { homeScore, awayScore, homeGoals, awayGoals }).then(r => r.data),
  close:      (id)                      => api.post(`/fixtures/${id}/close`).then(r => r.data),
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
export const uclKnockoutApi = {
  list:         ()             => api.get("/ucl-knockout").then(r => r.data),
  get:          (id)           => api.get(`/ucl-knockout/${id}`).then(r => r.data),
  current:      ()             => api.get("/ucl-knockout/public/current").then(r => r.data),
  create:       (name)         => api.post("/ucl-knockout", { name }).then(r => r.data),
  start:        (id)           => api.post(`/ucl-knockout/${id}/start`).then(r => r.data),
  saveResult:   (matchId, player1Score, player2Score, tieWinnerId, isWalkover = false) =>
    api.patch(`/ucl-knockout/matches/${matchId}/result`, { player1Score, player2Score, tieWinnerId, isWalkover }).then(r => r.data),
  updateMatchPlayers: (matchId, body) =>
    api.patch(`/ucl-knockout/matches/${matchId}/players`, body).then(r => r.data),
  reset:        (id)           => api.post(`/ucl-knockout/${id}/reset`).then(r => r.data),
  deleteTournament: (id)       => api.delete(`/ucl-knockout/${id}`).then(r => r.data),
}

export const winrateApi = {
  list:    (type, season) => api.get("/winrate", { params: { type, season } }).then(r => r.data),
  seasons: ()             => api.get("/winrate/seasons").then(r => r.data),
}

export const auctionIntelApi = {
  gradeMatrix:    (playerId)           => api.get(`/auction-intel/grade-matrix/${playerId}`).then(r => r.data),
  nemesis:        (playerId)           => api.get(`/auction-intel/nemesis/${playerId}`).then(r => r.data),
  h2hVsSquad:     (playerId, myTeamId) => api.get(`/auction-intel/h2h-vs-squad/${playerId}`, { params: { myTeamId } }).then(r => r.data),
  auctionHistory: ()                   => api.get("/auction-intel/auction-history").then(r => r.data),
  mvTrajectory:   (playerId)           => api.get(`/auction-intel/mv-trajectory/${playerId}`).then(r => r.data),
  snapshotMV:     ()                   => api.post("/auction-intel/snapshot-mv").then(r => r.data),
}

export const auctionTargetsApi = {
  list:           (teamId)     => api.get("/auction-targets", { params: { teamId } }).then(r => r.data),
  add:            (body)       => api.post("/auction-targets", body).then(r => r.data),
  update:         (id, body)   => api.patch(`/auction-targets/${id}`, body).then(r => r.data),
  remove:         (id)         => api.delete(`/auction-targets/${id}`).then(r => r.data),
  reorder:        (orderedIds) => api.patch("/auction-targets/reorder", { orderedIds }).then(r => r.data),
  playerInterest: (playerId)   => api.get(`/auction-targets/player/${playerId}/interest`).then(r => r.data),
}

export const auctionApi = {
  current:      ()                              => api.get("/auction/current").then(r => r.data),
  start:        (budgetPerTeam)                 => api.post("/auction/start", { budgetPerTeam }).then(r => r.data),
  retain:       (sessionId, teamId, playerId, price) =>
    api.post("/auction/retain", { sessionId, teamId, playerId, price }).then(r => r.data),
  removeRetention: (id)                         => api.delete(`/auction/retain/${id}`).then(r => r.data),
  addToPool:    (sessionId, playerId)           => api.post("/auction/pool/add", { sessionId, playerId }).then(r => r.data),
  removeFromPool: (id)                          => api.delete(`/auction/pool/${id}`).then(r => r.data),
  buildPool:    (sessionId)                     => api.post("/auction/build-pool", { sessionId }).then(r => r.data),
  nextPlayer:   (sessionId, playerId)           => api.post("/auction/next-player", { sessionId, playerId }).then(r => r.data),
  bid:          (sessionId, teamId, amount)     => api.post("/auction/bid", { sessionId, teamId, amount }).then(r => r.data),
  quickBid:     (sessionId, teamId)              => api.post("/auction/bid/quick", { sessionId, teamId }).then(r => r.data),
  sell:         (sessionId, opts)               => api.post("/auction/sell", { sessionId, ...opts }).then(r => r.data),
  markUnsold:   (sessionId)                     => api.post("/auction/mark-unsold", { sessionId }).then(r => r.data),
  advanceRound: (sessionId)                     => api.post("/auction/advance-round", { sessionId }).then(r => r.data),
  complete:     (sessionId)                     => api.post("/auction/complete", { sessionId }).then(r => r.data),
  setBidder:    (sessionId, teamId)              => api.post("/auction/set-bidder", { sessionId, teamId }).then(r => r.data),
  reduceBid:    (sessionId)                      => api.post("/auction/reduce-bid", { sessionId }).then(r => r.data),
  extraTime:    (sessionId)                      => api.post("/auction/extra-time", { sessionId }).then(r => r.data),
  undoLastSale: (sessionId)                      => api.post("/auction/undo-last-sale", { sessionId }).then(r => r.data),
  deleteSession: (sessionId)                     => api.delete(`/auction/${sessionId}`).then(r => r.data),
  enter:        (sessionId)                      => api.post("/auction/enter", { sessionId }).then(r => r.data),
  leave:        (sessionId)                      => api.post("/auction/leave", { sessionId }).then(r => r.data),
  priceHistory: (playerId)                       => api.get(`/auction/price-history/${playerId}`).then(r => r.data),
}
export const calendarApi = {
  list:     (month) => api.get(`/calendar?month=${month}`).then(r => r.data),
  upcoming: ()      => api.get("/calendar/upcoming").then(r => r.data),
}

export const specialEditionsApi = {
  list:   ()           => api.get("/special-editions").then(r => r.data),
  create: (body)       => api.post("/special-editions", body).then(r => r.data),
  update: (id, body)   => api.patch(`/special-editions/${id}`, body).then(r => r.data),
  delete: (id)         => api.delete(`/special-editions/${id}`).then(r => r.data),
}

// ── Cloudinary image upload ───────────────────────────────────────────────────
// Converts a File object to base64 then sends to our backend which uploads to
// Cloudinary. Returns the secure CDN URL. Images are served from Cloudinary
// directly — zero Render bandwidth cost for images.
export async function uploadImage(file, folder = "general") {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const res = await api.post("/upload", {
          data:   e.target.result, // base64 data URL
          folder,
        })
        resolve(res.data.url)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsDataURL(file)
  })
}

export const tlgApi = {
  list:            ()              => api.get("/tlg").then(r => r.data),
  current:         ()              => api.get("/tlg/current").then(r => r.data),
  get:             (id)            => api.get(`/tlg/${id}`).then(r => r.data),
  create:          (name)          => api.post("/tlg", { name }).then(r => r.data),
  assignTeams:     (id, teamIds)   => api.post(`/tlg/${id}/teams`, { teamIds }).then(r => r.data),
  start:           (id)            => api.post(`/tlg/${id}/start`).then(r => r.data),
  generateKnockout:(id)            => api.post(`/tlg/${id}/knockout`).then(r => r.data),
  saveFixture:     (fId, h, a)     => api.patch(`/tlg/fixture/${fId}`, { homeScore: h, awayScore: a }).then(r => r.data),
  clearFixture:    (fId)           => api.delete(`/tlg/fixture/${fId}/result`).then(r => r.data),
  saveKnockout:    (mId, h, a, tw) => api.patch(`/tlg/knockout/${mId}`, { homeScore: h, awayScore: a, tieWinnerId: tw }).then(r => r.data),
  delete:          (id)            => api.delete(`/tlg/${id}`).then(r => r.data),
}

export const tlgApi = {
  list:             ()                      => api.get("/tlg/list").then(r => r.data),
  current:          ()                      => api.get("/tlg/current").then(r => r.data),
  get:              (id)                    => api.get(`/tlg/${id}`).then(r => r.data),
  create:           ()                      => api.post("/tlg").then(r => r.data),
  draw:             (id, teamIds)           => api.post(`/tlg/${id}/draw`, { teamIds }).then(r => r.data),
  saveFixture:      (id, homeScore, awayScore, isWalkover) =>
    api.patch(`/tlg/fixtures/${id}`, { homeScore, awayScore, isWalkover }).then(r => r.data),
  clearFixture:     (id)                   => api.delete(`/tlg/fixtures/${id}/result`).then(r => r.data),
  generateKnockout: (id)                   => api.post(`/tlg/${id}/generate-knockout`).then(r => r.data),
  saveKnockout:     (phase, seasonId, homeScore, awayScore, isWalkover) =>
    api.patch(`/tlg/knockout/${phase}`, { seasonId, homeScore, awayScore, isWalkover }).then(r => r.data),
  delete:           (id)                   => api.delete(`/tlg/${id}`).then(r => r.data),
}