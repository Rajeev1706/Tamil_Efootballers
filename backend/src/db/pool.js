import pg from "pg"
import dotenv from "dotenv"
dotenv.config()

const { Pool, types } = pg

// Return DATE columns as plain strings (YYYY-MM-DD) instead of JS Date objects.
// Without this, pg converts DATE to a JS Date in UTC which causes timezone
// shifts when the server/client are in different timezones (e.g. UTC vs IST).
types.setTypeParser(1082, val => val)  // 1082 = DATE type OID

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

pool.on("error", (err) => {
  console.error("Unexpected DB client error:", err)
})

// Thin query helper — always releases the client
export async function query(text, params) {
  const start = Date.now()
  const res = await pool.query(text, params)
  if (process.env.NODE_ENV === "development") {
    console.log(`[db] ${Date.now() - start}ms → ${text.slice(0, 80)}`)
  }
  return res
}

// Transaction helper — pass an async fn that receives { query }
export async function withTransaction(fn) {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const result = await fn({ query: (t, p) => client.query(t, p) })
    await client.query("COMMIT")
    return result
  } catch (err) {
    await client.query("ROLLBACK")
    throw err
  } finally {
    client.release()
  }
}

export default pool