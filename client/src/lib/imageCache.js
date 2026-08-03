/**
 * imageCache.js — IndexedDB-based image cache for Supabase Storage URLs.
 *
 * Problem: Supabase Storage has no CDN caching on the Free plan, so every
 * img src= pointing at a Supabase URL counts as fresh egress on every page
 * load, for every user. With 130 players × 2 images × many visits this blows
 * through the 5 GB/month free quota easily.
 *
 * Solution: fetch each Supabase image once, store the blob in IndexedDB, then
 * serve an object URL from IndexedDB on every subsequent load — zero egress
 * after the first fetch per browser.
 *
 * Two-layer cache:
 *   1. memoryCache (Map)   — instant, lives for the current page session.
 *   2. IndexedDB           — persistent, survives page reloads, 7-day TTL.
 *
 * Concurrent-fetch guard: if two components mount at the same time and both
 * ask for the same URL before it's cached, only one network request is made;
 * both get the same Promise.
 *
 * Fallback: if IndexedDB is unavailable or the fetch fails for any reason,
 * the original Supabase URL is returned so the image still attempts to load
 * normally (graceful degradation).
 *
 * Only URLs that start with "https://" are cached — preset/bundled images
 * (from avatars.js import.meta.glob) are already local and need no caching.
 */

const DB_NAME    = "tef-image-cache-v1"
const STORE_NAME = "images"
const DB_VERSION = 1
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

// Layer 1: in-memory map  url → objectURL (lives for this page session)
const memoryCache = new Map()

// Concurrent-fetch guard: url → Promise<string>
// Prevents duplicate network requests when multiple components ask for the
// same URL at the same time (e.g. every row in the standings table loading
// simultaneously on first visit).
const pendingFetches = new Map()

// ── IndexedDB helpers ────────────────────────────────────────────────────────

let dbPromise = null

function openDB() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (!window.indexedDB) return reject(new Error("IndexedDB not available"))
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      // Store shape: { url: string, blob: Blob, cachedAt: number }
      e.target.result.createObjectStore(STORE_NAME, { keyPath: "url" })
    }
    req.onsuccess  = (e) => resolve(e.target.result)
    req.onerror    = (e) => reject(e.target.error)
    req.onblocked  = ()  => reject(new Error("IndexedDB blocked"))
  })
  return dbPromise
}

async function idbGet(url) {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx  = db.transaction(STORE_NAME, "readonly")
      const req = tx.objectStore(STORE_NAME).get(url)
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror   = () => resolve(null)
    })
  } catch {
    return null
  }
}

async function idbPut(record) {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite")
      tx.objectStore(STORE_NAME).put(record)
      tx.oncomplete = resolve
      tx.onerror    = resolve // don't reject — cache write failure is non-fatal
    })
  } catch {
    // IndexedDB write failed — not fatal, image will just be re-fetched
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * getImage(url) → Promise<string>
 *
 * Returns a local object URL (blob:// or data://) for the given image URL.
 * Falls back to the original URL if caching fails for any reason.
 *
 * Only caches https:// URLs — bundled/preset images are already local.
 */
export async function getImage(url) {
  if (!url || !url.startsWith("https://")) return url ?? null

  // 1. Memory cache — fastest path
  if (memoryCache.has(url)) return memoryCache.get(url)

  // 2. Concurrent-fetch guard — if this URL is already being fetched,
  //    join that Promise instead of firing another network request.
  if (pendingFetches.has(url)) return pendingFetches.get(url)

  const fetchPromise = (async () => {
    try {
      // 3. IndexedDB — fast, persists across page reloads
      const record = await idbGet(url)
      if (record && Date.now() - record.cachedAt < MAX_AGE_MS) {
        const objectUrl = URL.createObjectURL(record.blob)
        memoryCache.set(url, objectUrl)
        return objectUrl
      }

      // 4. Network fetch — only fires once per URL ever (until TTL expires)
      const res = await fetch(url, { cache: "no-store" })
      if (!res.ok) return url // Supabase returning 402/403 — don't cache, return original

      const blob      = await res.blob()
      const objectUrl = URL.createObjectURL(blob)

      // Persist to IndexedDB in the background — don't await
      idbPut({ url, blob, cachedAt: Date.now() })

      memoryCache.set(url, objectUrl)
      return objectUrl
    } catch {
      // Network error, CORS issue, etc. — fall back to original URL
      return url
    } finally {
      pendingFetches.delete(url)
    }
  })()

  pendingFetches.set(url, fetchPromise)
  return fetchPromise
}

/**
 * clearImageCache() — wipes the entire IndexedDB store and memory cache.
 * Useful for admin tools or debugging; call from the browser console:
 *   import('/src/lib/imageCache.js').then(m => m.clearImageCache())
 */
export async function clearImageCache() {
  memoryCache.clear()
  pendingFetches.clear()
  try {
    const db = await openDB()
    await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite")
      tx.objectStore(STORE_NAME).clear()
      tx.oncomplete = resolve
      tx.onerror    = resolve
    })
    console.log("[imageCache] Cache cleared.")
  } catch (e) {
    console.warn("[imageCache] Could not clear IndexedDB:", e)
  }
}