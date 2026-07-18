import LetterReveal from "./LetterReveal"

// Rough-edged diagonal gold streaks in the corners, approximating a
// brush-painted texture across the black card — built from angled,
// clipped gradient bars since there's no texture image asset to draw on.
function BrushStrokes() {
  const stroke = "linear-gradient(100deg, transparent 0%, #B8860B 15%, #F2C766 35%, #B8860B 55%, transparent 75%)"
  return (
    <>
      <div className="absolute -top-6 -left-10 w-64 h-16 opacity-70 pointer-events-none"
        style={{ background: stroke, transform: "rotate(-20deg)", clipPath: "polygon(0% 30%, 100% 0%, 100% 70%, 0% 100%)" }} />
      <div className="absolute top-6 -left-16 w-52 h-10 opacity-40 pointer-events-none"
        style={{ background: stroke, transform: "rotate(-18deg)", clipPath: "polygon(0% 20%, 100% 0%, 100% 80%, 0% 100%)" }} />
      <div className="absolute -bottom-6 -right-10 w-64 h-16 opacity-70 pointer-events-none"
        style={{ background: stroke, transform: "rotate(-20deg)", clipPath: "polygon(0% 30%, 100% 0%, 100% 70%, 0% 100%)" }} />
      <div className="absolute bottom-6 -right-16 w-52 h-10 opacity-40 pointer-events-none"
        style={{ background: stroke, transform: "rotate(-18deg)", clipPath: "polygon(0% 20%, 100% 0%, 100% 80%, 0% 100%)" }} />
    </>
  )
}

// A real two-stage firework: a small bright spark climbs from the bottom
// (the "trail"), then right as it arrives, 8 rays burst outward from that
// point and fade — not a static burst that just appears in place. Loops
// continuously; --rise controls how high it climbs before bursting.
function FireworkBurst({ bottom, left, delay = "0s", rise = "-500px", color = "#F2C766" }) {
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

// Season's pinnacle award — black card, gold brush-stroke corners, a
// circular star-flanked medallion, and the winner's name in a bold
// brush-script font, matching the reference style directly.
export default function BallonDorCelebration({ trophyImage, winnerName, bdrPoints, avatarImage, bgImage }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md animate-celebration-backdrop overflow-hidden">
      <FireworkBurst bottom="0" left="15%" delay="0s" rise="-620px" />
      <FireworkBurst bottom="0" left="82%" delay="0.6s" rise="-680px" color="#fff" />
      <FireworkBurst bottom="0" left="8%" delay="1.2s" rise="-540px" />
      <FireworkBurst bottom="0" left="90%" delay="1.8s" rise="-600px" color="#fff" />
      <FireworkBurst bottom="0" left="50%" delay="0.9s" rise="-720px" />

      <div className="relative animate-champion-pop bg-black border-2 rounded-[24px]
                       px-7 py-10 sm:px-10 sm:py-12 mx-4 w-[min(26rem,calc(100vw-2rem))] text-center overflow-hidden"
        style={{ borderColor: "#D9A441", boxShadow: "0 0 60px rgba(217,164,65,0.25)" }}
      >
        {bgImage && (
          <>
            <div className="absolute inset-0 bg-cover bg-top" style={{ backgroundImage: `url(${bgImage})` }} />
            <div className="absolute inset-0 bg-black/50" />
          </>
        )}
        <BrushStrokes />

        <div className="relative z-10">
          {avatarImage ? (
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 mx-auto mb-5 animate-trophy-float">
              <div className="absolute inset-0 rounded-full bg-gold/25 blur-xl animate-glow-pulse" />
              <img
                src={avatarImage}
                alt=""
                className="relative w-24 h-24 sm:w-28 sm:h-28 object-cover rounded-full border-2"
                style={{ borderColor: "#D9A441" }}
              />
              <img src={trophyImage} alt="Ballon d'Or" className="absolute -bottom-2 -right-2 w-10 h-10 sm:w-12 sm:h-12 object-contain drop-shadow-lg" />
            </div>
          ) : (
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 mx-auto mb-5 animate-trophy-float">
              <div className="absolute inset-0 rounded-full bg-gold/25 blur-xl animate-glow-pulse" />
              <img src={trophyImage} alt="Ballon d'Or" className="relative w-24 h-24 sm:w-28 sm:h-28 object-contain animate-trophy-reveal" />
            </div>
          )}

          <p className="text-sm sm:text-base font-bold uppercase tracking-[0.15em] mb-3" style={{ color: "#F2C766" }}>
            Ballon d'Or
          </p>

          <LetterReveal
            text={winnerName}
            className="block mb-3 leading-tight"
            style={{
              fontFamily: "'Kaushan Script', cursive",
              fontSize: "clamp(2.5rem, 10vw, 3.75rem)",
              color: "#F2C766",
              textShadow: "0 0 18px rgba(242,199,102,0.5)",
            }}
          />

          <p className="text-white text-sm sm:text-base mb-5">is the Season's Best Player 🏆</p>

          <div className="flex items-center justify-center gap-3 mb-1">
            <span className="h-px w-16" style={{ background: "linear-gradient(to right, transparent, #D9A441)" }} />
            <span className="w-2 h-2 rotate-45" style={{ background: "#D9A441" }} />
            <span className="h-px w-16" style={{ background: "linear-gradient(to left, transparent, #D9A441)" }} />
          </div>

          {bdrPoints != null && (
            <p className="mt-4 text-sm" style={{ color: "#C9A24B" }}>
              <span className="text-xl font-bold" style={{ color: "#F2C766" }}>{bdrPoints}</span>{" "}
              <span className="text-slate-400">Total BDR</span>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}