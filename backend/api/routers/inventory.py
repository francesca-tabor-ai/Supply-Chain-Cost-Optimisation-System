"""
Inventory Policy Router
POST /inventory/policy              → compute EOQ/ROP/SS
GET  /inventory/policy/{run_id}     → get results
GET  /inventory/state               → current on-hand snapshot
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.db.session import get_db
from backend.db.models import InventoryPolicyRun, InventoryState, Product, Location
from backend.agents.inventory.agent import run_inventory_policy, get_policy_summary

router = APIRouter(prefix="/inventory", tags=["inventory"])


class PolicyRequest(BaseModel):
    forecast_run_id: str
    periods_per_year: int = 52


class PolicyResponse(BaseModel):
    run_id: str
    status: str
    created_at: Optional[str]
    completed_at: Optional[str]


@router.post("/policy", response_model=PolicyResponse)
def compute_policy(req: PolicyRequest, db: Session = Depends(get_db)):
    """Compute EOQ, ROP, and safety stock for all products."""
    inv_run = InventoryPolicyRun(
        params={"forecast_run_id": req.forecast_run_id, "periods_per_year": req.periods_per_year},
        status="pending",
    )
    db.add(inv_run)
    db.flush()

    run_inventory_policy(db, inv_run.run_id, req.forecast_run_id, req.periods_per_year)

    return PolicyResponse(
        run_id=inv_run.run_id,
        status=inv_run.status,
        created_at=inv_run.created_at.isoformat() if inv_run.created_at else None,
        completed_at=inv_run.completed_at.isoformat() if inv_run.completed_at else None,
    )


@router.get("/policy/{run_id}")
def get_policy(run_id: str, db: Session = Depends(get_db)):
    run = db.query(InventoryPolicyRun).filter(InventoryPolicyRun.run_id == run_id).first()
    if not run:
        raise HTTPException(404, "Policy run not found")
    if run.status != "done":
        return {"status": run.status, "results": []}

    return {
        "run_id": run_id,
        "status": run.status,
        "results": get_policy_summary(db, run_id),
    }


@router.get("/state")
def current_inventory_state(
    sku: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Return current inventory on-hand snapshot."""
    q = (
        db.query(InventoryState, Product, Location)
        .join(Product, InventoryState.product_id == Product.product_id)
        .join(Location, InventoryState.location_id == Location.location_id)
    )
    if sku:
        q = q.filter(Product.sku == sku)

    rows = q.order_by(Product.sku).limit(200).all()
    return [
        {
            "sku": p.sku,
            "product_name": p.name,
            "location": loc.name,
            "on_hand": inv.on_hand,
            "on_order": inv.on_order,
            "backorder": inv.backorder,
            "snapshot_at": inv.snapshot_at.isoformat() if inv.snapshot_at else None,
        }
        for inv, p, loc in rows
    ]
