import { useEffect, useRef } from "react"
import FireworkBurst  from "../common/FireworkBurst"
import TrophySparkles from "../common/TrophySparkles"
import LetterReveal   from "../common/LetterReveal"
import tcCardImg          from "../../../images/tc.png"
import championshipTrophy from "../../../images/championship.png"

export default function ChampionshipCelebration({ teamName, teamLogo, players = [], onDismiss }) {
  const audioRef = useRef(null)

  useEffect(() => {
    audioRef.current?.play?.().catch(() => {})
  }, [])

  // Auto-dismiss after 10 seconds
  useEffect(() => {
    const timer = setTimeout(() => onDismiss?.(), 10000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center
                 celebration-vignette backdrop-blur-sm animate-celebration-backdrop overflow-hidden"
      onClick={onDismiss}
    >
      <audio ref={audioRef} src="/sounds/crowd-cheer.mp3" preload="auto" />

      <FireworkBurst bottom="0" left="10%"  delay="0s"   rise="-620px" color="#f59e0b" />
      <FireworkBurst bottom="0" left="85%"  delay="0.6s" rise="-680px" color="#fbbf24" />
      <FireworkBurst bottom="0" left="5%"   delay="1.2s" rise="-540px" color="#f59e0b" />
      <FireworkBurst bottom="0" left="92%"  delay="1.8s" rise="-600px" color="#fbbf24" />
      <FireworkBurst bottom="0" left="50%"  delay="0.9s" rise="-720px" color="#f59e0b" />

      {/* Card */}
      <div
        className="relative animate-champion-pop overflow-hidden rounded-2xl flex-shrink-0"
        style={{ width: "clamp(260px, 55vw, 380px)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Card background — tc.png already has all text/design */}
        <img src={tcCardImg} alt="" className="w-full h-auto" draggable={false} />

        {/* Championship trophy — top area */}
        <div
          className="absolute"
          style={{ top: "6%", left: "50%", transform: "translateX(-50%)", width: "25%" }}
        >
          <div className="animate-trophy-float">
            <div className="absolute inset-0 rounded-full bg-amber-500/20 blur-lg animate-glow-pulse" />
            <TrophySparkles />
            <img
              src={championshipTrophy}
              alt="Championship Trophy"
              className="relative w-full h-auto object-contain animate-trophy-reveal"
            />
          </div>
        </div>

        {/* Team logo — center */}
        <div
          className="absolute"
          style={{ top: "36%", left: "50%", transform: "translateX(-50%)", width: "24%", paddingTop: "24%" }}
        >
          <div className="absolute inset-0 rounded-xl bg-amber-500/30 blur-md animate-glow-pulse" />
          {teamLogo ? (
            <img
              src={teamLogo}
              alt={teamName}
              className="absolute inset-0 w-full h-full object-cover rounded-xl border border-white/20"
              style={{ boxShadow: "0 0 20px rgba(245,158,11,0.6)" }}
            />
          ) : (
            <div
              className="absolute inset-0 w-full h-full rounded-xl bg-pitch-800 border border-white/10
                         flex items-center justify-center font-black text-white/30"
              style={{ fontSize: "clamp(14px, 3vw, 22px)" }}
            >
              {teamName?.[0]}
            </div>
          )}
        </div>

        {/* Team name — sits above the card's baked-in text */}
        <div
          className="absolute left-0 right-0 text-center px-4"
          style={{ top: "58%" }}
        >
          <LetterReveal
            text={teamName}
            className="block font-black text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] tracking-wide"
            style={{ fontSize: "clamp(13px, 2.6vw, 20px)" }}
          />
        </div>
      </div>

      {/* Player names — below card */}
      {players.length > 0 && (
        <div
          className="mt-3 px-6 animate-celebration-backdrop max-w-lg w-full"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex flex-wrap justify-center gap-1.5">
            {players.map((p, i) => (
              <span key={i}
                className="text-xs font-semibold text-white/80 bg-white/10 border border-white/15
                           rounded-full px-2.5 py-1 backdrop-blur-sm">
                {p.name || p}
              </span>
            ))}
          </div>
        </div>
      )}

      <p
        className="mt-4 text-xs text-slate-500 animate-celebration-backdrop"
        onClick={onDismiss}
      >
        Tap anywhere to dismiss
      </p>
    </div>
  )
}