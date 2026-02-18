"""
Creates all tables and seeds the database with realistic sample data.
Run: python -m backend.db.init_db
"""

import random
from datetime import datetime, timedelta
from faker import Faker
from sqlalchemy.orm import Session

from backend.db.session import engine, SessionLocal
from backend.db.models import Base, Product, Location, Supplier, Lane, \
    DemandHistory, CostParameter, InventoryState, SupplierOffer, ShippingQuote

fake = Faker()
random.seed(42)

CATEGORIES = ["Electronics", "Apparel", "Industrial", "FMCG", "Pharma"]
MODES = ["sea", "air", "road"]
INCOTERMS = [["FOB", "CIF"], ["EXW", "DDP"], ["FOB"], ["CIF", "DAP"]]
SOURCES = ["mock_alibaba", "mock_globalsources", "mock_made_in_china"]


def create_tables():
    Base.metadata.create_all(bind=engine)
    print("✓ Tables created")


def seed(db: Session):
    # ── Products ─────────────────────────────
    products = []
    skus = [f"SKU-{i:04d}" for i in range(1, 21)]
    for sku in skus:
        p = Product(
            sku=sku,
            name=fake.bs().title()[:60],
            category=random.choice(CATEGORIES),
            uom="unit",
            pack_size=random.choice([1, 6, 12, 24]),
        )
        db.add(p)
        products.append(p)
    db.flush()
    print(f"  ✓ {len(products)} products")

    # ── Locations ────────────────────────────
    locations_data = [
        ("London Warehouse", "warehouse", "GB"),
        ("Berlin DC", "distribution_center", "DE"),
        ("New York Hub", "warehouse", "US"),
        ("Singapore DC", "distribution_center", "SG"),
    ]
    locations = []
    for name, ltype, country in locations_data:
        loc = Location(name=name, type=ltype, country=country)
        db.add(loc)
        locations.append(loc)
    db.flush()
    print(f"  ✓ {len(locations)} locations")

    # ── Suppliers ────────────────────────────
    suppliers = []
    supplier_names = [
        "Shenzhen TechParts Co.", "GlobalEdge Manufacturing", "Delta Supply Group",
        "Apex Industrial Ltd", "Meridian Components", "Pacific Source Inc.",
        "Titan Trade Co.", "Sunrise Exports", "EastWest Logistics", "PrimeGoods Mfg"
    ]
    for sname in supplier_names:
        s = Supplier(
            name=sname,
            rating=round(random.uniform(3.0, 5.0), 1),
            region=random.choice(["Asia", "Europe", "North America"]),
            country=random.choice(["CN", "DE", "US", "IN", "VN"]),
            incoterms_supported=random.choice(INCOTERMS),
        )
        db.add(s)
        suppliers.append(s)
    db.flush()
    print(f"  ✓ {len(suppliers)} suppliers")

    # ── Lanes ────────────────────────────────
    lanes = []
    for supplier in suppliers:
        for location in locations:
            if random.random() > 0.4:  # not every supplier serves every location
                lane = Lane(
                    supplier_id=supplier.supplier_id,
                    location_id=location.location_id,
                    mode=random.choice(MODES),
                    transit_time_days=random.randint(3, 45),
                )
                db.add(lane)
                lanes.append(lane)
    db.flush()
    print(f"  ✓ {len(lanes)} lanes")

    # ── Supplier Offers ──────────────────────
    offers = []
    for product in products:
        # 3–6 suppliers per product
        chosen_suppliers = random.sample(suppliers, k=random.randint(3, 6))
        for supplier in chosen_suppliers:
            base_price = random.uniform(5.0, 500.0)
            offer = SupplierOffer(
                supplier_id=supplier.supplier_id,
                product_id=product.product_id,
                price=round(base_price, 2),
                currency="USD",
                moq=random.choice([100, 250, 500, 1000, 2000]),
                lead_time_days=random.randint(7, 60),
                capacity_units=random.randint(5000, 50000),
                source=random.choice(SOURCES),
                confidence=round(random.uniform(0.7, 1.0), 2),
                raw_json={"scraped": True, "tier_pricing": []},
            )
            db.add(offer)
            offers.append(offer)
    db.flush()
    print(f"  ✓ {len(offers)} supplier offers")

    # ── Shipping Quotes ──────────────────────
    quotes_added = 0
    for lane in lanes[:40]:  # sample subset
        for product in random.sample(products, k=3):
            q = ShippingQuote(
                lane_id=lane.lane_id,
                product_id=product.product_id,
                cost_per_unit=round(random.uniform(0.5, 25.0), 2),
                currency="USD",
                assumptions={"weight_kg": 0.5, "incoterm": "FOB"},
            )
            db.add(q)
            quotes_added += 1
    db.flush()
    print(f"  ✓ {quotes_added} shipping quotes")

    # ── Demand History (104 weeks per product/location) ──
    demand_rows = 0
    for product in products:
        for location in locations:
            base_demand = random.uniform(200, 2000)
            trend = random.uniform(-0.5, 2.0)   # weekly units
            for week in range(104):             # 2 years
                date = datetime(2023, 1, 2) + timedelta(weeks=week)
                seasonal = 1 + 0.3 * (
                    0.5 * (1 - abs(week % 52 - 26) / 26)
                )  # mid-year peak
                noise = random.gauss(0, base_demand * 0.1)
                qty = max(0, base_demand + trend * week + seasonal * 50 + noise)
                dh = DemandHistory(
                    product_id=product.product_id,
                    location_id=location.location_id,
                    date=date,
                    qty=round(qty, 1),
                )
                db.add(dh)
                demand_rows += 1
    db.flush()
    print(f"  ✓ {demand_rows} demand history rows")

    # ── Inventory State ──────────────────────
    for product in products:
        for location in locations:
            inv = InventoryState(
                product_id=product.product_id,
                location_id=location.location_id,
                on_hand=round(random.uniform(100, 5000), 0),
                on_order=round(random.uniform(0, 2000), 0),
                backorder=0,
            )
            db.add(inv)
    db.flush()
    print(f"  ✓ inventory states")

    # ── Cost Parameters ──────────────────────
    for product in products:
        for location in locations:
            cp = CostParameter(
                product_id=product.product_id,
                location_id=location.location_id,
                holding_cost_per_unit_period=round(random.uniform(0.05, 2.0), 3),
                setup_cost=round(random.uniform(50, 500), 2),
                stockout_penalty=round(random.uniform(5, 50), 2),
                service_level=random.choice([0.90, 0.95, 0.98]),
            )
            db.add(cp)
    print(f"  ✓ cost parameters")

    db.commit()
    print("\n✅ Seed complete.")


if __name__ == "__main__":
    create_tables()
    db = SessionLocal()
    try:
        seed(db)
    finally:
        db.close()
