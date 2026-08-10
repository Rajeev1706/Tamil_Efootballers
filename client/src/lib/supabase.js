import { createClient } from "@supabase/supabase-js"
import api from "./api"

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// ─── Image resize helper ──────────────────────────────────────────────────────
// Resizes image to a max dimension before uploading — reduces upload time
// and Cloudinary storage. Returns a base64 data URL for uploading.

const JPEG_QUALITY = 0.85

function resizeAndEncode(file, maxDimension, quality = JPEG_QUALITY) {
  const isPng = file.type === "image/png"

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

  function imgFrom(src) {
    return new Promise((res, rej) => {
      const i = new Image()
      i.onload  = () => res(i)
      i.onerror = () => rej(new Error("decode"))
      i.src = src
    })
  }

  const attempt1 = () => new Promise((res, rej) => {
    const r = new FileReader()
    r.onload  = e => res(e.target.result)
    r.onerror = () => rej(new Error("read"))
    r.readAsDataURL(file)
  }).then(dataUrl => imgFrom(dataUrl)).then(img => {
    try { return encodeImg(img, maxDimension, quality) }
    catch { return encodeImg(img, 200, 0.7) }
  })

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

// ─── Upload to Cloudinary via backend ────────────────────────────────────────
// Resizes image, encodes to base64, sends to our backend /api/upload which
// forwards to Cloudinary. Returns the Cloudinary CDN URL.
// Images are then served from Cloudinary directly — zero Render/DB bandwidth.

async function uploadToCloudinary(file, folder, maxDimension) {
  const base64 = await resizeAndEncode(file, maxDimension)
  const res    = await api.post("/upload", { data: base64, folder })
  return res.data.url  // https://res.cloudinary.com/wencvhgh/...
}

// ─── Player squad photo (admin-set real match photo) ─────────────────────────
export async function uploadPlayerImage(playerId, file) {
  return uploadToCloudinary(file, "squads", 1200)
}

// ─── Player avatar images (custom upload via AvatarPicker) ───────────────────
export async function uploadPlayerAvatarImage(playerId, file, kind) {
  const maxDim = kind === "bg" ? 800 : 400
  return uploadToCloudinary(file, kind === "bg" ? "avatar-bg" : "avatars", maxDim)
}

// ─── Team logo ────────────────────────────────────────────────────────────────
export async function uploadTeamLogo(teamId, file) {
  return uploadToCloudinary(file, "logos", 400)
}

// ─── Team anthem (audio — stays on Supabase Storage) ─────────────────────────
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