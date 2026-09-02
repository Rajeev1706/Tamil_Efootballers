import { useEffect, useRef, useState } from "react"
import FireworkBurst  from "../common/FireworkBurst"
import TrophySparkles from "../common/TrophySparkles"
import LetterReveal   from "../common/LetterReveal"
import CountUp        from "./CountUp"
import duoCardImg     from "../../../images/duocard.png"
import duoTrophyImg   from "../../../images/duo.png"
import duoBootImg     from "../../../images/duoboot.png"

// Single player card using duocard.png frame
function DuoCard({ name, avatarUrl }) {
  return (
    <div
      className="relative animate-champion-pop overflow-hidden rounded-2xl flex-shrink-0"
      style={{ width: "clamp(210px, 38vw, 290px)" }}
    >
      {/* Card frame */}
      <img src={duoCardImg} alt="" className="w-full h-auto" draggable={false} />

      {/* Duo trophy */}
      <div
        className="absolute"
        style={{ top: "12%", left: "50%", transform: "translateX(-50%)", width: "30%" }}
      >
        <div className="animate-trophy-float">
          <div className="absolute inset-0 rounded-full bg-gold/20 blur-lg animate-glow-pulse" />
          <TrophySparkles />
          <img src={duoTrophyImg} alt="Duo Trophy"
            className="relative w-full h-auto object-contain animate-trophy-reveal" />
        </div>
      </div>

      {/* Player avatar */}
      <div
        className="absolute"
        style={{ top: "36%", left: "50%", transform: "translateX(-50%)", width: "32%", paddingTop: "32%" }}
      >
        <div className="absolute inset-0 rounded-xl bg-gold/20 blur-md animate-glow-pulse" />
        {avatarUrl ? (
          <img src={avatarUrl} alt={name}
            className="absolute inset-0 w-full h-full object-cover rounded-xl border border-white/20"
            style={{ boxShadow: "0 0 16px rgba(212,175,55,0.5)" }}
          />
        ) : (
          <div
            className="absolute inset-0 w-full h-full rounded-xl bg-pitch-800 border border-white/10
                       flex items-center justify-center font-black text-white/30"
            style={{ fontSize: "clamp(16px, 3vw, 24px)" }}
          >
            {name?.[0]}
          </div>
        )}
      </div>

      {/* Player name */}
      <div
        className="absolute left-0 right-0 text-center px-2"
        style={{ top: "64%" }}
      >
        <LetterReveal
          text={name}
          className="block font-black text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] tracking-wide"
          style={{ fontSize: "clamp(11px, 2.2vw, 17px)" }}
        />
      </div>
    </div>
  )
}

const AUTO_DISMISS_SEC = 10

export default function DuoWinnerCelebration({ player1, player2, scorer, onDismiss }) {
  const audioRef = useRef(null)
  const [animatedGoals, setAnimatedGoals] = useState(0)
  const [seconds, setSeconds] = useState(AUTO_DISMISS_SEC)

  useEffect(() => {
    audioRef.current?.play?.().catch(() => {})
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) { clearInterval(interval); onDismiss(); return 0 }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [onDismiss])

  useEffect(() => {
    if (!scorer) return
    const t = setTimeout(() => setAnimatedGoals(scorer.goals), 50)
    return () => clearTimeout(t)
  }, [scorer?.goals])

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center
                 celebration-vignette backdrop-blur-sm animate-celebration-backdrop overflow-hidden"
      onClick={onDismiss}
    >
      <audio ref={audioRef} src="/sounds/crowd-cheer.mp3" preload="auto" />

      <FireworkBurst bottom="0" left="8%"  delay="0s"   rise="-600px" />
      <FireworkBurst bottom="0" left="90%" delay="0.5s" rise="-650px" color="#fff" />
      <FireworkBurst bottom="0" left="50%" delay="0.8s" rise="-700px" />
      <FireworkBurst bottom="0" left="20%" delay="1.3s" rise="-580px" color="#fff" />
      <FireworkBurst bottom="0" left="75%" delay="1.7s" rise="-630px" />

      {/* Two cards side by side */}
      <div className="flex gap-4 sm:gap-6 items-start" onClick={e => e.stopPropagation()}>
        <DuoCard name={player1?.name} avatarUrl={player1?.avatar} />
        <DuoCard name={player2?.name} avatarUrl={player2?.avatar} />
      </div>

      {/* Golden boot — centered below both cards */}
      {scorer && (
        <div
          className="flex items-center gap-2 mt-4 animate-celebration-backdrop"
          onClick={e => e.stopPropagation()}
        >
          <img src={duoBootImg} alt="Duo Golden Boot" className="object-contain flex-shrink-0"
            style={{ width: "clamp(26px, 4.5vw, 36px)", height: "clamp(26px, 4.5vw, 36px)" }} />
          <p className="font-bold text-amber-400"
            style={{ fontSize: "clamp(12px, 2.5vw, 18px)" }}>
            {scorer.name} — <CountUp value={animatedGoals} duration={3000} /> goals
          </p>
        </div>
      )}

      <p className="mt-4 text-xs text-slate-500 animate-celebration-backdrop"
        onClick={onDismiss}>
        Tap anywhere to dismiss
      </p>
    </div>
  )
}