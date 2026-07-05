import { useMemo } from "react"

const COLORS = ["#10b981", "#f59e0b", "#3b82f6", "#f43f5e", "#a78bfa", "#ffffff"]

// Lightweight confetti burst — pure CSS, no dependency. Renders a fixed
// number of falling particles once, positioned/timed randomly, then leaves
// nothing behind (no persistent DOM cost, no animation loop in JS).
// Usage: {celebrate && <Confetti />} (relative to nearest positioned parent)
//     or {celebrate && <Confetti fixed />} (spans the whole viewport)
export default function Confetti({ count = 60, fixed = false }) {
  const particles = useMemo(() => (
    Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.4,
      duration: 1.4 + Math.random() * 1.2,
      size: 5 + Math.random() * 5,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotate: Math.random() * 360,
    }))
  ), [count])

  return (
    <div className={`pointer-events-none ${fixed ? "fixed" : "absolute"} inset-0 overflow-hidden z-50`} aria-hidden="true">
      {particles.map(p => (
        <span
          key={p.id}
          className="absolute top-0 animate-confetti-fall rounded-sm"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.4,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  )
}