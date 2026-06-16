import { createClient } from "@supabase/supabase-js"

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export async function uploadPlayerImage(playerId, file) {
  const ext  = file.name.split(".").pop().toLowerCase()
  const path = `${playerId}.${ext}`

  const { error } = await supabase.storage
    .from("player-images")
    .upload(path, file, { upsert: true, contentType: file.type })

  if (error) throw new Error(error.message)

  const { data } = supabase.storage
    .from("player-images")
    .getPublicUrl(path)

  // Add timestamp to bust browser cache on re-upload
  return `${data.publicUrl}?t=${Date.now()}`
}

export async function uploadTeamLogo(teamId, file) {
  const ext  = file.name.split(".").pop().toLowerCase()
  const path = `team-${teamId}.${ext}`

  const { error } = await supabase.storage
    .from("player-images")
    .upload(path, file, { upsert: true, contentType: file.type })

  if (error) throw new Error(error.message)

  const { data } = supabase.storage
    .from("player-images")
    .getPublicUrl(path)

  // Add timestamp to bust browser cache on re-upload
  return `${data.publicUrl}?t=${Date.now()}`
}