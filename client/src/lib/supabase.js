import { createClient } from "@supabase/supabase-js"

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// ─── Base64 image converter ───────────────────────────────────────────────────
// Instead of uploading to Supabase Storage (which hits bandwidth limits),
// images are converted to Base64 data URLs and stored directly in the
// PostgreSQL database. No external storage needed — images load instantly
// from the DB response with zero egress cost.
//
// Images are resized + compressed before encoding so they stay small enough
// to store in a TEXT column without bloating the DB or slowing API responses.

const MAX_DIMENSION = 400  // px — enough for logos/avatars at any UI size
const JPEG_QUALITY  = 0.82 // 82% quality — good visual quality, small file size

function resizeAndEncode(file, maxDimension = MAX_DIMENSION, quality = JPEG_QUALITY) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      // Calculate new dimensions keeping aspect ratio
      let { width, height } = img
      if (width > maxDimension || height > maxDimension) {
        if (width >= height) {
          height = Math.round((height / width) * maxDimension)
          width  = maxDimension
        } else {
          width  = Math.round((width / height) * maxDimension)
          height = maxDimension
        }
      }

      const canvas = document.createElement("canvas")
      canvas.width  = width
      canvas.height = height

      const ctx = canvas.getContext("2d")
      ctx.drawImage(img, 0, 0, width, height)

      // Always encode as JPEG for consistent small size
      // (PNG files like logos with transparency are kept as PNG)
      const isPng = file.type === "image/png"
      const dataUrl = isPng
        ? canvas.toDataURL("image/png")
        : canvas.toDataURL("image/jpeg", quality)

      resolve(dataUrl)
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error("Failed to load image for encoding"))
    }

    img.src = objectUrl
  })
}

// ─── Player photo (admin-set real photo) ─────────────────────────────────────
export async function uploadPlayerImage(playerId, file) {
  return resizeAndEncode(file, MAX_DIMENSION, JPEG_QUALITY)
}

// ─── Player avatar images (custom upload via AvatarPicker) ───────────────────
export async function uploadPlayerAvatarImage(playerId, file, kind) {
  // Avatar thumbnails shown inline in lists — smaller max size
  // Background images shown full-card — slightly larger
  const maxDim = kind === "bg" ? 600 : 300
  return resizeAndEncode(file, maxDim, JPEG_QUALITY)
}

// ─── Team logo ────────────────────────────────────────────────────────────────
export async function uploadTeamLogo(teamId, file) {
  // Logos are usually square — 300px is plenty for any UI usage
  return resizeAndEncode(file, 300, JPEG_QUALITY)
}

// ─── Team anthem (audio — can't Base64 encode large audio in DB, keep Supabase) ─
export async function uploadTeamAnthem(teamId, file) {
  const ext  = file.name.split(".").pop().toLowerCase()
  const path = `anthem-${teamId}-${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from("player-images")
    .upload(path, file, { upsert: true, contentType: file.type })

  if (error) throw new Error(error.message)

  const { data } = supabase.storage
    .from("player-images")
    .getPublicUrl(path)

  return data.publicUrl
}