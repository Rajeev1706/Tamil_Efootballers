/**
 * migrate-images-to-base64.js
 *
 * One-time script — converts all remaining Supabase Storage URLs in the DB
 * to base64 data URLs stored directly in the PostgreSQL columns.
 *
 * Uses the Supabase service role key to bypass the 402 billing restriction
 * on public storage access.
 *
 * Usage (run from inside Dashboards/backend/):
 *   node scripts/migrate-images-to-base64.js
 *
 * Safe to re-run — skips any record that's already base64.
 */

import pg from "pg"
import fetch from "node-fetch"
import dotenv from "dotenv"
dotenv.config()

const { Pool } = pg
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// ── Config ───────────────────────────────────────────────────────────────────

// Supabase service role key — bypasses 402 billing restriction on storage
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wbm1icXJtd2pibHVkZ2NoeXhuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTUzNDkyNCwiZXhwIjoyMDk3MTEwOTI0fQ.umLRn8ne-REcYx6AXX26Y1zYyktAy9mN7oLvYKxDRUg"

// Delay between requests to avoid hammering Supabase Storage
const DELAY_MS = 300

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

/**
 * Downloads an image from Supabase Storage using the service role key
 * and converts it to a base64 data URL.
 * Returns null if the download fails (so we can skip and continue).
 */
async function urlToBase64(url) {
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        apikey: SUPABASE_SERVICE_KEY,
      },
      timeout: 20000,
    })

    if (!res.ok) {
      console.warn(`\n    ⚠️  HTTP ${res.status} — ${url.slice(0, 80)}`)
      return null
    }

    const buffer      = await res.buffer()
    const contentType = res.headers.get("content-type") || "image/jpeg"
    const base64      = buffer.toString("base64")
    const dataUrl     = `data:${contentType};base64,${base64}`

    // Log size
    const kb = Math.round(buffer.length / 1024)
    process.stdout.write(` ✓ ${kb} KB\n`)

    return dataUrl
  } catch (err) {
    console.warn(`\n    ⚠️  Fetch failed: ${err.message}`)
    return null
  }
}

// ── Migration tasks ──────────────────────────────────────────────────────────

async function migrateColumn(table, column, label) {
  console.log(`\n── ${label} (${table}.${column}) ──────────────────────`)

  const { rows } = await pool.query(
    `SELECT id, ${column} FROM ${table}
     WHERE ${column} LIKE '%supabase.co/storage%'
     ORDER BY id`
  )

  console.log(`  Found ${rows.length} records to migrate`)
  if (rows.length === 0) return { total: 0, ok: 0, failed: 0 }

  let ok = 0, failed = 0

  for (const row of rows) {
    const url = row[column]
    process.stdout.write(`  [${table} id=${row.id}] Downloading...`)

    const base64 = await urlToBase64(url)

    if (base64) {
      await pool.query(
        `UPDATE ${table} SET ${column} = $1 WHERE id = $2`,
        [base64, row.id]
      )
      ok++
    } else {
      process.stdout.write(`    ✗ Skipped — will retry next run\n`)
      failed++
    }

    await sleep(DELAY_MS)
  }

  console.log(`\n  Done: ${ok} migrated, ${failed} failed`)
  return { total: rows.length, ok, failed }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🚀 Starting image migration: Supabase Storage → base64 in DB")
  console.log(`   DB: ${process.env.DATABASE_URL?.slice(0, 50)}...`)
  console.log(`   Using service role key to bypass 402 restriction`)

  const results = []

  results.push(await migrateColumn("players", "avatar_url",    "Player avatars"))
  results.push(await migrateColumn("players", "avatar_bg_url", "Player avatar backgrounds"))
  results.push(await migrateColumn("players", "image_url",     "Player squad photos"))
  results.push(await migrateColumn("teams",   "logo_url",      "Team logos"))

  // ── Summary ────────────────────────────────────────────────────────────────
  const total  = results.reduce((s, r) => s + r.total,  0)
  const ok     = results.reduce((s, r) => s + r.ok,     0)
  const failed = results.reduce((s, r) => s + r.failed, 0)

  console.log("\n══════════════════════════════════════════")
  console.log(`✅ Migration complete`)
  console.log(`   Total:   ${total}`)
  console.log(`   Success: ${ok}`)
  console.log(`   Failed:  ${failed}`)
  if (failed > 0) {
    console.log(`\n   ⚠️  ${failed} images failed — run the script again to retry.`)
    console.log(`   Failed images still have their original Supabase URL in the DB.`)
  } else {
    console.log(`\n   🎉 All images migrated — Supabase egress will drop to zero!`)
  }
  console.log("══════════════════════════════════════════")
  console.log("\n⚠️  IMPORTANT: Rotate your Supabase service role key now!")
  console.log("   Supabase Dashboard → Settings → API → Regenerate service_role key")

  await pool.end()
}

main().catch(err => {
  console.error("Fatal error:", err)
  process.exit(1)
})