import { useState } from "react"
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { BarChart2, Shield, LogIn, LogOut, Users, Trophy, Menu, X, GitCompare, TrendingUp, Award, CircleDollarSign, Home } from "lucide-react"
import { useAuthStore } from "../../store/authStore"
import { cn } from "../../lib/utils"

const MENU_ITEMS = [
  { value: "standings", label: "Home",             icon: Home },
  { value: "players",   label: "Total Players",   icon: Users },
  { value: "winrate",   label: "Win Rate",        icon: TrendingUp, link: "/win-rate-ranking"  },
  { value: "trophycab", label: "Trophy Cabinet",  icon: Trophy,     link: "/trophy-cabinet"     },
  { value: "compare",   label: "Compare Players", icon: GitCompare },
  { value: "teams",     label: "Teams",            icon: Shield },
  { value: "bdr",       label: "BDR Rankings",     icon: Award },
  { value: "market",    label: "Market Value",     icon: TrendingUp },
  { value: "trophies",  label: "Trophies",         icon: Trophy },
]

export default function Navbar() {
  const { pathname } = useLocation()
  const navigate     = useNavigate()
  const [searchParams] = useSearchParams()
  const user         = useAuthStore(s => s.user)
  const logout       = useAuthStore(s => s.logout)
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate("/")
  }

  const handleMenuClick = (view) => {
    navigate(`/?view=${view}`)
    setMenuOpen(false)
  }

  const activeView = pathname === "/" ? (searchParams.get("view") || "players") : null

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-surface-border bg-pitch-900/90 backdrop-blur-md">
        <div className="h-16 flex items-center">

          {/* Hamburger — pinned to left edge */}
          <button
            onClick={() => setMenuOpen(true)}
            className="w-14 h-16 flex items-center justify-center text-slate-400 hover:text-white hover:bg-surface/50 transition-colors flex-shrink-0"
            title="Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Rest of navbar in centered container */}
          <div className="flex-1 max-w-7xl mx-auto px-3 sm:px-6 flex items-center justify-between gap-2">

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
        </div>
      </header>

      {/* ── Sidebar overlay ── */}
      {menuOpen && (
        <div className="fixed inset-0 z-[100]" onClick={() => setMenuOpen(false)}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Sidebar */}
          <div
            className="absolute top-0 left-0 h-full w-72 bg-pitch-900 border-r border-surface-border shadow-2xl animate-slide-in"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-5 border-b border-surface-border">
              <span className="text-sm font-bold text-white uppercase tracking-widest">Menu</span>
              <button
                onClick={() => setMenuOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-surface flex items-center justify-center text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Menu items */}
            <nav className="p-3 space-y-1">
              {MENU_ITEMS.map(item => {
                const Icon = item.icon
                const isActive = item.link ? pathname === item.link : activeView === item.value
                if (item.link) {
                  return (
                    <Link
                      key={item.value}
                      to={item.link}
                      onClick={() => setMenuOpen(false)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all border",
                        isActive
                          ? "bg-accent/15 text-accent border-accent/25"
                          : "text-slate-400 hover:text-white hover:bg-surface border-transparent"
                      )}
                    >
                      <Icon className="w-4.5 h-4.5 flex-shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  )
                }
                return (
                  <button
                    key={item.value}
                    onClick={() => handleMenuClick(item.value)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                      isActive
                        ? "bg-accent/15 text-accent border border-accent/25"
                        : "text-slate-400 hover:text-white hover:bg-surface border border-transparent"
                    )}
                  >
                    <Icon className="w-4.5 h-4.5 flex-shrink-0" />
                    <span>{item.label}</span>
                  </button>
                )
              })}

            </nav>
          </div>
        </div>
      )}
    </>
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
      <span className="nav-label">{label}</span>
    </Link>
  )
}