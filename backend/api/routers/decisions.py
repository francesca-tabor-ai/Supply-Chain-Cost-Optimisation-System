"""
Decision / Recommendation Router
POST /decisions/recommend   → full pipeline recommendation
GET  /decisions/{run_id}    → poll decision status + summary
GET  /decisions             → list recent decisions
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.db.session import get_db
from backend.db.models import DecisionRun
from backend.agents.decision.agent import run_decision_pipeline

router = APIRouter(prefix="/decisions", tags=["decisions"])


class RecommendRequest(BaseModel):
    skus: Optional[List[str]] = None        # None = auto-select top SKUs
    sources: Optional[List[str]] = None
    use_p90_demand: bool = False            # True = risk-averse (conservative)
    max_suppliers_per_product: int = 3
    horizon_periods: int = 13


class DecisionResponse(BaseModel):
    run_id: str
    status: str
    summary: Optional[dict] = None
    created_at: Optional[str]
    completed_at: Optional[str]


@router.post("/recommend", response_model=DecisionResponse)
def recommend(req: RecommendRequest, db: Session = Depends(get_db)):
    """
    Run the full supply chain optimisation pipeline:
    scraper → forecast → inventory policy → LP optimisation.
    Returns a recommendation summary with cost reduction estimate.
    """
    decision = DecisionRun(status="pending")
    db.add(decision)
    db.flush()

    run_decision_pipeline(
        db,
        decision.run_id,
        skus=req.skus,
        sources=req.sources,
        use_p90_demand=req.use_p90_demand,
        max_suppliers_per_product=req.max_suppliers_per_product,
        horizon_periods=req.horizon_periods,
    )

    return DecisionResponse(
        run_id=decision.run_id,
        status=decision.status,
        summary=decision.summary,
        created_at=decision.created_at.isoformat() if decision.created_at else None,
        completed_at=decision.completed_at.isoformat() if decision.completed_at else None,
    )


@router.get("/{run_id}", response_model=DecisionResponse)
def get_decision(run_id: str, db: Session = Depends(get_db)):
    decision = db.query(DecisionRun).filter(DecisionRun.run_id == run_id).first()
    if not decision:
        raise HTTPException(404, "Decision run not found")
    return DecisionResponse(
        run_id=decision.run_id,
        status=decision.status,
        summary=decision.summary,
        created_at=decision.created_at.isoformat() if decision.created_at else None,
        completed_at=decision.completed_at.isoformat() if decision.completed_at else None,
    )


@router.get("")
def list_decisions(limit: int = 10, db: Session = Depends(get_db)):
    decisions = (
        db.query(DecisionRun)
        .order_by(DecisionRun.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "run_id": d.run_id,
            "status": d.status,
            "created_at": d.created_at.isoformat() if d.created_at else None,
            "cost_reduction_pct": (d.summary or {}).get("cost_reduction_estimate_pct"),
            "total_cost": (d.summary or {}).get("total_cost"),
        }
        for d in decisions
    ]
