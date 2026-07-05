import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { teamsApi, playersApi, recordsApi, fixturesApi, tradesApi, lineupsApi, favoritesApi, settingsApi, leagueInfoApi, uclApi, weeklyApi, uclKnockoutApi } from "./api"

export const QK = {
  teams:    ["teams"],
  team:     (id)     => ["teams", id],
  players:  (params) => ["players", params ?? {}],
  player:   (id)     => ["players", id],
  records:  ["records"],
  fixtures: (params) => ["fixtures", params ?? {}],
  recent:   ["fixtures", "recent"],
  trades:   (params) => ["trades", params ?? {}],
}

export const useSettings = () =>
  useQuery({ queryKey: ["settings"], queryFn: settingsApi.get, staleTime: 60000 })

export const useUclGroups = () =>
  useQuery({ queryKey: ["ucl-groups"], queryFn: uclApi.groups })

export const useUclAdminGroups = () =>
  useQuery({ queryKey: ["ucl-admin-groups"], queryFn: uclApi.adminGroups })

export const useWeeklyTournaments = () =>
  useQuery({ queryKey: ["weekly-tournaments"], queryFn: weeklyApi.list })

export const useWeeklyTournament = (id) =>
  useQuery({ queryKey: ["weekly-tournament", id], queryFn: () => weeklyApi.get(id), enabled: !!id })

export const useCreateWeeklyTournament = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name) => weeklyApi.create(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["weekly-tournaments"] }),
  })
}

export const useSetWeeklyPlayers = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, playerIds }) => weeklyApi.setPlayers(id, playerIds),
    onSuccess: (_, { id }) => qc.invalidateQueries({ queryKey: ["weekly-tournament", id] }),
  })
}

export const useSaveWeeklyResult = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ matchId, player1Score, player2Score, tieWinnerId }) =>
      weeklyApi.saveResult(matchId, player1Score, player2Score, tieWinnerId),
    onSuccess: (_, { tournamentId }) => {
      // Invalidate with both string and number forms to be safe
      qc.invalidateQueries({ queryKey: ["weekly-tournament"] })
      qc.invalidateQueries({ queryKey: ["players"] })
    },
  })
}

export const useDeleteWeeklyTournament = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => weeklyApi.deleteTournament(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["weekly-tournaments"] }),
  })
}

export const useUpdateMatchPlayers = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ matchId, ...body }) => weeklyApi.updateMatchPlayers(matchId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["weekly-tournament"] }),
  })
}

export const useResetWeeklyTournament = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => weeklyApi.reset(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["weekly-tournaments"] })
      qc.invalidateQueries({ queryKey: ["weekly-tournament", String(id)] })
    },
  })
}

export const useUclUnassigned = () =>
  useQuery({ queryKey: ["ucl-unassigned"], queryFn: uclApi.unassigned })

export const useUclStandings = () =>
  useQuery({ queryKey: ["ucl-standings"], queryFn: uclApi.standings, staleTime: 0 })

export const useUclFixtures = () =>
  useQuery({ queryKey: ["ucl-fixtures"], queryFn: uclApi.fixtures, refetchOnMount: "always", staleTime: 0 })

export const useUclTopScorers = () =>
  useQuery({ queryKey: ["ucl-top-scorers"], queryFn: uclApi.topScorers })

export const useWeeklyCurrent = () =>
  useQuery({ queryKey: ["weekly-current"], queryFn: weeklyApi.current })

export const useUclKnockoutCurrent = () =>
  useQuery({ queryKey: ["ucl-knockout-current"], queryFn: uclKnockoutApi.current })

export const useWeeklyTopScorers = () =>
  useQuery({ queryKey: ["weekly-top-scorers"], queryFn: weeklyApi.topScorers })

export const useCreateUclGroup = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name) => uclApi.createGroup(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ucl-groups"] }),
  })
}

export const useGenerateUclGroups = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (playerIds) => uclApi.generate(playerIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ucl-groups"] })
      qc.invalidateQueries({ queryKey: ["ucl-admin-groups"] })
      qc.invalidateQueries({ queryKey: ["ucl-unassigned"] })
      qc.invalidateQueries({ queryKey: ["ucl-standings"] })
    },
  })
}

export const useResetGroupFixtures = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => uclApi.resetGroupFixtures(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ucl-standings"] }),
  })
}
export const useRenameUclGroup = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }) => uclApi.renameGroup(id, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ucl-groups"] }),
  })
}
export const useDeleteUclGroup = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => uclApi.deleteGroup(id),
    onSuccess: () => {
      qc.refetchQueries({ queryKey: ["ucl-groups"] })
      qc.refetchQueries({ queryKey: ["ucl-admin-groups"] })
      qc.refetchQueries({ queryKey: ["ucl-unassigned"] })
      qc.refetchQueries({ queryKey: ["ucl-standings"] })
      qc.refetchQueries({ queryKey: ["ucl-fixtures"] })
      qc.refetchQueries({ queryKey: ["ucl-top-scorers"] })
    },
  })
}
export const useAssignUclPlayer = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ groupId, playerId }) => uclApi.assignPlayer(groupId, playerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ucl-groups"] })
      qc.invalidateQueries({ queryKey: ["ucl-unassigned"] })
    },
  })
}
export const useUnassignUclPlayer = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (playerId) => uclApi.unassignPlayer(playerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ucl-groups"] })
      qc.invalidateQueries({ queryKey: ["ucl-unassigned"] })
      qc.invalidateQueries({ queryKey: ["ucl-standings"] })
    },
  })
}

export const useLeagueInfo = () =>
  useQuery({ queryKey: ["league-info"], queryFn: leagueInfoApi.list })

export const useCreateLeagueInfo = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: leagueInfoApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["league-info"] }),
  })
}
export const useUpdateLeagueInfo = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }) => leagueInfoApi.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["league-info"] }),
  })
}
export const useDeleteLeagueInfo = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => leagueInfoApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["league-info"] }),
  })
}

export const useSeasonMatchRecords = (season) =>
  useQuery({
    queryKey: ["records", "season", season],
    queryFn:  () => recordsApi.bySeason(season),
    enabled:  !!season,
  })

export const useTeams = () =>
  useQuery({ queryKey: QK.teams, queryFn: teamsApi.list })

export const useTopScorers = () =>
  useQuery({ queryKey: ["top-scorers"], queryFn: teamsApi.topScorers })

export const useHallOfFame = () =>
  useQuery({ queryKey: ["hall-of-fame"], queryFn: teamsApi.hallOfFame })

export const useSeasonRecords = () =>
  useQuery({ queryKey: ["season-records"], queryFn: teamsApi.seasonRecords })

export const useCreateSeasonRecord = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body) => teamsApi.createSeasonRecord(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["season-records"] }),
  })
}

export const useUpdateSeasonRecord = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }) => teamsApi.updateSeasonRecord(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["season-records"] }),
  })
}

export const useDeleteSeasonRecord = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => teamsApi.deleteSeasonRecord(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["season-records"] }),
  })
}

export const useTeam = (id) =>
  useQuery({ queryKey: QK.team(id), queryFn: () => teamsApi.get(id), enabled: !!id })

export const usePlayers = (params) =>
  useQuery({ queryKey: QK.players(params), queryFn: () => playersApi.list(params) })

export const useMyPlayers = (teamId) =>
  useQuery({
    queryKey: QK.players({ teamId }),
    queryFn:  () => playersApi.list({ teamId }),
    enabled:  !!teamId,
  })

export const usePlayer = (id) =>
  useQuery({ queryKey: QK.player(id), queryFn: () => playersApi.get(id), enabled: !!id })

export const useUpdatePlayer = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }) => playersApi.update(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["players"] })
    },
  })
}

export const useRecords = () =>
  useQuery({ queryKey: QK.records, queryFn: recordsApi.list })

export const useLogRecord = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: recordsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.records })
      qc.invalidateQueries({ queryKey: ["players"] })
    },
  })
}

export const useLogTeamRecord = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: recordsApi.createTeam,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["players"] })
      qc.invalidateQueries({ queryKey: QK.records })
      qc.invalidateQueries({ queryKey: ["fixture-records"] })
    },
  })
}

export const useFixtureRecords = (fixtureId) =>
  useQuery({
    queryKey: ["fixture-records", fixtureId],
    queryFn:  () => recordsApi.byFixture(fixtureId),
    enabled:  !!fixtureId,
    refetchInterval: 30000, // poll every 30s so both teams see each other's updates
  })

export const useEditRecord = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }) => recordsApi.update(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.records })
      qc.invalidateQueries({ queryKey: ["players"] })
    },
  })
}

export const useDeleteRecord = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: recordsApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.records })
      qc.invalidateQueries({ queryKey: ["players"] })
    },
  })
}

export const useFixtures = (params) =>
  useQuery({ queryKey: QK.fixtures(params), queryFn: () => fixturesApi.list(params) })

export const useRecentFixtures = () =>
  useQuery({ queryKey: QK.recent, queryFn: fixturesApi.recent })

export const useCreateFixture = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fixturesApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fixtures"] }),
  })
}

export const useUpdateFixture = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }) => fixturesApi.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fixtures"] }),
  })
}

export const useUpdateRoundDate = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ round, date }) => fixturesApi.updateRoundDate(round, date),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fixtures"] }),
  })
}

export const useDeleteFixture = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => fixturesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fixtures"] }),
  })
}

export const useSaveFixtureResult = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, homeScore, awayScore, homeGoals, awayGoals }) =>
      fixturesApi.saveResult(id, homeScore, awayScore, homeGoals, awayGoals),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fixtures"] })
      qc.invalidateQueries({ queryKey: QK.teams })
    },
  })
}

export const useTrades = (params) =>
  useQuery({ queryKey: QK.trades(params), queryFn: () => tradesApi.list(params) })

export const useRequestTrade = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body) => tradesApi.request(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trades"] }),
  })
}

export const useTeamReviewTrade = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, action, reason }) => tradesApi.teamReview(id, action, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trades"] }),
  })
}

export const useReviewTrade = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, action }) => tradesApi.review(id, action),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trades"] })
      qc.invalidateQueries({ queryKey: ["players"] })
      qc.invalidateQueries({ queryKey: QK.teams })
    },
  })
}

export const useCancelTrade = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: tradesApi.cancel,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trades"] }),
  })
}

export const useCreateTeam = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: teamsApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.teams }),
  })
}

export const useCreatePlayer = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: playersApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["players"] })
      qc.invalidateQueries({ queryKey: QK.teams })
    },
  })
}

export const useDeletePlayer = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => playersApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["players"] })
      qc.invalidateQueries({ queryKey: QK.teams })
    },
  })
}

export const useUnassignPlayer = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => playersApi.unassign(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["players"] })
      qc.invalidateQueries({ queryKey: QK.teams })
    },
  })
}

export const useDeleteTeam = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => teamsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.teams })
      qc.invalidateQueries({ queryKey: ["players"] })
    },
  })
}

export const useUpdateTeam = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }) => teamsApi.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.teams }),
  })
}

export const useUpdateTeamSettings = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }) => teamsApi.updateSettings(id, body),
    onSuccess: (data, variables) => {
      qc.invalidateQueries({ queryKey: QK.teams })
      qc.invalidateQueries({ queryKey: QK.team(variables.id) })
    },
  })
}

export const useChangeTeamPassword = () => {
  return useMutation({
    mutationFn: ({ id, newPassword }) => teamsApi.changePassword(id, newPassword),
  })
}

// ── Lineup hooks ──────────────────────────────────────────────────────────────

export const useLineup = (fixtureId) =>
  useQuery({
    queryKey: ["lineup", fixtureId],
    queryFn:  () => lineupsApi.get(fixtureId),
    enabled:  !!fixtureId,
  })

export const useSaveLineup = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ fixtureId, matchups }) => lineupsApi.save(fixtureId, matchups),
    onSuccess: (_, { fixtureId }) => qc.invalidateQueries({ queryKey: ["lineup", fixtureId] }),
  })
}

export const useClearLineup = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (fixtureId) => lineupsApi.delete(fixtureId),
    onSuccess: (_, fixtureId) => qc.invalidateQueries({ queryKey: ["lineup", fixtureId] }),
  })
}

export const useH2H = (p1Id, p2Id) =>
  useQuery({
    queryKey: ["h2h", p1Id, p2Id],
    queryFn:  () => lineupsApi.h2h(p1Id, p2Id),
    enabled:  !!p1Id && !!p2Id,
  })

// ── Favorites hooks ───────────────────────────────────────────────────────────

export const useFavorites = () =>
  useQuery({ queryKey: ["favorites"], queryFn: favoritesApi.list })

export const useToggleFavorite = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ playerId, isFavorited }) =>
      isFavorited ? favoritesApi.remove(playerId) : favoritesApi.add(playerId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favorites"] }),
  })
}
// UCL Knockout hooks
export const useUclKnockoutList = () =>
  useQuery({ queryKey: ["ucl-knockout-list"], queryFn: uclKnockoutApi.list })

export const useUclKnockout = (id) =>
  useQuery({ queryKey: ["ucl-knockout", id], queryFn: () => uclKnockoutApi.get(id), enabled: !!id })

export const useCreateUclKnockout = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name) => uclKnockoutApi.create(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ucl-knockout-list"] }),
  })
}

export const useSaveUclKnockoutResult = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ matchId, player1Score, player2Score, tieWinnerId }) =>
      uclKnockoutApi.saveResult(matchId, player1Score, player2Score, tieWinnerId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ucl-knockout"] }),
  })
}

export const useUpdateUclKnockoutMatchPlayers = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ matchId, ...body }) => uclKnockoutApi.updateMatchPlayers(matchId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ucl-knockout"] }),
  })
}

export const useResetUclKnockout = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => uclKnockoutApi.reset(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ucl-knockout-list"] }),
  })
}

export const useDeleteUclKnockout = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => uclKnockoutApi.deleteTournament(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ucl-knockout-list"] }),
  })
}