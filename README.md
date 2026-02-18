# Supply Chain Cost Optimisation System

An AI-driven platform that minimises total supply chain cost — procurement, logistics, and inventory — using four chained agents and a MILP solver.

## Architecture

```
Data Sources
    ↓
[1] Supplier Scraper Agent   →  synthetic marketplace offers (price, MOQ, lead time, rating)
[2] Demand Forecast Agent    →  ARIMA / Prophet / ETS ensemble → P50 + P90 forecasts
[3] Inventory Policy Agent   →  EOQ = √(2DS/H), Reorder Point, Safety Stock
[4] LP Optimisation Agent    →  MILP via PuLP/CBC: minimise procurement + shipping + holding
    ↓
Decision API  →  React Dashboard
```

## Tech Stack

| Layer         | Technology                            |
|---------------|---------------------------------------|
| Backend       | Python 3.11, FastAPI, SQLAlchemy      |
| Optimisation  | PuLP (CBC solver), scipy              |
| Forecasting   | Meta Prophet, statsmodels (ARIMA/ETS) |
| Database      | PostgreSQL 16                         |
| Cache/Queue   | Redis                                 |
| Frontend      | React 18, Vite, Tailwind, Recharts    |
| Container     | Docker Compose                        |

## Quick Start

### Option A — Docker Compose (recommended)
```bash
cp .env.example .env
docker compose up
```
- API:       http://localhost:8000/docs
- Dashboard: http://localhost:3000

### Option B — Local development
```bash
bash scripts/setup_local.sh
# Start PostgreSQL, then:
python -m backend.db.init_db          # create tables + seed data
uvicorn backend.main:app --reload     # API on :8000
cd frontend && npm run dev            # Dashboard on :3000
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/decisions/recommend` | Run full pipeline |
| GET  | `/decisions/{id}` | Poll decision status |
| POST | `/scrape/jobs` | Scrape supplier data |
| GET  | `/scrape/suppliers?sku=` | Best offers per SKU |
| POST | `/forecast/run` | Trigger demand forecast |
| GET  | `/forecast/{id}/results` | Forecast results |
| POST | `/inventory/policy` | Compute EOQ/ROP/SS |
| GET  | `/inventory/policy/{id}` | Policy results |
| POST | `/optimize/run` | Solve MILP |
| GET  | `/optimize/{id}/solution` | Allocation plan |
| GET  | `/optimize/{id}/explain` | Cost drivers + constraints |

## Mathematical Models

### EOQ (Economic Order Quantity)
```
EOQ = √(2DS / H)
  D = annual demand
  S = setup/ordering cost
  H = holding cost per unit per year
```

### Reorder Point + Safety Stock
```
SS  = z_SL × σ × √L
ROP = μ × L + SS
  z_SL = normal z-score for service level (e.g. 1.645 for 95%)
  σ    = demand std dev per period
  L    = lead time in periods
```

### MILP Objective
```
min ∑(c_proc + c_ship) × x_ijk
  + ∑ h_kj × Inv_kj
  + ∑ p_kj × BO_kj

subject to:
  demand balance, supplier capacity,
  MOQ (binary y_ik), max supplier count
```

## Project Structure

```
├── backend/
│   ├── agents/
│   │   ├── scraper/     ← synthetic supplier data generation
│   │   ├── forecast/    ← ARIMA/Prophet/ETS ensemble
│   │   ├── inventory/   ← EOQ/ROP/safety stock
│   │   ├── optimizer/   ← PuLP MILP model
│   │   └── decision/    ← pipeline orchestrator
│   ├── api/routers/     ← FastAPI route handlers
│   ├── db/              ← SQLAlchemy models + seed data
│   ├── core/            ← settings/config
│   └── main.py          ← FastAPI app entry point
├── frontend/
│   └── src/
│       ├── pages/       ← Dashboard, Recommend, Forecast, Inventory, Optimisation
│       ├── components/  ← Card, charts (Recharts)
│       └── api/         ← axios client
├── docker-compose.yml
└── scripts/setup_local.sh
```

## Business Impact (Target)

| Metric | Target |
|--------|--------|
| Procurement cost reduction | 10–25% |
| Inventory holding cost reduction | 15–30% |
| Stockout reduction | 20–40% |
| Optimisation solve time | < 5 seconds |
