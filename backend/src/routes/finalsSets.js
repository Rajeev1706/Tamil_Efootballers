// routes/finalsSets.js
// Set-based finals format for qualifier2, final (team_league_playoffs)
// and champions_final, europa_final (team_knockout_matches)
import { Router } from "express"
import { query }  from "../db/pool.js"
import { authenticate, adminOnly } from "../middleware/auth.js"

const router = Router()

// ── Migrations (run on startup) ───────────────────────────────────────────────
;(async () => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS finals_set_config (
        id              SERIAL PRIMARY KEY,
        match_id        INT  NOT NULL,
        match_source    TEXT NOT NULL CHECK (match_source IN ('team_league_playoffs','team_knockout_matches')),
        num_sets        INT  NOT NULL DEFAULT 3,
        season_number   INT  NOT NULL,
        status          TEXT NOT NULL DEFAULT 'setup'
                         CHECK (status IN ('setup','drawn','in_progress','completed')),
        winner_team_id  INT  REFERENCES teams(id) ON DELETE SET NULL,
        created_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    await query(`
      CREATE TABLE IF NOT EXISTS finals_sets (
        id          SERIAL PRIMARY KEY,
        config_id   INT  NOT NULL REFERENCES finals_set_config(id) ON DELETE CASCADE,
        set_number  INT  NOT NULL,
        set_size    INT  NOT NULL DEFAULT 3,
        status      TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','drawn','completed')),
        UNIQUE(config_id, set_number)
      )
    `)
    await query(`
      CREATE TABLE IF NOT EXISTS finals_set_players (
        id        SERIAL PRIMARY KEY,
        set_id    INT NOT NULL REFERENCES finals_sets(id) ON DELETE CASCADE,
        team_id   INT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        player_id INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        UNIQUE(set_id, player_id)
      )
    `)
    await query(`
      CREATE TABLE IF NOT EXISTS finals_set_matchups (
        id               SERIAL PRIMARY KEY,
        set_id           INT NOT NULL REFERENCES finals_sets(id) ON DELETE CASCADE,
        team1_player_id  INT NOT NULL REFERENCES players(id),
        team2_player_id  INT NOT NULL REFERENCES players(id),
        team1_score      INT,
        team2_score      INT,
        winner_player_id INT REFERENCES players(id),
        status           TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','completed'))
      )
    `)
    console.log("[finals-sets] tables ready")
  } catch (e) {
    console.error("[finals-sets] migration error:", e.message)
  }
})()

// ── Helpers ───────────────────────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

async function buildFullConfig(configId) {
  const cfg = (await query("SELECT * FROM finals_set_config WHERE id=$1", [configId])).rows[0]
  if (!cfg) return null

  const sets = (await query(
    "SELECT * FROM finals_sets WHERE config_id=$1 ORDER BY set_number",
    [configId]
  )).rows

  for (const set of sets) {
    // players
    const players = (await query(`
      SELECT fsp.*, p.name AS player_name, t.name AS team_name, t.logo_url AS team_logo
      FROM finals_set_players fsp
      JOIN players p ON p.id = fsp.player_id
      JOIN teams   t ON t.id = fsp.team_id
      WHERE fsp.set_id = $1
      ORDER BY fsp.team_id, p.name
    `, [set.id])).rows
    set.players = players

    // matchups
    const matchups = (await query(`
      SELECT m.*,
        p1.name AS team1_player_name, p2.name AS team2_player_name,
        pw.name AS winner_name
      FROM finals_set_matchups m
      JOIN players p1 ON p1.id = m.team1_player_id
      JOIN players p2 ON p2.id = m.team2_player_id
      LEFT JOIN players pw ON pw.id = m.winner_player_id
      WHERE m.set_id = $1
      ORDER BY m.id
    `, [set.id])).rows
    set.matchups = matchups
  }

  cfg.sets = sets
  return cfg
}

// ── GET /api/finals-sets/match-lookup  — find match row by type + season ─────
router.get("/match-lookup", async (req, res, next) => {
  try {
    const { source, matchType, season } = req.query
    if (!source || !matchType || !season) {
      return res.status(400).json({ error: "source, matchType, season required" })
    }
    if (!["team_league_playoffs", "team_knockout_matches"].includes(source)) {
      return res.status(400).json({ error: "Invalid source" })
    }

    let matchRow
    if (source === "team_league_playoffs") {
      const r = await query(`
        SELECT p.*, t1.name AS team1_name, t2.name AS team2_name
        FROM team_league_playoffs p
        JOIN teams t1 ON t1.id = p.team1_id
        JOIN teams t2 ON t2.id = p.team2_id
        WHERE p.match_type=$1 AND p.season_number=$2
        LIMIT 1
      `, [matchType, Number(season)])
      matchRow = r.rows[0]
    } else {
      const r = await query(`
        SELECT p.*, t1.name AS team1_name, t2.name AS team2_name
        FROM team_knockout_matches p
        JOIN teams t1 ON t1.id = p.team1_id
        JOIN teams t2 ON t2.id = p.team2_id
        WHERE p.match_type=$1 AND p.season_number=$2
        LIMIT 1
      `, [matchType, Number(season)])
      matchRow = r.rows[0]
    }

    res.json({ match: matchRow || null })
  } catch (err) { next(err) }
})

// ── GET /api/finals-sets/match/:matchId  — fetch config for a match ──────────
router.get("/match/:matchId", async (req, res, next) => {
  try {
    const { matchId } = req.params
    const { source } = req.query  // 'team_league_playoffs' | 'team_knockout_matches'

    let cfgQuery = "SELECT id FROM finals_set_config WHERE match_id=$1"
    const params = [matchId]
    if (source) { cfgQuery += " AND match_source=$2"; params.push(source) }
    cfgQuery += " ORDER BY id DESC LIMIT 1"

    const cfgRow = (await query(cfgQuery, params)).rows[0]
    if (!cfgRow) return res.json({ config: null })

    const config = await buildFullConfig(cfgRow.id)
    res.json({ config })
  } catch (err) { next(err) }
})

// ── GET /api/finals-sets/:configId  — fetch by config id ─────────────────────
router.get("/:configId", async (req, res, next) => {
  try {
    const config = await buildFullConfig(req.params.configId)
    if (!config) return res.status(404).json({ error: "Config not found" })
    res.json({ config })
  } catch (err) { next(err) }
})

// ── POST /api/finals-sets/create  — admin creates config ─────────────────────
router.post("/create", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { matchId, matchSource, numSets, sets, seasonNumber } = req.body
    // sets: [{ setSize: 3 }, { setSize: 3 }, { setSize: 3 }]

    if (!matchId || !matchSource || !numSets || !sets || !seasonNumber) {
      return res.status(400).json({ error: "matchId, matchSource, numSets, sets, seasonNumber required" })
    }
    if (!["team_league_playoffs", "team_knockout_matches"].includes(matchSource)) {
      return res.status(400).json({ error: "Invalid matchSource" })
    }

    // Delete existing config for this match if any
    await query(
      "DELETE FROM finals_set_config WHERE match_id=$1 AND match_source=$2",
      [matchId, matchSource]
    )

    // Create config
    const cfg = (await query(`
      INSERT INTO finals_set_config (match_id, match_source, num_sets, season_number)
      VALUES ($1,$2,$3,$4) RETURNING *
    `, [matchId, matchSource, numSets, seasonNumber])).rows[0]

    // Create set rows
    for (let i = 0; i < sets.length; i++) {
      await query(
        "INSERT INTO finals_sets (config_id, set_number, set_size) VALUES ($1,$2,$3)",
        [cfg.id, i + 1, sets[i].setSize]
      )
    }

    const config = await buildFullConfig(cfg.id)
    res.status(201).json({ config })
  } catch (err) { next(err) }
})

// ── POST /api/finals-sets/:configId/players  — admin assigns players to sets ─
router.post("/:configId/players", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { configId } = req.params
    // setsPlayers: [{ setId, team1Players: [playerId,...], team2Players: [playerId,...] }]
    const { setsPlayers } = req.body

    if (!setsPlayers || !Array.isArray(setsPlayers)) {
      return res.status(400).json({ error: "setsPlayers array required" })
    }

    // Validate no player appears in multiple sets
    const allPlayerIds = setsPlayers.flatMap(s => [...s.team1Players, ...s.team2Players])
    if (new Set(allPlayerIds).size !== allPlayerIds.length) {
      return res.status(400).json({ error: "A player can only appear in one set" })
    }

    // Clear existing players for this config
    const setIds = (await query(
      "SELECT id FROM finals_sets WHERE config_id=$1", [configId]
    )).rows.map(r => r.id)

    if (setIds.length > 0) {
      await query(
        `DELETE FROM finals_set_players WHERE set_id = ANY($1)`,
        [setIds]
      )
    }

    // Insert players
    for (const sp of setsPlayers) {
      const { setId, team1Id, team2Id, team1Players, team2Players } = sp
      for (const pid of team1Players) {
        await query(
          "INSERT INTO finals_set_players (set_id, team_id, player_id) VALUES ($1,$2,$3)",
          [setId, team1Id, pid]
        )
      }
      for (const pid of team2Players) {
        await query(
          "INSERT INTO finals_set_players (set_id, team_id, player_id) VALUES ($1,$2,$3)",
          [setId, team2Id, pid]
        )
      }
    }

    const config = await buildFullConfig(configId)
    res.json({ config })
  } catch (err) { next(err) }
})

// ── POST /api/finals-sets/:configId/set/:setId/draw  — random draw for a set ─
router.post("/:configId/set/:setId/draw", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { configId, setId } = req.params

    const cfg = (await query("SELECT * FROM finals_set_config WHERE id=$1", [configId])).rows[0]
    if (!cfg) return res.status(404).json({ error: "Config not found" })

    const set = (await query("SELECT * FROM finals_sets WHERE id=$1 AND config_id=$2", [setId, configId])).rows[0]
    if (!set) return res.status(404).json({ error: "Set not found" })

    // Get match teams
    const matchTable = cfg.match_source
    const matchRow = (await query(`SELECT team1_id, team2_id FROM ${matchTable} WHERE id=$1`, [cfg.match_id])).rows[0]
    if (!matchRow) return res.status(400).json({ error: "Match not found" })

    const team1Id = matchRow.team1_id
    const team2Id = matchRow.team2_id

    // Get players for this set split by team
    const playersRes = await query(
      "SELECT player_id, team_id FROM finals_set_players WHERE set_id=$1",
      [setId]
    )
    const team1Players = playersRes.rows.filter(r => r.team_id === team1Id).map(r => r.player_id)
    const team2Players = playersRes.rows.filter(r => r.team_id === team2Id).map(r => r.player_id)

    if (team1Players.length !== team2Players.length || team1Players.length === 0) {
      return res.status(400).json({ error: "Set must have equal players from both teams" })
    }

    // Clear existing matchups for this set
    await query("DELETE FROM finals_set_matchups WHERE set_id=$1", [setId])

    // Random draw: shuffle team2, pair with team1 in order
    const shuffledTeam2 = shuffle(team2Players)
    for (let i = 0; i < team1Players.length; i++) {
      await query(`
        INSERT INTO finals_set_matchups (set_id, team1_player_id, team2_player_id)
        VALUES ($1,$2,$3)
      `, [setId, team1Players[i], shuffledTeam2[i]])
    }

    // Update set status
    await query("UPDATE finals_sets SET status='drawn' WHERE id=$1", [setId])

    // Update config status if all sets drawn
    const pendingSets = (await query(
      "SELECT id FROM finals_sets WHERE config_id=$1 AND status='pending'", [configId]
    )).rows
    if (pendingSets.length === 0) {
      await query("UPDATE finals_set_config SET status='drawn' WHERE id=$1", [configId])
    }

    const config = await buildFullConfig(configId)
    res.json({ config })
  } catch (err) { next(err) }
})

// ── POST /api/finals-sets/:configId/set/:setId/score  — submit matchup result ─
router.post("/:configId/set/:setId/score", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { configId, setId } = req.params
    // scores: [{ matchupId, team1Score, team2Score }]
    const { scores } = req.body

    if (!scores || !Array.isArray(scores)) {
      return res.status(400).json({ error: "scores array required" })
    }

    for (const sc of scores) {
      const { matchupId, team1Score, team2Score } = sc
      const t1 = Number(team1Score)
      const t2 = Number(team2Score)

      const mu = (await query(
        "SELECT *, status AS mu_status FROM finals_set_matchups WHERE id=$1 AND set_id=$2",
        [matchupId, setId]
      )).rows[0]
      if (!mu) continue

      const wasAlreadyDone = mu.mu_status === "completed"

      let winnerPlayerId = null
      if (t1 > t2) winnerPlayerId = mu.team1_player_id
      else if (t2 > t1) winnerPlayerId = mu.team2_player_id

      await query(`
        UPDATE finals_set_matchups
        SET team1_score=$1, team2_score=$2, winner_player_id=$3, status='completed'
        WHERE id=$4
      `, [t1, t2, winnerPlayerId, matchupId])

      // Log match_records only on first completion (avoid duplicates on re-submit)
      if (!wasAlreadyDone) {
        const p1 = (await query("SELECT grade FROM players WHERE id=$1", [mu.team1_player_id])).rows[0]
        const p2 = (await query("SELECT grade FROM players WHERE id=$1", [mu.team2_player_id])).rows[0]
        if (p1 && p2) {
          const p1Result = t1 > t2 ? "win" : t1 < t2 ? "loss" : "draw"
          const p2Result = t2 > t1 ? "win" : t2 < t1 ? "loss" : "draw"
          await query(
            "INSERT INTO match_records (player_id, opponent_id, result, opponent_grade, recorded_by) VALUES ($1,$2,$3,$4,$5)",
            [mu.team1_player_id, mu.team2_player_id, p1Result, p2.grade, req.user.id]
          )
          await query(
            "INSERT INTO match_records (player_id, opponent_id, result, opponent_grade, recorded_by) VALUES ($1,$2,$3,$4,$5)",
            [mu.team2_player_id, mu.team1_player_id, p2Result, p1.grade, req.user.id]
          )
        }
      }
    }

    // Check if all matchups in set are done
    const pending = (await query(
      "SELECT id FROM finals_set_matchups WHERE set_id=$1 AND status='pending'", [setId]
    )).rows
    if (pending.length === 0) {
      await query("UPDATE finals_sets SET status='completed' WHERE id=$1", [setId])
    }

    // Check if all sets in config are done → compute winner
    const incompleteSets = (await query(
      "SELECT id FROM finals_sets WHERE config_id=$1 AND status != 'completed'", [configId]
    )).rows

    if (incompleteSets.length === 0) {
      const cfg = (await query("SELECT * FROM finals_set_config WHERE id=$1", [configId])).rows[0]
      const matchTable = cfg.match_source
      const matchRow = (await query(`SELECT team1_id, team2_id FROM ${matchTable} WHERE id=$1`, [cfg.match_id])).rows[0]

      const setIds = (await query("SELECT id FROM finals_sets WHERE config_id=$1", [configId])).rows.map(r => r.id)

      // Get all players to determine team per player
      const allPlayers = (await query(
        "SELECT player_id, team_id FROM finals_set_players WHERE set_id = ANY($1)", [setIds]
      )).rows
      const playerTeamMap = {}
      for (const p of allPlayers) playerTeamMap[p.player_id] = p.team_id

      const allMatchups = (await query(
        "SELECT * FROM finals_set_matchups WHERE set_id = ANY($1)", [setIds]
      )).rows

      let team1Wins = 0, team2Wins = 0
      for (const mu of allMatchups) {
        if (!mu.winner_player_id) continue
        const winnerTeam = playerTeamMap[mu.winner_player_id]
        if (winnerTeam === matchRow.team1_id) team1Wins++
        else if (winnerTeam === matchRow.team2_id) team2Wins++
      }

      let newStatus = "completed"
      let winnerTeamId = null
      if (team1Wins > team2Wins) winnerTeamId = matchRow.team1_id
      else if (team2Wins > team1Wins) winnerTeamId = matchRow.team2_id
      else newStatus = "needs_decision" // Tied → 5v5 tiebreaker

      await query(
        "UPDATE finals_set_config SET status=$1, winner_team_id=$2 WHERE id=$3",
        [newStatus, winnerTeamId, configId]
      )
    }

    const config = await buildFullConfig(configId)
    res.json({ config })
  } catch (err) { next(err) }
})

// ── POST /api/finals-sets/:configId/force-winner  — admin force picks winner ──
router.post("/:configId/force-winner", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { configId } = req.params
    const { winnerTeamId } = req.body
    if (!winnerTeamId) return res.status(400).json({ error: "winnerTeamId required" })

    await query(
      "UPDATE finals_set_config SET winner_team_id=$1, status='completed' WHERE id=$2",
      [winnerTeamId, configId]
    )
    const config = await buildFullConfig(configId)
    res.json({ config })
  } catch (err) { next(err) }
})

export default router