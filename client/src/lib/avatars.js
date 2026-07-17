// Preset player avatar characters.
//
// HOW TO ADD A NEW AVATAR — no code changes needed:
//   1. Pick a character name, e.g. "goku"
//   2. Drop two files into client/images/ (same folder as everything else):
//        goku avatar.png   ← small thumbnail shown in the picker
//        goku bg.png       ← full background image for that character's
//                             Player Profile page
//   3. That's it — it'll appear in the picker automatically on next build.
//
// Naming is flexible: "goku avatar.png", "goku-avatar.png", and
// "goku_avatar.png" all work — space, hyphen, or underscore before
// "avatar"/"bg", case-insensitive. An avatar only shows up once BOTH files
// for its name exist.

const allImages = import.meta.glob("../../images/*.{png,jpg,jpeg,webp,gif,PNG,JPG,JPEG,WEBP,GIF}", { eager: true, import: "default" })

// Matches "<name> avatar.ext" / "<name>-avatar.ext" / "<name>_avatar.ext"
// (and the same for "bg"), case-insensitive. Requires a separator before
// the suffix so it never accidentally matches unrelated files like
// "Golden Boot.png" or "ucl_gb.png".
const AVATAR_RE = /^(.*?)[\s_-]+avatar$/i
const BG_RE     = /^(.*?)[\s_-]+bg$/i

const byId = {}

for (const [path, src] of Object.entries(allImages)) {
  const filename  = path.split("/").pop()
  const baseName  = filename.replace(/\.[a-zA-Z]+$/, "") // strip extension

  const avatarMatch = baseName.match(AVATAR_RE)
  const bgMatch      = baseName.match(BG_RE)

  if (avatarMatch) {
    const id = avatarMatch[1].trim().toLowerCase()
    byId[id] ??= { id, name: prettify(avatarMatch[1]) }
    byId[id].thumb = src
  } else if (bgMatch) {
    const id = bgMatch[1].trim().toLowerCase()
    byId[id] ??= { id, name: prettify(bgMatch[1]) }
    byId[id].bg = src
  }
}

function prettify(name) {
  return name.trim().replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase())
}

// Only expose avatars that have both a thumbnail AND a background — a
// half-uploaded pair just silently doesn't show up rather than rendering
// broken.
export const AVATARS = Object.values(byId)
  .filter(a => a.thumb && a.bg)
  .sort((a, b) => a.id.localeCompare(b.id))

export const getAvatarById = (id) => AVATARS.find(a => a.id === id) || null