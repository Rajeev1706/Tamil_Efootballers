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

/**
 * Some crests are dominated by a dark navy/maroon/black — fine as a subtle
 * background wash, but unreadable as text on a dark UI. This returns a
 * lightness-floored version of the same hue, safe to use for text/icons.
 */
export function readableTeamColor(color) {
  if (!color) return null
  const { r, g, b } = color
  const max = Math.max(r, g, b) / 255
  const min = Math.min(r, g, b) / 255
  const l = (max + min) / 2

  if (l >= 0.55) return color.hex

  const d = max - min
  if (d < 0.02) return "#cbd5e1" // achromatic (black/white/grey) crest — neutral light grey, no arbitrary hue

  let h = 0
  if (max === r / 255) h = ((g / 255 - b / 255) / d) % 6
  else if (max === g / 255) h = (b / 255 - r / 255) / d + 2
  else h = (r / 255 - g / 255) / d + 4
  h *= 60
  if (h < 0) h += 360

  const s = d / (1 - Math.abs(2 * l - 1))
  const targetL = 0.62
  const targetS = Math.max(s, 0.55)

  const c = (1 - Math.abs(2 * targetL - 1)) * targetS
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = targetL - c / 2
  let [r2, g2, b2] = h < 60 ? [c, x, 0]
    : h < 120 ? [x, c, 0]
    : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c]
    : h < 300 ? [x, 0, c]
    : [c, 0, x]

  const toHex = v => Math.round((v + m) * 255).toString(16).padStart(2, "0")
  return `#${toHex(r2)}${toHex(g2)}${toHex(b2)}`
}