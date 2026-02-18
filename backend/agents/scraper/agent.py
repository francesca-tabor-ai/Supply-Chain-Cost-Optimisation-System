"""
Supplier Scraper Agent
======================
Simulates supplier data collection from marketplace sources (Alibaba-style).

In production this would use Playwright/BeautifulSoup to crawl real sources.
For MVP it generates realistic synthetic data with noise, price tiers, and
competitive variation to feed the optimisation pipeline.

Key concepts:
 - Each 'source' has a different price/quality profile
 - Confidence scores reflect data completeness
 - Fingerprint deduplication prevents re-inserting unchanged offers
 - TTL check prevents re-running within scraper_ttl_hours
"""

import hashlib
import json
import random
from datetime import datetime, timedelta
from typing import List, Optional

from sqlalchemy.orm import Session

from backend.core.config import get_settings
from backend.db.models import (
    ScraperJob, Supplier, SupplierOffer, Product
)

settings = get_settings()

# Simulate price profiles per 'source' (markup factors)
SOURCE_PROFILES = {
    "mock_alibaba": {
        "price_factor_range": (0.85, 1.05),
        "moq_options": [100, 250, 500, 1000],
        "lead_time_range": (14, 45),
        "confidence_range": (0.75, 0.95),
        "rating_range": (3.5, 5.0),
    },
    "mock_globalsources": {
        "price_factor_range": (0.90, 1.10),
        "moq_options": [250, 500, 1000, 2000],
        "lead_time_range": (21, 60),
        "confidence_range": (0.80, 0.98),
        "rating_range": (3.8, 5.0),
    },
    "mock_made_in_china": {
        "price_factor_range": (0.80, 1.00),
        "moq_options": [500, 1000, 2000, 5000],
        "lead_time_range": (30, 60),
        "confidence_range": (0.65, 0.90),
        "rating_range": (3.0, 4.8),
    },
}

SUPPLIER_NAMES = [
    "Shenzhen TechParts Co.", "GlobalEdge Manufacturing", "Delta Supply Group",
    "Apex Industrial Ltd", "Meridian Components", "Pacific Source Inc.",
    "Titan Trade Co.", "Sunrise Exports", "EastWest Logistics", "PrimeGoods Mfg",
    "Horizon Enterprises", "BlueStar Supplies", "NovaTrade Asia", "AlphaMakers",
    "ZenithProcure Ltd",
]


def _fingerprint(offer_data: dict) -> str:
    """Stable hash of key offer fields for deduplication."""
    key = f"{offer_data['supplier_name']}|{offer_data['sku']}|{offer_data['price']}"
    return hashlib.md5(key.encode()).hexdigest()


def _simulate_offers_for_sku(sku: str, source: str, n_suppliers: int = 5) -> List[dict]:
    """
    Generate realistic synthetic supplier offers for a given SKU.
    Adds correlated noise: cheaper suppliers tend to have lower ratings and
    longer lead times, mimicking real marketplace dynamics.
    """
    profile = SOURCE_PROFILES.get(source, SOURCE_PROFILES["mock_alibaba"])
    rng = random.Random(hash(sku + source) % (2**32))

    # Base price anchored to SKU hash for consistency
    base_price = 10.0 + (hash(sku) % 490)

    offers = []
    for i in range(n_suppliers):
        factor = rng.uniform(*profile["price_factor_range"])
        price = round(base_price * factor * (1 + rng.gauss(0, 0.05)), 2)
        price = max(1.0, price)

        # Cheaper = slightly lower confidence & rating (market signal)
        price_percentile = (price - base_price * 0.8) / (base_price * 0.3 + 1)
        rating_adj = rng.uniform(*profile["rating_range"])
        rating_adj = min(5.0, rating_adj + price_percentile * 0.3)

        moq = rng.choice(profile["moq_options"])
        lead_time = rng.randint(*profile["lead_time_range"])
        confidence = rng.uniform(*profile["confidence_range"])
        ship_cost = round(rng.uniform(0.5, price * 0.15), 2)
        capacity = rng.randint(5000, 80000)

        supplier_name = rng.choice(SUPPLIER_NAMES)

        offers.append({
            "sku": sku,
            "source": source,
            "supplier_name": supplier_name,
            "price": price,
            "currency": "USD",
            "moq": moq,
            "lead_time_days": lead_time,
            "shipping_cost_per_unit": ship_cost,
            "capacity_units": capacity,
            "rating": round(rating_adj, 1),
            "confidence": round(confidence, 2),
            "fingerprint": _fingerprint({"supplier_name": supplier_name, "sku": sku, "price": price}),
            "raw_json": {
                "source": source,
                "tier_pricing": [
                    {"qty": moq, "price": price},
                    {"qty": moq * 2, "price": round(price * 0.95, 2)},
                    {"qty": moq * 5, "price": round(price * 0.90, 2)},
                ],
                "scraped_at": datetime.utcnow().isoformat(),
            },
        })

    return offers


def _get_or_create_supplier(db: Session, name: str, rating: float) -> Supplier:
    supplier = db.query(Supplier).filter(Supplier.name == name).first()
    if not supplier:
        supplier = Supplier(
            name=name,
            rating=rating,
            region="Asia",
            country="CN",
            incoterms_supported=["FOB", "CIF"],
        )
        db.add(supplier)
        db.flush()
    return supplier


def run_scraper_job(
    db: Session,
    job_id: str,
    skus: List[str],
    sources: Optional[List[str]] = None,
) -> ScraperJob:
    """
    Execute a scraper job: simulate fetching supplier data for each SKU
    and persist new/updated offers to the database.

    Returns the completed ScraperJob record.
    """
    if sources is None:
        sources = list(SOURCE_PROFILES.keys())

    job = db.query(ScraperJob).filter(ScraperJob.job_id == job_id).first()
    if not job:
        raise ValueError(f"Job {job_id} not found")

    job.status = "running"
    db.commit()

    offers_collected = 0
    try:
        for sku in skus:
            # Resolve product
            product = db.query(Product).filter(Product.sku == sku).first()
            if not product:
                continue  # skip unknown SKUs

            for source in sources:
                raw_offers = _simulate_offers_for_sku(sku, source, n_suppliers=4)
                for raw in raw_offers:
                    supplier = _get_or_create_supplier(db, raw["supplier_name"], raw["rating"])

                    # Dedup: check if same fingerprint already exists within TTL
                    ttl_cutoff = datetime.utcnow() - timedelta(hours=settings.scraper_ttl_hours)
                    existing = (
                        db.query(SupplierOffer)
                        .filter(
                            SupplierOffer.supplier_id == supplier.supplier_id,
                            SupplierOffer.product_id == product.product_id,
                            SupplierOffer.captured_at >= ttl_cutoff,
                        )
                        .first()
                    )
                    if existing:
                        continue  # within TTL, skip

                    offer = SupplierOffer(
                        supplier_id=supplier.supplier_id,
                        product_id=product.product_id,
                        price=raw["price"],
                        currency=raw["currency"],
                        moq=raw["moq"],
                        lead_time_days=raw["lead_time_days"],
                        capacity_units=raw["capacity_units"],
                        source=raw["source"],
                        confidence=raw["confidence"],
                        raw_json=raw["raw_json"],
                    )
                    db.add(offer)
                    offers_collected += 1

        db.flush()
        job.status = "done"
        job.offers_collected = offers_collected
        job.completed_at = datetime.utcnow()
        db.commit()

    except Exception as exc:
        db.rollback()
        job.status = "failed"
        job.error = str(exc)
        db.commit()
        raise

    return job


def get_best_offers_for_product(
    db: Session,
    product_id: str,
    top_n: int = 5,
    max_age_hours: int = 48,
) -> List[dict]:
    """
    Return the top N cheapest recent offers for a product,
    enriched with supplier name and rating.
    """
    cutoff = datetime.utcnow() - timedelta(hours=max_age_hours)
    offers = (
        db.query(SupplierOffer, Supplier)
        .join(Supplier, SupplierOffer.supplier_id == Supplier.supplier_id)
        .filter(
            SupplierOffer.product_id == product_id,
            SupplierOffer.captured_at >= cutoff,
        )
        .order_by(SupplierOffer.price)
        .limit(top_n)
        .all()
    )

    result = []
    for offer, supplier in offers:
        result.append({
            "offer_id": offer.offer_id,
            "supplier_id": supplier.supplier_id,
            "supplier_name": supplier.name,
            "supplier_rating": supplier.rating,
            "price": float(offer.price),
            "currency": offer.currency,
            "moq": offer.moq,
            "lead_time_days": offer.lead_time_days,
            "capacity_units": offer.capacity_units,
            "confidence": offer.confidence,
            "source": offer.source,
            "captured_at": offer.captured_at.isoformat() if offer.captured_at else None,
        })
    return result
