import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { teamsApi, playersApi, recordsApi, fixturesApi, tradesApi, lineupsApi, favoritesApi, settingsApi } from "./api"

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
    mutationFn: ({ playerId, toTeamId }) => tradesApi.request(playerId, toTeamId),
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