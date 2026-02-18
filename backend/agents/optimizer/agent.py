"""
Linear Programming / MILP Optimisation Agent
=============================================
Determines optimal supplier allocation minimising total supply chain cost.

Model: Multi-period MILP (Mixed Integer Linear Program)

Decision variables:
  x_ijk  ∈ R≥0   units of product k from supplier i to location j (per period)
  y_ik   ∈ {0,1} whether supplier i is used for product k (MOQ enforcement)
  Inv_kj ∈ R≥0   ending inventory of product k at location j
  BO_kj  ∈ R≥0   backorder quantity

Objective (minimise):
  ∑ (c_ik_proc + c_ijk_ship) * x_ijk     ← procurement + shipping
  + ∑ h_kj * Inv_kj                       ← holding cost
  + ∑ p_kj * BO_kj                        ← stockout penalty
  + ∑ f_ik * y_ik                         ← supplier fixed cost

Constraints:
  Demand:    ∑_i x_ijk + Inv_prev - BO_prev ≥ D_kj + Inv_kj - BO_kj
  Capacity:  ∑_j x_ijk ≤ Cap_ik
  MOQ:       ∑_j x_ijk ≥ MOQ_ik * y_ik  (if y_ik = 1)
  Big-M:     ∑_j x_ijk ≤ M_ik * y_ik
  Supplier count: ∑_i y_ik ≤ S_max_k
  Non-negativity: x, Inv, BO ≥ 0

Solver: PuLP with CBC (open-source). Gurobi/CPLEX drop-in via solver= param.
"""

import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pulp
from sqlalchemy.orm import Session

from backend.core.config import get_settings
from backend.db.models import (
    CostParameter, ForecastResult, InventoryPolicyResult,
    Location, OptimisationAllocation, OptimisationRun, Product,
    Supplier, SupplierOffer
)

settings = get_settings()

# Big-M upper bound (loose, tightened per product)
BIG_M_DEFAULT = 1_000_000


# ─────────────────────────────────────────────
# Data loaders
# ─────────────────────────────────────────────

def _load_products(db: Session, product_ids: Optional[List[str]] = None) -> List[Product]:
    q = db.query(Product)
    if product_ids:
        q = q.filter(Product.product_id.in_(product_ids))
    return q.all()


def _load_offers(db: Session, product_ids: List[str], max_per_product: int = 8) -> Dict[str, List[dict]]:
    """
    For each product, return the top offers (sorted by price) as dicts.
    """
    offers_by_product: Dict[str, List[dict]] = {}
    for pid in product_ids:
        rows = (
            db.query(SupplierOffer, Supplier)
            .join(Supplier, SupplierOffer.supplier_id == Supplier.supplier_id)
            .filter(SupplierOffer.product_id == pid)
            .order_by(SupplierOffer.price)
            .limit(max_per_product)
            .all()
        )
        offers_by_product[pid] = [
            {
                "offer_id": o.offer_id,
                "supplier_id": s.supplier_id,
                "supplier_name": s.name,
                "price": float(o.price),
                "moq": o.moq,
                "capacity": o.capacity_units or 50000,
                "lead_time_days": o.lead_time_days or 14,
            }
            for o, s in rows
        ]
    return offers_by_product


def _load_demand(
    db: Session,
    forecast_run_id: str,
    product_ids: List[str],
    location_ids: List[str],
    use_p90: bool = False,
) -> Dict[Tuple[str, str], float]:
    """
    Returns dict: (product_id, location_id) → aggregated demand (sum of forecast periods).
    """
    rows = (
        db.query(ForecastResult)
        .filter(
            ForecastResult.run_id == forecast_run_id,
            ForecastResult.product_id.in_(product_ids),
            ForecastResult.location_id.in_(location_ids),
        )
        .all()
    )
    demand: Dict[Tuple[str, str], float] = {}
    for r in rows:
        key = (r.product_id, r.location_id)
        val = r.p90 if use_p90 else r.p50
        demand[key] = demand.get(key, 0) + val
    return demand


def _load_costs(db: Session, product_ids: List[str], location_ids: List[str]) -> Dict[Tuple[str, str], dict]:
    rows = (
        db.query(CostParameter)
        .filter(
            CostParameter.product_id.in_(product_ids),
            CostParameter.location_id.in_(location_ids),
        )
        .all()
    )
    return {
        (r.product_id, r.location_id): {
            "holding": float(r.holding_cost_per_unit_period),
            "penalty": float(r.stockout_penalty or 0),
        }
        for r in rows
    }


def _load_safety_stocks(
    db: Session, inventory_run_id: str, product_ids: List[str], location_ids: List[str]
) -> Dict[Tuple[str, str], float]:
    rows = (
        db.query(InventoryPolicyResult)
        .filter(
            InventoryPolicyResult.run_id == inventory_run_id,
            InventoryPolicyResult.product_id.in_(product_ids),
            InventoryPolicyResult.location_id.in_(location_ids),
        )
        .all()
    )
    return {(r.product_id, r.location_id): (r.safety_stock or 0) for r in rows}


# ─────────────────────────────────────────────
# MILP Model Builder
# ─────────────────────────────────────────────

def _build_and_solve(
    products: List[Product],
    locations: List[Location],
    offers_by_product: Dict[str, List[dict]],
    demand: Dict[Tuple[str, str], float],
    cost_params: Dict[Tuple[str, str], dict],
    safety_stocks: Dict[Tuple[str, str], float],
    ship_cost_fraction: float = 0.08,   # shipping ≈ 8% of unit price (default)
    max_suppliers_per_product: int = 3,
    time_limit: int = 5,
) -> Tuple[str, Dict[str, Any]]:
    """
    Build and solve the MILP. Returns (status, solution_dict).
    """
    prob = pulp.LpProblem("supply_chain_cost_minimisation", pulp.LpMinimize)

    # ── Decision variables ───────────────────
    # x[p, s, l] = units of product p from supplier s to location l
    x: Dict[Tuple, pulp.LpVariable] = {}
    # y[p, s] = binary: does supplier s supply product p?
    y: Dict[Tuple, pulp.LpVariable] = {}
    # inv[p, l] = ending inventory of product p at location l
    inv: Dict[Tuple, pulp.LpVariable] = {}
    # bo[p, l] = backorder of product p at location l
    bo: Dict[Tuple, pulp.LpVariable] = {}

    pid_list = [p.product_id for p in products]
    lid_list = [l.location_id for l in locations]

    for product in products:
        pid = product.product_id
        offers = offers_by_product.get(pid, [])

        for offer in offers:
            sid = offer["supplier_id"]
            for loc in locations:
                lid = loc.location_id
                x[(pid, sid, lid)] = pulp.LpVariable(
                    f"x_{pid[:8]}_{sid[:8]}_{lid[:8]}", lowBound=0, cat="Continuous"
                )
            y[(pid, sid)] = pulp.LpVariable(
                f"y_{pid[:8]}_{sid[:8]}", cat="Binary"
            )

        for loc in locations:
            lid = loc.location_id
            inv[(pid, lid)] = pulp.LpVariable(f"inv_{pid[:8]}_{lid[:8]}", lowBound=0)
            bo[(pid, lid)] = pulp.LpVariable(f"bo_{pid[:8]}_{lid[:8]}", lowBound=0)

    # ── Objective ────────────────────────────
    objective_terms = []

    for product in products:
        pid = product.product_id
        offers = offers_by_product.get(pid, [])

        for offer in offers:
            sid = offer["supplier_id"]
            proc_cost = offer["price"]
            ship_cost = offer["price"] * ship_cost_fraction

            for loc in locations:
                lid = loc.location_id
                if (pid, sid, lid) in x:
                    objective_terms.append((proc_cost + ship_cost) * x[(pid, sid, lid)])

        for loc in locations:
            lid = loc.location_id
            cp = cost_params.get((pid, lid), {})
            h = cp.get("holding", 0.5)
            p = cp.get("penalty", 10.0)

            if (pid, lid) in inv:
                objective_terms.append(h * inv[(pid, lid)])
            if (pid, lid) in bo:
                objective_terms.append(p * bo[(pid, lid)])

    prob += pulp.lpSum(objective_terms), "total_cost"

    # ── Constraints ──────────────────────────
    for product in products:
        pid = product.product_id
        offers = offers_by_product.get(pid, [])
        if not offers:
            continue

        # --- Demand satisfaction ---
        for loc in locations:
            lid = loc.location_id
            d = demand.get((pid, lid), 0)
            ss = safety_stocks.get((pid, lid), 0)

            inflow = pulp.lpSum(
                x[(pid, offer["supplier_id"], lid)]
                for offer in offers
                if (pid, offer["supplier_id"], lid) in x
            )
            if (pid, lid) in inv and (pid, lid) in bo:
                # inflow + inventory_buffer ≥ demand
                # Allow backorders: inflow - bo ≥ demand - inv
                prob += (inflow + inv[(pid, lid)] - bo[(pid, lid)] >= d), \
                    f"demand_{pid[:8]}_{lid[:8]}"
                # Maintain safety stock buffer
                prob += (inv[(pid, lid)] >= ss), \
                    f"safety_stock_{pid[:8]}_{lid[:8]}"

        # --- Supplier capacity ---
        for offer in offers:
            sid = offer["supplier_id"]
            cap = offer["capacity"]
            total_shipped = pulp.lpSum(
                x[(pid, sid, lid)]
                for loc in locations
                for lid in [loc.location_id]
                if (pid, sid, lid) in x
            )
            if (pid, sid) in y:
                prob += (total_shipped <= cap * y[(pid, sid)]), \
                    f"capacity_{pid[:8]}_{sid[:8]}"

                # --- MOQ constraint ---
                moq = offer["moq"]
                big_m = min(cap, BIG_M_DEFAULT)
                prob += (total_shipped >= moq * y[(pid, sid)]), \
                    f"moq_{pid[:8]}_{sid[:8]}"
                # Big-M linking: can't order without selecting supplier
                prob += (total_shipped <= big_m * y[(pid, sid)]), \
                    f"bigm_{pid[:8]}_{sid[:8]}"

        # --- Max suppliers per product ---
        supplier_binaries = [y[(pid, o["supplier_id"])] for o in offers if (pid, o["supplier_id"]) in y]
        if supplier_binaries:
            prob += (pulp.lpSum(supplier_binaries) <= max_suppliers_per_product), \
                f"max_suppliers_{pid[:8]}"

    # ── Solve ────────────────────────────────
    solver = pulp.PULP_CBC_CMD(
        timeLimit=time_limit,
        msg=0,           # suppress solver output
        gapRel=0.02,     # 2% optimality gap acceptable
    )
    prob.solve(solver)

    status = pulp.LpStatus[prob.status]

    # ── Extract solution ──────────────────────
    solution: Dict[str, Any] = {
        "status": status,
        "total_cost": pulp.value(prob.objective) or 0,
        "allocations": [],
        "cost_breakdown": {
            "procurement": 0.0,
            "shipping": 0.0,
            "holding": 0.0,
            "penalty": 0.0,
        },
        "binding_constraints": [],
    }

    if status in ("Optimal", "Not Solved"):
        for product in products:
            pid = product.product_id
            offers = offers_by_product.get(pid, [])

            for offer in offers:
                sid = offer["supplier_id"]
                for loc in locations:
                    lid = loc.location_id
                    key = (pid, sid, lid)
                    if key in x:
                        qty_val = pulp.value(x[key]) or 0
                        if qty_val > 0.5:
                            proc = offer["price"] * qty_val
                            ship = offer["price"] * ship_cost_fraction * qty_val
                            solution["allocations"].append({
                                "product_id": pid,
                                "supplier_id": sid,
                                "supplier_name": offer["supplier_name"],
                                "location_id": lid,
                                "qty": round(qty_val, 1),
                                "unit_cost": offer["price"],
                                "ship_cost_per_unit": round(offer["price"] * ship_cost_fraction, 2),
                                "total_procurement": round(proc, 2),
                                "total_shipping": round(ship, 2),
                                "total_cost": round(proc + ship, 2),
                            })
                            solution["cost_breakdown"]["procurement"] += proc
                            solution["cost_breakdown"]["shipping"] += ship

            for loc in locations:
                lid = loc.location_id
                cp = cost_params.get((pid, lid), {})
                h = cp.get("holding", 0.5)
                p_pen = cp.get("penalty", 10.0)

                inv_val = pulp.value(inv.get((pid, lid), 0)) or 0
                bo_val = pulp.value(bo.get((pid, lid), 0)) or 0
                solution["cost_breakdown"]["holding"] += h * inv_val
                solution["cost_breakdown"]["penalty"] += p_pen * bo_val

        # Round cost breakdown
        for k in solution["cost_breakdown"]:
            solution["cost_breakdown"][k] = round(solution["cost_breakdown"][k], 2)

        # Identify binding constraints (those with zero slack)
        binding = []
        for name, constraint in prob.constraints.items():
            slack = constraint.slack
            if slack is not None and abs(slack) < 1e-4:
                binding.append(name)
        solution["binding_constraints"] = binding[:20]  # top 20

    return status, solution


# ─────────────────────────────────────────────
# Agent Runner
# ─────────────────────────────────────────────

def run_optimisation(
    db: Session,
    run_id: str,
    forecast_run_id: str,
    inventory_run_id: str,
    product_ids: Optional[List[str]] = None,
    use_p90: bool = False,
    max_suppliers_per_product: int = 3,
) -> OptimisationRun:
    """
    Execute the MILP optimisation and persist results.
    """
    run = db.query(OptimisationRun).filter(OptimisationRun.run_id == run_id).first()
    if not run:
        raise ValueError(f"OptimisationRun {run_id} not found")

    run.status = "running"
    db.commit()

    t_start = time.monotonic()

    try:
        products = _load_products(db, product_ids)
        locations = db.query(Location).all()

        pid_list = [p.product_id for p in products]
        lid_list = [l.location_id for l in locations]

        offers = _load_offers(db, pid_list)
        demand = _load_demand(db, forecast_run_id, pid_list, lid_list, use_p90=use_p90)
        cost_params = _load_costs(db, pid_list, lid_list)
        safety_stocks = _load_safety_stocks(db, inventory_run_id, pid_list, lid_list)

        status, solution = _build_and_solve(
            products=products,
            locations=locations,
            offers_by_product=offers,
            demand=demand,
            cost_params=cost_params,
            safety_stocks=safety_stocks,
            max_suppliers_per_product=max_suppliers_per_product,
            time_limit=settings.solver_time_limit_seconds,
        )

        solve_ms = int((time.monotonic() - t_start) * 1000)

        # Persist allocations
        for alloc in solution.get("allocations", []):
            row = OptimisationAllocation(
                run_id=run_id,
                supplier_id=alloc["supplier_id"],
                product_id=alloc["product_id"],
                location_id=alloc["location_id"],
                qty=alloc["qty"],
                unit_cost=alloc["unit_cost"],
                ship_cost=alloc["ship_cost_per_unit"],
                total_cost=alloc["total_cost"],
            )
            db.add(row)

        run.status = "optimal" if status == "Optimal" else "infeasible"
        run.total_cost = solution.get("total_cost", 0)
        run.solve_time_ms = solve_ms
        run.binding_constraints = solution.get("binding_constraints", [])
        run.cost_breakdown = solution.get("cost_breakdown", {})
        run.completed_at = datetime.utcnow()
        db.commit()

    except Exception as exc:
        db.rollback()
        run.status = "failed"
        db.commit()
        raise

    return run


def get_optimisation_explanation(db: Session, run_id: str) -> dict:
    """
    Return human-readable explanation of the optimisation result:
    cost drivers, binding constraints, and top allocations.
    """
    run = db.query(OptimisationRun).filter(OptimisationRun.run_id == run_id).first()
    if not run:
        return {}

    allocations = (
        db.query(OptimisationAllocation, Product, Supplier)
        .join(Product, OptimisationAllocation.product_id == Product.product_id)
        .join(Supplier, OptimisationAllocation.supplier_id == Supplier.supplier_id)
        .filter(OptimisationAllocation.run_id == run_id)
        .order_by(OptimisationAllocation.total_cost.desc())
        .limit(10)
        .all()
    )

    total = float(run.total_cost or 0)
    breakdown = run.cost_breakdown or {}

    return {
        "run_id": run_id,
        "status": run.status,
        "total_cost": total,
        "solve_time_ms": run.solve_time_ms,
        "cost_breakdown": breakdown,
        "cost_pct": {
            k: round(v / total * 100, 1) if total > 0 else 0
            for k, v in breakdown.items()
        },
        "binding_constraints": run.binding_constraints or [],
        "top_allocations": [
            {
                "product": p.sku,
                "supplier": s.name,
                "location_id": a.location_id,
                "qty": a.qty,
                "unit_cost": float(a.unit_cost or 0),
                "total_cost": float(a.total_cost or 0),
            }
            for a, p, s in allocations
        ],
    }
