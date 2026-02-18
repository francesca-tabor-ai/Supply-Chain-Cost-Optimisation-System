"""
Supply Chain Cost Optimisation System — FastAPI Application
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.core.config import get_settings
from backend.api.routers import scraper, forecast, inventory, optimizer, decisions

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "AI-driven platform that minimises procurement, logistics, and inventory costs "
        "by automatically identifying optimal suppliers, forecasting demand, "
        "optimising inventory levels, and solving cost-minimisation MILP problems."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — allow React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(scraper.router)
app.include_router(forecast.router)
app.include_router(inventory.router)
app.include_router(optimizer.router)
app.include_router(decisions.router)


@app.get("/", tags=["health"])
def root():
    return {
        "service": settings.app_name,
        "version": settings.app_version,
        "status": "healthy",
        "docs": "/docs",
    }


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok"}
