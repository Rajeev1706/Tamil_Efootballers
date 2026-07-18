// A real two-stage firework: a small bright spark climbs from the bottom
// (the "trail"), then right as it arrives, 8 rays burst outward from that
// point and fade — not a static burst that just appears in place. Loops
// continuously; --rise controls how high it climbs before bursting.
export default function FireworkBurst({ bottom, left, delay = "0s", rise = "-500px", color = "#F2C766" }) {
  const rays = [0, 45, 90, 135, 180, 225, 270, 315]
  return (
    <div className="absolute pointer-events-none" style={{ bottom, left }}>
      <span
        className="absolute bottom-0 left-0 w-[3px] rounded-full origin-bottom animate-firework-streak"
        style={{ background: `linear-gradient(to top, transparent, ${color})`, "--rise": rise, animationDelay: delay }}
      />
      <span
        className="absolute bottom-0 left-0 w-[4px] h-[4px] rounded-full animate-firework-trail"
        style={{ background: color, "--rise": rise, animationDelay: delay, boxShadow: `0 0 6px 2px ${color}` }}
      />
      <div className="absolute bottom-0 left-0" style={{ transform: `translateY(${rise})` }}>
        {rays.map((angle) => (
          <span key={angle}
            className="absolute top-0 left-0 w-[5px] h-[5px] rounded-full animate-firework-burst-ray"
            style={{
              background: color,
              "--angle": `${angle}deg`,
              animationDelay: delay,
              boxShadow: `0 0 6px 1px ${color}`,
            }}
          />
        ))}
      </div>
    </div>
  )
}