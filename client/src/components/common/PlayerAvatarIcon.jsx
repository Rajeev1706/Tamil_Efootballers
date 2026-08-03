import { getAvatarById } from "../../lib/avatars"
import { cn } from "../../lib/utils"
import { useCachedImage } from "../../hooks/useCachedImage"

// Small icon shown inline next to a player's name in plain-text lists —
// the character avatar they picked (custom upload or preset), NOT the
// admin-set real photo (that's PlayerAvatar.jsx, used elsewhere and left
// untouched). Renders nothing if the player hasn't set one — the name
// stays exactly as plain text like it does now.
//
// Custom uploads (avatarUrl) are Supabase Storage URLs — they're cached
// in IndexedDB after the first fetch so they never count as egress again.
// Preset avatars (from avatars.js import.meta.glob) are already bundled
// locally and go through useCachedImage too — it no-ops for non-https URLs.
export default function PlayerAvatarIcon({ player, size = "w-[43px] h-[43px]", className }) {
  const preset = getAvatarById(player?.avatarId)
  const rawSrc = player?.avatarUrl || preset?.thumb || null

  // Always call the hook (Rules of Hooks — no conditional calls)
  const cachedSrc = useCachedImage(rawSrc)

  if (!player || !rawSrc) return null
  if (!cachedSrc) return null // still loading — render nothing (was nothing before)

  return (
    <img
      src={cachedSrc}
      alt={player.name ? `${player.name} avatar` : "Player avatar"}
      className={cn("inline-block rounded-md object-cover flex-shrink-0 align-middle", size, className)}
    />
  )
}