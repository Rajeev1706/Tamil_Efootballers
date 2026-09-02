import { useEffect, useRef } from "react"
import FireworkBurst  from "../common/FireworkBurst"
import TrophySparkles from "../common/TrophySparkles"
import LetterReveal   from "../common/LetterReveal"
import revCardImg     from "../../../images/revcard.png"
import revTrophyImg   from "../../../images/revolution.png"

export default function RevolutionCelebration({ name, avatarThumb, anthemUrl, onDismiss }) {
  const audioRef = useRef(null)

  useEffect(() => {
    audioRef.current?.play?.().catch(() => {})
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center
                 celebration-vignette backdrop-blur-sm animate-celebration-backdrop overflow-hidden"
      onClick={onDismiss}
    >
      <audio ref={audioRef} src={anthemUrl || "/sounds/crowd-cheer.mp3"} preload="auto" />

      <FireworkBurst bottom="0" left="10%"  delay="0s"   rise="-620px" color="#3b82f6" />
      <FireworkBurst bottom="0" left="85%"  delay="0.6s" rise="-680px" color="#fff" />
      <FireworkBurst bottom="0" left="5%"   delay="1.2s" rise="-540px" color="#60a5fa" />
      <FireworkBurst bottom="0" left="92%"  delay="1.8s" rise="-600px" color="#fff" />
      <FireworkBurst bottom="0" left="50%"  delay="0.9s" rise="-720px" />

      {/* Card */}
      <div
        className="relative animate-champion-pop overflow-hidden rounded-2xl"
        style={{ width: "clamp(300px, 68vw, 440px)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Card frame */}
        <img src={revCardImg} alt="" className="w-full h-auto" draggable={false} />

        {/* Revolution trophy */}
        <div
          className="absolute"
          style={{ top: "12%", left: "50%", transform: "translateX(-50%)", width: "30%" }}
        >
          <div className="animate-trophy-float">
            <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-lg animate-glow-pulse" />
            <TrophySparkles />
            <img
              src={revTrophyImg}
              alt="Revolution Trophy"
              className="relative w-full h-auto object-contain animate-trophy-reveal"
            />
          </div>
        </div>

        {/* Player avatar */}
        <div
          className="absolute"
          style={{ top: "40%", left: "50%", transform: "translateX(-50%)", width: "26%", paddingTop: "26%" }}
        >
          <div className="absolute inset-0 rounded-xl bg-blue-500/30 blur-md animate-glow-pulse" />
          {avatarThumb ? (
            <img
              src={avatarThumb}
              alt={name}
              className="absolute inset-0 w-full h-full object-cover rounded-xl border border-white/20"
              style={{ boxShadow: "0 0 16px rgba(59,130,246,0.5)" }}
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

        {/* Player name */}
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