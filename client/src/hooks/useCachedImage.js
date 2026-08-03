/**
 * useCachedImage(url) — React hook that returns a local blob:// URL for the
 * given image URL, served from IndexedDB after the first fetch.
 *
 * Usage:
 *   const src = useCachedImage(player.avatarUrl)
 *   <img src={src} />
 *
 * - Returns null while the image is loading (so you can show a placeholder).
 * - Returns the original URL immediately if it's not an https:// URL (preset
 *   bundled images are already local — no caching needed).
 * - Never throws — falls back to the original URL on any error.
 */

import { useState, useEffect, useRef } from "react"
import { getImage } from "../lib/imageCache"

export function useCachedImage(url) {
  // For non-remote URLs (null, bundled preset paths like blob:, data:) just
  // return immediately — no async work needed.
  const isRemote = url && url.startsWith("https://")

  const [src, setSrc] = useState(() => (isRemote ? null : (url ?? null)))
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    if (!isRemote) {
      setSrc(url ?? null)
      return
    }

    // Reset to null (loading state) if the URL changed
    setSrc(null)

    getImage(url).then((resolved) => {
      if (mountedRef.current) setSrc(resolved)
    })

    return () => {
      mountedRef.current = false
    }
  }, [url, isRemote])

  return src
}