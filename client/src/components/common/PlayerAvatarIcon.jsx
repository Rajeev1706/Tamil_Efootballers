import { getAvatarById } from "../../lib/avatars"
import { cn } from "../../lib/utils"

// Small icon shown inline next to a player's name in plain-text lists —
// the character avatar they picked (custom upload or preset), NOT the
// admin-set real photo (that's PlayerAvatar.jsx, used elsewhere and left
// untouched). Renders nothing if the player hasn't set one — the name
// stays exactly as plain text like it does now.
export default function PlayerAvatarIcon({ player, size = "w-10 h-10", className }) {
  if (!player) return null
  const preset = getAvatarById(player.avatarId)
  const src = player.avatarUrl || preset?.thumb
  if (!src) return null

  return (
    <img
      src={src}
      alt={player.name ? `${player.name} avatar` : "Player avatar"}
      className={cn("inline-block rounded-md object-cover flex-shrink-0 align-middle", size, className)}
    />
  )
}