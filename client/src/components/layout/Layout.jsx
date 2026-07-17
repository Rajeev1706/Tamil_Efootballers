import Navbar from "./Navbar"

export default function Layout({ children, backgroundImage }) {
  return (
    <div className="min-h-screen bg-pitch-900 relative">
      {backgroundImage && (
        <>
          <div
            className="block max-sm:hidden absolute inset-0 z-0 bg-cover bg-top"
            style={{ backgroundImage: `url(${backgroundImage})` }}
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