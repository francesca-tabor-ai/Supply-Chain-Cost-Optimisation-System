"""
SQLAlchemy ORM models for the Supply Chain Cost Optimisation System.
Schema covers: dimension tables, fact tables, and run/result tables.
"""

import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Float, Integer, Boolean, DateTime,
    ForeignKey, Text, JSON, Numeric, Index
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, DeclarativeBase
from sqlalchemy.sql import func


class Base(DeclarativeBase):
    pass


def gen_uuid():
    return str(uuid.uuid4())


# ─────────────────────────────────────────────
# DIMENSION TABLES
# ─────────────────────────────────────────────

class Product(Base):
    __tablename__ = "products"

    product_id = Column(String, primary_key=True, default=gen_uuid)
    sku = Column(String(64), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    category = Column(String(128))
    uom = Column(String(32), default="unit")        # unit of measure
    pack_size = Column(Integer, default=1)
    created_at = Column(DateTime, server_default=func.now())

    demand_history = relationship("DemandHistory", back_populates="product")
    supplier_offers = relationship("SupplierOffer", back_populates="product")
    forecast_results = relationship("ForecastResult", back_populates="product")
    inventory_states = relationship("InventoryState", back_populates="product")
    cost_parameters = relationship("CostParameter", back_populates="product")


class Location(Base):
    __tablename__ = "locations"

    location_id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String(255), nullable=False)
    type = Column(String(64))       # warehouse | distribution_center | retail
    country = Column(String(64))
    created_at = Column(DateTime, server_default=func.now())

    demand_history = relationship("DemandHistory", back_populates="location")
    inventory_states = relationship("InventoryState", back_populates="location")
    cost_parameters = relationship("CostParameter", back_populates="location")
    lanes_as_dest = relationship("Lane", back_populates="location")


class Supplier(Base):
    __tablename__ = "suppliers"

    supplier_id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String(255), nullable=False)
    rating = Column(Float)          # 0–5
    region = Column(String(128))
    country = Column(String(64))
    incoterms_supported = Column(JSON, default=list)  # ["FOB","CIF"]
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

    offers = relationship("SupplierOffer", back_populates="supplier")
    lanes = relationship("Lane", back_populates="supplier")


class Lane(Base):
    """Supplier → Location shipping lane."""
    __tablename__ = "lanes"

    lane_id = Column(String, primary_key=True, default=gen_uuid)
    supplier_id = Column(String, ForeignKey("suppliers.supplier_id"), nullable=False)
    location_id = Column(String, ForeignKey("locations.location_id"), nullable=False)
    mode = Column(String(32))               # sea | air | road | rail
    transit_time_days = Column(Integer)

    supplier = relationship("Supplier", back_populates="lanes")
    location = relationship("Location", back_populates="lanes_as_dest")
    shipping_quotes = relationship("ShippingQuote", back_populates="lane")


# ─────────────────────────────────────────────
# FACT TABLES
# ─────────────────────────────────────────────

class SupplierOffer(Base):
    """A priced offer from a supplier for a specific product (scraper output)."""
    __tablename__ = "supplier_offers"

    offer_id = Column(String, primary_key=True, default=gen_uuid)
    supplier_id = Column(String, ForeignKey("suppliers.supplier_id"), nullable=False)
    product_id = Column(String, ForeignKey("products.product_id"), nullable=False)
    price = Column(Numeric(12, 4), nullable=False)
    currency = Column(String(8), default="USD")
    moq = Column(Integer, default=1)                # minimum order quantity
    lead_time_days = Column(Integer)
    capacity_units = Column(Integer)                # max supply per period
    captured_at = Column(DateTime, server_default=func.now())
    source_url = Column(Text)
    source = Column(String(128))                    # alibaba | mock | erp
    confidence = Column(Float, default=1.0)         # 0–1 data quality score
    raw_json = Column(JSON)

    supplier = relationship("Supplier", back_populates="offers")
    product = relationship("Product", back_populates="supplier_offers")

    __table_args__ = (
        Index("ix_offers_product_supplier", "product_id", "supplier_id"),
    )


class ShippingQuote(Base):
    __tablename__ = "shipping_quotes"

    quote_id = Column(String, primary_key=True, default=gen_uuid)
    lane_id = Column(String, ForeignKey("lanes.lane_id"), nullable=False)
    product_id = Column(String, ForeignKey("products.product_id"), nullable=False)
    cost_per_unit = Column(Numeric(12, 4), nullable=False)
    currency = Column(String(8), default="USD")
    captured_at = Column(DateTime, server_default=func.now())
    assumptions = Column(JSON)

    lane = relationship("Lane", back_populates="shipping_quotes")


class DemandHistory(Base):
    __tablename__ = "demand_history"

    id = Column(String, primary_key=True, default=gen_uuid)
    product_id = Column(String, ForeignKey("products.product_id"), nullable=False)
    location_id = Column(String, ForeignKey("locations.location_id"), nullable=False)
    date = Column(DateTime, nullable=False)
    qty = Column(Float, nullable=False)

    product = relationship("Product", back_populates="demand_history")
    location = relationship("Location", back_populates="demand_history")

    __table_args__ = (
        Index("ix_demand_product_location_date", "product_id", "location_id", "date"),
    )


class InventoryState(Base):
    __tablename__ = "inventory_state"

    id = Column(String, primary_key=True, default=gen_uuid)
    product_id = Column(String, ForeignKey("products.product_id"), nullable=False)
    location_id = Column(String, ForeignKey("locations.location_id"), nullable=False)
    on_hand = Column(Float, default=0)
    on_order = Column(Float, default=0)
    backorder = Column(Float, default=0)
    snapshot_at = Column(DateTime, server_default=func.now())

    product = relationship("Product", back_populates="inventory_states")
    location = relationship("Location", back_populates="inventory_states")


class CostParameter(Base):
    __tablename__ = "cost_parameters"

    id = Column(String, primary_key=True, default=gen_uuid)
    product_id = Column(String, ForeignKey("products.product_id"), nullable=False)
    location_id = Column(String, ForeignKey("locations.location_id"), nullable=False)
    holding_cost_per_unit_period = Column(Numeric(12, 4), nullable=False)
    setup_cost = Column(Numeric(12, 4), nullable=False)         # ordering cost S
    stockout_penalty = Column(Numeric(12, 4), default=0)
    service_level = Column(Float, default=0.95)                 # e.g. 0.95
    effective_from = Column(DateTime, server_default=func.now())

    product = relationship("Product", back_populates="cost_parameters")
    location = relationship("Location", back_populates="cost_parameters")


# ─────────────────────────────────────────────
# RUN / RESULT TABLES
# ─────────────────────────────────────────────

class ScraperJob(Base):
    __tablename__ = "scraper_jobs"

    job_id = Column(String, primary_key=True, default=gen_uuid)
    skus = Column(JSON)             # list of SKUs requested
    sources = Column(JSON)          # list of sources
    status = Column(String(32), default="pending")   # pending|running|done|failed
    offers_collected = Column(Integer, default=0)
    error = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    completed_at = Column(DateTime)


class ForecastRun(Base):
    __tablename__ = "forecast_runs"

    run_id = Column(String, primary_key=True, default=gen_uuid)
    params = Column(JSON)
    model_versions = Column(JSON)
    status = Column(String(32), default="pending")
    created_at = Column(DateTime, server_default=func.now())
    completed_at = Column(DateTime)

    results = relationship("ForecastResult", back_populates="run")


class ForecastResult(Base):
    __tablename__ = "forecast_results"

    id = Column(String, primary_key=True, default=gen_uuid)
    run_id = Column(String, ForeignKey("forecast_runs.run_id"), nullable=False)
    product_id = Column(String, ForeignKey("products.product_id"), nullable=False)
    location_id = Column(String, ForeignKey("locations.location_id"))
    date = Column(DateTime, nullable=False)
    p50 = Column(Float, nullable=False)     # median forecast
    p90 = Column(Float, nullable=False)     # 90th percentile (risk-averse)
    model_used = Column(String(64))
    mape = Column(Float)
    wape = Column(Float)

    run = relationship("ForecastRun", back_populates="results")
    product = relationship("Product", back_populates="forecast_results")

    __table_args__ = (
        Index("ix_forecast_run_product_date", "run_id", "product_id", "date"),
    )


class InventoryPolicyRun(Base):
    __tablename__ = "inventory_policy_runs"

    run_id = Column(String, primary_key=True, default=gen_uuid)
    params = Column(JSON)
    status = Column(String(32), default="pending")
    created_at = Column(DateTime, server_default=func.now())
    completed_at = Column(DateTime)

    results = relationship("InventoryPolicyResult", back_populates="run")


class InventoryPolicyResult(Base):
    __tablename__ = "inventory_policy_results"

    id = Column(String, primary_key=True, default=gen_uuid)
    run_id = Column(String, ForeignKey("inventory_policy_runs.run_id"), nullable=False)
    product_id = Column(String, ForeignKey("products.product_id"), nullable=False)
    location_id = Column(String, ForeignKey("locations.location_id"))
    eoq = Column(Float)             # Economic Order Quantity
    rop = Column(Float)             # Reorder Point
    safety_stock = Column(Float)
    avg_demand = Column(Float)
    demand_std = Column(Float)
    lead_time_days = Column(Float)
    service_level = Column(Float)
    annual_holding_cost = Column(Float)
    annual_ordering_cost = Column(Float)

    run = relationship("InventoryPolicyRun", back_populates="results")


class OptimisationRun(Base):
    __tablename__ = "optimisation_runs"

    run_id = Column(String, primary_key=True, default=gen_uuid)
    scenario_id = Column(String)
    params = Column(JSON)
    solver = Column(String(64), default="CBC")
    status = Column(String(32), default="pending")   # pending|optimal|infeasible|failed
    total_cost = Column(Numeric(16, 2))
    solve_time_ms = Column(Integer)
    binding_constraints = Column(JSON)
    cost_breakdown = Column(JSON)
    created_at = Column(DateTime, server_default=func.now())
    completed_at = Column(DateTime)

    allocations = relationship("OptimisationAllocation", back_populates="run")


class OptimisationAllocation(Base):
    __tablename__ = "optimisation_allocations"

    id = Column(String, primary_key=True, default=gen_uuid)
    run_id = Column(String, ForeignKey("optimisation_runs.run_id"), nullable=False)
    supplier_id = Column(String, ForeignKey("suppliers.supplier_id"), nullable=False)
    product_id = Column(String, ForeignKey("products.product_id"), nullable=False)
    location_id = Column(String, ForeignKey("locations.location_id"))
    period = Column(String(32))         # e.g. "2025-W01"
    qty = Column(Float, nullable=False)
    unit_cost = Column(Numeric(12, 4))
    ship_cost = Column(Numeric(12, 4))
    total_cost = Column(Numeric(16, 2))

    run = relationship("OptimisationRun", back_populates="allocations")

    __table_args__ = (
        Index("ix_alloc_run_product", "run_id", "product_id"),
    )


class DecisionRun(Base):
    __tablename__ = "decision_runs"

    run_id = Column(String, primary_key=True, default=gen_uuid)
    status = Column(String(32), default="pending")
    scraper_job_id = Column(String, ForeignKey("scraper_jobs.job_id"))
    forecast_run_id = Column(String, ForeignKey("forecast_runs.run_id"))
    inventory_run_id = Column(String, ForeignKey("inventory_policy_runs.run_id"))
    optimisation_run_id = Column(String, ForeignKey("optimisation_runs.run_id"))
    summary = Column(JSON)      # top recommendations + cost reduction estimate
    created_at = Column(DateTime, server_default=func.now())
    completed_at = Column(DateTime)
