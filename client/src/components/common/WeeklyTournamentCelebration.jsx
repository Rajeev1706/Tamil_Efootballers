import { useEffect, useRef, useState } from "react"
import FireworkBurst  from "../common/FireworkBurst"
import TrophySparkles from "../common/TrophySparkles"
import LetterReveal   from "../common/LetterReveal"
import CountUp        from "./CountUp"
import weeklyCardImg  from "../../../images/weeklycard.png"
import weeklyTrophy   from "../../../images/Weekly.png"
import goldenBootLogo from "../../../images/Golden Boot.png"

export default function WeeklyTournamentCelebration({ name, avatarThumb, anthemUrl, scorer, onDismiss }) {
  const audioRef = useRef(null)
  const [animatedGoals, setAnimatedGoals] = useState(0)

  useEffect(() => {
    audioRef.current?.play?.().catch(() => {})
  }, [])

  useEffect(() => {
    if (!scorer) return
    const t = setTimeout(() => setAnimatedGoals(scorer.goals), 50)
    return () => clearTimeout(t)
  }, [scorer?.goals])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center
                 celebration-vignette backdrop-blur-sm animate-celebration-backdrop overflow-hidden"
      onClick={onDismiss}
    >
      <audio ref={audioRef} src={anthemUrl || "/sounds/crowd-cheer.mp3"} preload="auto" />

      <FireworkBurst bottom="0" left="10%"  delay="0s"   rise="-620px" />
      <FireworkBurst bottom="0" left="85%"  delay="0.6s" rise="-680px" color="#fff" />
      <FireworkBurst bottom="0" left="5%"   delay="1.2s" rise="-540px" />
      <FireworkBurst bottom="0" left="92%"  delay="1.8s" rise="-600px" color="#fff" />
      <FireworkBurst bottom="0" left="50%"  delay="0.9s" rise="-720px" />

      {/* Card */}
      <div
        className="relative animate-champion-pop overflow-hidden rounded-2xl"
        style={{ width: "clamp(300px, 68vw, 440px)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Card frame */}
        <img src={weeklyCardImg} alt="" className="w-full h-auto" draggable={false} />

        {/* Weekly trophy */}
        <div
          className="absolute"
          style={{ top: "12%", left: "50%", transform: "translateX(-50%)", width: "30%" }}
        >
          <div className="animate-trophy-float">
            <div className="absolute inset-0 rounded-full bg-gold/20 blur-lg animate-glow-pulse" />
            <TrophySparkles />
            <img
              src={weeklyTrophy}
              alt="Weekly Trophy"
              className="relative w-full h-auto object-contain animate-trophy-reveal"
            />
          </div>
        </div>

        {/* Player avatar */}
        <div
          className="absolute"
          style={{ top: "40%", left: "50%", transform: "translateX(-50%)", width: "26%", paddingTop: "26%" }}
        >
          <div className="absolute inset-0 rounded-xl bg-red-600/30 blur-md animate-glow-pulse" />
          {avatarThumb ? (
            <img
              src={avatarThumb}
              alt={name}
              className="absolute inset-0 w-full h-full object-cover rounded-xl border border-white/20"
              style={{ boxShadow: "0 0 16px rgba(220,30,30,0.5)" }}
            />
          ) : (
            <div
              className="absolute inset-0 w-full h-full rounded-xl bg-pitch-800 border border-white/10
                         flex items-center justify-center font-black text-white/30"
              style={{ fontSize: "clamp(14px, 3vw, 22px)" }}
            >
              {name?.[0]}
            </div>
          )}
        </div>

        {/* Player name — below avatar */}
        <div
          className="absolute left-0 right-0 text-center px-4"
          style={{ top: "60%" }}
        >
          <LetterReveal
            text={name}
            className="block font-black text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] tracking-wide"
            style={{ fontSize: "clamp(13px, 2.8vw, 22px)" }}
          />
        </div>

        {/* Golden Boot — inside card above WEEKLY WINNER text */}
        {scorer && (
          <div
            className="absolute left-0 right-0 flex items-center justify-center gap-1.5 px-6 z-10"
            style={{ top: "65%" }}
          >
          <div className="flex items-center gap-2">
              <img src={goldenBootLogo} alt="Golden Boot" className="object-contain flex-shrink-0"
                style={{ width: "clamp(26px, 4.5vw, 36px)", height: "clamp(26px, 4.5vw, 36px)" }} />
              <p className="font-bold text-amber-400"
                style={{ fontSize: "clamp(12px, 2.5vw, 18px)" }}>
                {scorer.name} — <CountUp value={animatedGoals} duration={3000} /> goals
              </p>
            </div>
          </div>
        )}
      </div>

      <p
        className="absolute bottom-8 text-xs text-slate-500 animate-celebration-backdrop"
        onClick={onDismiss}
      >
        Tap anywhere to dismiss
      </p>
    </div>
  )
}