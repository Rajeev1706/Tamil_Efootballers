import { createClient } from "@supabase/supabase-js"

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export async function uploadPlayerImage(playerId, file) {
  const ext  = file.name.split(".").pop().toLowerCase()
  // Unique path per upload (not just a query string) — Supabase's storage
  // CDN caches by path, so re-using the same path and only changing a
  // ?t= query param does NOT reliably bust that upstream cache. A new
  // path guarantees nothing can serve stale bytes for it.
  const path = `${playerId}-${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from("player-images")
    .upload(path, file, { upsert: true, contentType: file.type })

  if (error) throw new Error(error.message)

  const { data } = supabase.storage
    .from("player-images")
    .getPublicUrl(path)

  return data.publicUrl
}

export async function uploadPlayerAvatarImage(playerId, file, kind) {
  const ext  = file.name.split(".").pop().toLowerCase()
  // kind is "avatar" or "bg" — kept in the path so both images for the
  // same player never collide with each other.
  const path = `avatar-${kind}-${playerId}-${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from("player-images")
    .upload(path, file, { upsert: true, contentType: file.type })

  if (error) throw new Error(error.message)

  const { data } = supabase.storage
    .from("player-images")
    .getPublicUrl(path)

  return data.publicUrl
}

export async function uploadTeamLogo(teamId, file) {
  const ext  = file.name.split(".").pop().toLowerCase()
  // Same fix as uploadPlayerImage — unique path per upload, not a fixed
  // path with a cache-busting query string, since Supabase's storage CDN
  // caches by path and ignores query strings.
  const path = `team-${teamId}-${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from("player-images")
    .upload(path, file, { upsert: true, contentType: file.type })

  if (error) throw new Error(error.message)

  const { data } = supabase.storage
    .from("player-images")
    .getPublicUrl(path)

  return data.publicUrl
}