import axios from 'axios'

const BASE = '/api'

const http = axios.create({ baseURL: BASE, timeout: 120_000 })

// ── Types ────────────────────────────────────

export interface DecisionSummary {
  products_optimised: number
  total_cost: number
  cost_reduction_estimate_pct: number
  cost_breakdown: { procurement: number; shipping: number; holding: number; penalty: number }
  solver_status: string
  solve_time_ms: number
  top_recommendations: Array<{
    product: string
    optimal_supplier: string
    order_qty: number
    unit_cost: number
    total_cost: number
  }>
  binding_constraints: string[]
}

export interface DecisionRun {
  run_id: string
  status: string
  summary?: DecisionSummary
  created_at?: string
  completed_at?: string
}

export interface ForecastResult {
  product_sku: string
  product_name: string
  location: string
  date: string
  p50: number
  p90: number
  model: string
  mape_pct: number
  wape: number
}

export interface InventoryResult {
  product_sku: string
  product_name: string
  location: string
  eoq: number
  rop: number
  safety_stock: number
  avg_weekly_demand: number
  service_level_pct: number
  annual_holding_cost: number
  annual_ordering_cost: number
  annual_total_cost: number
}

export interface Allocation {
  product_sku: string
  product_name: string
  supplier: string
  supplier_rating: number
  location: string
  qty: number
  unit_cost: number
  ship_cost: number
  total_cost: number
}

export interface SupplierOffer {
  offer_id: string
  supplier_name: string
  supplier_rating: number
  price: number
  currency: string
  moq: number
  lead_time_days: number
  confidence: number
  source: string
}

// ── API calls ───────────────────────────────

export const api = {
  // Decisions
  recommend: (body: {
    skus?: string[]
    use_p90_demand?: boolean
    max_suppliers_per_product?: number
    horizon_periods?: number
  }) => http.post<DecisionRun>('/decisions/recommend', body).then(r => r.data),

  getDecision: (id: string) =>
    http.get<DecisionRun>(`/decisions/${id}`).then(r => r.data),

  listDecisions: () =>
    http.get<DecisionRun[]>('/decisions').then(r => r.data),

  // Forecast
  triggerForecast: (body: { sku_ids?: string[]; horizon?: number }) =>
    http.post<{ run_id: string; status: string }>('/forecast/run', body).then(r => r.data),

  getForecastResults: (run_id: string) =>
    http.get<{ run_id: string; status: string; results: ForecastResult[] }>(
      `/forecast/${run_id}/results`
    ).then(r => r.data),

  getDemandHistory: (sku: string) =>
    http.get<{ sku: string; product_name: string; history: Array<{ date: string; qty: number }> }>(
      `/forecast/history?sku=${sku}`
    ).then(r => r.data),

  // Inventory
  getInventoryPolicy: (run_id: string) =>
    http.get<{ run_id: string; status: string; results: InventoryResult[] }>(
      `/inventory/policy/${run_id}`
    ).then(r => r.data),

  getInventoryState: () =>
    http.get('/inventory/state').then(r => r.data),

  // Optimisation
  getOptimisationSolution: (run_id: string) =>
    http.get<{ run_id: string; status: string; total_cost: number; cost_breakdown: object; allocations: Allocation[] }>(
      `/optimize/${run_id}/solution`
    ).then(r => r.data),

  getOptimisationExplanation: (run_id: string) =>
    http.get(`/optimize/${run_id}/explain`).then(r => r.data),

  // Scraper
  scrapeSuppliers: (skus: string[]) =>
    http.post('/scrape/jobs', { skus }).then(r => r.data),

  getSupplierOffers: (sku: string) =>
    http.get<SupplierOffer[]>(`/scrape/suppliers?sku=${sku}`).then(r => r.data),

  listSuppliers: () =>
    http.get('/scrape/suppliers').then(r => r.data),
}
