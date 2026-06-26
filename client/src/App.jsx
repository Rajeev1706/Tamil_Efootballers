import { BrowserRouter, Routes, Route } from "react-router-dom"
import ProtectedRoute    from "./components/common/ProtectedRoute"
import CommonDashboard  from "./pages/CommonDashboard"
import TeamDashboard    from "./pages/TeamDashboard"
import AdminPage        from "./pages/AdminPage"
import Login            from "./pages/Login"
import PlayerProfile    from "./pages/PlayerProfile"
import HallOfFame       from "./pages/HallOfFame"

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"             element={<CommonDashboard />} />
        <Route path="/login"        element={<Login />} />
        <Route path="/player/:id"   element={<PlayerProfile />} />
        <Route path="/hall-of-fame" element={<HallOfFame />} />
        <Route path="/team"         element={
          <ProtectedRoute><TeamDashboard /></ProtectedRoute>
        } />
        <Route path="/admin"        element={
          <ProtectedRoute role="admin"><AdminPage /></ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  )
}