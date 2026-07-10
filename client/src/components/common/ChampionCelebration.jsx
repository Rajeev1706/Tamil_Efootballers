import { useEffect, useRef } from "react"
import LetterReveal from "./LetterReveal"
import TrophySparkles from "./TrophySparkles"

// Full-screen "champion decided" takeover — dimmed vignette backdrop, a
// trophy with a 3D landing animation + idle float + twinkling sparkles,
// and the champion's name revealed letter by letter. `children` renders
// extra content below the subtitle (e.g. a team's player roster).
export default function ChampionCelebration({ trophyImage, eyebrow, title, subtitle, badgeImage, children }) {
  const audioRef = useRef(null)

  useEffect(() => {
    // Browsers block audio with sound unless the user has already
    // interacted with the page — this can legitimately fail on a fresh
    // page load, which is expected and fine, so the .catch() just swallows
    // it rather than throwing a console error.
    audioRef.current?.play?.().catch(() => {})
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center celebration-vignette backdrop-blur-sm animate-celebration-backdrop overflow-hidden">
      <audio ref={audioRef} src="/sounds/crowd-cheer.mp3" preload="auto" />
      <div className="relative animate-champion-pop animate-shine-sweep
                       bg-gradient-to-b from-pitch-800 to-pitch-900 border-2 border-gold/50
                       shadow-[0_0_80px_rgba(245,158,11,0.3)] rounded-2xl
                       px-6 py-8 sm:px-14 sm:py-14 mx-4 max-w-[26rem] text-center">
        <div className="relative w-24 h-24 sm:w-32 sm:h-32 mx-auto mb-4 sm:mb-6 animate-trophy-float">
          <div className="absolute inset-0 rounded-full bg-gold/25 blur-xl animate-glow-pulse" />
          <TrophySparkles />
          <img src={trophyImage} alt={eyebrow} className="relative w-24 h-24 sm:w-32 sm:h-32 object-contain animate-trophy-reveal" />
        </div>
        <p className="section-label text-gold/80 mb-2">{eyebrow}</p>
        {badgeImage && (
          <img src={badgeImage} alt="" className="w-11 h-11 sm:w-14 sm:h-14 object-cover rounded-full mx-auto mb-3 border-2 border-gold/40 shadow-[0_0_20px_rgba(245,158,11,0.25)]" />
        )}
        <LetterReveal
          text={title}
          className="block text-3xl sm:text-4xl font-extrabold text-gold mb-2 tracking-tight"
        />
        <p className="text-slate-300 text-sm">{subtitle}</p>
        {children}
      </div>
    </div>
  )
}