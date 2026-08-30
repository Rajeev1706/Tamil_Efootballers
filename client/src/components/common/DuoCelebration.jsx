import { useEffect, useRef } from "react"
import FireworkBurst from "./FireworkBurst"

export default function DuoCelebration({ trophyImage, player1, player2 }) {
  const audioRef = useRef(null)

  useEffect(() => {
    audioRef.current?.play?.().catch(() => {})
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-pitch-900/80 overflow-hidden"
      style={{ animation: "fadeIn 0.4s ease" }}>
      <style>{`@keyframes fadeIn { from { opacity:0 } to { opacity:1 } }`}</style>
      <audio ref={audioRef} src="/sounds/crowd-cheer.mp3" preload="auto" />

      <FireworkBurst bottom="0" left="10%"  delay="0s"   rise="-600px" />
      <FireworkBurst bottom="0" left="88%"  delay="0.5s" rise="-650px" color="#fff" />
      <FireworkBurst bottom="0" left="50%"  delay="1s"   rise="-700px" />

      <div className="relative mx-4 text-center">
        {/* Trophy */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative w-20 h-20 mx-auto mb-3">
            <div className="absolute inset-0 rounded-full bg-gold/25 blur-xl" />
            <img src={trophyImage} alt="Duo Trophy" className="relative w-20 h-20 object-contain" />
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-gold/80">Duo Tournament Champions</p>
        </div>

        {/* Two player cards */}
        <div className="flex items-stretch gap-4 sm:gap-6">
          {[player1, player2].map((p, i) => (
            <div key={i}
              className="flex-1 relative bg-gradient-to-b from-pitch-800 to-pitch-900 border-2 border-gold/50
                         rounded-2xl px-4 py-6 overflow-hidden min-w-[130px] max-w-[180px]
                         shadow-[0_0_40px_rgba(245,158,11,0.25)]">
              {p?.bgImage && (
                <div className="absolute inset-0 bg-cover bg-top opacity-30 rounded-2xl"
                  style={{ backgroundImage: `url(${p.bgImage})` }} />
              )}
              <div className="relative">
                {p?.avatar ? (
                  <img src={p.avatar} alt={p?.name}
                    className="w-16 h-16 rounded-full object-cover mx-auto mb-3 border-2 border-gold/40
                               shadow-[0_0_20px_rgba(245,158,11,0.3)]" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-pitch-700 border-2 border-gold/40
                                  mx-auto mb-3 flex items-center justify-center text-2xl font-bold text-gold">
                    {p?.name?.[0] ?? "?"}
                  </div>
                )}
                <p className="text-lg font-extrabold text-gold tracking-tight">{p?.name ?? "—"}</p>
                <p className="text-xs text-slate-400 mt-0.5">{i === 0 ? "Set 1" : "Set 2"}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-slate-300 text-sm mt-5 font-medium">Duo Tournament Champions! 🎉</p>
      </div>
    </div>
  )
}