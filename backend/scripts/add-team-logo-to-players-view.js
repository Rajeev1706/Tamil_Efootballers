// scripts/add-team-logo-to-players-view.js
//
// Adds `t.logo_url AS "teamLogo"` to the players_full view so every
// player+team list in the app can show the team's logo.
//
// migrate.js was updated with this change too, but migrate.js only runs
// CREATE TABLE IF NOT EXISTS / re-applies views on a fresh run — it won't
// auto-rerun against the live DB. This script just re-applies the one
// view definition, safely (CREATE OR REPLACE VIEW), without touching
// anything else.
//
// Run once:
//   node scripts/add-team-logo-to-players-view.js

import dotenv from "dotenv"
dotenv.config()
import { query } from "../src/db/pool.js"

const SQL = `
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
  t.logo_url      AS "teamLogo"
FROM players p
LEFT JOIN teams t ON p.team_id = t.id;
`

async function run() {
  console.log("🔧 Re-applying players_full view with teamLogo…")
  try {
    await query(SQL)
    console.log("✅ Done — players_full now returns teamLogo")
  } catch (err) {
    console.error("❌ Failed:", err.message)
    process.exit(1)
  }
  process.exit(0)
}

run()