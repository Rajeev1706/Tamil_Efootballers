/**
 * migrate_lineups.js — adds fixture_lineups table
 * Usage: node src/db/migrate_lineups.js
 */
import { query } from "./pool.js"

const SQL = `
CREATE TABLE IF NOT EXISTS fixture_lineups (
  id            SERIAL PRIMARY KEY,
  fixture_id    INT NOT NULL REFERENCES fixtures(id) ON DELETE CASCADE,
  team_id       INT NOT NULL REFERENCES teams(id)    ON DELETE CASCADE,
  my_player_id  INT NOT NULL REFERENCES players(id)  ON DELETE CASCADE,
  opp_player_id INT NOT NULL REFERENCES players(id)  ON DELETE CASCADE,
  slot          INT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (fixture_id, team_id, slot)
);

CREATE INDEX IF NOT EXISTS idx_lineups_fixture_team ON fixture_lineups(fixture_id, team_id);
`

async function migrate() {
  console.log("🔧 Migrating lineups table…")
  try {
    await query(SQL)
    console.log("✅ Done")
  } catch (err) {
    console.error("❌ Failed:", err.message)
    process.exit(1)
  }
  process.exit(0)
}

migrate()