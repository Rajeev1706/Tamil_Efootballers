import { useEffect, useRef, useState } from "react"
import FireworkBurst   from "../common/FireworkBurst"
import TrophySparkles  from "../common/TrophySparkles"
import LetterReveal    from "../common/LetterReveal"
import CountUp         from "./CountUp"
import dshannCardImg   from "../../../images/dshanncard.png"
import teamLeagueTrophy from "../../../images/Team League.png"
import tlGoldenBootLogo from "../../../images/team league_gb.png"

export default function DshannLeagueCelebration({ teamName, teamLogo, scorer, players = [], anthemUrl, onDismiss }) {
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
        <img src={dshannCardImg} alt="" className="w-full h-auto" draggable={false} />

        {/* Team League trophy */}
        <div
          className="absolute"
          style={{ top: "12%", left: "50%", transform: "translateX(-50%)", width: "30%" }}
        >
          <div className="animate-trophy-float">
            <div className="absolute inset-0 rounded-full bg-purple-500/20 blur-lg animate-glow-pulse" />
            <TrophySparkles />
            <img
              src={teamLeagueTrophy}
              alt="Dshann League Trophy"
              className="relative w-full h-auto object-contain animate-trophy-reveal"
            />
          </div>
        </div>

        {/* Team logo */}
        <div
          className="absolute"
          style={{ top: "40%", left: "50%", transform: "translateX(-50%)", width: "26%", paddingTop: "26%" }}
        >
          <div className="absolute inset-0 rounded-xl bg-purple-500/30 blur-md animate-glow-pulse" />
          {teamLogo ? (
            <img
              src={teamLogo}
              alt={teamName}
              className="absolute inset-0 w-full h-full object-cover rounded-xl border border-white/20"
              style={{ boxShadow: "0 0 16px rgba(147,51,234,0.5)" }}
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

        {/* Team name */}
        <div
          className="absolute left-0 right-0 text-center px-4"
          style={{ top: "60%" }}
        >
          <LetterReveal
            text={teamName}
            className="block font-black text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] tracking-wide"
            style={{ fontSize: "clamp(13px, 2.8vw, 22px)" }}
          />
        </div>

        {/* TL Golden Boot */}
        {scorer && (
          <div
            className="absolute left-0 right-0 flex items-center justify-center gap-2 z-10"
            style={{ top: "65%" }}
          >
            <img src={tlGoldenBootLogo} alt="Golden Boot" className="object-contain flex-shrink-0"
              style={{ width: "clamp(26px, 4.5vw, 36px)", height: "clamp(26px, 4.5vw, 36px)" }} />
            <p className="font-bold text-amber-400"
              style={{ fontSize: "clamp(12px, 2.5vw, 18px)" }}>
              {scorer.name} — <CountUp value={animatedGoals} duration={3000} /> goals
            </p>
          </div>
        )}
      </div>

      <p
        className="absolute bottom-8 text-xs text-slate-500 animate-celebration-backdrop"
        onClick={onDismiss}
      >
        Tap anywhere to dismiss
      </p>

      {/* Squad player names — below card */}
      {players.length > 0 && (
        <div
          className="absolute left-0 right-0 px-6 animate-celebration-backdrop"
          style={{ bottom: "60px" }}
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
    </div>
  )
}