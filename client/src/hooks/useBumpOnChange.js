import { useState, useEffect, useRef } from "react"

// Returns true for a brief moment every time `value` changes — used to
// trigger the bid-amount "bump" animation without needing to wire up
// animation state by hand at every call site.
export function useBumpOnChange(value, duration = 420) {
  const [bumping, setBumping] = useState(false)
  const prevRef = useRef(value)

  useEffect(() => {
    if (prevRef.current !== undefined && value !== prevRef.current) {
      setBumping(true)
      const timer = setTimeout(() => setBumping(false), duration)
      prevRef.current = value
      return () => clearTimeout(timer)
    }
    prevRef.current = value
  }, [value, duration])

  return bumping
}