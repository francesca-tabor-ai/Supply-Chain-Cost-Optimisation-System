"""
Inventory Optimisation Agent
=============================
Computes per-product/location inventory policy parameters:

  EOQ  = sqrt(2 * D * S / H)
  SS   = z_SL * sigma_LT
  ROP  = mu_LT + SS
       = (D/period * L) + z_SL * sigma * sqrt(L)

Where:
  D         = annual demand rate (from forecast)
  S         = setup / ordering cost
  H         = holding cost per unit per year
  L         = lead time in periods
  sigma     = demand std deviation per period
  z_SL      = z-score for desired service level (e.g. 0.95 → 1.645)
  sigma_LT  = demand std dev during lead time = sigma * sqrt(L)

Annual cost at EOQ:
  TC = (D/EOQ) * S + (EOQ/2) * H

The outputs (EOQ, ROP, SS) feed:
  1. LP optimisation as target order size / inventory constraint
  2. Dashboard for operations teams
"""

import math
from datetime import datetime
from typing import List, Optional

import numpy as np
from scipy.stats import norm
from sqlalchemy.orm import Session

from backend.db.models import (
    CostParameter, ForecastResult, ForecastRun, InventoryPolicyResult,
    InventoryPolicyRun, Location, Product, SupplierOffer
)


# ─────────────────────────────────────────────
# Core EOQ / Safety Stock Mathematics
# ─────────────────────────────────────────────

def compute_eoq(demand_annual: float, setup_cost: float, holding_cost_annual: float) -> float:
    """
    Economic Order Quantity: EOQ = sqrt(2DS / H)

    Args:
        demand_annual: total annual demand in units
        setup_cost:    fixed cost per order (S)
        holding_cost_annual: holding cost per unit per year (H)

    Returns:
        EOQ in units (always ≥ 1)
    """
    if holding_cost_annual <= 0 or demand_annual <= 0:
        return max(1.0, demand_annual)
    eoq = math.sqrt(2 * demand_annual * setup_cost / holding_cost_annual)
    return max(1.0, round(eoq, 1))


def compute_safety_stock(
    demand_std_per_period: float,
    lead_time_periods: float,
    service_level: float,
    lead_time_std_periods: float = 0.0,
) -> float:
    """
    Safety stock for service level SL.

    If lead time is deterministic:
      SS = z_SL * sigma * sqrt(L)

    If lead time has variance (sigma_L):
      sigma_LT^2 = sigma^2 * L + mu^2 * sigma_L^2
      SS = z_SL * sigma_LT

    Args:
        demand_std_per_period:  std dev of periodic demand
        lead_time_periods:      mean lead time in periods
        service_level:          target (e.g. 0.95)
        lead_time_std_periods:  std dev of lead time (0 = deterministic)

    Returns:
        Safety stock in units (≥ 0)
    """
    z = norm.ppf(service_level)
    if lead_time_periods <= 0:
        return 0.0

    # Variance contribution from demand uncertainty
    var_demand = (demand_std_per_period ** 2) * lead_time_periods
    # Variance contribution from lead time uncertainty
    # Using mean demand approximation: E[D] ≈ demand_std * sqrt(2/pi) for half-normal,
    # but we need mean demand per period — use std as proxy when mean is unavailable
    var_lead_time = (demand_std_per_period ** 2) * (lead_time_std_periods ** 2)
    sigma_lt = math.sqrt(var_demand + var_lead_time)

    return max(0.0, round(z * sigma_lt, 1))


def compute_rop(
    demand_mean_per_period: float,
    lead_time_periods: float,
    safety_stock: float,
) -> float:
    """
    Reorder Point: ROP = mu_LT + SS
                       = (mean demand/period * lead time) + safety stock
    """
    mu_lt = demand_mean_per_period * lead_time_periods
    return max(0.0, round(mu_lt + safety_stock, 1))


def annual_inventory_cost(
    eoq: float,
    demand_annual: float,
    setup_cost: float,
    holding_cost_annual: float,
) -> dict:
    """
    Annual cost breakdown at EOQ:
      Ordering cost = (D / EOQ) * S
      Holding cost  = (EOQ / 2) * H
      Total         = sum
    """
    if eoq <= 0:
        return {"ordering": 0, "holding": 0, "total": 0}
    ordering = (demand_annual / eoq) * setup_cost
    holding = (eoq / 2) * holding_cost_annual
    return {
        "ordering": round(ordering, 2),
        "holding": round(holding, 2),
        "total": round(ordering + holding, 2),
    }


# ─────────────────────────────────────────────
# Agent runner
# ─────────────────────────────────────────────

def run_inventory_policy(
    db: Session,
    run_id: str,
    forecast_run_id: str,
    periods_per_year: int = 52,   # weekly periods
) -> InventoryPolicyRun:
    """
    Compute EOQ, ROP, and safety stock for all products/locations
    using the latest cost parameters and a given forecast run.
    """
    run = db.query(InventoryPolicyRun).filter(InventoryPolicyRun.run_id == run_id).first()
    if not run:
        raise ValueError(f"InventoryPolicyRun {run_id} not found")

    run.status = "running"
    db.commit()

    try:
        # Load all cost parameters
        cost_params = db.query(CostParameter).all()
        results_added = 0

        for cp in cost_params:
            # Annual holding cost from per-period rate
            h_annual = float(cp.holding_cost_per_unit_period) * periods_per_year
            s = float(cp.setup_cost)
            sl = cp.service_level

            # Get best lead time from latest supplier offers for this product
            latest_offer = (
                db.query(SupplierOffer)
                .filter(SupplierOffer.product_id == cp.product_id)
                .order_by(SupplierOffer.price)
                .first()
            )
            lead_time_weeks = (
                (latest_offer.lead_time_days / 7.0) if latest_offer else 4.0
            )

            # Pull forecast for this product/location
            forecasts = (
                db.query(ForecastResult)
                .filter(
                    ForecastResult.run_id == forecast_run_id,
                    ForecastResult.product_id == cp.product_id,
                    ForecastResult.location_id == cp.location_id,
                )
                .order_by(ForecastResult.date)
                .all()
            )

            if not forecasts:
                continue

            p50_values = np.array([f.p50 for f in forecasts])
            demand_mean = float(np.mean(p50_values))
            demand_std = float(np.std(p50_values))
            demand_annual = demand_mean * periods_per_year

            # Core calculations
            eoq = compute_eoq(demand_annual, s, h_annual)
            ss = compute_safety_stock(demand_std, lead_time_weeks, sl)
            rop = compute_rop(demand_mean, lead_time_weeks, ss)
            costs = annual_inventory_cost(eoq, demand_annual, s, h_annual)

            result = InventoryPolicyResult(
                run_id=run_id,
                product_id=cp.product_id,
                location_id=cp.location_id,
                eoq=eoq,
                rop=rop,
                safety_stock=ss,
                avg_demand=round(demand_mean, 2),
                demand_std=round(demand_std, 2),
                lead_time_days=round(lead_time_weeks * 7, 1),
                service_level=sl,
                annual_holding_cost=costs["holding"],
                annual_ordering_cost=costs["ordering"],
            )
            db.add(result)
            results_added += 1

        run.status = "done"
        run.completed_at = datetime.utcnow()
        db.commit()

    except Exception as exc:
        db.rollback()
        run.status = "failed"
        db.commit()
        raise

    return run


def get_policy_summary(db: Session, run_id: str) -> List[dict]:
    """
    Return a flat list of inventory policy results for dashboard display.
    """
    results = (
        db.query(InventoryPolicyResult, Product, Location)
        .join(Product, InventoryPolicyResult.product_id == Product.product_id)
        .outerjoin(Location, InventoryPolicyResult.location_id == Location.location_id)
        .filter(InventoryPolicyResult.run_id == run_id)
        .all()
    )
    return [
        {
            "product_sku": p.sku,
            "product_name": p.name,
            "location": loc.name if loc else "Global",
            "eoq": r.eoq,
            "rop": r.rop,
            "safety_stock": r.safety_stock,
            "avg_weekly_demand": r.avg_demand,
            "demand_std": r.demand_std,
            "lead_time_days": r.lead_time_days,
            "service_level_pct": round((r.service_level or 0) * 100, 1),
            "annual_holding_cost": r.annual_holding_cost,
            "annual_ordering_cost": r.annual_ordering_cost,
            "annual_total_cost": round((r.annual_holding_cost or 0) + (r.annual_ordering_cost or 0), 2),
        }
        for r, p, loc in results
    ]
