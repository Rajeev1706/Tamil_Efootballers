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
  const isPng = file.type === "image/png"

  // Draw img onto a canvas at given dimension and return data URL
  // Falls back to 200px if the browser runs out of memory (common on mobile with large photos)
  function encodeImg(img, dim, qual) {
    let { width, height } = img
    if (width > dim || height > dim) {
      if (width >= height) { height = Math.round((height / width) * dim); width = dim }
      else                 { width = Math.round((width / height) * dim); height = dim }
    }
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    canvas.getContext("2d").drawImage(img, 0, 0, width, height)
    return isPng ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", qual)
  }

  // Load an image from a src string (data URL or object URL)
  function imgFrom(src) {
    return new Promise((res, rej) => {
      const i = new Image()
      i.onload  = () => res(i)
      i.onerror = () => rej(new Error("decode"))
      i.src = src
    })
  }

  // Attempt 1 — FileReader → data URL → canvas (best mobile compat)
  const attempt1 = () => new Promise((res, rej) => {
    const r = new FileReader()
    r.onload  = e => res(e.target.result)
    r.onerror = () => rej(new Error("read"))
    r.readAsDataURL(file)
  }).then(dataUrl => imgFrom(dataUrl)).then(img => {
    try { return encodeImg(img, maxDimension, quality) }
    catch { return encodeImg(img, 200, 0.7) }   // memory fallback
  })

  // Attempt 2 — createObjectURL → canvas (fallback for some formats)
  const attempt2 = () => {
    const url = URL.createObjectURL(file)
    return imgFrom(url)
      .then(img => { URL.revokeObjectURL(url); return img })
      .then(img => {
        try { return encodeImg(img, maxDimension, quality) }
        catch { return encodeImg(img, 200, 0.7) }
      })
      .catch(e => { URL.revokeObjectURL(url); throw e })
  }

  return attempt1()
    .catch(() => attempt2())
    .catch(() => { throw new Error("Could not process this image. Please use a JPEG or PNG photo.") })
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