// A handful of thin diagonal light streaks shooting across the celebration
// backdrop at staggered, irregular-feeling intervals — each meteor loops on
// its own delay/duration, so together they never feel perfectly synced.
const METEORS = [
  { top: "5%",  left: "70%", delay: "0s",   duration: "3.5s" },
  { top: "0%",  left: "40%", delay: "1.2s", duration: "4.2s" },
  { top: "10%", left: "85%", delay: "2.1s", duration: "3.8s" },
  { top: "2%",  left: "20%", delay: "0.6s", duration: "5s"   },
  { top: "8%",  left: "55%", delay: "2.8s", duration: "4.6s" },
  { top: "0%",  left: "95%", delay: "1.7s", duration: "3.2s" },
  { top: "6%",  left: "10%", delay: "3.4s", duration: "4.9s" },
]

export default function MeteorStreaks() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {METEORS.map((m, i) => (
        <span
          key={i}
          className="meteor"
          style={{ top: m.top, left: m.left, animationDelay: m.delay, animationDuration: m.duration }}
        />
      ))}
    </div>
  )
}