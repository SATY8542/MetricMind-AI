import os
import sys
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any

import pandas as pd
import psycopg2
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent

# Add ai_agentllm to sys.path
sys.path.append(str(PROJECT_ROOT / "ai_agentllm"))

load_dotenv(PROJECT_ROOT / ".env")

from auth import (
    get_db,
    get_current_user,
    require_role,
    create_jwt_token,
    verify_password,
    hash_password,
)
from models import (
    RegisterRequest,
    LoginRequest,
    AuthResponse,
    UserInviteRequest,
    AIChatRequest,
    AlertRuleCreate,
    ActiveDatasetRequest,
)
import analytics
import forecasting
import importer
import reports_generator
import alerts
import subscriptions

try:
    from parser import parse_question
    from reasoning import explain_findings, build_chart_spec, calculate_change
    from tools import execute_governed_query
except ImportError as err:
    print(f"Warning: ai_agentllm import note: {err}")

# --------------------------------------------------
# Application setup
# --------------------------------------------------

app = FastAPI(
    title="MetricMind AI - Enterprise SaaS API",
    description="Agentic Semantic Business Intelligence & Analytics Engine",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CSV_PATH = BASE_DIR / "data" / "MetricMind_Corporate_Sales_Dataset.csv"
data = pd.read_csv(CSV_PATH)

def get_db_connection():
    return psycopg2.connect(
        host=os.getenv("PGHOST", "localhost"),
        port=os.getenv("PGPORT", "5432"),
        dbname=os.getenv("PGDATABASE", "metricmind"),
        user=os.getenv("PGUSER", "metricmind"),
        password=os.getenv("PGPASSWORD", "Password11"),
        connect_timeout=5,
    )

# --------------------------------------------------
# Health & Status
# --------------------------------------------------

@app.get("/")
def home():
    return {
        "status": "online",
        "platform": "MetricMind AI",
        "version": "2.0.0",
        "environment": os.getenv("APP_ENV", "production"),
        "documentation": "/docs",
    }

# ==================================================
# Authentication & Organization Workspaces
# ==================================================

@app.post("/api/auth/register", response_model=AuthResponse)
def register(req: RegisterRequest):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("SELECT id FROM users WHERE email = %s", (req.email,))
        if cur.fetchone():
            raise HTTPException(status_code=400, detail="User with this email already exists.")

        org_id = f"org_{uuid.uuid4().hex[:12]}"
        user_id = f"usr_{uuid.uuid4().hex[:12]}"
        slug = req.organization_name.lower().replace(" ", "-")[:40]

        cur.execute("""
            INSERT INTO organizations (id, name, slug, plan)
            VALUES (%s, %s, %s, 'starter');
        """, (org_id, req.organization_name, slug))

        pwd_hash = hash_password(req.password)
        cur.execute("""
            INSERT INTO users (id, org_id, email, password_hash, full_name, role)
            VALUES (%s, %s, %s, %s, %s, %s);
        """, (user_id, org_id, req.email, pwd_hash, req.full_name, req.role or "owner"))

        conn.commit()

        token = create_jwt_token({"sub": user_id, "org_id": org_id, "role": req.role or "owner"})

        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": user_id,
                "email": req.email,
                "full_name": req.full_name,
                "role": req.role or "owner",
            },
            "organization": {
                "id": org_id,
                "name": req.organization_name,
                "plan": "starter",
            }
        }
    finally:
        conn.close()

@app.post("/api/auth/login", response_model=AuthResponse)
def login(req: LoginRequest):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT u.id, u.org_id, u.email, u.password_hash, u.full_name, u.role, o.name AS org_name, o.plan
            FROM users u
            JOIN organizations o ON u.org_id = o.id
            WHERE u.email = %s;
        """, (req.email,))
        row = cur.fetchone()

        if not row or not verify_password(req.password, row[3]):
            raise HTTPException(status_code=401, detail="Invalid email or password.")

        user_id, org_id, email, _, full_name, role, org_name, plan = row
        token = create_jwt_token({"sub": user_id, "org_id": org_id, "role": role})

        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": user_id,
                "email": email,
                "full_name": full_name,
                "role": role,
            },
            "organization": {
                "id": org_id,
                "name": org_name,
                "plan": plan,
            }
        }
    finally:
        conn.close()

@app.get("/api/auth/me")
def get_profile(current_user: Dict[str, Any] = Depends(get_current_user)):
    return current_user

@app.get("/api/org/users")
def get_org_users(
    current_user: Dict[str, Any] = Depends(require_role("analyst"))
):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT id, email, full_name, role, created_at
            FROM users
            WHERE org_id = %s
            ORDER BY created_at ASC;
        """, (current_user["org_id"],))
        rows = cur.fetchall()
        return [
            {
                "id": r[0],
                "email": r[1],
                "full_name": r[2],
                "role": r[3],
                "created_at": r[4].isoformat() if r[4] else None,
            }
            for r in rows
        ]
    finally:
        conn.close()

@app.post("/api/org/users")
def invite_user(
    req: UserInviteRequest,
    current_user: Dict[str, Any] = Depends(require_role("admin"))
):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("SELECT id FROM users WHERE email = %s", (req.email,))
        if cur.fetchone():
            raise HTTPException(status_code=400, detail="User with this email already exists.")

        user_id = f"usr_{uuid.uuid4().hex[:12]}"
        pwd = req.password or "MetricMind2026!"
        pwd_hash = hash_password(pwd)

        cur.execute("""
            INSERT INTO users (id, org_id, email, password_hash, full_name, role)
            VALUES (%s, %s, %s, %s, %s, %s);
        """, (user_id, current_user["org_id"], req.email, pwd_hash, req.full_name, req.role))
        conn.commit()

        return {"status": "success", "message": f"User {req.email} added with role {req.role}."}
    finally:
        conn.close()

# ==================================================
# Modern Business Intelligence Dashboard APIs
# ==================================================

@app.get("/api/analytics/overview")
def get_kpi_overview(
    dataset_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    region: Optional[str] = None,
    product: Optional[str] = None,
    channel: Optional[str] = None,
    quarter: Optional[str] = None,
    year: Optional[int] = None,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Return the 7 KPI cards with growth rates, filters, and active dataset scoping."""
    return analytics.get_kpi_overview(
        org_id=current_user.get("org_id"),
        dataset_id=dataset_id,
        start_date=start_date,
        end_date=end_date,
        region=region,
        product=product,
        channel=channel,
        quarter=quarter,
        year=year,
    )

@app.get("/api/analytics/trends")
def get_trends(
    dataset_id: Optional[str] = None,
    year: Optional[int] = None,
    region: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Return monthly/quarterly trends and revenue vs cost series scoped to active dataset."""
    return analytics.get_trends(
        org_id=current_user.get("org_id"),
        dataset_id=dataset_id,
        year=year,
        region=region,
    )

@app.get("/api/analytics/breakdown")
def get_breakdown(
    dataset_id: Optional[str] = None,
    year: Optional[int] = None,
    quarter: Optional[str] = None,
    region: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Return top/underperforming products, regional & channel distributions scoped to active dataset."""
    return analytics.get_breakdowns(
        org_id=current_user.get("org_id"),
        dataset_id=dataset_id,
        year=year,
        quarter=quarter,
        region=region,
    )

# ==================================================
# Natural Language AI Business Assistant
# ==================================================

@app.post("/api/ai/query")
def ask_ai_assistant(
    req: AIChatRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Convert English or Hindi business questions into safe, governed semantic queries,
    retrieve verified data, and return explanations and dynamic ECharts specs.
    """
    question = req.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    try:
        query = parse_question(question)
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))

    # Apply request-level filter overrides if provided
    if req.filters:
        query.filters.update(req.filters)
    if req.time_range:
        query.time_range = req.time_range

    query.org_id = current_user.get("org_id")
    if req.dataset_id:
        query.dataset_id = req.dataset_id

    # Record usage
    subscriptions.record_ai_usage(current_user["org_id"])

    # For chart visualization and comparison, fetch up to 5 items if limit was 1
    query_exec = query.model_copy()
    if query_exec.limit == 1 and query_exec.dimensions:
        query_exec.limit = 5

    # Execute governed query against Cube / PostgreSQL with active dataset scoping
    try:
        data_rows = execute_governed_query(
            query_exec,
            org_id=current_user.get("org_id"),
            dataset_id=req.dataset_id,
        )
    except Exception as exc:
        data_rows = []

    # Calculate comparison change if requested
    comparison_result = None
    if query.comparison_period and len(data_rows) >= 2:
        try:
            prev = list(data_rows[1].values())[0] if len(data_rows) > 1 else 0
            curr = list(data_rows[0].values())[0] if data_rows else 0
            comparison_result = calculate_change(prev, curr, query.measures[0] if query.measures else "revenue")
        except Exception:
            pass

    # Produce data-grounded explanation
    explanation = explain_findings(
        question=question,
        query_measures=query.measures,
        query_dimensions=query.dimensions,
        data=data_rows,
        comparison=comparison_result,
        lang=query.language,
    )

    # Build ECharts spec
    chart_spec = build_chart_spec(
        query_measures=query.measures,
        query_dimensions=query.dimensions,
        data=data_rows,
        chart_type="bar",
    )

    return {
        "question": question,
        "language": query.language,
        "semantic_query": {
            "measures": query.measures,
            "dimensions": query.dimensions,
            "filters": query.filters,
            "time_range": query.time_range,
            "limit": query.limit,
            "order_direction": query.order_direction,
        },
        "data": data_rows,
        "summary_text": explanation,
        "chart_config": chart_spec,
        "comparison": comparison_result,
        "filters_applied": query.filters,
        "time_range_applied": query.time_range,
        "is_data_sufficient": bool(data_rows),
    }

# ==================================================
# CSV and Excel Data Ingestion Pipeline
# ==================================================

@app.post("/api/import/preview")
async def preview_import(
    file: UploadFile = File(...),
    current_user: Dict[str, Any] = Depends(require_role("analyst")),
):
    """Upload CSV or Excel file to preview structure and detected column mappings."""
    suffix = Path(file.filename).suffix.lower()
    if suffix not in [".csv", ".xlsx", ".xls"]:
        raise HTTPException(status_code=400, detail="Only CSV and Excel files (.csv, .xlsx, .xls) are supported.")

    file_id = f"upload_{uuid.uuid4().hex[:12]}"
    temp_path = importer.UPLOAD_TEMP_DIR / f"{file_id}{suffix}"

    with open(temp_path, "wb") as f:
        content = await file.read()
        if len(content) > 50 * 1024 * 1024:  # 50MB limit
            raise HTTPException(status_code=400, detail="File size exceeds the 50MB limit.")
        f.write(content)

    try:
        preview = importer.preview_uploaded_file(temp_path)
        preview["file_id"] = file_id
        preview["filename"] = file.filename
        return preview
    except Exception as e:
        if temp_path.exists():
            temp_path.unlink()
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")

@app.post("/api/import/confirm")
def confirm_import(
    file_id: str = Form(...),
    filename: str = Form(...),
    column_mappings_json: str = Form(...),
    current_user: Dict[str, Any] = Depends(require_role("admin")),
):
    """Commit mapped uploaded dataset into tenant sales database."""
    import json
    try:
        mappings = json.loads(column_mappings_json)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid column mappings format.")

    matching_files = list(importer.UPLOAD_TEMP_DIR.glob(f"{file_id}.*"))
    if not matching_files:
        raise HTTPException(status_code=404, detail="Upload session expired or file not found. Please upload again.")

    temp_path = matching_files[0]
    try:
        result = importer.commit_import(
            file_path=temp_path,
            filename=filename,
            column_mappings=mappings,
            org_id=current_user["org_id"],
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Import failed: {str(e)}")

@app.get("/api/import/history")
def get_import_history(current_user: Dict[str, Any] = Depends(get_current_user)):
    return importer.get_import_history(current_user["org_id"])

# ==================================================
# Dataset Management & Active Selection
# ==================================================

@app.get("/api/datasets")
def list_datasets(current_user: Dict[str, Any] = Depends(get_current_user)):
    """List all available datasets and the current active dataset pointer."""
    return importer.get_available_datasets(current_user["org_id"])

@app.post("/api/datasets/active")
def switch_active_dataset(
    req: ActiveDatasetRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Switch the active dataset for the organization."""
    try:
        return importer.set_active_dataset(current_user["org_id"], req.dataset_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/datasets/{dataset_id}")
def remove_dataset(
    dataset_id: str,
    current_user: Dict[str, Any] = Depends(require_role("admin")),
):
    """Delete an uploaded dataset and remove its records from tenant storage."""
    try:
        return importer.delete_dataset(current_user["org_id"], dataset_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# ==================================================
# Automated Reports & Exports
# ==================================================

@app.get("/api/reports/summary")
def get_report_summary(
    dataset_id: Optional[str] = None,
    period_type: str = "monthly",
    year: Optional[int] = None,
    quarter: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Get structured summary data for business reports scoped to active dataset."""
    return reports_generator.generate_report_summary(
        org_id=current_user.get("org_id"),
        dataset_id=dataset_id,
        period_type=period_type,
        year=year,
        quarter=quarter,
    )

@app.get("/api/reports/export/excel")
def export_excel(
    dataset_id: Optional[str] = None,
    period_type: str = "monthly",
    year: Optional[int] = None,
    quarter: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Export executive BI report as a styled Excel (.xlsx) spreadsheet."""
    report_data = reports_generator.generate_report_summary(
        org_id=current_user.get("org_id"),
        dataset_id=dataset_id,
        period_type=period_type,
        year=year,
        quarter=quarter,
    )
    buf = reports_generator.export_excel_report(report_data)
    filename = f"MetricMind_Report_{period_type}_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"

    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@app.get("/api/reports/export/pdf")
def export_pdf(
    dataset_id: Optional[str] = None,
    period_type: str = "monthly",
    year: Optional[int] = None,
    quarter: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Export executive BI report as an authoritative printable PDF."""
    report_data = reports_generator.generate_report_summary(
        org_id=current_user.get("org_id"),
        dataset_id=dataset_id,
        period_type=period_type,
        year=year,
        quarter=quarter,
    )
    buf = reports_generator.export_pdf_report(report_data)
    filename = f"MetricMind_Report_{period_type}_{datetime.now().strftime('%Y%m%d_%H%M')}.pdf"

    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# ==================================================
# Sales Forecasting
# ==================================================

@app.get("/api/analytics/forecast")
def get_forecast(
    dataset_id: Optional[str] = None,
    horizon_months: int = Query(6, ge=1, le=12),
    metric: str = Query("revenue", pattern="^(revenue|units_sold)$"),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Generate statistical sales forecasts with 95% confidence intervals and evaluation metrics."""
    try:
        return forecasting.generate_revenue_forecast(
            org_id=current_user.get("org_id"),
            dataset_id=dataset_id,
            horizon_months=horizon_months,
            metric=metric,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ==================================================
# Smart Alerts & Anomaly Detection
# ==================================================

@app.get("/api/alerts/rules")
def list_alert_rules(current_user: Dict[str, Any] = Depends(get_current_user)):
    return alerts.get_alert_rules(current_user["org_id"])

@app.post("/api/alerts/rules")
def create_alert_rule(
    req: AlertRuleCreate,
    current_user: Dict[str, Any] = Depends(require_role("admin")),
):
    return alerts.create_alert_rule(
        org_id=current_user["org_id"],
        name=req.name,
        metric=req.metric,
        condition=req.condition,
        threshold=req.threshold,
    )

@app.delete("/api/alerts/rules/{rule_id}")
def delete_alert_rule(
    rule_id: str,
    current_user: Dict[str, Any] = Depends(require_role("admin")),
):
    deleted = alerts.delete_alert_rule(current_user["org_id"], rule_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Alert rule not found.")
    return {"status": "success", "message": "Rule removed."}

@app.get("/api/alerts/history")
def list_alert_history(current_user: Dict[str, Any] = Depends(get_current_user)):
    return alerts.get_alert_history(current_user["org_id"])

@app.post("/api/alerts/scan")
def scan_alerts(current_user: Dict[str, Any] = Depends(require_role("analyst"))):
    return alerts.scan_anomalies_and_rules(current_user["org_id"])

# ==================================================
# SaaS Subscriptions & Usage Limits
# ==================================================

@app.get("/api/subscription/plans")
def list_plans():
    return subscriptions.CONFIGURABLE_PLANS

@app.get("/api/subscription/usage")
def get_usage(current_user: Dict[str, Any] = Depends(get_current_user)):
    return subscriptions.get_tenant_usage(
        org_id=current_user["org_id"],
        plan_id=current_user.get("plan", "pro"),
    )

# ==================================================
# Preserved Original CSV Endpoints (Backwards Compatible)
# ==================================================

@app.get("/sales")
def get_sales():
    return data.to_dict(orient="records")

@app.get("/summary")
def get_summary():
    return {
        "total_orders": int(len(data)),
        "total_revenue": round(float(data["Revenue"].sum()), 2),
        "total_profit": round(float(data["Profit"].sum()), 2),
        "total_units_sold": int(data["Units_Sold"].sum()),
    }

@app.get("/sales/region/{region}")
def get_sales_by_region(region: str):
    filtered_data = data[
        data["Region"].astype(str).str.lower() == region.lower()
    ]
    return filtered_data.to_dict(orient="records")

@app.get("/summary/region/{region}")
def get_region_summary(region: str):
    filtered_data = data[
        data["Region"].astype(str).str.lower() == region.lower()
    ]
    return {
        "region": region,
        "total_orders": int(len(filtered_data)),
        "total_units_sold": int(filtered_data["Units_Sold"].sum()),
        "total_revenue": round(float(filtered_data["Revenue"].sum()), 2),
        "total_profit": round(float(filtered_data["Profit"].sum()), 2),
    }

@app.get("/summary/product/{product}")
def get_product_summary(product: str):
    filtered_data = data[
        data["Product"].astype(str).str.lower() == product.lower()
    ]
    if filtered_data.empty:
        raise HTTPException(
            status_code=404,
            detail=f"Product '{product}' not found",
        )
    return {
        "product": product,
        "total_orders": int(len(filtered_data)),
        "total_units_sold": int(filtered_data["Units_Sold"].sum()),
        "total_revenue": round(float(filtered_data["Revenue"].sum()), 2),
        "total_profit": round(float(filtered_data["Profit"].sum()), 2),
    }

@app.get("/summary/channel/{channel}")
def get_channel_summary(channel: str):
    filtered_data = data[
        data["Channel"].astype(str).str.lower() == channel.lower()
    ]
    if filtered_data.empty:
        raise HTTPException(
            status_code=404,
            detail=f"Channel '{channel}' not found",
        )
    return {
        "channel": channel,
        "total_orders": int(len(filtered_data)),
        "total_units_sold": int(filtered_data["Units_Sold"].sum()),
        "total_revenue": round(float(filtered_data["Revenue"].sum()), 2),
        "total_profit": round(float(filtered_data["Profit"].sum()), 2),
    }

@app.get("/summary/year/{year}")
def get_year_summary(year: int):
    filtered_data = data[data["Year"] == year]
    if filtered_data.empty:
        raise HTTPException(
            status_code=404,
            detail=f"Year '{year}' not found",
        )
    return {
        "year": year,
        "total_orders": int(len(filtered_data)),
        "total_units_sold": int(filtered_data["Units_Sold"].sum()),
        "total_revenue": round(float(filtered_data["Revenue"].sum()), 2),
        "total_profit": round(float(filtered_data["Profit"].sum()), 2),
    }

@app.get("/summary/month/{month}")
def get_month_summary(month: int):
    if month < 1 or month > 12:
        raise HTTPException(
            status_code=400,
            detail="Month must be between 1 and 12",
        )
    filtered_data = data[data["Month"] == month]
    if filtered_data.empty:
        raise HTTPException(
            status_code=404,
            detail=f"Month '{month}' not found",
        )
    return {
        "month": month,
        "total_orders": int(len(filtered_data)),
        "total_units_sold": int(filtered_data["Units_Sold"].sum()),
        "total_revenue": round(float(filtered_data["Revenue"].sum()), 2),
        "total_profit": round(float(filtered_data["Profit"].sum()), 2),
    }

@app.get("/summary/cost-profit")
def get_cost_profit_summary():
    return {
        "total_material_cost": round(float(data["Material_Cost"].sum()), 2),
        "total_shipping_cost": round(float(data["Shipping_Cost"].sum()), 2),
        "total_labor_cost": round(float(data["Labor_Cost"].sum()), 2),
        "total_marketing_cost": round(float(data["Marketing_Cost"].sum()), 2),
        "total_cost": round(float(data["Total_Cost"].sum()), 2),
        "total_profit": round(float(data["Profit"].sum()), 2),
        "average_margin_percent": round(float(data["Margin_Percent"].mean()), 2),
    }

@app.get("/summary/quarter/{quarter}")
def get_quarter_summary(quarter: str):
    filtered_data = data[
        data["Quarter"].astype(str).str.upper() == quarter.upper()
    ]
    if filtered_data.empty:
        raise HTTPException(
            status_code=404,
            detail=f"Quarter '{quarter}' not found",
        )
    return {
        "quarter": quarter.upper(),
        "total_orders": int(len(filtered_data)),
        "total_units_sold": int(filtered_data["Units_Sold"].sum()),
        "total_revenue": round(float(filtered_data["Revenue"].sum()), 2),
        "total_profit": round(float(filtered_data["Profit"].sum()), 2),
    }

@app.get("/dbt/sales-summary")
def get_dbt_sales_summary():
    """Fixed dbt endpoint correctly reading avg_margin_percent."""
    try:
        return analytics.get_dbt_sales_summary(limit=100)
    except psycopg2.Error as exc:
        raise HTTPException(
            status_code=500,
            detail="Could not read public.sales_summary. Check PostgreSQL credentials and confirm dbt model exists."
        ) from exc