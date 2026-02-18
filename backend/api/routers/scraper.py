"""
Scraper Router
POST /scrape/jobs       → create and run a scraper job
GET  /scrape/jobs/{id}  → poll job status
GET  /suppliers         → list suppliers with optional sku filter
"""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.db.session import get_db
from backend.db.models import ScraperJob, Supplier, SupplierOffer, Product
from backend.agents.scraper.agent import run_scraper_job, get_best_offers_for_product

router = APIRouter(prefix="/scrape", tags=["scraper"])


class ScrapeJobRequest(BaseModel):
    skus: List[str]
    sources: Optional[List[str]] = None


class ScrapeJobResponse(BaseModel):
    job_id: str
    status: str
    offers_collected: int
    skus: List[str]
    created_at: Optional[str]
    completed_at: Optional[str]
    error: Optional[str] = None


@router.post("/jobs", response_model=ScrapeJobResponse)
def create_scrape_job(req: ScrapeJobRequest, db: Session = Depends(get_db)):
    """Create and synchronously run a scraper job for the given SKUs."""
    # Validate SKUs exist
    existing = db.query(Product).filter(Product.sku.in_(req.skus)).all()
    valid_skus = [p.sku for p in existing]
    if not valid_skus:
        raise HTTPException(404, f"No products found for SKUs: {req.skus}")

    job = ScraperJob(skus=valid_skus, sources=req.sources or [], status="pending")
    db.add(job)
    db.flush()

    job = run_scraper_job(db, job.job_id, valid_skus, req.sources)

    return ScrapeJobResponse(
        job_id=job.job_id,
        status=job.status,
        offers_collected=job.offers_collected,
        skus=job.skus,
        created_at=job.created_at.isoformat() if job.created_at else None,
        completed_at=job.completed_at.isoformat() if job.completed_at else None,
        error=job.error,
    )


@router.get("/jobs/{job_id}", response_model=ScrapeJobResponse)
def get_scrape_job(job_id: str, db: Session = Depends(get_db)):
    job = db.query(ScraperJob).filter(ScraperJob.job_id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")
    return ScrapeJobResponse(
        job_id=job.job_id,
        status=job.status,
        offers_collected=job.offers_collected or 0,
        skus=job.skus or [],
        created_at=job.created_at.isoformat() if job.created_at else None,
        completed_at=job.completed_at.isoformat() if job.completed_at else None,
        error=job.error,
    )


@router.get("/suppliers")
def list_suppliers(
    sku: Optional[str] = None,
    top_n: int = 10,
    db: Session = Depends(get_db),
):
    """List best supplier offers, optionally filtered by SKU."""
    if sku:
        product = db.query(Product).filter(Product.sku == sku).first()
        if not product:
            raise HTTPException(404, f"SKU {sku} not found")
        return get_best_offers_for_product(db, product.product_id, top_n=top_n)

    # Return all active suppliers with their latest offer count
    suppliers = db.query(Supplier).filter(Supplier.is_active == True).all()
    return [
        {
            "supplier_id": s.supplier_id,
            "name": s.name,
            "rating": s.rating,
            "region": s.region,
            "country": s.country,
            "offer_count": db.query(SupplierOffer)
                .filter(SupplierOffer.supplier_id == s.supplier_id)
                .count(),
        }
        for s in suppliers
    ]
