import { cn } from "../../lib/utils"

// Small logo shown inline next to a team's name in plain-text lists (e.g.
// "RANGERS" in the players directory). Renders nothing when the team has no
// logo_url — the row falls back to exactly what it looked like before.
export function TeamLogoIcon({ logoUrl, name, size = "w-8 h-8", className }) {
  if (!logoUrl) return null
  return (
    <img
      src={logoUrl}
      alt={name ? `${name} logo` : "Team logo"}
      className={cn("inline-block rounded-md object-contain flex-shrink-0 align-middle", size, className)}
    />
  )
}

// Avatar-style team badge used anywhere a letter-initial box currently
// stands in for a team (standings rows, admin team list, playoff cards).
// Shows the real logo when available, otherwise keeps the existing
// letter-initial fallback so nothing breaks for teams without a logo.
export function TeamAvatar({ logoUrl, name, size = "w-7 h-7", textSize = "text-xs", className, fallbackClassName }) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={name || "Team"}
        className={cn("rounded-md object-cover flex-shrink-0", size, className)}
      />
    )
  }
  return (
    <div
      className={cn(
        "rounded-md flex items-center justify-center font-bold flex-shrink-0",
        size, textSize,
        fallbackClassName || "bg-surface-border text-slate-400",
        className
      )}
    >
      {name?.charAt(0) || "?"}
    </div>
  )
}