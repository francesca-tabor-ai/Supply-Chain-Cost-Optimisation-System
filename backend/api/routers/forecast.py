"""
Forecast Router
POST /forecast/run              → trigger a forecast run
GET  /forecast/{run_id}/results → poll results + metrics
GET  /forecast/history          → demand history for charting
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.db.session import get_db
from backend.db.models import DemandHistory, ForecastRun, ForecastResult, Product, Location
from backend.agents.forecast.agent import run_forecast, get_forecast_summary

router = APIRouter(prefix="/forecast", tags=["forecast"])


class ForecastRunRequest(BaseModel):
    sku_ids: Optional[List[str]] = None    # product_ids; None = all
    horizon: int = 13
    frequency: str = "W"


class ForecastRunResponse(BaseModel):
    run_id: str
    status: str
    created_at: Optional[str]
    completed_at: Optional[str]


@router.post("/run", response_model=ForecastRunResponse)
def trigger_forecast(req: ForecastRunRequest, db: Session = Depends(get_db)):
    """Trigger a synchronous forecast run for the given products."""
    forecast_run = ForecastRun(
        params={"sku_ids": req.sku_ids, "horizon": req.horizon, "freq": req.frequency},
        status="pending",
    )
    db.add(forecast_run)
    db.flush()

    run_forecast(db, forecast_run.run_id, req.sku_ids, horizon=req.horizon, frequency=req.frequency)

    return ForecastRunResponse(
        run_id=forecast_run.run_id,
        status=forecast_run.status,
        created_at=forecast_run.created_at.isoformat() if forecast_run.created_at else None,
        completed_at=forecast_run.completed_at.isoformat() if forecast_run.completed_at else None,
    )


@router.get("/{run_id}/results")
def get_forecast_results(run_id: str, db: Session = Depends(get_db)):
    """Return forecast results for a completed run."""
    run = db.query(ForecastRun).filter(ForecastRun.run_id == run_id).first()
    if not run:
        raise HTTPException(404, "Forecast run not found")
    if run.status != "done":
        return {"status": run.status, "results": []}

    return {
        "run_id": run_id,
        "status": run.status,
        "model_versions": run.model_versions,
        "results": get_forecast_summary(db, run_id),
    }


@router.get("/history")
def demand_history(
    sku: str = Query(..., description="Product SKU"),
    location_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Return historical demand for a SKU for chart rendering."""
    product = db.query(Product).filter(Product.sku == sku).first()
    if not product:
        raise HTTPException(404, f"SKU {sku} not found")

    q = db.query(DemandHistory).filter(DemandHistory.product_id == product.product_id)
    if location_id:
        q = q.filter(DemandHistory.location_id == location_id)

    rows = q.order_by(DemandHistory.date).all()
    return {
        "sku": sku,
        "product_name": product.name,
        "history": [{"date": r.date.strftime("%Y-%m-%d"), "qty": r.qty} for r in rows],
    }


@router.get("/runs")
def list_forecast_runs(limit: int = 10, db: Session = Depends(get_db)):
    runs = db.query(ForecastRun).order_by(ForecastRun.created_at.desc()).limit(limit).all()
    return [
        {
            "run_id": r.run_id,
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in runs
    ]
