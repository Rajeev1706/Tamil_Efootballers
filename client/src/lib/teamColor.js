import { useState, useEffect } from "react"

/**
 * Extracts the most DOMINANT vivid color from an image.
 * Uses color bucketing to find the most frequent vivid hue.
 */
function extractDominantColor(imageUrl) {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      try {
        const canvas  = document.createElement("canvas")
        canvas.width  = 80
        canvas.height = 80
        const ctx = canvas.getContext("2d")
        ctx.drawImage(img, 0, 0, 80, 80)

        const data = ctx.getImageData(0, 0, 80, 80).data
        const buckets = {}

        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3]
          if (a < 200) continue

          const r = data[i], g = data[i+1], b = data[i+2]

          // Skip near-white, near-black, near-grey
          const max = Math.max(r, g, b)
          const min = Math.min(r, g, b)
          const saturation = max === 0 ? 0 : (max - min) / max
          const brightness = max / 255

          if (saturation < 0.25) continue  // too grey
          if (brightness < 0.15) continue  // too dark
          if (brightness > 0.97) continue  // too white

          // Bucket into coarse color groups (every 20 steps)
          const br = Math.round(r / 20) * 20
          const bg = Math.round(g / 20) * 20
          const bb = Math.round(b / 20) * 20
          const key = `${br},${bg},${bb}`

          if (!buckets[key]) buckets[key] = { r: 0, g: 0, b: 0, count: 0 }
          buckets[key].r += r
          buckets[key].g += g
          buckets[key].b += b
          buckets[key].count++
        }

        // Find bucket with most pixels
        let best = null
        let bestCount = 0
        for (const key of Object.keys(buckets)) {
          if (buckets[key].count > bestCount) {
            bestCount = buckets[key].count
            best = buckets[key]
          }
        }

        if (!best || bestCount < 10) return resolve(null)

        let r = Math.round(best.r / best.count)
        let g = Math.round(best.g / best.count)
        let b = Math.round(best.b / best.count)

        // Boost vibrancy — push the dominant channel higher
        const max = Math.max(r, g, b)
        const min = Math.min(r, g, b)
        if (max > 0) {
          const boost = 1.5
          r = Math.min(255, Math.round(r * boost))
          g = Math.min(255, Math.round(g * boost))
          b = Math.min(255, Math.round(b * boost))
          // Clamp
          r = Math.max(0, r); g = Math.max(0, g); b = Math.max(0, b)
        }

        const hex = `#${r.toString(16).padStart(2,"0")}${g.toString(16).padStart(2,"0")}${b.toString(16).padStart(2,"0")}`
        resolve({ r, g, b, hex, css: `${r}, ${g}, ${b}` })
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = imageUrl
  })
}

export function useTeamColor(logoUrl) {
  const [color, setColor] = useState(null)

  useEffect(() => {
    if (!logoUrl) { setColor(null); return }
    extractDominantColor(logoUrl).then(setColor)
  }, [logoUrl])

  return color
}