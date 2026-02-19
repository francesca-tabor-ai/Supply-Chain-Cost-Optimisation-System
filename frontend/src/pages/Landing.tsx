import { Link } from 'react-router-dom'
import {
  ArrowRight, BarChart2, TrendingUp, Package, Zap,
  ChevronRight, CheckCircle2, GitBranch, Shield, Clock
} from 'lucide-react'

/* ── Reusable primitives ─────────────────────────────────── */

function GradientBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-cool-200 bg-cool-50 text-xs font-medium text-cool-600 tracking-wide">
      {children}
    </span>
  )
}

function MetricCard({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <div className="flex-1 min-w-[160px] p-6 rounded-2xl border border-cool-200 bg-white shadow-card hover:shadow-card-hover transition-shadow duration-300">
      <p className="text-3xl font-bold text-ink-900 mb-1">
        <span className="gradient-text">{value}</span>
      </p>
      <p className="text-sm font-semibold text-ink-800">{label}</p>
      {sub && <p className="text-xs text-cool-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function FeatureCard({
  icon: Icon, title, description, gradient,
}: { icon: React.ElementType; title: string; description: string; gradient: string }) {
  return (
    <div className="group p-6 rounded-2xl border border-cool-200 bg-white shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-300">
      <div className={`w-10 h-10 rounded-xl mb-4 flex items-center justify-center bg-gradient-to-br ${gradient}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <h3 className="text-base font-semibold text-ink-900 mb-2">{title}</h3>
      <p className="text-sm text-cool-500 leading-relaxed">{description}</p>
    </div>
  )
}

function AgentStep({
  num, title, description, tag,
}: { num: string; title: string; description: string; tag: string }) {
  return (
    <div className="flex gap-5">
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-brand flex items-center justify-center text-white text-sm font-bold shadow-glow-sm">
        {num}
      </div>
      <div className="pt-1">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="font-semibold text-ink-900">{title}</h4>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-cool-100 text-cool-500 font-mono font-medium">{tag}</span>
        </div>
        <p className="text-sm text-cool-500 leading-relaxed">{description}</p>
      </div>
    </div>
  )
}

/* ── Mini dashboard mockup rendered in the hero ─────────────── */
function HeroDashboardMockup() {
  const bars = [62, 88, 45, 95, 70, 83, 55, 77, 90, 68, 82, 74]
  const linePoints = [30, 45, 38, 55, 52, 68, 62, 75, 70, 84, 80, 92]

  return (
    <div className="relative w-full max-w-2xl mx-auto animate-float">
      {/* Outer glow */}
      <div className="absolute -inset-4 bg-gradient-brand opacity-10 blur-3xl rounded-3xl" />

      {/* Card shell */}
      <div className="relative bg-white rounded-3xl border border-cool-200 shadow-xl overflow-hidden">
        {/* Top bar */}
        <div className="gradient-bar h-0.5 w-full" />

        {/* Window chrome */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-cool-100">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
          <span className="ml-3 text-xs font-mono text-cool-400">scco — supply chain optimisation</span>
        </div>

        <div className="p-6">
          {/* KPI row */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: 'Cost Reduction', val: '−19.4%', color: 'text-emerald-600' },
              { label: 'Optimised Cost', val: '$2.1M', color: 'text-ink-900' },
              { label: 'Solve Time', val: '1.2s', color: 'text-violet-600' },
            ].map(k => (
              <div key={k.label} className="p-3 rounded-xl bg-cool-50 border border-cool-100">
                <p className="text-[10px] text-cool-400 font-medium mb-0.5">{k.label}</p>
                <p className={`text-base font-bold ${k.color}`}>{k.val}</p>
              </div>
            ))}
          </div>

          {/* Forecast chart mockup */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-ink-800">Demand Forecast — SKU-0003</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 font-mono">Prophet · WAPE 8.3%</span>
            </div>
            <div className="h-28 flex items-end gap-1 relative">
              {/* Area fill behind bars */}
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="lineGrad" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#d946ef" />
                  </linearGradient>
                  <linearGradient id="areaGrad" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.12" />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* P90 band */}
                <path
                  d={`M ${linePoints.map((p, i) => `${(i / (linePoints.length - 1)) * 100},${100 - p - 10}`).join(' L ')} L 100,100 L 0,100 Z`}
                  fill="url(#areaGrad)"
                />
                {/* P50 line */}
                <polyline
                  points={linePoints.map((p, i) => `${(i / (linePoints.length - 1)) * 100},${100 - p}`).join(' ')}
                  fill="none"
                  stroke="url(#lineGrad)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>

              {/* Actual demand bars */}
              {bars.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm opacity-30"
                  style={{
                    height: `${h}%`,
                    background: 'linear-gradient(to top, #8b5cf6, #d946ef)',
                  }}
                />
              ))}
            </div>
            <div className="flex justify-between mt-1">
              {['Jan', 'Mar', 'May', 'Jul', 'Sep', 'Nov'].map(m => (
                <span key={m} className="text-[9px] text-cool-300">{m}</span>
              ))}
            </div>
          </div>

          {/* Allocation table mockup */}
          <div>
            <p className="text-xs font-semibold text-ink-800 mb-2">Optimal Allocations</p>
            <div className="space-y-1.5">
              {[
                { sku: 'SKU-0001', supplier: 'Shenzhen TechParts', qty: '4,200', cost: '$182K', pct: 88 },
                { sku: 'SKU-0003', supplier: 'GlobalEdge Mfg', qty: '2,800', cost: '$124K', pct: 72 },
                { sku: 'SKU-0007', supplier: 'Delta Supply Group', qty: '6,500', cost: '$96K', pct: 60 },
              ].map(r => (
                <div key={r.sku} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-cool-50 transition-colors">
                  <span className="font-mono text-[10px] text-violet-600 w-16 flex-shrink-0">{r.sku}</span>
                  <span className="text-[11px] text-ink-700 flex-1 truncate">{r.supplier}</span>
                  <span className="text-[11px] text-cool-400 w-10 text-right">{r.qty}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 rounded-full bg-cool-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-brand"
                        style={{ width: `${r.pct}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-semibold text-ink-900 w-12 text-right">{r.cost}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Main Landing Page ───────────────────────────────────── */
export default function Landing() {
  return (
    <div className="min-h-screen bg-white font-sans overflow-x-hidden">

      {/* ── NAV ── */}
      <nav className="fixed top-0 inset-x-0 z-50 glass border-b border-cool-200">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-brand flex items-center justify-center">
              <BarChart2 className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-ink-900 tracking-tight">SCCO</span>
          </div>

          <div className="hidden md:flex items-center gap-7 text-sm text-cool-500 font-medium">
            <a href="#how-it-works" className="hover:text-ink-900 transition-colors">How it works</a>
            <a href="#features" className="hover:text-ink-900 transition-colors">Features</a>
            <a href="#metrics" className="hover:text-ink-900 transition-colors">Impact</a>
          </div>

          <Link
            to="/app"
            className="flex items-center gap-1.5 text-sm font-semibold text-white px-4 py-2 rounded-xl bg-ink-900 hover:bg-ink-800 transition-colors"
          >
            Open Dashboard
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative pt-28 pb-20 overflow-hidden">
        {/* Dot grid background */}
        <div className="absolute inset-0 dot-grid opacity-60" />
        {/* Radial gradient wash */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(139,92,246,0.07)_0%,transparent_70%)]" />

        <div className="relative max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="inline-flex mb-6">
              <GradientBadge>
                <span className="w-1.5 h-1.5 rounded-full bg-gradient-brand inline-block" />
                AI-Powered Supply Chain Intelligence
              </GradientBadge>
            </div>

            <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold text-ink-900 tracking-tight leading-[1.06] mb-6 max-w-4xl mx-auto">
              Cut supply chain costs{' '}
              <span className="gradient-text">by up to 25%</span>
            </h1>

            <p className="text-lg sm:text-xl text-cool-500 max-w-2xl mx-auto leading-relaxed mb-10 font-light">
              Four AI agents working in sequence — supplier intelligence, demand forecasting,
              inventory policy, and mathematical optimisation — delivering automated,
              data-driven procurement decisions.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/app"
                className="flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-white bg-ink-900 hover:bg-ink-800 transition-colors shadow-lg text-sm"
              >
                <Zap className="w-4 h-4" />
                Launch Dashboard
              </Link>
              <a
                href="#how-it-works"
                className="flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-ink-800 bg-white border border-cool-200 hover:border-cool-300 hover:bg-cool-50 transition-colors text-sm"
              >
                See how it works
                <ChevronRight className="w-4 h-4 text-cool-400" />
              </a>
            </div>
          </div>

          {/* Dashboard mockup as hero visual */}
          <HeroDashboardMockup />
        </div>
      </section>

      {/* ── METRICS STRIP ── */}
      <section id="metrics" className="py-16 border-y border-cool-100 bg-cool-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-wrap gap-4 justify-center">
            <MetricCard value="10–25%" label="Procurement cost reduction" sub="vs. naive supplier selection" />
            <MetricCard value="15–30%" label="Inventory cost reduction" sub="through EOQ optimisation" />
            <MetricCard value="20–40%" label="Stockout reduction" sub="via safety stock policy" />
            <MetricCard value="<5s" label="Optimisation solve time" sub="MILP with PuLP/CBC solver" />
            <MetricCard value="MAPE<15%" label="Forecast accuracy target" sub="ARIMA · Prophet · ETS ensemble" />
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl mb-14">
            <GradientBadge>Pipeline</GradientBadge>
            <h2 className="text-4xl font-bold text-ink-900 mt-4 mb-4 tracking-tight">
              Four agents, one decision
            </h2>
            <p className="text-cool-500 leading-relaxed text-lg font-light">
              Each agent in the chain feeds the next. Every recommendation is fully traceable —
              from raw supplier offer to final allocation plan.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            {/* Steps */}
            <div className="space-y-8">
              <AgentStep
                num="1"
                title="Supplier Scraper"
                description="Collects unit price, MOQ, lead time, shipping cost, and supplier rating from marketplace sources. Stores raw data with confidence scores and TTL-based deduplication."
                tag="scraper-service"
              />
              <AgentStep
                num="2"
                title="Demand Forecast"
                description="Trains ARIMA, Prophet, and ETS on historical demand. Selects the best model per SKU by validation WAPE. Outputs P50 (baseline) and P90 (risk-averse) forecasts for the planning horizon."
                tag="forecast-service"
              />
              <AgentStep
                num="3"
                title="Inventory Optimisation"
                description="Computes EOQ = √(2DS/H), safety stock using the service-level z-score, and reorder points. Feeds target quantities and inventory constraints into the LP."
                tag="inventory-service"
              />
              <AgentStep
                num="4"
                title="LP Cost Minimisation"
                description="Solves a Mixed-Integer Linear Program minimising procurement + shipping + holding + backorder penalty costs, subject to demand, capacity, MOQ, and supplier-count constraints."
                tag="optimizer-service"
              />
            </div>

            {/* Architecture diagram */}
            <div className="relative">
              <div className="absolute -inset-8 bg-gradient-brand opacity-5 blur-3xl rounded-3xl" />
              <div className="relative bg-white rounded-3xl border border-cool-200 shadow-card p-6 space-y-3 font-mono text-sm">
                <div className="gradient-bar h-0.5 w-full rounded-full mb-4" />
                {[
                  { tag: 'POST', path: '/decisions/recommend', note: 'trigger full pipeline', color: 'bg-emerald-100 text-emerald-700' },
                  { tag: 'POST', path: '/scrape/jobs', note: 'scrape supplier data', color: 'bg-emerald-100 text-emerald-700' },
                  { tag: 'POST', path: '/forecast/run', note: 'generate P50 + P90', color: 'bg-emerald-100 text-emerald-700' },
                  { tag: 'POST', path: '/inventory/policy', note: 'compute EOQ / ROP / SS', color: 'bg-emerald-100 text-emerald-700' },
                  { tag: 'POST', path: '/optimize/run', note: 'solve MILP', color: 'bg-emerald-100 text-emerald-700' },
                  { tag: 'GET', path: '/optimize/{id}/explain', note: 'cost drivers + duals', color: 'bg-sky-100 text-sky-700' },
                  { tag: 'GET', path: '/optimize/{id}/solution', note: 'full allocation plan', color: 'bg-sky-100 text-sky-700' },
                ].map(row => (
                  <div key={row.path} className="flex items-center gap-3 py-2 border-b border-cool-50 last:border-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex-shrink-0 ${row.color}`}>{row.tag}</span>
                    <span className="text-ink-800 flex-1 text-xs">{row.path}</span>
                    <span className="text-cool-300 text-[10px] hidden sm:block">{row.note}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-24 bg-cool-50 border-y border-cool-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <GradientBadge>Capabilities</GradientBadge>
            <h2 className="text-4xl font-bold text-ink-900 mt-4 mb-3 tracking-tight">
              Serious infrastructure, calm interface
            </h2>
            <p className="text-cool-500 max-w-xl mx-auto text-lg font-light">
              Built for procurement managers, inventory planners, and operations teams who need decisions — not dashboards.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FeatureCard
              icon={TrendingUp}
              title="Ensemble forecasting"
              description="ARIMA, Prophet, and ETS compete per SKU. Best model selected by validation WAPE — no manual tuning required."
              gradient="from-violet-500 to-purple-600"
            />
            <FeatureCard
              icon={Package}
              title="EOQ + safety stock"
              description="Classic inventory theory made practical. EOQ, reorder points, and z-score safety stock computed for every product-location pair."
              gradient="from-fuchsia-500 to-pink-600"
            />
            <FeatureCard
              icon={Zap}
              title="MILP optimisation"
              description="PuLP/CBC solves the full allocation problem in under 5 seconds. MOQ binary constraints, capacity limits, supplier-count caps."
              gradient="from-rose-500 to-orange-500"
            />
            <FeatureCard
              icon={BarChart2}
              title="Cost breakdown"
              description="Every recommendation decomposes cost into procurement, shipping, holding, and stockout penalty — so you know where to focus."
              gradient="from-sky-500 to-blue-600"
            />
            <FeatureCard
              icon={GitBranch}
              title="Traceable decisions"
              description="Each run captures the supplier snapshot, forecast version, policy parameters, and solver status. Full audit trail, always."
              gradient="from-emerald-500 to-teal-600"
            />
            <FeatureCard
              icon={Shield}
              title="Risk-averse mode"
              description="Toggle P90 demand to plan against worst-case scenarios. Compare baseline vs conservative cost and stockout risk side-by-side."
              gradient="from-amber-500 to-yellow-500"
            />
          </div>
        </div>
      </section>

      {/* ── TECH STACK ── */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <GradientBadge>Stack</GradientBadge>
          <h2 className="text-4xl font-bold text-ink-900 mt-4 mb-12 tracking-tight">Built on trusted open-source</h2>

          <div className="flex flex-wrap justify-center gap-3">
            {[
              'Python 3.11', 'FastAPI', 'SQLAlchemy', 'PostgreSQL',
              'PuLP · CBC', 'Meta Prophet', 'statsmodels', 'scipy',
              'React 18', 'Vite', 'Tailwind CSS', 'Recharts', 'Docker',
            ].map(t => (
              <span
                key={t}
                className="px-4 py-2 rounded-xl border border-cool-200 bg-white text-sm font-medium text-cool-600 shadow-sm hover:border-cool-300 hover:text-ink-900 transition-colors"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 bg-ink-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_50%,rgba(139,92,246,0.12)_0%,transparent_70%)]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-24 bg-gradient-to-b from-transparent via-violet-500 to-transparent opacity-40" />

        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <div className="inline-flex mb-6">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs font-medium text-white/50 tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-slow inline-block" />
              Ready to deploy
            </span>
          </div>

          <h2 className="text-4xl sm:text-5xl font-bold text-white tracking-tight mb-5 leading-tight">
            Reduce supply chain costs.<br />
            <span className="gradient-text">Starting today.</span>
          </h2>
          <p className="text-cool-300 text-lg mb-10 font-light leading-relaxed">
            One command to start. Full pipeline — scraper, forecasting,
            inventory policy, MILP solve — in under 90 seconds.
          </p>

          <div className="bg-ink-900 rounded-2xl border border-white/10 p-4 mb-8 text-left font-mono text-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span className="text-xs text-cool-500 ml-2">terminal</span>
            </div>
            <p className="text-cool-300"><span className="text-emerald-400">$</span> cp .env.example .env</p>
            <p className="text-cool-300"><span className="text-emerald-400">$</span> docker compose up</p>
            <p className="text-cool-400 text-xs mt-2"># API → localhost:8000/docs · Dashboard → localhost:3000</p>
          </div>

          <Link
            to="/app"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-white bg-gradient-cta hover:opacity-90 transition-opacity shadow-glow text-sm"
          >
            Open Dashboard
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-10 border-t border-cool-100">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-gradient-brand flex items-center justify-center">
              <BarChart2 className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-ink-900 text-sm">SCCO</span>
            <span className="text-cool-300 text-sm">·</span>
            <span className="text-cool-400 text-sm">Supply Chain Cost Optimisation</span>
          </div>
          <div className="flex items-center gap-5 text-xs text-cool-400">
            <span>v1.0.0 MVP</span>
            <span>·</span>
            <a href="https://github.com/francesca-tabor-ai/Supply-Chain-Cost-Optimisation-System"
              target="_blank" rel="noreferrer"
              className="hover:text-ink-900 transition-colors">GitHub</a>
            <span>·</span>
            <a href="/api/docs" className="hover:text-ink-900 transition-colors">API Docs</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
