import { useState, useCallback } from "react"

/**
 * useDraftState — like useState, but auto-saves to localStorage so the value
 * survives navigating away and coming back (e.g. leaving a tournament creation
 * form to register a new player, then returning).
 *
 * Usage:
 *   const [selected, setSelected, clearDraft] = useDraftState("draft_weekly_selected", [])
 *
 * Call clearDraft() after a successful submit to wipe the saved value.
 */
export function useDraftState(key, initial) {
  const [state, setState] = useState(() => {
    try {
      const stored = localStorage.getItem(key)
      if (stored !== null) return JSON.parse(stored)
    } catch {}
    return initial
  })

  const setStatePersisted = useCallback((valOrFn) => {
    setState(prev => {
      const next = typeof valOrFn === "function" ? valOrFn(prev) : valOrFn
      try { localStorage.setItem(key, JSON.stringify(next)) } catch {}
      return next
    })
  }, [key])

  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(key) } catch {}
  }, [key])

  return [state, setStatePersisted, clearDraft]
}