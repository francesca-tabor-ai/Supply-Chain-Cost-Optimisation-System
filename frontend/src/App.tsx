import { BrowserRouter, Routes, Route, NavLink, Link } from 'react-router-dom'
import { BarChart2, TrendingUp, Package, Zap, LayoutDashboard, ArrowUpRight } from 'lucide-react'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import Forecast from './pages/Forecast'
import Inventory from './pages/Inventory'
import Optimisation from './pages/Optimisation'
import Recommend from './pages/Recommend'

const navItems = [
  { to: '/app', icon: LayoutDashboard, label: 'Overview' },
  { to: '/app/recommend', icon: Zap, label: 'Recommend' },
  { to: '/app/forecast', icon: TrendingUp, label: 'Demand Forecast' },
  { to: '/app/inventory', icon: Package, label: 'Inventory Policy' },
  { to: '/app/optimisation', icon: BarChart2, label: 'Optimisation' },
]

function AppShell() {
  return (
    <div className="flex h-screen overflow-hidden bg-cool-50">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-cool-200 flex flex-col flex-shrink-0 shadow-sm">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-cool-100">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-gradient-brand flex items-center justify-center flex-shrink-0 shadow-glow-sm">
              <BarChart2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-bold text-ink-900 text-sm leading-tight tracking-tight">SCCO</p>
              <p className="text-[10px] text-cool-400 font-medium">Cost Optimisation</p>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/app'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-ink-900 text-white shadow-sm'
                    : 'text-cool-500 hover:bg-cool-100 hover:text-ink-800'
                }`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Bottom */}
        <div className="px-4 py-4 border-t border-cool-100 space-y-2">
          <a
            href="/api/docs"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-cool-400 hover:bg-cool-100 hover:text-ink-800 transition-colors"
          >
            <span>API Docs</span>
            <ArrowUpRight className="w-3 h-3 ml-auto" />
          </a>
          <Link
            to="/"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-cool-400 hover:bg-cool-100 hover:text-ink-800 transition-colors"
          >
            ← Landing Page
          </Link>
          <div className="px-3">
            <div className="gradient-bar h-0.5 w-full rounded-full opacity-60" />
            <p className="text-[10px] text-cool-300 mt-2">v1.0.0 MVP</p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/app" element={<Dashboard />} />
          <Route path="/app/recommend" element={<Recommend />} />
          <Route path="/app/forecast" element={<Forecast />} />
          <Route path="/app/inventory" element={<Inventory />} />
          <Route path="/app/optimisation" element={<Optimisation />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/app/*" element={<AppShell />} />
      </Routes>
    </BrowserRouter>
  )
}
