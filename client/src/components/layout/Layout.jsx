import Navbar from "./Navbar"
import { useCachedImage } from "../../hooks/useCachedImage"

// backgroundImage: optional Supabase URL used on the Player Profile page.
// We cache it locally so re-visits and re-renders never count as egress.
export default function Layout({ children, backgroundImage }) {
  const cachedBg = useCachedImage(backgroundImage)

  return (
    <div className="min-h-screen bg-pitch-900 relative">
      {cachedBg && (
        <>
          <div
            className="block max-sm:hidden absolute inset-0 z-0 bg-cover bg-top"
            style={{ backgroundImage: `url(${cachedBg})` }}
          />
          {/* Scrim so page content stays readable regardless of the image */}
          <div className="block max-sm:hidden absolute inset-0 z-0 bg-pitch-900/80" />
        </>
      )}
      <div className="relative z-10">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          {children}
        </main>
      </div>
    </div>
  )
}