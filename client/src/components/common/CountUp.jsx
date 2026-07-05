import { useEffect, useRef, useState } from "react"

// Animates a number counting up from its previous value to a new one.
// Usage: <CountUp value={1234} /> or <CountUp value={player.marketValue} suffix=" cr" />
// Non-numeric values (e.g. "—") pass through untouched.
export default function CountUp({ value, duration = 700, formatter, className }) {
  const numeric = typeof value === "number" ? value : parseFloat(value)
  const isValidNumber = !isNaN(numeric) && isFinite(numeric)

  const [display, setDisplay] = useState(isValidNumber ? numeric : value)
  const prevValue = useRef(isValidNumber ? numeric : 0)
  const rafRef = useRef(null)

  useEffect(() => {
    if (!isValidNumber) {
      setDisplay(value)
      return
    }

    const from = prevValue.current
    const to = numeric
    if (from === to) return

    const start = performance.now()
    cancelAnimationFrame(rafRef.current)

    function tick(now) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = from + (to - from) * eased
      setDisplay(current)
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        prevValue.current = to
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numeric, isValidNumber])

  if (!isValidNumber) return <span className={className}>{value}</span>

  const rounded = Math.round(display)
  const text = formatter ? formatter(rounded) : rounded.toLocaleString()
  return <span className={className}>{text}</span>
}