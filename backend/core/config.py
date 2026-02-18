from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    app_name: str = "Supply Chain Cost Optimisation System"
    app_version: str = "1.0.0"
    debug: bool = False

    # Database
    database_url: str = "postgresql://scco:scco_password@localhost:5432/scco_db"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Security
    secret_key: str = "dev-secret-key-change-in-production"

    # Optimisation solver
    solver_time_limit_seconds: int = 5

    # Forecasting
    forecast_horizon_days: int = 90
    forecast_frequency: str = "W"  # Weekly

    # Scraper
    scraper_ttl_hours: int = 24

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()
