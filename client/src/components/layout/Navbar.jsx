import { Link, useLocation, useNavigate } from "react-router-dom"
import { BarChart2, Shield, LogIn, LogOut, Users, Trophy } from "lucide-react"
import { useAuthStore } from "../../store/authStore"
import { cn } from "../../lib/utils"

export default function Navbar() {
  const { pathname } = useLocation()
  const navigate     = useNavigate()
  const user         = useAuthStore(s => s.user)
  const logout       = useAuthStore(s => s.logout)

  const handleLogout = () => {
    logout()
    navigate("/")
  }

  return (
    <header className="sticky top-0 z-50 border-b border-surface-border bg-pitch-900/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 sm:gap-2.5 group min-w-0 flex-shrink-0">
          <img src="/logo.png" alt="TEC Logo" className="w-9 h-9 sm:w-14 sm:h-14 rounded-lg object-cover flex-shrink-0" />
          <div className="flex flex-col leading-none min-w-0">
            <span className="text-xs sm:text-sm font-bold text-white tracking-wide truncate">Tamil</span>
            <span className="text-[10px] sm:text-xs text-accent font-semibold tracking-widest uppercase truncate">Efootballers</span>
          </div>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
          <NavLink to="/" label="Dashboard" icon={BarChart2} active={pathname === "/"} />
          <NavLink to="/hall-of-fame" label="Hall of Fame" icon={Trophy} active={pathname === "/hall-of-fame"} />

          {!user && (
            <NavLink to="/login" label="Login" icon={LogIn} active={pathname === "/login"} />
          )}

          {user?.role === "team_owner" && (
            <NavLink to="/team" label="My Team" icon={Users} active={pathname === "/team"} />
          )}

          {user?.role === "admin" && (
            <NavLink to="/admin" label="Admin" icon={Shield} active={pathname === "/admin"} />
          )}

          {user && (
            <button
              onClick={handleLogout}
              className="w-8 h-8 rounded-lg hover:bg-surface flex items-center justify-center text-slate-400 hover:text-white transition-colors flex-shrink-0"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </nav>
      </div>
    </header>
  )
}

function NavLink({ to, label, icon: Icon, active }) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
        active
          ? "bg-accent/15 text-accent border border-accent/25"
          : "text-slate-400 hover:text-white hover:bg-surface"
      )}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span>{label}</span>
    </Link>
  )
}