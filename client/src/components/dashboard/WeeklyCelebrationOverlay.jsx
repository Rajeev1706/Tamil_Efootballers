import { useEffect, useRef, useState } from "react"
import FireworkBurst   from "../common/FireworkBurst"
import TrophySparkles  from "../common/TrophySparkles"
import LetterReveal    from "../common/LetterReveal"
import CountUp         from "../common/CountUp"
import weekCardImg     from "../../../images/weekcard.png"
import weekTrophyImg   from "../../../images/weektrophy.png"
import { getAvatarById } from "../../lib/avatars"

const AUTO_DISMISS_SEC = 10

export default function WeeklyCelebrationOverlay({ settings, onDismiss }) {
  const [seconds, setSeconds]         = useState(AUTO_DISMISS_SEC)
  const [animatedPts, setAnimatedPts] = useState(0)
  const audioRef = useRef(null)

  const powerName   = settings.weekly_celebration_power_name
  const avatarUrl   = settings.weekly_celebration_power_avatar_url
  const avatarId    = settings.weekly_celebration_power_avatar_id
  const preset      = getAvatarById(avatarId ? parseInt(avatarId) : null)
  const avatarSrc   = avatarUrl || preset?.full || preset?.thumb
  const powerPoints = parseInt(settings.weekly_celebration_power_points || "0")
  const powerWins   = settings.weekly_celebration_power_wins

  useEffect(() => {
    audioRef.current?.play?.().catch(() => {})
    const t = setTimeout(() => setAnimatedPts(powerPoints), 50)
    return () => clearTimeout(t)
  }, [powerPoints])

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
    const h = (e) => { if (e.key === "Escape") onDismiss() }
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [onDismiss])

  if (!powerName) return null

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center
                 celebration-vignette backdrop-blur-sm animate-celebration-backdrop overflow-hidden"
      onClick={onDismiss}
    >
      <audio ref={audioRef} src="/sounds/crowd-cheer.mp3" preload="auto" />

      <FireworkBurst bottom="0" left="10%"  delay="0s"   rise="-620px" color="#22c55e" />
      <FireworkBurst bottom="0" left="85%"  delay="0.6s" rise="-680px" color="#fff" />
      <FireworkBurst bottom="0" left="5%"   delay="1.2s" rise="-540px" color="#4ade80" />
      <FireworkBurst bottom="0" left="92%"  delay="1.8s" rise="-600px" color="#fff" />
      <FireworkBurst bottom="0" left="50%"  delay="0.9s" rise="-720px" />

      {/* Card */}
      <div
        className="relative animate-champion-pop overflow-hidden rounded-2xl"
        style={{ width: "clamp(300px, 68vw, 440px)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Card frame */}
        <img src={weekCardImg} alt="" className="w-full h-auto" draggable={false} />

        {/* Week trophy */}
        <div
          className="absolute"
          style={{ top: "8%", left: "50%", transform: "translateX(-50%)", width: "26%" }}
        >
          <div className="animate-trophy-float">
            <div className="absolute inset-0 rounded-full bg-green-500/20 blur-lg animate-glow-pulse" />
            <TrophySparkles />
            <img src={weekTrophyImg} alt="Week Trophy"
              className="relative w-full h-auto object-contain animate-trophy-reveal" />
          </div>
        </div>

        {/* Player avatar */}
        <div
          className="absolute"
          style={{ top: "36%", left: "50%", transform: "translateX(-50%)", width: "26%", paddingTop: "26%" }}
        >
          <div className="absolute inset-0 rounded-xl bg-green-500/20 blur-md animate-glow-pulse" />
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt={powerName}
              className="absolute inset-0 w-full h-full object-cover rounded-xl border border-green-500/20"
              style={{ boxShadow: "0 0 16px rgba(34,197,94,0.4)" }}
            />
          ) : (
            <div
              className="absolute inset-0 w-full h-full rounded-xl bg-pitch-800 border border-green-500/20
                         flex items-center justify-center font-black text-white/30"
              style={{ fontSize: "clamp(16px, 3.5vw, 28px)" }}
            >
              {powerName?.[0]}
            </div>
          )}
        </div>

        {/* Player name — below avatar */}
        <div
          className="absolute left-0 right-0 text-center px-4"
          style={{ top: "58%" }}
        >
          <LetterReveal
            text={powerName}
            className="block font-black text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] tracking-wide"
            style={{ fontSize: "clamp(13px, 2.8vw, 22px)" }}
          />
        </div>

        {/* Points */}
        <div
          className="absolute left-0 right-0 text-center z-10"
          style={{ top: "64%" }}
        >
          <p className="font-bold text-green-400"
            style={{ fontSize: "clamp(12px, 2.5vw, 18px)" }}>
            <CountUp value={animatedPts} duration={3000} /> pts · {powerWins}W
          </p>
        </div>
      </div>

      <p
        className="mt-4 text-xs text-slate-500 animate-celebration-backdrop"
        onClick={onDismiss}
      >
        Tap anywhere to dismiss
      </p>
    </div>
  )
}