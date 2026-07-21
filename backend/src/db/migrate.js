/**
 * migrate.js  — run once to create the schema from scratch
 * Usage: npm run db:migrate
 */
import { query } from "./pool.js"

const SQL = `
-- ─────────────────────────────────────────────────────────────────────────────
-- EXTENSIONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE user_role     AS ENUM ('admin', 'team_owner');
  CREATE TYPE player_grade  AS ENUM ('S', 'A+', 'A', 'B', 'C');
  CREATE TYPE match_result  AS ENUM ('win', 'draw', 'loss');
  CREATE TYPE fixture_status AS ENUM ('upcoming', 'completed');
  CREATE TYPE trade_status  AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- TEAMS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teams (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100) UNIQUE NOT NULL,
  played     INT     DEFAULT 0,
  won        INT     DEFAULT 0,
  drawn      INT     DEFAULT 0,
  lost       INT     DEFAULT 0,
  gf         INT     DEFAULT 0,
  ga         INT     DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS gd         INT GENERATED ALWAYS AS (gf - ga) STORED,
  ADD COLUMN IF NOT EXISTS points     INT GENERATED ALWAYS AS (won * 3 + drawn) STORED,
  ADD COLUMN IF NOT EXISTS anthem_url TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- USERS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(50)  UNIQUE NOT NULL,
  email         VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          user_role    DEFAULT 'team_owner',
  team_id       INT REFERENCES teams(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- PLAYERS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS players (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  alias         VARCHAR(50),
  team_id       INT REFERENCES teams(id) ON DELETE SET NULL,
  grade         player_grade NOT NULL DEFAULT 'C',
  auction_price INT          NOT NULL DEFAULT 0,
  market_value  INT          NOT NULL DEFAULT 0,
  bdr_points    INT          NOT NULL DEFAULT 0,
  form          CHAR(1)[]    DEFAULT '{}',
  avatar_id     VARCHAR(64),
  avatar_url    TEXT,
  avatar_bg_url TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- PLAYER TROPHIES — season-scoped award log
-- ─────────────────────────────────────────────────────────────────────────────
-- One row per real-world trophy-worthy event (e.g. "UCL Knockout Tournament
-- #5's Final"), NOT per trophy count increment. source_key uniquely
-- identifies that event regardless of who wins it, which is what makes
-- corrections possible: if an admin fixes a wrong result later, the same
-- source_key gets looked up again, the previous (wrong) holder's trophy
-- count + market value get reverted, and the correct winner gets awarded
-- instead. The lifetime trophy1Count..trophy7Count columns on players stay
-- untouched by this table's existence — they're still the source of truth
-- for the Trophy Case / career display. This table exists purely so market
-- value can filter trophies down to "won in the CURRENT season only".
CREATE TABLE IF NOT EXISTS player_trophies (
  id            SERIAL PRIMARY KEY,
  player_id     INT  NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  trophy_column VARCHAR(20) NOT NULL,
  season_number INT  NOT NULL,
  source_key    TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_key, player_id)
);
CREATE INDEX IF NOT EXISTS idx_player_trophies_player ON player_trophies(player_id);
CREATE INDEX IF NOT EXISTS idx_player_trophies_season ON player_trophies(season_number);


-- ─────────────────────────────────────────────────────────────────────────────
-- MATCH RECORDS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS match_records (
  id              SERIAL PRIMARY KEY,
  player_id       INT          NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  opponent_id     INT          NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  result          match_result NOT NULL,
  opponent_grade  player_grade NOT NULL,
  recorded_at     DATE         DEFAULT CURRENT_DATE,
  recorded_by     INT REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- FIXTURES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fixtures (
  id              SERIAL PRIMARY KEY,
  home_team_id    INT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  away_team_id    INT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  round           INT NOT NULL,
  scheduled_date  DATE NOT NULL,
  home_score      INT,
  away_score      INT,
  status          fixture_status DEFAULT 'upcoming',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT different_teams CHECK (home_team_id <> away_team_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- TRADE REQUESTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trade_requests (
  id              SERIAL PRIMARY KEY,
  player_id       INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  from_team_id    INT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  to_team_id      INT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  status          trade_status DEFAULT 'pending',
  requested_by    INT REFERENCES users(id),
  reviewed_by     INT REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ,
  CONSTRAINT different_teams_trade CHECK (from_team_id <> to_team_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_players_team         ON players(team_id);
CREATE INDEX IF NOT EXISTS idx_players_grade        ON players(grade);
CREATE INDEX IF NOT EXISTS idx_match_records_player ON match_records(player_id);
CREATE INDEX IF NOT EXISTS idx_fixtures_teams       ON fixtures(home_team_id, away_team_id);
CREATE INDEX IF NOT EXISTS idx_fixtures_status      ON fixtures(status);
CREATE INDEX IF NOT EXISTS idx_trade_status         ON trade_requests(status);
CREATE INDEX IF NOT EXISTS idx_trade_teams          ON trade_requests(from_team_id, to_team_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- MARKET VALUE FUNCTION
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION compute_market_value(p_player_id INT)
RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE
  ew_raw   NUMERIC := 0;
  ew       NUMERIC;
  pp       NUMERIC;
  win_pct  NUMERIC;
  mv_raw   NUMERIC;
  final_mv INT;
BEGIN
  SELECT COALESCE(SUM(
    CASE
      WHEN mr.result = 'win'  AND mr.opponent_grade = 'S'   THEN 1.5
      WHEN mr.result = 'win'  AND mr.opponent_grade = 'A+'  THEN 1.2
      WHEN mr.result = 'win'  AND mr.opponent_grade = 'A'   THEN 0.9
      WHEN mr.result = 'win'  AND mr.opponent_grade = 'B'   THEN 0.7
      WHEN mr.result = 'win'  AND mr.opponent_grade = 'C'   THEN 0.6
      WHEN mr.result = 'draw' AND mr.opponent_grade = 'S'   THEN 0.75
      WHEN mr.result = 'draw' AND mr.opponent_grade = 'A+'  THEN 0.60
      WHEN mr.result = 'draw' AND mr.opponent_grade = 'A'   THEN 0.45
      WHEN mr.result = 'draw' AND mr.opponent_grade = 'B'   THEN 0.35
      WHEN mr.result = 'draw' AND mr.opponent_grade = 'C'   THEN 0.30
      WHEN mr.result = 'loss' AND mr.opponent_grade = 'S'   THEN -0.5
      WHEN mr.result = 'loss' AND mr.opponent_grade = 'A+'  THEN -0.6
      WHEN mr.result = 'loss' AND mr.opponent_grade = 'A'   THEN -0.7
      WHEN mr.result = 'loss' AND mr.opponent_grade = 'B'   THEN -0.8
      WHEN mr.result = 'loss' AND mr.opponent_grade = 'C'   THEN -1.0
      ELSE 0
    END
  ), 0) INTO ew_raw
  FROM match_records mr
  WHERE mr.player_id = p_player_id;

  ew       := GREATEST(ew_raw, 0);
  pp       := ew * 3;
  win_pct  := GREATEST(ew / 14.0, 0);
  mv_raw   := LEAST(pp * 5 + win_pct * 85, 450);
  final_mv := GREATEST(50, ROUND(mv_raw / 5.0) * 5);

  RETURN final_mv;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- MV TRIGGER
-- Recomputes market_value for BOTH players involved in a match_records row —
-- not just the one the result was logged "from". Without this, a player who
-- only ever appears as opponent_id (the losing side, when results are logged
-- from the winner's perspective) never gets their market_value recalculated,
-- and stays stuck at whatever it was initialized to instead of the proper
-- floor/formula result from compute_market_value().
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_update_market_value()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE players SET market_value = compute_market_value(OLD.player_id)   WHERE id = OLD.player_id;
    UPDATE players SET market_value = compute_market_value(OLD.opponent_id) WHERE id = OLD.opponent_id;
    RETURN OLD;
  ELSE
    UPDATE players SET market_value = compute_market_value(NEW.player_id)   WHERE id = NEW.player_id;
    UPDATE players SET market_value = compute_market_value(NEW.opponent_id) WHERE id = NEW.opponent_id;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_mv ON match_records;
CREATE TRIGGER trg_update_mv
  AFTER INSERT OR UPDATE OR DELETE ON match_records
  FOR EACH ROW EXECUTE FUNCTION trigger_update_market_value();


-- ─────────────────────────────────────────────────────────────────────────────
-- VIEWS  (used directly in routes)
-- ─────────────────────────────────────────────────────────────────────────────

-- Used in GET /api/teams — returns standings with position rank
CREATE OR REPLACE VIEW league_standings AS
SELECT
  t.id, t.name, t.played, t.won, t.drawn, t.lost,
  t.gf, t.ga, t.gd, t.points,
  ROW_NUMBER() OVER (ORDER BY t.points DESC, t.gd DESC, t.gf DESC) AS position
FROM teams t;

-- Used in GET /api/players — camelCase aliases match frontend shape
CREATE OR REPLACE VIEW players_full AS
SELECT
  p.id,
  p.name,
  p.alias,
  p.grade,
  p.auction_price AS "auctionPrice",
  p.market_value  AS "marketValue",
  p.bdr_points    AS "bdrPoints",
  p.form,
  p.trophy1_count AS "trophy1Count",
  p.trophy2_count AS "trophy2Count",
  p.trophy3_count AS "trophy3Count",
  p.trophy4_count AS "trophy4Count",
  t.name          AS team,
  p.team_id       AS "teamId",
  t.logo_url      AS "teamLogo",
  p.avatar_id     AS "avatarId",
  p.avatar_url    AS "avatarUrl",
  p.avatar_bg_url AS "avatarBgUrl"
FROM players p
LEFT JOIN teams t ON p.team_id = t.id;
`

async function migrate() {
  console.log("🔧 Running migrations…")
  try {
    await query(SQL)
    console.log("✅ Migration complete")
  } catch (err) {
    console.error("❌ Migration failed:", err.message)
    process.exit(1)
  }
  process.exit(0)
}

migrate()