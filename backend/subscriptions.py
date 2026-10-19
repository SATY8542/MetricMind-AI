"""
Subscription plans and usage tracking for MetricMind AI SaaS.
Configurable plan definitions and monthly quota enforcement.
"""

import os
import psycopg2
from typing import Dict, Any, Optional
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
load_dotenv(PROJECT_ROOT / ".env")

CONFIGURABLE_PLANS = {
    "starter": {
        "id": "starter",
        "name": "Free Starter",
        "price_monthly_usd": 0,
        "max_imports_per_month": 5,
        "max_ai_queries_per_month": 50,
        "max_reports_per_month": 10,
        "features": {
            "forecasting": False,
            "custom_alerts": False,
            "export_pdf": True,
            "export_excel": True,
            "multi_user": False,
        },
        "description": "Ideal for small independent sellers exploring semantic analytics.",
    },
    "small_business": {
        "id": "small_business",
        "name": "Small Business",
        "price_monthly_usd": 49,
        "max_imports_per_month": 50,
        "max_ai_queries_per_month": 500,
        "max_reports_per_month": 100,
        "features": {
            "forecasting": True,
            "custom_alerts": True,
            "export_pdf": True,
            "export_excel": True,
            "multi_user": True,
        },
        "description": "Complete BI suite for growing teams and regional enterprises.",
    },
    "pro": {
        "id": "pro",
        "name": "Business Pro",
        "price_monthly_usd": 149,
        "max_imports_per_month": 9999,
        "max_ai_queries_per_month": 9999,
        "max_reports_per_month": 9999,
        "features": {
            "forecasting": True,
            "custom_alerts": True,
            "export_pdf": True,
            "export_excel": True,
            "multi_user": True,
            "priority_support": True,
        },
        "description": "Unlimited enterprise-grade AI analytics, forecasting, and governance.",
    },
}

def get_db():
    return psycopg2.connect(
        host=os.getenv("PGHOST", "localhost"),
        port=int(os.getenv("PGPORT", "5432")),
        dbname=os.getenv("PGDATABASE", "metricmind"),
        user=os.getenv("PGUSER", "metricmind"),
        password=os.getenv("PGPASSWORD", "Password11"),
        connect_timeout=5,
    )

def get_tenant_usage(org_id: str, plan_id: str = "starter") -> Dict[str, Any]:
    """Retrieve current month usage vs plan limits for tenant."""
    current_my = datetime.now().strftime("%Y-%m")
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT ai_queries_count, imports_count, reports_count
            FROM usage_tracking
            WHERE org_id = %s AND month_year = %s;
        """, (org_id, current_my))
        row = cur.fetchone()

        ai_count = row[0] if row else 0
        imports_count = row[1] if row else 0
        reports_count = row[2] if row else 0

        plan = CONFIGURABLE_PLANS.get(plan_id, CONFIGURABLE_PLANS["starter"])

        return {
            "month_year": current_my,
            "plan": plan,
            "usage": {
                "ai_queries": {
                    "used": ai_count,
                    "limit": plan["max_ai_queries_per_month"],
                    "remaining": max(plan["max_ai_queries_per_month"] - ai_count, 0),
                },
                "imports": {
                    "used": imports_count,
                    "limit": plan["max_imports_per_month"],
                    "remaining": max(plan["max_imports_per_month"] - imports_count, 0),
                },
                "reports": {
                    "used": reports_count,
                    "limit": plan["max_reports_per_month"],
                    "remaining": max(plan["max_reports_per_month"] - reports_count, 0),
                },
            }
        }
    finally:
        conn.close()

def record_ai_usage(org_id: str):
    """Increment AI query counter for current month."""
    current_my = datetime.now().strftime("%Y-%m")
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO usage_tracking (id, org_id, month_year, ai_queries_count)
            VALUES (%s, %s, %s, 1)
            ON CONFLICT (org_id, month_year)
            DO UPDATE SET ai_queries_count = usage_tracking.ai_queries_count + 1;
        """, (f"ut_{org_id}_{current_my}", org_id, current_my))
        conn.commit()
    finally:
        conn.close()
