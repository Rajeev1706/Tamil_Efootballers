/**
 * tlg.js — Team League Group Knockout format
 *
 * 8 teams split into Group A + Group B (4 each).
 * Top 2 each group → Champions Bracket (Team League trophy).
 * Bottom 2 each group → Europa Bracket (Europa trophy).
 * 8th place team is relegated.
 */
import { Router } from "express"
import { query } from "../db/pool.js"
import { authenticate, adminOnly } from "../middleware/auth.js"
import { reconcileTrophyRoster, awardOrReassignTrophy } from "../services/trophyAwards.js"
import { reconcileTeamTrophy } from "../services/teamTrophyAwards.js"
import { addBdr } from "../services/bdrAwards.js"
import { updateSeasonRecord } from "../services/seasonRecord.js"

// BDR for final standings — same as regular Team League playoffs
const TLG_BDR = {
  champions_final: { winner: 12, loser: 9  }, // Champion +12, Runner-up +9
  third_place:     { winner: 7,  loser: 5  }, // 3rd +7, 4th +5
  europa_final:    { winner: 0,  loser: 0  }, // No extra BDR for Europa
  seventh_place:   { winner: 0,  loser: 0  }, // No extra BDR for 7th/8th
}

async function awardBdrToTeam(teamId, bdr) {
  if (!bdr || !teamId) return
  const players = await query("SELECT id FROM players WHERE team_id = $1", [teamId])
  for (const p of players.rows) await addBdr(p.id, bdr)
}

const router = Router()

// Round-robin for 4 teams: 3 rounds, 2 fixtures each
function roundRobinFixtures() {
  return [
    [[0, 3], [1, 2]],
    [[0, 2], [3, 1]],
    [[0, 1], [2, 3]],
  ]
}

async function getGroupStandings(tlgId, groupId) {
  const teamsRes = await query(
    `SELECT t.id, t.name, t.logo_url AS "logoUrl"
     FROM tlg_group_teams gt JOIN teams t ON t.id = gt.team_id
     WHERE gt.group_id = $1 ORDER BY gt.seed`,
    [groupId]
  )
  const teams = teamsRes.rows

  const fixturesRes = await query(
    "SELECT * FROM tlg_fixtures WHERE group_id = $1 AND status = 'completed'",
    [groupId]
  )

  const standings = teams.map(t => ({
    ...t, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0,
  }))

  for (const f of fixturesRes.rows) {
    const home = standings.find(t => t.id === f.home_team_id)
    const away = standings.find(t => t.id === f.away_team_id)
    if (!home || !away) continue
    home.played++; away.played++
    home.gf += f.home_score ?? 0; home.ga += f.away_score ?? 0
    away.gf += f.away_score ?? 0; away.ga += f.home_score ?? 0
    if (f.home_score > f.away_score) {
      home.won++; away.lost++; home.points += 3
    } else if (f.home_score < f.away_score) {
      away.won++; home.lost++; away.points += 3
    } else {
      home.drawn++; away.drawn++; home.points++; away.points++
    }
  }

  standings.forEach(t => { t.gd = t.gf - t.ga })
  standings.sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf)
  return standings
}

async function buildTlgPayload(tlg) {
  const groupsRes = await query(
    "SELECT * FROM tlg_groups WHERE season_id = $1 ORDER BY name",
    [tlg.id]
  )
  const groups = []
  for (const g of groupsRes.rows) {
    const standings = await getGroupStandings(tlg.id, g.id)
    const fixturesRes = await query(
      `SELECT f.*,
         ht.name AS "homeTeamName", ht.logo_url AS "homeTeamLogo",
         at.name AS "awayTeamName", at.logo_url AS "awayTeamLogo"
       FROM tlg_fixtures f
       JOIN teams ht ON ht.id = f.home_team_id
       JOIN teams at ON at.id = f.away_team_id
       WHERE f.group_id = $1 ORDER BY f.round, f.id`,
      [g.id]
    )
    groups.push({ id: g.id, name: g.name, standings, fixtures: fixturesRes.rows })
  }

  const knockoutRes = await query(
    `SELECT k.*,
       ht.name AS "homeTeamName", ht.logo_url AS "homeTeamLogo",
       at.name AS "awayTeamName", at.logo_url AS "awayTeamLogo",
       wt.name AS "winnerName",   wt.logo_url AS "winnerLogo"
     FROM tlg_knockout k
     LEFT JOIN teams ht ON ht.id = k.home_team_id
     LEFT JOIN teams at ON at.id = k.away_team_id
     LEFT JOIN teams wt ON wt.id = k.winner_id
     WHERE k.season_id = $1`,
    [tlg.id]
  )
  const knockout = {}
  for (const k of knockoutRes.rows) knockout[k.phase] = k

  return { ...tlg, groups, knockout }
}

// GET /api/tlg/list
router.get("/list", async (_req, res, next) => {
  try {
    const result = await query("SELECT * FROM tlg_seasons ORDER BY created_at DESC LIMIT 10")
    res.json(result.rows)
  } catch (err) { next(err) }
})

// GET /api/tlg/current
router.get("/current", async (_req, res, next) => {
  try {
    const seasonRes = await query("SELECT value FROM app_settings WHERE key = 'current_season'")
    const season    = parseInt(seasonRes.rows[0]?.value || "1")
    const tlgRes    = await query(
      "SELECT * FROM tlg_seasons WHERE season_number = $1 ORDER BY id DESC LIMIT 1",
      [season]
    )
    if (!tlgRes.rows[0]) return res.json(null)
    res.json(await buildTlgPayload(tlgRes.rows[0]))
  } catch (err) { next(err) }
})

// GET /api/tlg/:id
router.get("/:id", async (req, res, next) => {
  try {
    const tlgRes = await query("SELECT * FROM tlg_seasons WHERE id = $1", [req.params.id])
    if (!tlgRes.rows[0]) return res.status(404).json({ error: "Not found" })
    res.json(await buildTlgPayload(tlgRes.rows[0]))
  } catch (err) { next(err) }
})

// POST /api/tlg — create season
router.post("/", authenticate, adminOnly, async (req, res, next) => {
  try {
    const seasonRes = await query("SELECT value FROM app_settings WHERE key = 'current_season'")
    const season    = parseInt(seasonRes.rows[0]?.value || "1")
    const exists    = await query("SELECT id FROM tlg_seasons WHERE season_number = $1", [season])
    if (exists.rows[0]) return res.status(400).json({ error: "TLG season already exists" })
    const result = await query(
      "INSERT INTO tlg_seasons (season_number, status) VALUES ($1, 'setup') RETURNING *",
      [season]
    )
    res.status(201).json(result.rows[0])
  } catch (err) { next(err) }
})

// POST /api/tlg/:id/draw — assign 8 teams, create groups + fixtures
router.post("/:id/draw", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { teamIds } = req.body
    if (!Array.isArray(teamIds) || teamIds.length !== 8) {
      return res.status(400).json({ error: "Exactly 8 teams required" })
    }
    const tlgId    = parseInt(req.params.id)
    const shuffled = [...teamIds].sort(() => Math.random() - 0.5)
    const gATeams  = shuffled.slice(0, 4)
    const gBTeams  = shuffled.slice(4, 8)

    await query("DELETE FROM tlg_groups WHERE season_id = $1", [tlgId])

    const gA = (await query("INSERT INTO tlg_groups (season_id, name) VALUES ($1,'A') RETURNING *", [tlgId])).rows[0]
    const gB = (await query("INSERT INTO tlg_groups (season_id, name) VALUES ($1,'B') RETURNING *", [tlgId])).rows[0]

    for (let i = 0; i < 4; i++) {
      await query("INSERT INTO tlg_group_teams (group_id, team_id, seed) VALUES ($1,$2,$3)", [gA.id, gATeams[i], i + 1])
      await query("INSERT INTO tlg_group_teams (group_id, team_id, seed) VALUES ($1,$2,$3)", [gB.id, gBTeams[i], i + 1])
    }

    const schedule = roundRobinFixtures()
    for (const [groupId, teams] of [[gA.id, gATeams], [gB.id, gBTeams]]) {
      for (let r = 0; r < schedule.length; r++) {
        for (const [hi, ai] of schedule[r]) {
          await query(
            "INSERT INTO tlg_fixtures (season_id, group_id, round, home_team_id, away_team_id) VALUES ($1,$2,$3,$4,$5)",
            [tlgId, groupId, r + 1, teams[hi], teams[ai]]
          )
        }
      }
    }

    await query("UPDATE tlg_seasons SET status='group' WHERE id=$1", [tlgId])
    const tlg = (await query("SELECT * FROM tlg_seasons WHERE id=$1", [tlgId])).rows[0]
    res.json(await buildTlgPayload(tlg))
  } catch (err) { next(err) }
})

// PATCH /api/tlg/fixtures/:id — save group fixture result
router.patch("/fixtures/:id", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { homeScore, awayScore, isWalkover } = req.body
    await query(
      "UPDATE tlg_fixtures SET home_score=$1, away_score=$2, status='completed', is_walkover=$3 WHERE id=$4",
      [homeScore, awayScore, isWalkover ?? false, req.params.id]
    )
    const fix = (await query("SELECT * FROM tlg_fixtures WHERE id=$1", [req.params.id])).rows[0]
    res.json(fix)
  } catch (err) { next(err) }
})

// DELETE /api/tlg/fixtures/:id/result
router.delete("/fixtures/:id/result", authenticate, adminOnly, async (req, res, next) => {
  try {
    await query(
      "UPDATE tlg_fixtures SET home_score=NULL,away_score=NULL,status='pending',is_walkover=FALSE WHERE id=$1",
      [req.params.id]
    )
    res.json({ cleared: true })
  } catch (err) { next(err) }
})

// POST /api/tlg/:id/generate-knockout
router.post("/:id/generate-knockout", authenticate, adminOnly, async (req, res, next) => {
  try {
    const tlgId    = parseInt(req.params.id)
    const groupsRes = await query("SELECT * FROM tlg_groups WHERE season_id=$1 ORDER BY name", [tlgId])
    if (groupsRes.rows.length < 2) return res.status(400).json({ error: "Groups not set up" })

    const [gA, gB]      = groupsRes.rows
    const standingsA    = await getGroupStandings(tlgId, gA.id)
    const standingsB    = await getGroupStandings(tlgId, gB.id)
    const [A1,A2,A3,A4] = standingsA
    const [B1,B2,B3,B4] = standingsB

    await query("DELETE FROM tlg_knockout WHERE season_id=$1", [tlgId])

    const phases = [
      { phase: "champions_sf1",   home: A1.id, away: B2.id },
      { phase: "champions_sf2",   home: B1.id, away: A2.id },
      { phase: "champions_final", home: null,  away: null  },
      { phase: "third_place",     home: null,  away: null  },
      { phase: "europa_qr1",      home: A3.id, away: B4.id },
      { phase: "europa_qr2",      home: B3.id, away: A4.id },
      { phase: "europa_final",    home: null,  away: null  },
      { phase: "seventh_place",   home: null,  away: null  },
    ]

    for (const p of phases) {
      await query(
        "INSERT INTO tlg_knockout (season_id, phase, home_team_id, away_team_id) VALUES ($1,$2,$3,$4)",
        [tlgId, p.phase, p.home, p.away]
      )
    }

    await query("UPDATE tlg_seasons SET status='knockout' WHERE id=$1", [tlgId])
    const tlg = (await query("SELECT * FROM tlg_seasons WHERE id=$1", [tlgId])).rows[0]
    res.json(await buildTlgPayload(tlg))
  } catch (err) { next(err) }
})

// PATCH /api/tlg/knockout/:phase — save knockout result
router.patch("/knockout/:phase", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { seasonId, homeScore, awayScore, isWalkover } = req.body
    const phase = req.params.phase

    const matchRes = await query(
      "SELECT * FROM tlg_knockout WHERE season_id=$1 AND phase=$2",
      [seasonId, phase]
    )
    const match = matchRes.rows[0]
    if (!match) return res.status(404).json({ error: "Match not found" })

    const winnerId = homeScore > awayScore ? match.home_team_id : match.away_team_id
    const loserId  = winnerId === match.home_team_id ? match.away_team_id : match.home_team_id

    await query(
      "UPDATE tlg_knockout SET home_score=$1,away_score=$2,winner_id=$3,status='completed',is_walkover=$4 WHERE season_id=$5 AND phase=$6",
      [homeScore, awayScore, winnerId, isWalkover ?? false, seasonId, phase]
    )

    const seasonRes = await query("SELECT value FROM app_settings WHERE key='current_season'")
    const season    = parseInt(seasonRes.rows[0]?.value || "1")

    // Advance to next round
    const advance = {
      champions_sf1: () => Promise.all([
        query("UPDATE tlg_knockout SET home_team_id=$1 WHERE season_id=$2 AND phase='champions_final'", [winnerId, seasonId]),
        query("UPDATE tlg_knockout SET home_team_id=$1 WHERE season_id=$2 AND phase='third_place'",     [loserId,  seasonId]),
      ]),
      champions_sf2: () => Promise.all([
        query("UPDATE tlg_knockout SET away_team_id=$1 WHERE season_id=$2 AND phase='champions_final'", [winnerId, seasonId]),
        query("UPDATE tlg_knockout SET away_team_id=$1 WHERE season_id=$2 AND phase='third_place'",     [loserId,  seasonId]),
      ]),
      europa_qr1: () => Promise.all([
        query("UPDATE tlg_knockout SET home_team_id=$1 WHERE season_id=$2 AND phase='europa_final'",  [winnerId, seasonId]),
        query("UPDATE tlg_knockout SET home_team_id=$1 WHERE season_id=$2 AND phase='seventh_place'", [loserId,  seasonId]),
      ]),
      europa_qr2: () => Promise.all([
        query("UPDATE tlg_knockout SET away_team_id=$1 WHERE season_id=$2 AND phase='europa_final'",  [winnerId, seasonId]),
        query("UPDATE tlg_knockout SET away_team_id=$1 WHERE season_id=$2 AND phase='seventh_place'", [loserId,  seasonId]),
      ]),
    }
    if (advance[phase]) await advance[phase]()

    // Trophies
    if (phase === "champions_final") {
      // BDR: Champion +12, Runner-up +9
      await awardBdrToTeam(winnerId, TLG_BDR.champions_final.winner)
      await awardBdrToTeam(loserId,  TLG_BDR.champions_final.loser)

      const playersRes = await query("SELECT id FROM players WHERE team_id=$1", [winnerId])
      await reconcileTrophyRoster({
        sourceKey: `tlg-gko-champion-s${season}`,
        trophyColumn: "trophy2_count",
        playerIds: playersRes.rows.map(r => r.id),
        seasonNumber: season,
      })
      // Golden Boot — top scorer from league match records this season
      const gbRes = await query(`
        SELECT p.id,
          SUM(CASE WHEN mr.player_id=p.id THEN mr.player_score WHEN mr.opponent_id=p.id THEN mr.opponent_score ELSE 0 END) AS goals
        FROM players p
        LEFT JOIN match_records mr ON (mr.player_id=p.id OR mr.opponent_id=p.id) AND mr.match_type='league' AND mr.season_number=$1
        GROUP BY p.id ORDER BY goals DESC LIMIT 1
      `, [season])
      if (gbRes.rows[0]?.goals > 0) {
        await awardOrReassignTrophy({
          sourceKey: `tlg-gko-golden-boot-s${season}`,
          trophyColumn: "trophy6_count",
          playerId: gbRes.rows[0].id,
          seasonNumber: season,
        })
      }
      await query("UPDATE tlg_seasons SET status='completed' WHERE id=$1", [seasonId])

      // ── Auto-award Team League trophy to winning team (TLG groups+knockout format) ──
      await reconcileTeamTrophy({
        tournament:   "team_league",
        teamId:       winnerId,
        seasonNumber: season,
      })

      // ── Auto-fill season record — TLG team league winner ──────────────────
      const tlgWinnerTeamRes = await query("SELECT name FROM teams WHERE id=$1", [winnerId])
      const tlgWinnerPlayersRes = await query("SELECT name FROM players WHERE team_id=$1", [winnerId])
      await updateSeasonRecord(season, {
        team_league_winner:  tlgWinnerTeamRes.rows[0]?.name ?? null,
        team_league_players: tlgWinnerPlayersRes.rows.map(r => r.name),
      })
    }

    if (phase === "third_place") {
      // BDR: 3rd place +7, 4th place +5
      await awardBdrToTeam(winnerId, TLG_BDR.third_place.winner)
      await awardBdrToTeam(loserId,  TLG_BDR.third_place.loser)
    }

    if (phase === "europa_final") {
      const playersRes = await query("SELECT id FROM players WHERE team_id=$1", [winnerId])
      await reconcileTrophyRoster({
        sourceKey: `tlg-gko-europa-s${season}`,
        trophyColumn: "trophy9_count",
        playerIds: playersRes.rows.map(r => r.id),
        seasonNumber: season,
      })
      await query("UPDATE teams SET europa_wins = COALESCE(europa_wins, 0) + 1 WHERE id=$1", [winnerId])
      // ── Auto-award Europa trophy to winning team ──────────────────────────
      await reconcileTeamTrophy({
        tournament:   "europa",
        teamId:       winnerId,
        seasonNumber: season,
      })
    }

    if (phase === "seventh_place") {
      // 8th place (loser) — store relegated team in app_settings for next season
      await query(
        "INSERT INTO app_settings (key,value) VALUES ('tlg_relegated_team_id',$1) ON CONFLICT (key) DO UPDATE SET value=$1",
        [String(loserId)]
      )
    }

    const tlg = (await query("SELECT * FROM tlg_seasons WHERE id=$1", [seasonId])).rows[0]
    res.json(await buildTlgPayload(tlg))
  } catch (err) { next(err) }
})

// DELETE /api/tlg/:id
router.delete("/:id", authenticate, adminOnly, async (req, res, next) => {
  try {
    await query("DELETE FROM tlg_seasons WHERE id=$1", [req.params.id])
    res.json({ deleted: true })
  } catch (err) { next(err) }
})

export default router