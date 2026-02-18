"""
Optimiser Router
POST /optimize/run              → solve MILP
GET  /optimize/{run_id}/solution → allocations + cost breakdown
GET  /optimize/{run_id}/explain  → binding constraints + cost drivers
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.db.session import get_db
from backend.db.models import OptimisationRun, OptimisationAllocation, Product, Supplier, Location
from backend.agents.optimizer.agent import run_optimisation, get_optimisation_explanation

router = APIRouter(prefix="/optimize", tags=["optimizer"])


class OptimizeRequest(BaseModel):
    forecast_run_id: str
    inventory_run_id: str
    product_ids: Optional[List[str]] = None
    use_p90_demand: bool = False
    max_suppliers_per_product: int = 3


class OptimizeResponse(BaseModel):
    run_id: str
    status: str
    total_cost: Optional[float]
    solve_time_ms: Optional[int]


@router.post("/run", response_model=OptimizeResponse)
def trigger_optimisation(req: OptimizeRequest, db: Session = Depends(get_db)):
    """Trigger the MILP optimisation. Returns run_id immediately."""
    opt_run = OptimisationRun(
        params={
            "forecast_run_id": req.forecast_run_id,
            "inventory_run_id": req.inventory_run_id,
            "use_p90": req.use_p90_demand,
            "max_suppliers": req.max_suppliers_per_product,
        },
        solver="CBC",
        status="pending",
    )
    db.add(opt_run)
    db.flush()

    run_optimisation(
        db,
        opt_run.run_id,
        req.forecast_run_id,
        req.inventory_run_id,
        product_ids=req.product_ids,
        use_p90=req.use_p90_demand,
        max_suppliers_per_product=req.max_suppliers_per_product,
    )

    return OptimizeResponse(
        run_id=opt_run.run_id,
        status=opt_run.status,
        total_cost=float(opt_run.total_cost) if opt_run.total_cost else None,
        solve_time_ms=opt_run.solve_time_ms,
    )


@router.get("/{run_id}/solution")
def get_solution(run_id: str, db: Session = Depends(get_db)):
    """Return the full allocation plan for a completed optimisation run."""
    run = db.query(OptimisationRun).filter(OptimisationRun.run_id == run_id).first()
    if not run:
        raise HTTPException(404, "Optimisation run not found")

    allocations = (
        db.query(OptimisationAllocation, Product, Supplier, Location)
        .join(Product, OptimisationAllocation.product_id == Product.product_id)
        .join(Supplier, OptimisationAllocation.supplier_id == Supplier.supplier_id)
        .outerjoin(Location, OptimisationAllocation.location_id == Location.location_id)
        .filter(OptimisationAllocation.run_id == run_id)
        .order_by(OptimisationAllocation.total_cost.desc())
        .all()
    )

    return {
        "run_id": run_id,
        "status": run.status,
        "total_cost": float(run.total_cost) if run.total_cost else 0,
        "solve_time_ms": run.solve_time_ms,
        "cost_breakdown": run.cost_breakdown,
        "allocations": [
            {
                "product_sku": p.sku,
                "product_name": p.name,
                "supplier": s.name,
                "supplier_rating": s.rating,
                "location": loc.name if loc else None,
                "qty": a.qty,
                "unit_cost": float(a.unit_cost) if a.unit_cost else 0,
                "ship_cost": float(a.ship_cost) if a.ship_cost else 0,
                "total_cost": float(a.total_cost) if a.total_cost else 0,
            }
            for a, p, s, loc in allocations
        ],
    }


@router.get("/{run_id}/explain")
def explain_solution(run_id: str, db: Session = Depends(get_db)):
    """Return explanation: cost drivers, binding constraints, top allocations."""
    return get_optimisation_explanation(db, run_id)
