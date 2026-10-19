"""
Sales Forecasting engine for MetricMind AI.
Uses time-series statistical modeling (Holt-Winters / exponential smoothing with linear trend)
to forecast future revenue and units sold, providing 95% confidence intervals and
accuracy evaluation metrics (MAE, RMSE, MAPE).
"""

import math
from typing import Dict, Any, List, Optional
import psycopg2
import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
load_dotenv(PROJECT_ROOT / ".env")

def get_db():
    return psycopg2.connect(
        host=os.getenv("PGHOST", "localhost"),
        port=int(os.getenv("PGPORT", "5432")),
        dbname=os.getenv("PGDATABASE", "metricmind"),
        user=os.getenv("PGUSER", "metricmind"),
        password=os.getenv("PGPASSWORD", "Password11"),
        connect_timeout=5,
    )

def generate_revenue_forecast(
    org_id: Optional[str] = None,
    dataset_id: Optional[str] = None,
    horizon_months: int = 6,
    metric: str = "revenue"
) -> Dict[str, Any]:
    """Generate time-series forecast with confidence intervals and evaluation metrics scoped to active dataset."""
    conn = get_db()
    try:
        cur = conn.cursor()
        tbl = "raw_sales"
        params = []
        where_parts = []

        effective_ds = dataset_id
        if org_id and not effective_ds:
            try:
                cur.execute("SELECT active_dataset_id FROM organizations WHERE id = %s", (org_id,))
                r = cur.fetchone()
                effective_ds = r[0] if r and r[0] else "ds_demo_corporate"
            except Exception:
                effective_ds = "ds_demo_corporate"

        if org_id:
            if effective_ds == "all":
                tbl = "tenant_sales"
                where_parts.append("org_id = %s")
                params.append(org_id)
            elif effective_ds == "ds_demo_corporate":
                cur.execute("SELECT COUNT(*) FROM tenant_sales WHERE org_id = %s AND dataset_id = 'ds_demo_corporate'", (org_id,))
                if cur.fetchone()[0] > 0:
                    tbl = "tenant_sales"
                    where_parts.append("org_id = %s AND dataset_id = %s")
                    params.extend([org_id, "ds_demo_corporate"])
                else:
                    tbl = "raw_sales"
            elif effective_ds:
                tbl = "tenant_sales"
                where_parts.append("org_id = %s AND dataset_id = %s")
                params.extend([org_id, effective_ds])
            else:
                tbl = "tenant_sales"
                where_parts.append("org_id = %s")
                params.append(org_id)

        where_clause = ("WHERE " + " AND ".join(where_parts)) if where_parts else ""

        # Retrieve aggregated historical monthly data ordered by year and month
        metric_col = "revenue" if metric == "revenue" else "units_sold"
        sql = f"""
            SELECT
                year,
                CAST(month AS INT) AS m_int,
                ROUND(SUM({metric_col}), 2) AS val
            FROM {tbl}
            {where_clause}
            GROUP BY year, month
            ORDER BY year ASC, m_int ASC;
        """
        cur.execute(sql, tuple(params))
        rows = cur.fetchall()

        if len(rows) < 4:
            raise ValueError(f"Insufficient historical data in selected dataset for predictive forecasting (found {len(rows)} month interval(s); minimum 4 required). Switch to Demo dataset or upload multi-month historical data.")

        historical = []
        month_names = {
            1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr", 5: "May", 6: "Jun",
            7: "Jul", 8: "Aug", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dec"
        }

        values = []
        for r in rows:
            yr, m, val = r[0], int(r[1]), float(r[2])
            lbl = f"{month_names.get(m, f'M{m}')} {yr}"
            historical.append({
                "period": lbl,
                "year": yr,
                "month": m,
                "actual": val,
            })
            values.append(val)

        n = len(values)

        # Fit Holt's Linear Trend (Double Exponential Smoothing)
        # Level equation: L_t = alpha * Y_t + (1 - alpha) * (L_{t-1} + T_{t-1})
        # Trend equation: T_t = beta * (L_t - L_{t-1}) + (1 - beta) * T_{t-1}
        alpha = 0.35
        beta = 0.15

        level = values[0]
        trend = (values[-1] - values[0]) / max(n - 1, 1)

        fitted = [level]
        errors = []

        for t in range(1, n):
            prev_level = level
            level = alpha * values[t] + (1 - alpha) * (prev_level + trend)
            trend = beta * (level - prev_level) + (1 - beta) * trend
            pred_t = prev_level + trend
            fitted.append(pred_t)
            errors.append(values[t] - pred_t)

        # Evaluation metrics
        mae = sum(abs(e) for e in errors) / len(errors) if errors else 0.0
        mse = sum(e ** 2 for e in errors) / len(errors) if errors else 0.0
        rmse = math.sqrt(mse)
        mape_list = [abs(e / values[i]) * 100 for i, e in enumerate(errors, 1) if values[i] != 0]
        mape = sum(mape_list) / len(mape_list) if mape_list else 0.0

        # Standard error for confidence interval
        std_error = rmse if rmse > 0 else (mae * 1.25)
        z_score = 1.96  # 95% confidence interval

        # Forecast future points
        last_yr = rows[-1][0]
        last_m = int(rows[-1][1])

        forecast_points = []
        for h in range(1, horizon_months + 1):
            next_m = (last_m + h - 1) % 12 + 1
            next_yr = last_yr + ((last_m + h - 1) // 12)
            lbl = f"{month_names.get(next_m, f'M{next_m}')} {next_yr}"

            # Projected point
            y_hat = round(level + (h * trend), 2)
            # Uncertainty expands with horizon sqrt(h)
            margin_err = round(z_score * std_error * math.sqrt(h), 2)

            forecast_points.append({
                "period": lbl,
                "year": next_yr,
                "month": next_m,
                "forecast": max(y_hat, 0.0),
                "lower_bound": max(round(y_hat - margin_err, 2), 0.0),
                "upper_bound": round(y_hat + margin_err, 2),
            })

        return {
            "metric": metric,
            "horizon_months": horizon_months,
            "historical": historical,
            "forecast": forecast_points,
            "evaluation": {
                "mae": round(mae, 2),
                "rmse": round(rmse, 2),
                "mape_percent": round(mape, 2),
                "confidence_level": "95%",
                "model": "Holt Linear Exponential Smoothing",
            },
            "disclaimer": (
                "Forecasts are statistical projections based on historical patterns and "
                "do not represent financial guarantees. Actual outcomes may differ based "
                "on market conditions, consumer demand, and operational changes."
            )
        }
    finally:
        conn.close()
