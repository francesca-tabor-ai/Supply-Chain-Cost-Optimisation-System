import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { BarChart2, TrendingUp, Package, Zap, Home, ChevronRight } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import Forecast from './pages/Forecast'
import Inventory from './pages/Inventory'
import Optimisation from './pages/Optimisation'
import Recommend from './pages/Recommend'

const navItems = [
  { to: '/', icon: Home, label: 'Overview' },
  { to: '/recommend', icon: Zap, label: 'Recommend' },
  { to: '/forecast', icon: TrendingUp, label: 'Demand Forecast' },
  { to: '/inventory', icon: Package, label: 'Inventory Policy' },
  { to: '/optimisation', icon: BarChart2, label: 'Optimisation' },
]

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-brand-900 text-white flex flex-col flex-shrink-0">
          <div className="p-6 border-b border-brand-700">
            <div className="flex items-center gap-2 mb-1">
              <BarChart2 className="w-6 h-6 text-brand-100" />
              <span className="font-bold text-lg leading-tight">SCCO</span>
            </div>
            <p className="text-xs text-blue-300">Supply Chain Cost Optimisation</p>
          </div>
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-600 text-white'
                      : 'text-blue-200 hover:bg-brand-700 hover:text-white'
                  }`
                }
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="p-4 text-xs text-blue-400 border-t border-brand-700">
            v1.0.0 · MVP
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/recommend" element={<Recommend />} />
            <Route path="/forecast" element={<Forecast />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/optimisation" element={<Optimisation />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
