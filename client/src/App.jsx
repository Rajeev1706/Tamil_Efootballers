import { lazy, Suspense } from "react"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import ProtectedRoute from "./components/common/ProtectedRoute"

// All pages are lazy-loaded so each route gets its own chunk.
// This eliminates the entire class of "Cannot access X before initialization"
// crashes caused by circular module initialization in the combined bundle.
const CommonDashboard     = lazy(() => import("./pages/CommonDashboard"))
const TeamDashboard       = lazy(() => import("./pages/TeamDashboard"))
const AdminPage           = lazy(() => import("./pages/AdminPage"))
const Login               = lazy(() => import("./pages/Login"))
const PlayerProfile       = lazy(() => import("./pages/PlayerProfile"))
const HallOfFame          = lazy(() => import("./pages/HallOfFame"))
const WinRateRanking      = lazy(() => import("./pages/WinRateRanking"))
const TrophyCabinet       = lazy(() => import("./pages/TrophyCabinet"))
const PlayerTrophyCabinet = lazy(() => import("./pages/PlayerTrophyCabinet"))
const ChampionshipPage    = lazy(() => import("./pages/ChampionshipPage"))
const WeeklyDraw          = lazy(() => import("./pages/WeeklyDraw"))
const WeeklyBracket       = lazy(() => import("./pages/WeeklyBracket"))
const RevolutionDraw      = lazy(() => import("./pages/RevolutionDraw"))
const TlgDraw             = lazy(() => import("./pages/TlgDraw"))
const RevolutionBracket   = lazy(() => import("./pages/RevolutionBracket"))
const UclDraw             = lazy(() => import("./pages/UclDraw"))
const UclKODraw           = lazy(() => import("./pages/UclKODraw"))
const UclKOBracket        = lazy(() => import("./pages/UclKOBracket"))
const TeamKnockoutBracket = lazy(() => import("./pages/TeamKnockoutBracket"))
const AuctionAdmin        = lazy(() => import("./pages/AuctionAdmin"))
const AuctionLive         = lazy(() => import("./pages/AuctionLive"))
const TeamAuctionLive     = lazy(() => import("./pages/TeamAuctionLive"))
const TeamRosterPage      = lazy(() => import("./pages/TeamRosterPage"))
const SeasonCalendar      = lazy(() => import("./pages/SeasonCalendar"))
const TeamTrophyCabinet   = lazy(() => import("./pages/TeamTrophyCabinet"))
const TeamTrophyDetail    = lazy(() => import("./pages/TeamTrophyDetail"))
const DuoTournament       = lazy(() => import("./pages/DuoTournament"))
const DuoDraw             = lazy(() => import("./pages/DuoDraw"))

// Minimal spinner shown while a page chunk loads
function PageLoader() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0f172a" }}>
      <div style={{ width: 32, height: 32, border: "3px solid #334155", borderTopColor: "#38bdf8", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/"                        element={<CommonDashboard />} />
          <Route path="/login"                   element={<Login />} />
          <Route path="/player/:id"              element={<PlayerProfile />} />
          <Route path="/team-roster/:id"         element={<TeamRosterPage />} />
          <Route path="/hall-of-fame"            element={<HallOfFame />} />
          <Route path="/win-rate-ranking"        element={<WinRateRanking />} />
          <Route path="/trophy-cabinet"          element={<TrophyCabinet />} />
          <Route path="/championship"            element={<ChampionshipPage />} />
          <Route path="/trophy-cabinet/:id"      element={<PlayerTrophyCabinet />} />
          <Route path="/weekly/bracket/:id"      element={<WeeklyBracket />} />
          <Route path="/ucl-knockout/bracket/:id" element={<UclKOBracket />} />
          <Route path="/team-knockout"           element={<TeamKnockoutBracket />} />
          <Route path="/auction/live"            element={<AuctionLive />} />
          <Route path="/calendar"                element={<SeasonCalendar />} />
          <Route path="/team-trophies"           element={<TeamTrophyCabinet />} />
          <Route path="/team-trophies/:id"       element={<TeamTrophyDetail />} />
          <Route path="/duo-tournament"          element={<DuoTournament />} />

          {/* Admin-protected draw/bracket routes */}
          <Route path="/weekly/draw/:id"         element={<ProtectedRoute role="admin"><WeeklyDraw /></ProtectedRoute>} />
          <Route path="/revolution/draw/:id"     element={<ProtectedRoute role="admin"><RevolutionDraw /></ProtectedRoute>} />
          <Route path="/tlg-draw/:id"            element={<ProtectedRoute role="admin"><TlgDraw /></ProtectedRoute>} />
          <Route path="/revolution/bracket/:id"  element={<ProtectedRoute role="admin"><RevolutionBracket /></ProtectedRoute>} />
          <Route path="/ucl/draw"                element={<ProtectedRoute role="admin"><UclDraw /></ProtectedRoute>} />
          <Route path="/ucl-knockout/draw/:id"   element={<ProtectedRoute role="admin"><UclKODraw /></ProtectedRoute>} />
          <Route path="/admin/auction"           element={<ProtectedRoute role="admin"><AuctionAdmin /></ProtectedRoute>} />
          <Route path="/duo/draw/:season"        element={<ProtectedRoute role="admin"><DuoDraw /></ProtectedRoute>} />

          {/* Auth-protected team routes */}
          <Route path="/team"         element={<ProtectedRoute><TeamDashboard /></ProtectedRoute>} />
          <Route path="/team/auction" element={<ProtectedRoute><TeamAuctionLive /></ProtectedRoute>} />
          <Route path="/admin"        element={<ProtectedRoute role="admin"><AdminPage /></ProtectedRoute>} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
