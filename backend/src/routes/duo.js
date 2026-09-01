import { Router } from "express"
import { z } from "zod"
import { query, withTransaction } from "../db/pool.js"
import { authenticate, adminOnly } from "../middleware/auth.js"
import { recalcMarketValue } from "../services/marketValue.js"
import { recalcForm } from "../services/form.js"
import { addBdr } from "../services/bdrAwards.js"
import { reconcileTrophyRoster, awardOrReassignTrophy } from "../services/trophyAwards.js"
import { updateSeasonRecord } from "../services/seasonRecord.js"
import { incrementHistory } from "../services/tournamentHistoryService.js"

const router = Router()

// ── Inline column migration ───────────────────────────────────────────────────
;(async () => {
  try {
    // ── Core duo tables (safe to run on every startup) ─────────────────────
    await query(`
      CREATE TABLE IF NOT EXISTS duo_pairs (
        id              SERIAL PRIMARY KEY,
        season_number   INT NOT NULL,
        set1_player_id  INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        set2_player_id  INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        duo_name        TEXT NOT NULL,
        created_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    await query(`
      CREATE TABLE IF NOT EXISTS duo_groups (
        id            SERIAL PRIMARY KEY,
        season_number INT NOT NULL,
        name          TEXT NOT NULL,
        status        TEXT NOT NULL DEFAULT 'active',
        created_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    await query(`
      CREATE TABLE IF NOT EXISTS duo_group_members (
        id           SERIAL PRIMARY KEY,
        group_id     INT NOT NULL REFERENCES duo_groups(id) ON DELETE CASCADE,
        duo_pair_id  INT NOT NULL REFERENCES duo_pairs(id) ON DELETE CASCADE,
        played INT DEFAULT 0, won INT DEFAULT 0, drawn INT DEFAULT 0,
        lost INT DEFAULT 0, gf INT DEFAULT 0, ga INT DEFAULT 0, points INT DEFAULT 0
      )
    `)
    await query(`
      CREATE TABLE IF NOT EXISTS duo_fixtures (
        id                    SERIAL PRIMARY KEY,
        group_id              INT REFERENCES duo_groups(id) ON DELETE CASCADE,
        home_pair_id          INT NOT NULL REFERENCES duo_pairs(id) ON DELETE CASCADE,
        away_pair_id          INT NOT NULL REFERENCES duo_pairs(id) ON DELETE CASCADE,
        round_number          INT,
        match_number          INT,
        knockout_round        TEXT,
        status                TEXT NOT NULL DEFAULT 'pending',
        set1_home_score       INT,
        set1_away_score       INT,
        set2_home_score       INT,
        set2_away_score       INT,
        set1_match_record_id  INT REFERENCES match_records(id) ON DELETE SET NULL,
        set2_match_record_id  INT REFERENCES match_records(id) ON DELETE SET NULL,
        winner_pair_id        INT REFERENCES duo_pairs(id) ON DELETE SET NULL,
        created_at            TIMESTAMPTZ DEFAULT NOW()
      )
    `)
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
    await query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS trophy12_count INT DEFAULT 0`)
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
        p.trophy12_count AS "trophy12Count",
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
  // Decider match columns for 1-1 knockout ties
  try {
    await query(`ALTER TABLE duo_fixtures ADD COLUMN IF NOT EXISTS decider_home_player_id INT REFERENCES players(id)`)
    await query(`ALTER TABLE duo_fixtures ADD COLUMN IF NOT EXISTS decider_away_player_id INT REFERENCES players(id)`)
    await query(`ALTER TABLE duo_fixtures ADD COLUMN IF NOT EXISTS decider_home_score INT`)
    await query(`ALTER TABLE duo_fixtures ADD COLUMN IF NOT EXISTS decider_away_score INT`)
    await query(`ALTER TABLE duo_fixtures ADD COLUMN IF NOT EXISTS decider_match_record_id INT REFERENCES match_records(id)`)
  } catch (e) { console.error('[duo] decider migration:', e.message) }
})()

const GROUP_NAMES  = ["Group A","Group B","Group C","Group D","Group E","Group F","Group G","Group H"]

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
        p1s1.id AS "homeSet1Id", p1s1.name AS "homeSet1Name",
        p1s1.avatar_id AS "homeSet1AvatarId", p1s1.avatar_url AS "homeSet1AvatarUrl", p1s1.avatar_bg_url AS "homeSet1AvatarBg",
        p1s2.id AS "homeSet2Id", p1s2.name AS "homeSet2Name",
        p1s2.avatar_id AS "homeSet2AvatarId", p1s2.avatar_url AS "homeSet2AvatarUrl", p1s2.avatar_bg_url AS "homeSet2AvatarBg",
        p2s1.id AS "awaySet1Id", p2s1.name AS "awaySet1Name",
        p2s1.avatar_id AS "awaySet1AvatarId", p2s1.avatar_url AS "awaySet1AvatarUrl", p2s1.avatar_bg_url AS "awaySet1AvatarBg",
        p2s2.id AS "awaySet2Id", p2s2.name AS "awaySet2Name",
        p2s2.avatar_id AS "awaySet2AvatarId", p2s2.avatar_url AS "awaySet2AvatarUrl", p2s2.avatar_bg_url AS "awaySet2AvatarBg",
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
        p.avatar_id  AS "avatarId",
        p.avatar_url AS "avatarUrl",
        COALESCE(SUM(mr.player_score), 0)::int AS goals
      FROM players p
      JOIN match_records mr ON mr.player_id = p.id
      WHERE mr.match_type = 'duo'
        AND mr.season_number = $1
      GROUP BY p.id, p.name, p.grade, p.avatar_id, p.avatar_url
      ORDER BY goals DESC, p.name ASC
      LIMIT 10
    `, [seasonNum]).catch(() => ({ rows: [] }))

    // Find champion pair from completed final
    const finalFixture = fixtures.rows.find(f => f.knockout_round === 'final' && f.status === 'completed' && f.winner_pair_id)
    let champion = null
    if (finalFixture) {
      const isHomeWinner = finalFixture.winner_pair_id === finalFixture.home_pair_id
      champion = {
        set1Name:       isHomeWinner ? finalFixture.homeSet1Name : finalFixture.awaySet1Name,
        set2Name:       isHomeWinner ? finalFixture.homeSet2Name : finalFixture.awaySet2Name,
        set1Id:         isHomeWinner ? finalFixture.homeSet1Id   : finalFixture.awaySet1Id,
        set2Id:         isHomeWinner ? finalFixture.homeSet2Id   : finalFixture.awaySet2Id,
        set1AvatarId:   isHomeWinner ? finalFixture.homeSet1AvatarId  : finalFixture.awaySet1AvatarId,
        set1AvatarUrl:  isHomeWinner ? finalFixture.homeSet1AvatarUrl : finalFixture.awaySet1AvatarUrl,
        set1AvatarBg:   isHomeWinner ? finalFixture.homeSet1AvatarBg  : finalFixture.awaySet1AvatarBg,
        set2AvatarId:   isHomeWinner ? finalFixture.homeSet2AvatarId  : finalFixture.awaySet2AvatarId,
        set2AvatarUrl:  isHomeWinner ? finalFixture.homeSet2AvatarUrl : finalFixture.awaySet2AvatarUrl,
        set2AvatarBg:   isHomeWinner ? finalFixture.homeSet2AvatarBg  : finalFixture.awaySet2AvatarBg,
        duoName:        isHomeWinner ? finalFixture.homeDuoName        : finalFixture.awayDuoName,
      }
    }

    res.json({
      seasonNumber: seasonNum,
      groups: groups.rows,
      fixtures: fixtures.rows,
      topScorers: topScorers.rows,
      champion,
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

    // Set wins: who won each set individually
    const homeSets = (set1HomeScore > set1AwayScore ? 1 : 0) + (set2HomeScore > set2AwayScore ? 1 : 0)
    const awaySets = (set1AwayScore > set1HomeScore ? 1 : 0) + (set2AwayScore > set2HomeScore ? 1 : 0)

    let winnerPairId = null
    let needsDecider = false

    if (fix.knockout_round) {
      // Knockout tiebreaker chain: sets → aggregate → decider
      if (homeSets > awaySets)       winnerPairId = fix.home_pair_id
      else if (awaySets > homeSets)  winnerPairId = fix.away_pair_id
      else if (homeAgg > awayAgg)    winnerPairId = fix.home_pair_id
      else if (awayAgg > homeAgg)    winnerPairId = fix.away_pair_id
      else                           needsDecider = true
    } else {
      // Group stage: set wins determine result; draw (1-1) is allowed
      if (homeSets > awaySets)      winnerPairId = fix.home_pair_id
      else if (awaySets > homeSets) winnerPairId = fix.away_pair_id
    }

    await withTransaction(async ({ query: q }) => {
      // Get pair players + their grades
      const homePair = (await q("SELECT * FROM duo_pairs WHERE id = $1", [fix.home_pair_id])).rows[0]
      const awayPair = (await q("SELECT * FROM duo_pairs WHERE id = $1", [fix.away_pair_id])).rows[0]

      const allPlayerIds = [
        homePair.set1_player_id, homePair.set2_player_id,
        awayPair.set1_player_id, awayPair.set2_player_id
      ].filter(Boolean)
      const gradesRes = await q(
        "SELECT id, grade FROM players WHERE id = ANY($1::int[])",
        [allPlayerIds]
      )
      const gradeMap = Object.fromEntries(gradesRes.rows.map(p => [p.id, p.grade]))

      // Create/update match records for Set1 players
      let set1RecordId = fix.set1_match_record_id
      if (set1RecordId) {
        await q("DELETE FROM match_records WHERE id = $1", [set1RecordId])
      }
      const result1 = set1HomeScore > set1AwayScore ? "win" : set1HomeScore < set1AwayScore ? "loss" : "draw"
      const s1r = await q(`
        INSERT INTO match_records (player_id, opponent_id, result, player_score, opponent_score, match_type, season_number, opponent_grade)
        VALUES ($1,$2,$3,$4,$5,'duo',$6,$7) RETURNING id`,
        [homePair.set1_player_id, awayPair.set1_player_id, result1, set1HomeScore, set1AwayScore,
         homePair.season_number, gradeMap[awayPair.set1_player_id] || "C"]
      )
      set1RecordId = s1r.rows[0].id

      // Create/update match records for Set2 players
      let set2RecordId = fix.set2_match_record_id
      if (set2RecordId) {
        await q("DELETE FROM match_records WHERE id = $1", [set2RecordId])
      }
      const result2 = set2HomeScore > set2AwayScore ? "win" : set2HomeScore < set2AwayScore ? "loss" : "draw"
      const s2r = await q(`
        INSERT INTO match_records (player_id, opponent_id, result, player_score, opponent_score, match_type, season_number, opponent_grade)
        VALUES ($1,$2,$3,$4,$5,'duo',$6,$7) RETURNING id`,
        [homePair.set2_player_id, awayPair.set2_player_id, result2, set2HomeScore, set2AwayScore,
         homePair.season_number, gradeMap[awayPair.set2_player_id] || "C"]
      )
      set2RecordId = s2r.rows[0].id

      // Update fixture scores
      await q(`
        UPDATE duo_fixtures SET
          set1_home_score = $1, set1_away_score = $2,
          set2_home_score = $3, set2_away_score = $4,
          set1_match_record_id = $5, set2_match_record_id = $6,
          winner_pair_id = $7, status = $8
        WHERE id = $9`,
        [set1HomeScore, set1AwayScore, set2HomeScore, set2AwayScore,
         set1RecordId, set2RecordId, winnerPairId,
         needsDecider ? 'needs_decider' : 'completed',
         fix.id]
      )

      // Update group standings if group fixture (result based on set wins)
      if (fix.group_id) {
        const homeResult = homeSets > awaySets ? "win" : homeSets < awaySets ? "loss" : "draw"
        const awayResult = homeResult === "win" ? "loss" : homeResult === "loss" ? "win" : "draw"

        // If fixture was already completed, REVERSE the old standings first to prevent double-counting
        if (fix.status === 'completed' || fix.status === 'needs_decider') {
          const oldHomeSets = ((fix.set1_home_score > fix.set1_away_score ? 1 : 0) +
                               (fix.set2_home_score > fix.set2_away_score ? 1 : 0))
          const oldAwaySets = ((fix.set1_away_score > fix.set1_home_score ? 1 : 0) +
                               (fix.set2_away_score > fix.set2_home_score ? 1 : 0))
          const oldHomeAgg  = (fix.set1_home_score || 0) + (fix.set2_home_score || 0)
          const oldAwayAgg  = (fix.set1_away_score || 0) + (fix.set2_away_score || 0)
          const oldHomeResult = oldHomeSets > oldAwaySets ? "win" : oldHomeSets < oldAwaySets ? "loss" : "draw"
          const oldAwayResult = oldHomeResult === "win" ? "loss" : oldHomeResult === "loss" ? "win" : "draw"

          const reverseStandings = async (pairId, result, gf, ga) => {
            await q(`
              UPDATE duo_group_members SET
                played = GREATEST(played - 1, 0),
                won    = GREATEST(won    - $2::int, 0),
                drawn  = GREATEST(drawn  - $3::int, 0),
                lost   = GREATEST(lost   - $4::int, 0),
                gf     = GREATEST(gf     - $5, 0),
                ga     = GREATEST(ga     - $6, 0),
                points = GREATEST(points - $7, 0)
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

          await reverseStandings(fix.home_pair_id, oldHomeResult, oldHomeAgg, oldAwayAgg)
          await reverseStandings(fix.away_pair_id, oldAwayResult, oldAwayAgg, oldHomeAgg)
        }

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

      // ── Duo knockout tournament history ──────────────────────────────────────
      if (fix.knockout_round && winnerPairId && !needsDecider) {
        try {
          const loserKoPairId = winnerPairId === fix.home_pair_id ? fix.away_pair_id : fix.home_pair_id
          const loserKoPair   = await q("SELECT set1_player_id, set2_player_id FROM duo_pairs WHERE id = $1", [loserKoPairId])
          const lp = loserKoPair.rows[0]
          if (lp) {
            for (const pid of [lp.set1_player_id, lp.set2_player_id].filter(Boolean)) {
              await incrementHistory(pid, "duo", "knockout", fix.knockout_round).catch(() => {})
            }
          }
          if (fix.knockout_round === "final") {
            const winnerKoPair = await q("SELECT set1_player_id, set2_player_id FROM duo_pairs WHERE id = $1", [winnerPairId])
            const wp = winnerKoPair.rows[0]
            if (wp) {
              for (const pid of [wp.set1_player_id, wp.set2_player_id].filter(Boolean)) {
                await incrementHistory(pid, "duo", "knockout", "winner").catch(() => {})
              }
            }
          }
        } catch (e) { console.error("[duo] ko history:", e.message) }
      }

      // ── BDR for knockout rounds ───────────────────────────────────────────
      // Only award when this is a knockout match and a winner is known (not needs_decider)
      if (fix.knockout_round && winnerPairId && !needsDecider) {
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

          // Store completion timestamp in app_settings for celebration window
          await query(`
            INSERT INTO app_settings (key, value) VALUES ($1, $2)
            ON CONFLICT (key) DO UPDATE SET value = $2
          `, [`duo_champion_completed_at_${seasonNum}`, new Date().toISOString()])

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
            await addBdr(topScorer.player_id, 3)
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

    // ── Record group stage positions in tournament history ───────────────────
    // All pairs and their final group rankings are known at this point
    try {
      for (const row of standings.rows) {
        const pairRes = await query("SELECT set1_player_id, set2_player_id FROM duo_pairs WHERE id = $1", [row.duoPairId])
        const pair = pairRes.rows[0]
        if (pair) {
          for (const pid of [pair.set1_player_id, pair.set2_player_id].filter(Boolean)) {
            await incrementHistory(pid, "duo", "group", String(parseInt(row.rnk)))
          }
        }
      }
    } catch (e) { console.error("[duo] group history:", e.message) }

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

// ── PATCH /api/duo/pairs/:id — replace set1 or set2 player in a pair ──────────
// When a player is swapped, any existing fixture scores involving this pair are
// reset to pending (match records deleted) so results reflect the new player.
router.patch("/pairs/:id", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { set1PlayerId, set2PlayerId } = z.object({
      set1PlayerId: z.number().int().positive().optional(),
      set2PlayerId: z.number().int().positive().optional(),
    }).parse(req.body)

    if (!set1PlayerId && !set2PlayerId) {
      return res.status(400).json({ error: "Provide set1PlayerId or set2PlayerId to update" })
    }

    const pairRes = await query("SELECT * FROM duo_pairs WHERE id = $1", [req.params.id])
    const pair = pairRes.rows[0]
    if (!pair) return res.status(404).json({ error: "Pair not found" })

    const newSet1Id = set1PlayerId ?? pair.set1_player_id
    const newSet2Id = set2PlayerId ?? pair.set2_player_id

    if (newSet1Id === newSet2Id) {
      return res.status(400).json({ error: "Set 1 and Set 2 players must be different" })
    }

    // Build new duo_name from first names
    const namesRes = await query(
      "SELECT id, name FROM players WHERE id = ANY($1::int[])",
      [[newSet1Id, newSet2Id]]
    )
    const nameMap = Object.fromEntries(namesRes.rows.map(p => [p.id, p.name]))
    const duoName = `${nameMap[newSet1Id]?.split(" ")[0]} & ${nameMap[newSet2Id]?.split(" ")[0]}`

    await withTransaction(async ({ query: q }) => {
      // Update the pair
      await q(`
        UPDATE duo_pairs SET set1_player_id = $1, set2_player_id = $2, duo_name = $3 WHERE id = $4
      `, [newSet1Id, newSet2Id, duoName, req.params.id])

      // Find all fixtures involving this pair and reset any that have scores
      const fixtures = await q(`
        SELECT id, group_id, home_pair_id, away_pair_id,
               set1_match_record_id, set2_match_record_id,
               set1_home_score, set1_away_score,
               set2_home_score, set2_away_score,
               winner_pair_id
        FROM duo_fixtures
        WHERE (home_pair_id = $1 OR away_pair_id = $1)
          AND status IN ('completed', 'needs_decider')
      `, [pair.id])

      for (const fix of fixtures.rows) {
        // Delete match records so MV/form are recalculated without the old result
        if (fix.set1_match_record_id) {
          await q("DELETE FROM match_records WHERE id = $1", [fix.set1_match_record_id])
        }
        if (fix.set2_match_record_id) {
          await q("DELETE FROM match_records WHERE id = $1", [fix.set2_match_record_id])
        }

        // Reverse the OPPONENT pair's group standings for this specific fixture
        // so both sides of the match are consistent after the reset
        if (fix.group_id) {
          const oppPairId = fix.home_pair_id === pair.id ? fix.away_pair_id : fix.home_pair_id
          const isHome    = fix.home_pair_id === pair.id

          const homeAgg = (fix.set1_home_score ?? 0) + (fix.set2_home_score ?? 0)
          const awayAgg = (fix.set1_away_score ?? 0) + (fix.set2_away_score ?? 0)
          const homeSets = ((fix.set1_home_score > fix.set1_away_score ? 1 : 0) +
                            (fix.set2_home_score > fix.set2_away_score ? 1 : 0))
          const awaySets = ((fix.set1_away_score > fix.set1_home_score ? 1 : 0) +
                            (fix.set2_away_score > fix.set2_home_score ? 1 : 0))

          // Determine opponent's result from their perspective
          const oppResult = isHome
            ? (awaySets > homeSets ? "win" : awaySets < homeSets ? "loss" : "draw")
            : (homeSets > awaySets ? "win" : homeSets < awaySets ? "loss" : "draw")
          const oppGf = isHome ? awayAgg : homeAgg
          const oppGa = isHome ? homeAgg : awayAgg

          await q(`
            UPDATE duo_group_members SET
              played = GREATEST(played - 1, 0),
              won    = GREATEST(won    - $1, 0),
              drawn  = GREATEST(drawn  - $2, 0),
              lost   = GREATEST(lost   - $3, 0),
              gf     = GREATEST(gf     - $4, 0),
              ga     = GREATEST(ga     - $5, 0),
              points = GREATEST(points - $6, 0)
            WHERE group_id = $7 AND duo_pair_id = $8
          `, [
            oppResult === "win"  ? 1 : 0,
            oppResult === "draw" ? 1 : 0,
            oppResult === "loss" ? 1 : 0,
            oppGf, oppGa,
            oppResult === "win" ? 3 : oppResult === "draw" ? 1 : 0,
            fix.group_id, oppPairId
          ])
        }

        // Reset fixture back to pending, clear scores
        await q(`
          UPDATE duo_fixtures SET
            set1_home_score = NULL, set1_away_score = NULL,
            set2_home_score = NULL, set2_away_score = NULL,
            set1_match_record_id = NULL, set2_match_record_id = NULL,
            winner_pair_id = NULL, status = 'pending'
          WHERE id = $1
        `, [fix.id])
      }

      // Reset the edited pair's own standings to 0
      if (fixtures.rows.length > 0) {
        await q(`
          UPDATE duo_group_members SET
            played = 0, won = 0, drawn = 0, lost = 0, gf = 0, ga = 0, points = 0
          WHERE duo_pair_id = $1
        `, [pair.id])
      }
    })

    // Recalc MV/form for all 4 affected players
    const allPlayerIds = [pair.set1_player_id, pair.set2_player_id, newSet1Id, newSet2Id]
    for (const pid of [...new Set(allPlayerIds)]) {
      await recalcMarketValue(pid)
      await recalcForm(pid)
    }

    const fresh = await query(`
      SELECT dp.id, dp.duo_name AS "duoName",
        p1.id AS "set1Id", p1.name AS "set1Name", p1.grade AS "set1Grade",
        p2.id AS "set2Id", p2.name AS "set2Name", p2.grade AS "set2Grade"
      FROM duo_pairs dp
      JOIN players p1 ON p1.id = dp.set1_player_id
      JOIN players p2 ON p2.id = dp.set2_player_id
      WHERE dp.id = $1
    `, [req.params.id])

    res.json(fresh.rows[0])
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

// ── POST /api/duo/fixtures/:id/decider/setup ─────────────────────────────────
// Admin picks one player from each pair to play the decider 1v1.
// Only allowed when fixture status = 'needs_decider'.
router.post("/fixtures/:id/decider/setup", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { homePlayerId, awayPlayerId } = z.object({
      homePlayerId: z.number().int().positive(),
      awayPlayerId: z.number().int().positive(),
    }).parse(req.body)

    const fixRes = await query("SELECT * FROM duo_fixtures WHERE id = $1", [req.params.id])
    const fix = fixRes.rows[0]
    if (!fix) return res.status(404).json({ error: "Fixture not found" })
    if (fix.status !== "needs_decider") {
      return res.status(400).json({ error: "Fixture does not need a decider — only allowed when 1-1 with equal aggregate" })
    }

    // Validate players belong to their respective pairs
    const homePair = (await query("SELECT * FROM duo_pairs WHERE id = $1", [fix.home_pair_id])).rows[0]
    const awayPair = (await query("SELECT * FROM duo_pairs WHERE id = $1", [fix.away_pair_id])).rows[0]

    const homeValid = homePlayerId === homePair.set1_player_id || homePlayerId === homePair.set2_player_id
    const awayValid = awayPlayerId === awayPair.set1_player_id || awayPlayerId === awayPair.set2_player_id

    if (!homeValid) return res.status(400).json({ error: "Home player must be from the home pair" })
    if (!awayValid) return res.status(400).json({ error: "Away player must be from the away pair" })

    await query(`
      UPDATE duo_fixtures
      SET decider_home_player_id = $1, decider_away_player_id = $2
      WHERE id = $3
    `, [homePlayerId, awayPlayerId, req.params.id])

    res.json({ success: true })
  } catch (err) { next(err) }
})

// ── POST /api/duo/fixtures/:id/decider/result ─────────────────────────────────
// Admin enters the decider 1v1 score. Must have a winner (no draw).
// Determines the pair winner, advances them in the bracket, awards BDR/trophies.
router.post("/fixtures/:id/decider/result", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { homeScore, awayScore } = z.object({
      homeScore: z.number().int().min(0),
      awayScore: z.number().int().min(0),
    }).parse(req.body)

    if (homeScore === awayScore) {
      return res.status(400).json({ error: "Decider must have a winner — scores cannot be equal" })
    }

    const fixRes = await query("SELECT * FROM duo_fixtures WHERE id = $1", [req.params.id])
    const fix = fixRes.rows[0]
    if (!fix) return res.status(404).json({ error: "Fixture not found" })
    if (fix.status !== "needs_decider") {
      return res.status(400).json({ error: "Fixture is not awaiting a decider" })
    }
    if (!fix.decider_home_player_id || !fix.decider_away_player_id) {
      return res.status(400).json({ error: "Set up decider players first via /decider/setup" })
    }

    const winnerPairId = homeScore > awayScore ? fix.home_pair_id : fix.away_pair_id
    const loserPairId  = winnerPairId === fix.home_pair_id ? fix.away_pair_id : fix.home_pair_id

    await withTransaction(async ({ query: q }) => {
      const homePair = (await q("SELECT * FROM duo_pairs WHERE id = $1", [fix.home_pair_id])).rows[0]
      const awayPair = (await q("SELECT * FROM duo_pairs WHERE id = $1", [fix.away_pair_id])).rows[0]

      // Delete old decider match record if re-entering
      if (fix.decider_match_record_id) {
        await q("DELETE FROM match_records WHERE id = $1", [fix.decider_match_record_id])
      }

      // Create match record for the decider players
      const deciderResult = homeScore > awayScore ? "win" : "loss"
      const deciderHomeGrade = (await q("SELECT grade FROM players WHERE id = $1", [fix.decider_home_player_id])).rows[0]?.grade || "C"
      const deciderAwayGrade = (await q("SELECT grade FROM players WHERE id = $1", [fix.decider_away_player_id])).rows[0]?.grade || "C"
      const mrRes = await q(`
        INSERT INTO match_records
          (player_id, opponent_id, result, player_score, opponent_score, match_type, season_number, opponent_grade)
        VALUES ($1, $2, $3, $4, $5, 'duo', $6, $7) RETURNING id
      `, [fix.decider_home_player_id, fix.decider_away_player_id,
          deciderResult, homeScore, awayScore, homePair.season_number, deciderAwayGrade])

      // Mark fixture completed with winner
      await q(`
        UPDATE duo_fixtures SET
          decider_home_score = $1, decider_away_score = $2,
          decider_match_record_id = $3,
          winner_pair_id = $4, status = 'completed'
        WHERE id = $5
      `, [homeScore, awayScore, mrRes.rows[0].id, winnerPairId, fix.id])

      // Recalc MV + form for decider players
      await recalcMarketValue(fix.decider_home_player_id)
      await recalcMarketValue(fix.decider_away_player_id)
      await recalcForm(fix.decider_home_player_id)
      await recalcForm(fix.decider_away_player_id)

      // BDR awards
      const winnerPair = winnerPairId === fix.home_pair_id ? homePair : awayPair
      const loserPair  = loserPairId  === fix.home_pair_id ? homePair : awayPair
      const LOSER_BDR  = { qf: 4, sf: 6, final: 8 }
      const WINNER_BDR = { final: 10 }
      const loserBdr   = LOSER_BDR[fix.knockout_round]
      const winnerBdr  = WINNER_BDR[fix.knockout_round]
      if (loserBdr) {
        await addBdr(loserPair.set1_player_id, loserBdr)
        await addBdr(loserPair.set2_player_id, loserBdr)
      }
      if (winnerBdr) {
        await addBdr(winnerPair.set1_player_id, winnerBdr)
        await addBdr(winnerPair.set2_player_id, winnerBdr)
      }

      // Advance winner in bracket
      if (fix.knockout_round && fix.knockout_round !== "final") {
        const NEXT_ROUND = { r16: "qf", qf: "sf", sf: "final" }
        const nextRound  = NEXT_ROUND[fix.knockout_round]
        if (nextRound) {
          const col = fix.match_number % 2 !== 0 ? "home_pair_id" : "away_pair_id"
          await q(`
            UPDATE duo_fixtures SET ${col} = $1
            WHERE knockout_round = $2
            AND home_pair_id IN (SELECT id FROM duo_pairs WHERE season_number = $3)
            AND match_number = $4
          `, [winnerPairId, nextRound, homePair.season_number, Math.ceil(fix.match_number / 2)])
        }
      }

      // Final: trophies + golden boot
      if (fix.knockout_round === "final") {
        const seasonNum = homePair.season_number
        await reconcileTrophyRoster({
          sourceKey:    `duo_champion_s${seasonNum}`,
          trophyColumn: "trophy10_count",
          playerIds:    [winnerPair.set1_player_id, winnerPair.set2_player_id].filter(Boolean),
          seasonNumber: seasonNum,
        })
        const duoWinnerNamesRes = await query(
          "SELECT name FROM players WHERE id = ANY($1::int[])",
          [[winnerPair.set1_player_id, winnerPair.set2_player_id].filter(Boolean)]
        )
        await updateSeasonRecord(seasonNum, { duo_winner: duoWinnerNamesRes.rows.map(r => r.name).join(" & ") })
        await query(`
          INSERT INTO app_settings (key, value) VALUES ($1, $2)
          ON CONFLICT (key) DO UPDATE SET value = $2
        `, [`duo_champion_completed_at_${seasonNum}`, new Date().toISOString()])

        const gbRes = await q(`
          SELECT mr.player_id, SUM(mr.player_score) AS goals
          FROM match_records mr
          WHERE mr.match_type = 'duo' AND mr.season_number = $1
          GROUP BY mr.player_id ORDER BY goals DESC LIMIT 1
        `, [seasonNum])
        const topScorer = gbRes.rows[0]
        if (topScorer?.goals > 0) {
          await addBdr(topScorer.player_id, 3)
          await awardOrReassignTrophy({
            sourceKey:    `duo_golden_boot_s${seasonNum}`,
            trophyColumn: "trophy11_count",
            playerId:     topScorer.player_id,
            seasonNumber: seasonNum,
          })
        }
      }
    })

    res.json({ success: true, winnerPairId })
  } catch (err) { next(err) }
})


export default router