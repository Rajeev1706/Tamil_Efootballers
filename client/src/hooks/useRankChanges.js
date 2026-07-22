import { useEffect, useMemo } from "react"

// Returns a map of { id: rankChange } where rankChange is:
//   positive = moved UP (improved rank), negative = dropped, 0 = same, null = new entry
// Also saves the current order to localStorage so next visit can compare against it.
// key must be unique per list (e.g. "league-table", "bdr-ranking")
export function useRankChanges(key, currentIds) {
  const storageKey = `rank-snapshot-${key}`

  const changes = useMemo(() => {
    if (!currentIds || currentIds.length === 0) return {}
    try {
      const prev = JSON.parse(localStorage.getItem(storageKey) || "null")
      if (!prev) return {}
      const result = {}
      currentIds.forEach((id, idx) => {
        const prevRank = prev[String(id)]
        if (prevRank == null) {
          result[id] = null // new entry
        } else {
          // Lower rank index = better position
          // If prevRank was 5 and now idx is 2 → moved up by 3 → positive
          result[id] = prevRank - idx
        }
      })
      return result
    } catch {
      return {}
    }
  }, [key, currentIds?.join(",")])

  // Save current order after computing changes
  useEffect(() => {
    if (!currentIds || currentIds.length === 0) return
    const snapshot = {}
    currentIds.forEach((id, idx) => { snapshot[String(id)] = idx })
    try { localStorage.setItem(storageKey, JSON.stringify(snapshot)) } catch {}
  }, [key, currentIds?.join(",")])

  return changes
}