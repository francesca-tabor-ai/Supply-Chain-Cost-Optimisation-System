"""
Demand Forecast Agent
=====================
Generates per-SKU/location demand forecasts using an ensemble of:
  1. ARIMA  (statsmodels)
  2. Prophet (Meta's Prophet)
  3. ETS / Exponential Smoothing (statsmodels)

For each product/location pair:
  - Train all three models on historical data
  - Evaluate on a held-out validation window (last 8 periods)
  - Select the model with lowest validation WAPE
  - Generate P50 (median) and P90 (90th percentile) forecasts
  - Persist results to forecast_results table

Mathematical output fed downstream:
  - P50 → baseline optimisation (expected cost)
  - P90 → risk-averse optimisation / safety stock sizing
"""

import warnings
from datetime import datetime
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

from backend.core.config import get_settings
from backend.db.models import (
    DemandHistory, ForecastResult, ForecastRun, Location, Product
)

warnings.filterwarnings("ignore")  # suppress convergence warnings in fitting
settings = get_settings()

VALIDATION_PERIODS = 8   # hold-out window for model selection


# ─────────────────────────────────────────────
# Metrics
# ─────────────────────────────────────────────

def wape(actual: np.ndarray, forecast: np.ndarray) -> float:
    """Weighted Absolute Percentage Error — robust to zero actuals."""
    total_actual = np.sum(np.abs(actual))
    if total_actual == 0:
        return 0.0
    return float(np.sum(np.abs(actual - forecast)) / total_actual)


def mape(actual: np.ndarray, forecast: np.ndarray) -> float:
    mask = actual != 0
    if not mask.any():
        return 0.0
    return float(np.mean(np.abs((actual[mask] - forecast[mask]) / actual[mask])) * 100)


def smape(actual: np.ndarray, forecast: np.ndarray) -> float:
    denom = np.abs(actual) + np.abs(forecast)
    mask = denom != 0
    if not mask.any():
        return 0.0
    return float(np.mean(2 * np.abs(actual[mask] - forecast[mask]) / denom[mask]) * 100)


# ─────────────────────────────────────────────
# Individual model trainers
# ─────────────────────────────────────────────

def _fit_arima(train: pd.Series, horizon: int) -> Tuple[np.ndarray, np.ndarray]:
    """
    Fit ARIMA(p,d,q) via auto-selection (grid search p,d,q ∈ {0,1,2}).
    Returns (p50_forecast, std_per_step).
    """
    from statsmodels.tsa.arima.model import ARIMA

    best_aic = np.inf
    best_order = (1, 1, 1)
    for p in range(3):
        for d in range(2):
            for q in range(3):
                try:
                    m = ARIMA(train, order=(p, d, q)).fit()
                    if m.aic < best_aic:
                        best_aic = m.aic
                        best_order = (p, d, q)
                except Exception:
                    continue

    model = ARIMA(train, order=best_order).fit()
    fc = model.get_forecast(steps=horizon)
    p50 = np.maximum(0, fc.predicted_mean.values)
    ci = fc.conf_int(alpha=0.20)   # 80% CI → ~P90 upper bound
    std = np.maximum(0, (ci.iloc[:, 1].values - p50) / 1.28)
    return p50, std


def _fit_prophet(train: pd.Series, horizon: int) -> Tuple[np.ndarray, np.ndarray]:
    """
    Fit Meta Prophet with weekly seasonality.
    Returns (p50_forecast, std_per_step).
    """
    from prophet import Prophet  # type: ignore

    df = pd.DataFrame({"ds": train.index, "y": train.values})
    m = Prophet(
        yearly_seasonality=True,
        weekly_seasonality=False,
        daily_seasonality=False,
        seasonality_mode="multiplicative",
        interval_width=0.80,  # P10–P90 interval
    )
    m.fit(df)

    future = m.make_future_dataframe(periods=horizon, freq=settings.forecast_frequency)
    fc = m.predict(future).tail(horizon)

    p50 = np.maximum(0, fc["yhat"].values)
    upper = np.maximum(0, fc["yhat_upper"].values)
    std = np.maximum(0, (upper - p50) / 1.28)
    return p50, std


def _fit_ets(train: pd.Series, horizon: int) -> Tuple[np.ndarray, np.ndarray]:
    """
    Fit Holt-Winters Exponential Smoothing (additive trend + seasonal).
    Returns (p50_forecast, std_per_step).
    """
    from statsmodels.tsa.holtwinters import ExponentialSmoothing

    seasonal_periods = 52 if settings.forecast_frequency == "W" else 12
    use_seasonal = len(train) >= 2 * seasonal_periods

    try:
        m = ExponentialSmoothing(
            train,
            trend="add",
            seasonal="add" if use_seasonal else None,
            seasonal_periods=seasonal_periods if use_seasonal else None,
        ).fit(optimized=True)
    except Exception:
        # Fallback: simple exponential smoothing
        m = ExponentialSmoothing(train, trend=None, seasonal=None).fit()

    p50 = np.maximum(0, m.forecast(horizon))
    # ETS doesn't give direct intervals; approximate sigma from in-sample residuals
    resid_std = float(np.std(m.resid))
    std = np.full(horizon, resid_std)
    return p50, std


# ─────────────────────────────────────────────
# Ensemble selector
# ─────────────────────────────────────────────

def _best_model(
    train: pd.Series,
    validation: pd.Series,
) -> Tuple[str, np.ndarray, np.ndarray]:
    """
    Train all three models on `train`, evaluate WAPE on `validation`,
    return (model_name, p50_full_forecast, std_full_forecast) for the winner.
    The full forecast includes validation + remaining horizon.
    """
    full_horizon = len(validation)
    val_actual = validation.values

    results: Dict[str, Tuple[float, np.ndarray, np.ndarray]] = {}
    for name, fn in [("arima", _fit_arima), ("prophet", _fit_prophet), ("ets", _fit_ets)]:
        try:
            p50, std = fn(train, full_horizon)
            w = wape(val_actual, p50[:len(val_actual)])
            results[name] = (w, p50, std)
        except Exception:
            continue

    if not results:
        # Ultimate fallback: naive seasonal
        p50 = np.array([train.iloc[-1]] * full_horizon)
        std = np.full(full_horizon, float(train.std()))
        return "naive", p50, std

    best = min(results, key=lambda k: results[k][0])
    return best, results[best][1], results[best][2]


# ─────────────────────────────────────────────
# Main forecast runner
# ─────────────────────────────────────────────

def run_forecast(
    db: Session,
    run_id: str,
    sku_ids: Optional[List[str]] = None,
    horizon: int = 13,              # periods ahead (13 weeks ≈ 1 quarter)
    frequency: str = "W",
) -> ForecastRun:
    """
    Execute a forecast run for the specified products (or all if sku_ids=None).
    Persists ForecastResult rows for each product/location.
    """
    run = db.query(ForecastRun).filter(ForecastRun.run_id == run_id).first()
    if not run:
        raise ValueError(f"ForecastRun {run_id} not found")

    run.status = "running"
    db.commit()

    try:
        # Load products
        q = db.query(Product)
        if sku_ids:
            q = q.filter(Product.product_id.in_(sku_ids))
        products = q.all()

        locations = db.query(Location).all()
        model_versions: Dict[str, str] = {}

        for product in products:
            for location in locations:
                # Pull demand history
                rows = (
                    db.query(DemandHistory)
                    .filter(
                        DemandHistory.product_id == product.product_id,
                        DemandHistory.location_id == location.location_id,
                    )
                    .order_by(DemandHistory.date)
                    .all()
                )

                if len(rows) < 16:
                    continue  # need at least 16 periods to fit

                dates = pd.DatetimeIndex([r.date for r in rows])
                qty = np.array([r.qty for r in rows], dtype=float)

                series = pd.Series(qty, index=dates)
                series = series.resample(frequency).sum().fillna(0)

                if len(series) < 16:
                    continue

                # Train/validation split
                val_start = -VALIDATION_PERIODS
                train = series.iloc[:val_start]
                validation = series.iloc[val_start:]

                model_name, p50_val, std_val = _best_model(train, validation)

                # Refit on full data for actual forecast
                try:
                    fit_fn = {"arima": _fit_arima, "prophet": _fit_prophet, "ets": _fit_ets}.get(model_name)
                    if fit_fn:
                        p50, std = fit_fn(series, horizon)
                    else:
                        p50 = np.array([series.iloc[-1]] * horizon)
                        std = np.full(horizon, float(series.std()))
                except Exception:
                    p50 = np.array([series.mean()] * horizon)
                    std = np.full(horizon, float(series.std()))

                # P90 = P50 + 1.28 * sigma  (90th percentile of normal distribution)
                p90 = p50 + 1.28 * std

                # Compute final metrics
                full_p50, _ = (
                    {"arima": _fit_arima, "prophet": _fit_prophet, "ets": _fit_ets}
                    .get(model_name, lambda s, h: (np.array([s.mean()] * h), np.zeros(h)))(
                        train, VALIDATION_PERIODS
                    )
                )
                val_mape = mape(validation.values, full_p50[:VALIDATION_PERIODS])
                val_wape = wape(validation.values, full_p50[:VALIDATION_PERIODS])

                # Generate future dates
                last_date = series.index[-1]
                future_dates = pd.date_range(start=last_date, periods=horizon + 1, freq=frequency)[1:]

                for i, fdate in enumerate(future_dates):
                    result = ForecastResult(
                        run_id=run_id,
                        product_id=product.product_id,
                        location_id=location.location_id,
                        date=fdate.to_pydatetime(),
                        p50=max(0.0, float(p50[i])),
                        p90=max(0.0, float(p90[i])),
                        model_used=model_name,
                        mape=round(val_mape, 2),
                        wape=round(val_wape, 4),
                    )
                    db.add(result)

                key = f"{product.sku}_{location.location_id}"
                model_versions[key] = model_name

        run.model_versions = model_versions
        run.status = "done"
        run.completed_at = datetime.utcnow()
        db.commit()

    except Exception as exc:
        db.rollback()
        run.status = "failed"
        db.commit()
        raise

    return run


def get_forecast_summary(db: Session, run_id: str) -> List[dict]:
    """
    Return a flat list of forecast results for a given run,
    including product SKU, location name, date, P50, P90, model, accuracy.
    """
    results = (
        db.query(ForecastResult, Product, Location)
        .join(Product, ForecastResult.product_id == Product.product_id)
        .outerjoin(Location, ForecastResult.location_id == Location.location_id)
        .filter(ForecastResult.run_id == run_id)
        .order_by(ForecastResult.product_id, ForecastResult.date)
        .all()
    )
    return [
        {
            "product_sku": p.sku,
            "product_name": p.name,
            "location": loc.name if loc else "Global",
            "date": r.date.strftime("%Y-%m-%d"),
            "p50": round(r.p50, 1),
            "p90": round(r.p90, 1),
            "model": r.model_used,
            "mape_pct": r.mape,
            "wape": r.wape,
        }
        for r, p, loc in results
    ]
