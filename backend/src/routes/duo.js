import { Router } from "express"
import { z } from "zod"
import { query, withTransaction } from "../db/pool.js"
import { authenticate, adminOnly } from "../middleware/auth.js"
import { recalcMarketValue } from "../services/marketValue.js"
import { recalcForm } from "../services/form.js"
import { addBdr } from "../services/bdrAwards.js"
import { reconcileTrophyRoster, awardOrReassignTrophy } from "../services/trophyAwards.js"
import { updateSeasonRecord } from "../services/seasonRecord.js"

const router = Router()

// ── Inline column migration — add trophy10/11 if not already present ──────────
;(async () => {
  try {
    // duo_selections: admin-chosen Set 1 / Set 2 players per season
    await query(`
      CREATE TABLE IF NOT EXISTS duo_selections (
        id            SERIAL PRIMARY KEY,
        season_number INT NOT NULL,
        set_number    INT NOT NULL CHECK (set_number IN (1,2)),
        player_id     INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        UNIQUE(season_number, player_id)
      )
    `)
    // Ensure all extended trophy columns exist (trophy8/9 may not be in base migrate.js)
    await query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS trophy8_count  INT DEFAULT 0`)
    await query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS trophy9_count  INT DEFAULT 0`)
    await query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS trophy10_count INT DEFAULT 0`)
    await query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS trophy11_count INT DEFAULT 0`)
    await query(`
      CREATE OR REPLACE VIEW players_full AS
      SELECT
        p.id, p.name, p.alias, p.grade,
        p.auction_price AS "auctionPrice",
        p.market_value  AS "marketValue",
        p.bdr_points    AS "bdrPoints",
        p.form,
        p.trophy1_count  AS "trophy1Count",
        p.trophy2_count  AS "trophy2Count",
        p.trophy3_count  AS "trophy3Count",
        p.trophy4_count  AS "trophy4Count",
        p.trophy5_count  AS "trophy5Count",
        p.trophy6_count  AS "trophy6Count",
        p.trophy7_count  AS "trophy7Count",
        p.trophy8_count  AS "trophy8Count",
        p.trophy9_count  AS "trophy9Count",
        p.trophy10_count AS "trophy10Count",
        p.trophy11_count AS "trophy11Count",
        p.is_captain     AS "isCaptain",
        p.grade_floor    AS "gradeFloor",
        p.grade_ceiling  AS "gradeCeiling",
        t.name           AS team,
        p.team_id        AS "teamId",
        t.logo_url       AS "teamLogo",
        p.avatar_id      AS "avatarId",
        p.avatar_url     AS "avatarUrl",
        p.avatar_bg_url  AS "avatarBgUrl"
      FROM players p
      LEFT JOIN teams t ON p.team_id = t.id
    `)
  } catch (e) { console.error("[duo] trophy10/11 migration:", e.message) }
})()

const GROUP_NAMES  = ["Group A","Group B","Group C","Group D","Group E","Group F","Group G","Group H"]
const SET1_GRADES  = ["S","A+","A"]
const SET2_GRADES  = ["B","C"]

// ── Helpers ───────────────────────────────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Generate round-robin fixtures with proper round numbers using circle method.
// With n teams, there are n-1 rounds (n even) or n rounds (n odd).
// Each round has floor(n/2) matches.
function roundRobinFixtures(pairIds) {
  const n = pairIds.length
  const fixtures = []

  if (n < 2) return fixtures

  // Pad to even number with a "bye" (null)
  const teams = n % 2 === 0 ? [...pairIds] : [...pairIds, null]
  const rounds = teams.length - 1
  const half   = teams.length / 2

  for (let round = 0; round < rounds; round++) {
    for (let i = 0; i < half; i++) {
      const home = teams[i]
      const away = teams[teams.length - 1 - i]
      // Skip if either is the bye slot
      if (home !== null && away !== null) {
        fixtures.push({ home, away, roundNumber: round + 1 })
      }
    }
    // Rotate all except first element
    const last = teams.pop()
    teams.splice(1, 0, last)
  }

  return fixtures
}

// ── GET /api/duo/current — public: current season data ────────────────────────
router.get("/current", async (req, res, next) => {
  try {
    const { season } = req.query

    // Get latest season if not specified
    let seasonNum = season
    if (!seasonNum) {
      try {
        const r = await query("SELECT MAX(season_number) AS s FROM duo_groups")
        seasonNum = r.rows[0]?.s
      } catch { return res.json(null) }
    }
    if (!seasonNum) return res.json(null)

    // Groups + standings
    let groups
    try {
      groups = await query(`
        SELECT g.id, g.name, g.status,
          dgm.duo_pair_id AS "duoPairId",
          dp.duo_name AS "duoName",
          p1.name AS "set1Name", p1.id AS "set1Id", p1.grade::text AS "set1Grade",
          p2.name AS "set2Name", p2.id AS "set2Id", p2.grade::text AS "set2Grade",
          dgm.played, dgm.won, dgm.drawn, dgm.lost,
          dgm.gf, dgm.ga, dgm.gf - dgm.ga AS gd, dgm.points
        FROM duo_groups g
        JOIN duo_group_members dgm ON dgm.group_id = g.id
        JOIN duo_pairs dp ON dp.id = dgm.duo_pair_id
        JOIN players p1 ON p1.id = dp.set1_player_id
        JOIN players p2 ON p2.id = dp.set2_player_id
        WHERE g.season_number = $1
        ORDER BY g.name ASC, dgm.points DESC, (dgm.gf - dgm.ga) DESC, dgm.gf DESC
      `, [seasonNum])
    } catch (e) {
      console.error('[duo] groups query failed:', e.message)
      return res.json(null)
    }

    // Fixtures
    const fixtures = await query(`
      SELECT
        df.*,
        dp1.duo_name AS "homeDuoName", dp2.duo_name AS "awayDuoName",
        p1s1.name AS "homeSet1Name", p1s2.name AS "homeSet2Name",
        p2s1.name AS "awaySet1Name", p2s2.name AS "awaySet2Name",
        g.name AS "groupName"
      FROM duo_fixtures df
      JOIN duo_pairs dp1 ON dp1.id = df.home_pair_id
      JOIN duo_pairs dp2 ON dp2.id = df.away_pair_id
      JOIN players p1s1 ON p1s1.id = dp1.set1_player_id
      JOIN players p1s2 ON p1s2.id = dp1.set2_player_id
      JOIN players p2s1 ON p2s1.id = dp2.set1_player_id
      JOIN players p2s2 ON p2s2.id = dp2.set2_player_id
      LEFT JOIN duo_groups g ON g.id = df.group_id
      WHERE (g.season_number = $1 OR df.knockout_round IS NOT NULL AND EXISTS (
        SELECT 1 FROM duo_pairs dp3 WHERE dp3.id = df.home_pair_id AND dp3.season_number = $1
      ))
      ORDER BY df.knockout_round NULLS FIRST, df.match_number ASC, df.id ASC
    `, [seasonNum])

    // Top scorers (Golden Boot)
    const topScorers = await query(`
      SELECT
        p.id, p.name, p.grade,
        COALESCE(SUM(mr.player_score), 0)::int AS goals
      FROM players p
      JOIN match_records mr ON mr.player_id = p.id
      WHERE mr.match_type = 'duo'
        AND mr.season_number = $1
      GROUP BY p.id, p.name, p.grade
      ORDER BY goals DESC, p.name ASC
      LIMIT 10
    `, [seasonNum]).catch(() => ({ rows: [] }))

    res.json({
      seasonNumber: seasonNum,
      groups: groups.rows,
      fixtures: fixtures.rows,
      topScorers: topScorers.rows,
    })
  } catch (err) { next(err) }
})

// ── POST /api/duo/generate — admin: create draw ───────────────────────────────
router.post("/generate", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { seasonNumber } = z.object({ seasonNumber: z.number().int().positive() }).parse(req.body)

    // Use admin-selected sets from duo_selections table
    const set1Res = await query(
      `SELECT p.id, p.name, p.grade::text AS grade
       FROM duo_selections ds JOIN players p ON p.id = ds.player_id
       WHERE ds.season_number = $1 AND ds.set_number = 1
       ORDER BY RANDOM()`,
      [seasonNumber]
    )
    const set2Res = await query(
      `SELECT p.id, p.name, p.grade::text AS grade
       FROM duo_selections ds JOIN players p ON p.id = ds.player_id
       WHERE ds.season_number = $1 AND ds.set_number = 2
       ORDER BY RANDOM()`,
      [seasonNumber]
    )

    if (set1Res.rows.length === 0 || set2Res.rows.length === 0) {
      return res.status(400).json({ error: "Please confirm Set 1 and Set 2 selections first" })
    }

    const set1 = shuffle(set1Res.rows)
    const set2 = shuffle(set2Res.rows)
    const pairCount = Math.min(set1.length, set2.length)

    if (pairCount < 2) return res.status(400).json({ error: "Not enough players to form pairs" })

    await withTransaction(async ({ query: q }) => {
      // Wipe existing season data
      const existingGroups = await q("SELECT id FROM duo_groups WHERE season_number = $1", [seasonNumber])
      const gIds = existingGroups.rows.map(r => r.id)
      if (gIds.length > 0) {
        await q("DELETE FROM duo_fixtures WHERE group_id = ANY($1::int[])", [gIds])
        await q("DELETE FROM duo_group_members WHERE group_id = ANY($1::int[])", [gIds])
        await q("DELETE FROM duo_groups WHERE id = ANY($1::int[])", [gIds])
      }
      await q("DELETE FROM duo_pairs WHERE season_number = $1", [seasonNumber])

      // Create pairs
      const pairs = []
      for (let i = 0; i < pairCount; i++) {
        const p1 = set1[i], p2 = set2[i]
        const duoName = `${p1.name.split(" ")[0]} & ${p2.name.split(" ")[0]}`
        const pr = await q(
          "INSERT INTO duo_pairs (season_number, set1_player_id, set2_player_id, duo_name) VALUES ($1,$2,$3,$4) RETURNING id",
          [seasonNumber, p1.id, p2.id, duoName]
        )
        pairs.push({ id: pr.rows[0].id, set1: p1, set2: p2, duoName })
      }

      // Distribute into 8 groups (round-robin)
      const shuffledPairs = shuffle(pairs)
      const groupCount = Math.min(8, Math.floor(pairCount / 2))
      const usedGroupNames = GROUP_NAMES.slice(0, groupCount)

      const groups = []
      for (const name of usedGroupNames) {
        const gr = await q(
          "INSERT INTO duo_groups (season_number, name, status) VALUES ($1,$2,'active') RETURNING id",
          [seasonNumber, name]
        )
        groups.push({ id: gr.rows[0].id, name, pairs: [] })
      }

      // Assign pairs to groups round-robin
      shuffledPairs.forEach((pair, idx) => {
        groups[idx % groupCount].pairs.push(pair)
      })

      // Create group members + round-robin fixtures
      for (const group of groups) {
        for (const pair of group.pairs) {
          await q(
            "INSERT INTO duo_group_members (group_id, duo_pair_id) VALUES ($1,$2)",
            [group.id, pair.id]
          )
        }
        const fixtures = roundRobinFixtures(group.pairs.map(p => p.id))
        for (const fix of fixtures) {
          await q(
            "INSERT INTO duo_fixtures (group_id, home_pair_id, away_pair_id, round_number, status) VALUES ($1,$2,$3,$4,'pending')",
            [group.id, fix.home, fix.away, fix.roundNumber]
          )
        }
      }
    })

    res.json({ success: true, message: `${pairCount} duo pairs created across groups for Season ${seasonNumber}` })
  } catch (err) { next(err) }
})

// ── POST /api/duo/fixtures/:id/score — admin: enter scores ───────────────────
router.post("/fixtures/:id/score", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { set1HomeScore, set1AwayScore, set2HomeScore, set2AwayScore } = z.object({
      set1HomeScore: z.number().int().min(0),
      set1AwayScore: z.number().int().min(0),
      set2HomeScore: z.number().int().min(0),
      set2AwayScore: z.number().int().min(0),
    }).parse(req.body)

    const fixRes = await query("SELECT * FROM duo_fixtures WHERE id = $1", [req.params.id])
    const fix = fixRes.rows[0]
    if (!fix) return res.status(404).json({ error: "Fixture not found" })

    const homeAgg = set1HomeScore + set2HomeScore
    const awayAgg = set1AwayScore + set2AwayScore

    let winnerPairId = null
    if (homeAgg > awayAgg) winnerPairId = fix.home_pair_id
    else if (awayAgg > homeAgg) winnerPairId = fix.away_pair_id

    await withTransaction(async ({ query: q }) => {
      // Get pair players
      const homePair = (await q("SELECT * FROM duo_pairs WHERE id = $1", [fix.home_pair_id])).rows[0]
      const awayPair = (await q("SELECT * FROM duo_pairs WHERE id = $1", [fix.away_pair_id])).rows[0]

      // Create/update match records for Set1 players
      let set1RecordId = fix.set1_match_record_id
      if (set1RecordId) {
        await q("DELETE FROM match_records WHERE id = $1", [set1RecordId])
      }
      const result1 = set1HomeScore > set1AwayScore ? "win" : set1HomeScore < set1AwayScore ? "loss" : "draw"
      const s1r = await q(`
        INSERT INTO match_records (player_id, opponent_id, result, player_score, opponent_score, match_type, season_number)
        VALUES ($1,$2,$3,$4,$5,'duo',$6) RETURNING id`,
        [homePair.set1_player_id, awayPair.set1_player_id, result1, set1HomeScore, set1AwayScore,
         homePair.season_number]
      )
      set1RecordId = s1r.rows[0].id

      // Create/update match records for Set2 players
      let set2RecordId = fix.set2_match_record_id
      if (set2RecordId) {
        await q("DELETE FROM match_records WHERE id = $1", [set2RecordId])
      }
      const result2 = set2HomeScore > set2AwayScore ? "win" : set2HomeScore < set2AwayScore ? "loss" : "draw"
      const s2r = await q(`
        INSERT INTO match_records (player_id, opponent_id, result, player_score, opponent_score, match_type, season_number)
        VALUES ($1,$2,$3,$4,$5,'duo',$6) RETURNING id`,
        [homePair.set2_player_id, awayPair.set2_player_id, result2, set2HomeScore, set2AwayScore,
         homePair.season_number]
      )
      set2RecordId = s2r.rows[0].id

      // Update fixture scores
      await q(`
        UPDATE duo_fixtures SET
          set1_home_score = $1, set1_away_score = $2,
          set2_home_score = $3, set2_away_score = $4,
          set1_match_record_id = $5, set2_match_record_id = $6,
          winner_pair_id = $7, status = 'completed'
        WHERE id = $8`,
        [set1HomeScore, set1AwayScore, set2HomeScore, set2AwayScore,
         set1RecordId, set2RecordId, winnerPairId, fix.id]
      )

      // Update group standings if group fixture
      if (fix.group_id) {
        const homeResult = homeAgg > awayAgg ? "win" : homeAgg < awayAgg ? "loss" : "draw"
        const awayResult = homeAgg < awayAgg ? "win" : homeAgg > awayAgg ? "loss" : "draw"

        const updateStandings = async (pairId, result, gf, ga) => {
          await q(`
            UPDATE duo_group_members SET
              played = played + 1,
              won    = won   + $2::int,
              drawn  = drawn + $3::int,
              lost   = lost  + $4::int,
              gf = gf + $5, ga = ga + $6,
              points = points + $7
            WHERE group_id = $8 AND duo_pair_id = $1`,
            [pairId,
             result === "win"  ? 1 : 0,
             result === "draw" ? 1 : 0,
             result === "loss" ? 1 : 0,
             gf, ga,
             result === "win" ? 3 : result === "draw" ? 1 : 0,
             fix.group_id
            ]
          )
        }

        await updateStandings(fix.home_pair_id, homeResult, homeAgg, awayAgg)
        await updateStandings(fix.away_pair_id, awayResult, awayAgg, homeAgg)
      }

      // Recalc market values + form
      const playerIds = [homePair.set1_player_id, homePair.set2_player_id, awayPair.set1_player_id, awayPair.set2_player_id]
      for (const pid of playerIds) {
        await recalcMarketValue(pid)
        await recalcForm(pid)
      }

      // ── BDR for knockout rounds ───────────────────────────────────────────
      // Only award when this is a knockout match (has knockout_round)
      if (fix.knockout_round && winnerPairId) {
        const loserPairId = winnerPairId === fix.home_pair_id ? fix.away_pair_id : fix.home_pair_id
        const loserPair   = winnerPairId === fix.home_pair_id ? awayPair : homePair
        const winnerPair  = winnerPairId === fix.home_pair_id ? homePair : awayPair

        // BDR per round (for loser — reaching that round)
        const LOSER_BDR = { qf: 4, sf: 6, final: 8 }
        // BDR for winner of final
        const WINNER_BDR = { final: 10 }

        const loserBdr  = LOSER_BDR[fix.knockout_round]
        const winnerBdr = WINNER_BDR[fix.knockout_round]

        // Award loser BDR (for reaching this round)
        if (loserBdr) {
          await addBdr(loserPair.set1_player_id, loserBdr)
          await addBdr(loserPair.set2_player_id, loserBdr)
        }

        // Award winner BDR (champion only)
        if (winnerBdr) {
          await addBdr(winnerPair.set1_player_id, winnerBdr)
          await addBdr(winnerPair.set2_player_id, winnerBdr)
        }

        // Runner-up (Final loser) gets 8 already above.
        // SF losers get 6, QF losers get 4 — handled above.

        // ── Golden Boot — top individual scorer in this tournament ───────────
        if (fix.knockout_round === "final") {
          const seasonNum = homePair.season_number

          // ── Duo champion trophy (trophy10) — both players of the winning pair ──
          await reconcileTrophyRoster({
            sourceKey:    `duo_champion_s${seasonNum}`,
            trophyColumn: "trophy10_count",
            playerIds:    [winnerPair.set1_player_id, winnerPair.set2_player_id].filter(Boolean),
            seasonNumber: seasonNum,
          })

          // ── Auto-fill season record — duo winner ───────────────────────────
          const duoWinnerNamesRes = await query(
            "SELECT name FROM players WHERE id = ANY($1::int[])",
            [[winnerPair.set1_player_id, winnerPair.set2_player_id].filter(Boolean)]
          )
          const duoWinnerLabel = duoWinnerNamesRes.rows.map(r => r.name).join(" & ")
          await updateSeasonRecord(seasonNum, { duo_winner: duoWinnerLabel })

          const gbRes = await q(`
            SELECT mr.player_id,
              SUM(mr.player_score) AS goals
            FROM match_records mr
            WHERE mr.match_type = 'duo'
              AND mr.season_number = $1
            GROUP BY mr.player_id
            ORDER BY goals DESC LIMIT 1
          `, [seasonNum])
          const topScorer = gbRes.rows[0]
          if (topScorer?.goals > 0) {
            await addBdr(topScorer.player_id, 4)
            // ── Duo Golden Boot trophy (trophy11) ─────────────────────────────
            await awardOrReassignTrophy({
              sourceKey:    `duo_golden_boot_s${seasonNum}`,
              trophyColumn: "trophy11_count",
              playerId:     topScorer.player_id,
              seasonNumber: seasonNum,
            })
          }
        }
      }
    })

    res.json({ success: true })
  } catch (err) { next(err) }
})

// ── POST /api/duo/knockout/generate — admin: advance top 2 from each group ───
router.post("/knockout/generate", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { seasonNumber } = z.object({ seasonNumber: z.number().int().positive() }).parse(req.body)

    // Get top 2 from each group
    const standings = await query(`
      SELECT
        dgm.duo_pair_id AS "duoPairId", dgm.points, dgm.gf - dgm.ga AS gd, dgm.gf,
        g.id AS "groupId", g.name AS "groupName",
        RANK() OVER (PARTITION BY dgm.group_id ORDER BY dgm.points DESC, dgm.gf - dgm.ga DESC, dgm.gf DESC) AS rnk
      FROM duo_group_members dgm
      JOIN duo_groups g ON g.id = dgm.group_id
      WHERE g.season_number = $1
    `, [seasonNumber])

    const qualifiers = standings.rows.filter(r => r.rnk <= 2)

    if (qualifiers.length < 4) return res.status(400).json({ error: "Not enough qualifiers" })

    // Shuffle qualifiers for R16 draw
    const shuffled = shuffle(qualifiers)
    const matchCount = Math.floor(shuffled.length / 2)

    // Delete existing knockout fixtures for this season
    await query(`
      DELETE FROM duo_fixtures WHERE knockout_round IS NOT NULL
      AND home_pair_id IN (SELECT id FROM duo_pairs WHERE season_number = $1)
    `, [seasonNumber])

    const round = shuffled.length >= 16 ? "r16" : shuffled.length >= 8 ? "qf" : "sf"

    for (let i = 0; i < matchCount; i++) {
      await query(
        "INSERT INTO duo_fixtures (home_pair_id, away_pair_id, knockout_round, match_number, status) VALUES ($1,$2,$3,$4,'pending')",
        [shuffled[i*2].duoPairId, shuffled[i*2+1].duoPairId, round, i+1]
      )
    }

    res.json({ success: true, round, matches: matchCount })
  } catch (err) { next(err) }
})

// ── POST /api/duo/knockout/advance — admin: advance winners to next round ─────
router.post("/knockout/advance", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { seasonNumber, fromRound } = z.object({
      seasonNumber: z.number().int().positive(),
      fromRound:    z.string()
    }).parse(req.body)

    const NEXT_ROUND = { r16: "qf", qf: "sf", sf: "final" }
    const nextRound  = NEXT_ROUND[fromRound]
    if (!nextRound) return res.status(400).json({ error: "No next round after final" })

    const completedRes = await query(`
      SELECT winner_pair_id FROM duo_fixtures
      WHERE knockout_round = $1 AND status = 'completed'
      AND home_pair_id IN (SELECT id FROM duo_pairs WHERE season_number = $2)
      ORDER BY match_number ASC
    `, [fromRound, seasonNumber])

    const winners = completedRes.rows.map(r => r.winner_pair_id).filter(Boolean)
    if (winners.length < 2) return res.status(400).json({ error: "Not enough completed matches" })

    const shuffled = shuffle(winners)

    // Delete existing next round fixtures
    await query(`
      DELETE FROM duo_fixtures WHERE knockout_round = $1
      AND home_pair_id IN (SELECT id FROM duo_pairs WHERE season_number = $2)
    `, [nextRound, seasonNumber])

    for (let i = 0; i < Math.floor(shuffled.length / 2); i++) {
      await query(
        "INSERT INTO duo_fixtures (home_pair_id, away_pair_id, knockout_round, match_number, status) VALUES ($1,$2,$3,$4,'pending')",
        [shuffled[i*2], shuffled[i*2+1], nextRound, i+1]
      )
    }

    res.json({ success: true, nextRound, matches: Math.floor(shuffled.length / 2) })
  } catch (err) { next(err) }
})

// ── GET /api/duo/pairs — get all pairs for a season ───────────────────────────
router.get("/pairs", async (req, res, next) => {
  try {
    const { season } = req.query
    const result = await query(`
      SELECT
        dp.id, dp.duo_name AS "duoName", dp.season_number AS "seasonNumber",
        p1.id AS "set1Id", p1.name AS "set1Name", p1.grade AS "set1Grade",
        p2.id AS "set2Id", p2.name AS "set2Name", p2.grade AS "set2Grade"
      FROM duo_pairs dp
      JOIN players p1 ON p1.id = dp.set1_player_id
      JOIN players p2 ON p2.id = dp.set2_player_id
      WHERE dp.season_number = $1
      ORDER BY dp.duo_name ASC
    `, [season || 1])
    res.json(result.rows)
  } catch (err) { next(err) }
})

// ── DELETE /api/duo/season/:seasonNumber — admin: wipe all duo data ──────────
router.delete("/season/:seasonNumber", authenticate, adminOnly, async (req, res, next) => {
  try {
    const sn = parseInt(req.params.seasonNumber)

    await withTransaction(async ({ query: q }) => {
      // Get all group IDs for this season
      const groups = await q("SELECT id FROM duo_groups WHERE season_number = $1", [sn])
      const gIds = groups.rows.map(r => r.id)

      if (gIds.length > 0) {
        // Delete match records linked to duo fixtures
        const fixtures = await q(
          "SELECT set1_match_record_id, set2_match_record_id FROM duo_fixtures WHERE group_id = ANY($1::int[])",
          [gIds]
        )
        const mrIds = fixtures.rows.flatMap(r => [r.set1_match_record_id, r.set2_match_record_id]).filter(Boolean)
        if (mrIds.length > 0) await q("DELETE FROM match_records WHERE id = ANY($1::int[])", [mrIds])

        await q("DELETE FROM duo_fixtures WHERE group_id = ANY($1::int[])", [gIds])
        await q("DELETE FROM duo_group_members WHERE group_id = ANY($1::int[])", [gIds])
        await q("DELETE FROM duo_groups WHERE id = ANY($1::int[])", [gIds])
      }

      // Delete knockout fixtures for this season
      await q(`
        DELETE FROM duo_fixtures WHERE knockout_round IS NOT NULL
        AND home_pair_id IN (SELECT id FROM duo_pairs WHERE season_number = $1)
      `, [sn])

      // Delete pairs
      await q("DELETE FROM duo_pairs WHERE season_number = $1", [sn])
    })

    res.json({ success: true, message: `Season ${sn} duo data deleted` })
  } catch (err) { next(err) }
})

// ── POST /api/duo/sets — admin saves Set 1 and Set 2 player selections ────────
router.post("/sets", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { seasonNumber, set1PlayerIds, set2PlayerIds } = z.object({
      seasonNumber:  z.number().int().positive(),
      set1PlayerIds: z.array(z.number().int().positive()).min(1).max(32),
      set2PlayerIds: z.array(z.number().int().positive()).min(1).max(32),
    }).parse(req.body)

    if (set1PlayerIds.length !== set2PlayerIds.length) {
      return res.status(400).json({ error: "Set 1 and Set 2 must have the same number of players" })
    }
    const overlap = set1PlayerIds.filter(id => set2PlayerIds.includes(id))
    if (overlap.length > 0) {
      return res.status(400).json({ error: "A player cannot be in both sets" })
    }

    await withTransaction(async ({ query: q }) => {
      await q("DELETE FROM duo_selections WHERE season_number = $1", [seasonNumber])
      for (const pid of set1PlayerIds) {
        await q("INSERT INTO duo_selections (season_number, set_number, player_id) VALUES ($1,1,$2)", [seasonNumber, pid])
      }
      for (const pid of set2PlayerIds) {
        await q("INSERT INTO duo_selections (season_number, set_number, player_id) VALUES ($1,2,$2)", [seasonNumber, pid])
      }
    })
    res.json({ saved: true, set1Count: set1PlayerIds.length, set2Count: set2PlayerIds.length })
  } catch (err) { next(err) }
})

// ── GET /api/duo/sets — get saved selections ──────────────────────────────────
router.get("/sets", async (req, res, next) => {
  try {
    const seasonNumber = parseInt(req.query.season)
    const rows = await query(`
      SELECT ds.set_number, p.id, p.name, p.grade::text AS grade, p.team_id,
             t.name AS team_name
      FROM duo_selections ds
      JOIN players p ON p.id = ds.player_id
      LEFT JOIN teams t ON t.id = p.team_id
      WHERE ds.season_number = $1
      ORDER BY ds.set_number, p.name
    `, [seasonNumber])
    const set1 = rows.rows.filter(r => r.set_number === 1)
    const set2 = rows.rows.filter(r => r.set_number === 2)
    res.json({ set1, set2, confirmed: set1.length > 0 && set2.length > 0 })
  } catch (err) { next(err) }
})

// ── DELETE /api/duo/sets — clear selections ───────────────────────────────────
router.delete("/sets", authenticate, adminOnly, async (req, res, next) => {
  try {
    const seasonNumber = parseInt(req.query.season)
    await query("DELETE FROM duo_selections WHERE season_number = $1", [seasonNumber])
    res.json({ cleared: true })
  } catch (err) { next(err) }
})

export default router