import { cn } from "../../lib/utils"
import { useCachedImage } from "../../hooks/useCachedImage"
import { getAvatarById } from "../../lib/avatars"

const gradeColors = {
  S:   "bg-gold/20 text-gold border-gold/40",
  A:   "bg-blue-400/20 text-blue-400 border-blue-400/40",
  B:   "bg-emerald-400/20 text-emerald-400 border-emerald-400/40",
  C:   "bg-slate-500/20 text-slate-400 border-slate-500/40",
}

// Priority order:
//   1. imageUrl  — admin-uploaded squad photo (only on single-player endpoint)
//   2. avatarUrl — player's custom uploaded character avatar
//   3. avatarId  — player's chosen preset character avatar
//   4. initials  — fallback when none of the above are set
export default function PlayerAvatar({ player, size = "md", className }) {
  const sizes = {
    sm:  "w-8 h-8 text-xs rounded-lg border",
    md:  "w-10 h-10 text-sm rounded-xl border",
    lg:  "w-16 h-16 text-xl rounded-2xl border-2",
    xl:  "w-20 h-20 text-2xl rounded-2xl border-2",
  }

  const initials  = player.name?.split(" ").map(n => n[0]).join("") || "?"
  const colorCls  = gradeColors[player.grade] || gradeColors["C"]

  // Resolve the best available image source
  const preset    = getAvatarById(player.avatarId)
  const rawSrc    = player.imageUrl || player.avatarUrl || preset?.thumb || null

  const cachedSrc = useCachedImage(rawSrc)

  if (rawSrc) {
    return cachedSrc ? (
      <img
        src={cachedSrc}
        alt={player.name}
        className={cn(
          "object-cover flex-shrink-0",
          sizes[size],
          "border border-surface-border",
          className
        )}
      />
    ) : (
      // Loading state — show initials while image resolves
      <div className={cn(
        "flex items-center justify-center font-extrabold flex-shrink-0 animate-pulse",
        sizes[size],
        colorCls,
        className
      )}>
        {initials}
      </div>
    )
  }

  return (
    <div className={cn(
      "flex items-center justify-center font-extrabold flex-shrink-0",
      sizes[size],
      colorCls,
      className
    )}>
      {initials}
    </div>
  )
}