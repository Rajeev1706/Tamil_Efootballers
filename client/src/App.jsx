import { BrowserRouter, Routes, Route } from "react-router-dom"
import ProtectedRoute    from "./components/common/ProtectedRoute"
import CommonDashboard  from "./pages/CommonDashboard"
import TeamDashboard    from "./pages/TeamDashboard"
import AdminPage        from "./pages/AdminPage"
import Login            from "./pages/Login"
import PlayerProfile    from "./pages/PlayerProfile"
import HallOfFame       from "./pages/HallOfFame"
import WinRateRanking       from "./pages/WinRateRanking"
import TrophyCabinet        from "./pages/TrophyCabinet"
import PlayerTrophyCabinet  from "./pages/PlayerTrophyCabinet"
import WeeklyDraw       from "./pages/WeeklyDraw"
import WeeklyBracket    from "./pages/WeeklyBracket"
import RevolutionDraw    from "./pages/RevolutionDraw"
import TlgDraw from "./pages/TlgDraw"
import RevolutionBracket from "./pages/RevolutionBracket"
import UclDraw          from "./pages/UclDraw"
import UclKODraw    from "./pages/UclKODraw"
import UclKOBracket from "./pages/UclKOBracket"
import AuctionAdmin from "./pages/AuctionAdmin"
import AuctionLive from "./pages/AuctionLive"
import TeamAuctionLive from "./pages/TeamAuctionLive"
import TeamRosterPage from "./pages/TeamRosterPage"
import SeasonCalendar    from "./pages/SeasonCalendar"
import TeamTrophyCabinet from "./pages/TeamTrophyCabinet"
import TeamTrophyDetail  from "./pages/TeamTrophyDetail"
import DuoTournament     from "./pages/DuoTournament"
import DuoDraw          from "./pages/DuoDraw"

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"             element={<CommonDashboard />} />
        <Route path="/login"        element={<Login />} />
        <Route path="/player/:id"   element={<PlayerProfile />} />
        <Route path="/team-roster/:id" element={<TeamRosterPage />} />
        <Route path="/hall-of-fame"      element={<HallOfFame />} />
        <Route path="/win-rate-ranking"     element={<WinRateRanking />} />
        <Route path="/trophy-cabinet"        element={<TrophyCabinet />} />
        <Route path="/trophy-cabinet/:id"    element={<PlayerTrophyCabinet />} />
        <Route path="/weekly/draw/:id"    element={<WeeklyDraw />} />
        <Route path="/weekly/bracket/:id" element={<WeeklyBracket />} />
        <Route path="/revolution/draw/:id"    element={<RevolutionDraw />} />
        <Route path="/tlg-draw/:id" element={<TlgDraw />} />
        <Route path="/revolution/bracket/:id" element={<RevolutionBracket />} />
        <Route path="/ucl/draw"                element={<UclDraw />} />
        <Route path="/ucl-knockout/draw/:id"    element={<UclKODraw />} />
        <Route path="/ucl-knockout/bracket/:id" element={<UclKOBracket />} />
        <Route path="/admin/auction"            element={<ProtectedRoute role="admin"><AuctionAdmin /></ProtectedRoute>} />
        <Route path="/auction/live"             element={<AuctionLive />} />
        <Route path="/calendar"                   element={<SeasonCalendar />} />
        <Route path="/team-trophies"               element={<TeamTrophyCabinet />} />
        <Route path="/team-trophies/:id"           element={<TeamTrophyDetail />} />
        <Route path="/duo-tournament"              element={<DuoTournament />} />
        <Route path="/duo/draw/:season"             element={<DuoDraw />} />
        <Route path="/team"         element={
          <ProtectedRoute><TeamDashboard /></ProtectedRoute>
        } />
        <Route path="/team/auction" element={
          <ProtectedRoute><TeamAuctionLive /></ProtectedRoute>
        } />
        <Route path="/admin"        element={
          <ProtectedRoute role="admin"><AdminPage /></ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  )
}