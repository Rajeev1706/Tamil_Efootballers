import { useState } from "react"
import { cn } from "../../lib/utils"
import loadingVideo from "../../../images/tlogo.webm"

// Shows the custom branded loading video (transparent .webm). Falls back
// automatically to the plain spinner if the video fails to load for any
// reason, so nothing breaks.
export default function Loading({ className }) {
  const [videoFailed, setVideoFailed] = useState(false)

  return (
    <div className={cn("flex flex-col items-center justify-center py-20", className)}>
      {!videoFailed ? (
        <video
          src={loadingVideo}
          autoPlay
          loop
          muted
          playsInline
          onError={() => setVideoFailed(true)}
          className="w-24 h-24 object-contain"
        />
      ) : (
        <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      )}
    </div>
  )
}