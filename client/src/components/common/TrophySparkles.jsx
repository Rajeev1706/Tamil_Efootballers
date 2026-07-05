// A handful of small gold dots scattered around a trophy, each twinkling
// (fading in/out) on its own staggered timer. Purely decorative — no
// randomness needed since it's a small fixed set of positions around a
// fixed-size trophy image.
const SPARKLES = [
  { top: "-6%",  left: "8%",   delay: "0s",   size: 6 },
  { top: "4%",   left: "92%",  delay: "0.3s", size: 5 },
  { top: "78%",  left: "-4%",  delay: "0.6s", size: 5 },
  { top: "88%",  left: "88%",  delay: "0.9s", size: 6 },
  { top: "-10%", left: "55%",  delay: "1.2s", size: 4 },
  { top: "40%",  left: "104%", delay: "0.5s", size: 4 },
]

export default function TrophySparkles() {
  return (
    <>
      {SPARKLES.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-gold animate-twinkle pointer-events-none"
          style={{
            top: s.top,
            left: s.left,
            width: s.size,
            height: s.size,
            animationDelay: s.delay,
            boxShadow: "0 0 6px 1px rgba(245,158,11,0.7)",
          }}
        />
      ))}
    </>
  )
}