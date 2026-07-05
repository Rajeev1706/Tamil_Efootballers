import LetterReveal from "./LetterReveal"
import TrophySparkles from "./TrophySparkles"

// Full-screen "champion decided" takeover — dimmed vignette backdrop, a
// trophy with a 3D landing animation + idle float + twinkling sparkles,
// and the champion's name revealed letter by letter. `children` renders
// extra content below the subtitle (e.g. a team's player roster).
export default function ChampionCelebration({ trophyImage, eyebrow, title, subtitle, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center celebration-vignette backdrop-blur-sm animate-celebration-backdrop overflow-hidden">
      <div className="relative animate-champion-pop animate-shine-sweep
                       bg-gradient-to-b from-pitch-800 to-pitch-900 border-2 border-gold/50
                       shadow-[0_0_80px_rgba(245,158,11,0.3)] rounded-2xl
                       px-14 py-14 mx-4 max-w-lg text-center">
        <div className="relative w-32 h-32 mx-auto mb-6 animate-trophy-float">
          <div className="absolute inset-0 rounded-full bg-gold/25 blur-xl animate-glow-pulse" />
          <TrophySparkles />
          <img src={trophyImage} alt={eyebrow} className="relative w-32 h-32 object-contain animate-trophy-reveal" />
        </div>
        <p className="section-label text-gold/80 mb-2">{eyebrow}</p>
        <LetterReveal
          text={title}
          className="block text-4xl font-extrabold text-gold mb-2 tracking-tight"
        />
        <p className="text-slate-300 text-sm">{subtitle}</p>
        {children}
      </div>
    </div>
  )
}