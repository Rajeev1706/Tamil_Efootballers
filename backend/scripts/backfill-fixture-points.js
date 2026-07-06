// scripts/backfill-fixture-points.js
//
// One-time backfill for the live-points feature. Any player result logged
// via the Team Dashboard BEFORE records.js was updated:
//   - has fixture_id = NULL (that column didn't exist / wasn't populated yet)
//   - never touched teams.score_points/gf/ga at all — the old code only
//     saved the match_records row, nothing more
//
// Anything logged AFTER the update already has fixture_id set and has
// already correctly updated team points live — this script must not touch
// those, or points would be double-counted.
//
// For each un-linked league result still tied to a currently PENDING
// (status = 'upcoming') fixture, this script:
//   1. Finds which fixture it actually belongs to (team membership + date,
//      same heuristic the app already uses elsewhere)
//   2. Sets its fixture_id so it's correctly tracked going forward
//   3. Adds its point/goal contribution to both teams — using the exact
//      same 3/1/0 + mirrored logic as the live POST /records/team endpoint
//
// Run:
//   node scripts/backfill-fixture-points.js            (dry run — default)
//   node scripts/backfill-fixture-points.js --apply    (actually applies it)

import dotenv from 'dotenv'
dotenv.config()
import { query, withTransaction } from '../src/db/pool.js'

const APPLY = process.argv.includes('--apply')

async function main() {
  // Find every not-yet-linked league result, matched to whichever pending
  // fixture it plausibly belongs to (team membership + date heuristic).
  const candidates = await query(`
    SELECT
      mr.id AS record_id,
      mr.player_id, mr.opponent_id, mr.result, mr.player_score, mr.opponent_score,
      p.name AS player_name, p.team_id AS player_team_id,
      opp.name AS opponent_name, opp.team_id AS opponent_team_id,
      f.id AS fixture_id, f.round, f.scheduled_date,
      ht.name AS home_team, at.name AS away_team
    FROM match_records mr
    JOIN players p   ON mr.player_id   = p.id
    JOIN players opp ON mr.opponent_id = opp.id
    JOIN fixtures f  ON f.status = 'upcoming'
      AND p.team_id   IN (f.home_team_id, f.away_team_id)
      AND opp.team_id IN (f.home_team_id, f.away_team_id)
      AND mr.recorded_at::date >= f.scheduled_date::date
    JOIN teams ht ON f.home_team_id = ht.id
    JOIN teams at ON f.away_team_id = at.id
    WHERE mr.match_type = 'league' AND mr.fixture_id IS NULL
    ORDER BY mr.id, f.scheduled_date ASC
  `)

  // Group by record_id so we can detect ambiguous matches (a record that
  // plausibly matches more than one pending fixture) and skip those safely
  // rather than guessing.
  const byRecord = new Map()
  for (const row of candidates.rows) {
    if (!byRecord.has(row.record_id)) byRecord.set(row.record_id, [])
    byRecord.get(row.record_id).push(row)
  }

  const clean = []
  const ambiguous = []
  for (const [recordId, matches] of byRecord) {
    if (matches.length === 1) clean.push(matches[0])
    else ambiguous.push({ recordId, matches })
  }

  if (clean.length === 0 && ambiguous.length === 0) {
    console.log('✅ No un-linked pre-deployment results found. Nothing to backfill.')
    process.exit(0)
  }

  console.log(`Found ${clean.length} result(s) to backfill cleanly:\n`)
  for (const r of clean) {
    console.log(
      `  [record ${r.record_id}] Round ${r.round} — ${r.home_team} vs ${r.away_team}: ` +
      `${r.player_name} (${r.result}) vs ${r.opponent_name}` +
      (r.player_score != null ? `  ${r.player_score}-${r.opponent_score}` : '')
    )
  }

  if (ambiguous.length > 0) {
    console.log(`\n⚠️  ${ambiguous.length} result(s) matched MORE THAN ONE pending fixture — skipped, need manual review:`)
    for (const { recordId, matches } of ambiguous) {
      console.log(`  [record ${recordId}] matches ${matches.length} fixtures: rounds ${matches.map(m => m.round).join(', ')}`)
    }
  }

  if (!APPLY) {
    console.log('\nThis was a DRY RUN — no changes made.')
    console.log('Re-run with --apply to actually link these and add their points to the teams.')
    process.exit(0)
  }

  await withTransaction(async ({ query: q }) => {
    for (const r of clean) {
      // Same 3/1/0 + mirrored logic as records.js POST /team
      const playerPts = r.result === 'win' ? 3 : r.result === 'draw' ? 1 : 0
      const oppPts    = r.result === 'win' ? 0 : r.result === 'loss' ? 3 : 1
      const pScore = r.player_score ?? 0
      const oScore = r.opponent_score ?? 0

      await q('UPDATE match_records SET fixture_id = $1 WHERE id = $2', [r.fixture_id, r.record_id])

      await q(
        'UPDATE teams SET score_points = score_points + $1, gf = gf + $2, ga = ga + $3 WHERE id = $4',
        [playerPts, pScore, oScore, r.player_team_id]
      )
      await q(
        'UPDATE teams SET score_points = score_points + $1, gf = gf + $2, ga = ga + $3 WHERE id = $4',
        [oppPts, oScore, pScore, r.opponent_team_id]
      )
    }
  })

  console.log(`\n✅ Backfilled ${clean.length} result(s). Team points/goals updated, fixture_id linked for each.`)
  if (ambiguous.length > 0) {
    console.log(`⚠️  ${ambiguous.length} result(s) still need manual review (see above) — not touched.`)
  }
  process.exit(0)
}

main().catch(err => {
  console.error('❌ Failed:', err.message)
  process.exit(1)
})