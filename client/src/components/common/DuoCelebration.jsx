import { useEffect, useRef } from "react"
import TrophySparkles from "./TrophySparkles"
import FireworkBurst from "./FireworkBurst"
import LetterReveal from "./LetterReveal"

// Two-player side-by-side celebration for Duo Tournament champions
export default function DuoCelebration({ trophyImage, player1, player2 }) {
  const audioRef = useRef(null)

  useEffect(() => {
    audioRef.current?.play?.().catch(() => {})
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center celebration-vignette backdrop-blur-sm animate-celebration-backdrop overflow-hidden">
      <audio ref={audioRef} src="/sounds/crowd-cheer.mp3" preload="auto" />
      <FireworkBurst bottom="0" left="10%"  delay="0s"   rise="-600px" />
      <FireworkBurst bottom="0" left="88%"  delay="0.5s" rise="-650px" color="#fff" />
      <FireworkBurst bottom="0" left="50%"  delay="1s"   rise="-700px" />
      <FireworkBurst bottom="0" left="5%"   delay="1.5s" rise="-550px" color="#fff" />
      <FireworkBurst bottom="0" left="93%"  delay="2s"   rise="-620px" />

      <div className="relative mx-4 text-center animate-champion-pop">
        {/* Trophy + eyebrow */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-3 animate-trophy-float">
            <div className="absolute inset-0 rounded-full bg-gold/25 blur-xl animate-glow-pulse" />
            <TrophySparkles />
            <img src={trophyImage} alt="Duo Trophy" className="relative w-20 h-20 sm:w-24 sm:h-24 object-contain animate-trophy-reveal" />
          </div>
          <p className="section-label text-gold/80">Duo Tournament Champions</p>
        </div>

        {/* Two player cards side by side */}
        <div className="flex items-stretch gap-4 sm:gap-6">
          {[player1, player2].map((p, i) => (
            <div key={i}
              className="flex-1 relative bg-gradient-to-b from-pitch-800 to-pitch-900 border-2 border-gold/50
                         shadow-[0_0_50px_rgba(245,158,11,0.25)] rounded-2xl px-4 py-6 sm:px-6 sm:py-8
                         overflow-hidden min-w-[130px] max-w-[180px]">
              {p?.bgImage && (
                <>
                  <div className="absolute inset-0 bg-cover bg-top opacity-40" style={{ backgroundImage: `url(${p.bgImage})` }} />
                  <div className="absolute inset-0 bg-pitch-900/60" />
                </>
              )}
              <div className="relative">
                {p?.avatar ? (
                  <img src={p.avatar} alt={p.name}
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover mx-auto mb-3 border-2 border-gold/40 shadow-[0_0_20px_rgba(245,158,11,0.3)]" />
                ) : (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-pitch-700 border-2 border-gold/40 mx-auto mb-3 flex items-center justify-center text-2xl font-bold text-gold">
                    {p?.name?.[0] ?? "?"}
                  </div>
                )}
                <LetterReveal
                  text={p?.name ?? ""}
                  className="block text-lg sm:text-xl font-extrabold text-gold tracking-tight"
                />
                <p className="text-slate-400 text-xs mt-1">
                  {i === 0 ? "Set 1" : "Set 2"}
                </p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-slate-300 text-sm mt-5">are the Duo Tournament Champions! 🎉</p>
      </div>
    </div>
  )
}