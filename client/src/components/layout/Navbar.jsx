import { Link, useLocation, useNavigate } from "react-router-dom"
import { BarChart2, Shield, LogIn, LogOut, Users } from "lucide-react"
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <img src="/images/logo.png" alt="TEC Logo" className="w-14 h-14 rounded-lg object-cover" />
          <div className="flex flex-col leading-none">
            <span className="text-sm font-bold text-white tracking-wide">Tamil</span>
            <span className="text-xs text-accent font-semibold tracking-widest uppercase">Efootballers</span>
          </div>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-1">
          <NavLink to="/" label="Dashboard" icon={BarChart2} active={pathname === "/"} />

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
            <div className="flex items-center gap-2 ml-2 pl-2 border-l border-surface-border">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-semibold text-white">{user.username}</p>
                <p className="text-xs text-slate-500 capitalize">{user.role.replace("_", " ")}</p>
              </div>
              <button
                onClick={handleLogout}
                className="w-8 h-8 rounded-lg hover:bg-surface flex items-center justify-center text-slate-400 hover:text-rose-400 transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
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
        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
        active
          ? "bg-accent/15 text-accent border border-accent/25"
          : "text-slate-400 hover:text-white hover:bg-surface"
      )}
    >
      <Icon className="w-4 h-4" />
      {label}
    </Link>
  )
}