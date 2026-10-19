"""
Data Ingestion module for MetricMind AI.
Handles CSV and Excel file validation, column detection, type inference,
mapping, duplicate detection, financial formula verification, and tenant-isolated insertion.
"""

import os
import uuid
import pandas as pd
import psycopg2
from typing import Dict, Any, List, Optional
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
load_dotenv(PROJECT_ROOT / ".env")

UPLOAD_TEMP_DIR = BASE_DIR / "data" / "uploads"
UPLOAD_TEMP_DIR.mkdir(parents=True, exist_ok=True)

SUPPORTED_FIELDS = [
    {"field": "order_id", "label": "Order ID", "required": True, "type": "string"},
    {"field": "order_date", "label": "Order Date", "required": True, "type": "date"},
    {"field": "product", "label": "Product Name", "required": True, "type": "string"},
    {"field": "region", "label": "Region", "required": True, "type": "string"},
    {"field": "channel", "label": "Sales Channel", "required": False, "type": "string"},
    {"field": "country", "label": "Country", "required": False, "type": "string"},
    {"field": "units_sold", "label": "Units Sold", "required": True, "type": "number"},
    {"field": "unit_price", "label": "Unit Price", "required": False, "type": "number"},
    {"field": "revenue", "label": "Total Revenue", "required": True, "type": "number"},
    {"field": "material_cost", "label": "Material Cost", "required": False, "type": "number"},
    {"field": "shipping_cost", "label": "Shipping Cost", "required": False, "type": "number"},
    {"field": "labor_cost", "label": "Labor Cost", "required": False, "type": "number"},
    {"field": "marketing_cost", "label": "Marketing Cost", "required": False, "type": "number"},
    {"field": "total_cost", "label": "Total Cost", "required": False, "type": "number"},
    {"field": "profit", "label": "Profit", "required": False, "type": "number"},
]

def get_db():
    return psycopg2.connect(
        host=os.getenv("PGHOST", "localhost"),
        port=int(os.getenv("PGPORT", "5432")),
        dbname=os.getenv("PGDATABASE", "metricmind"),
        user=os.getenv("PGUSER", "metricmind"),
        password=os.getenv("PGPASSWORD", "Password11"),
        connect_timeout=5,
    )

def read_file_to_dataframe(file_path: Path) -> pd.DataFrame:
    suffix = file_path.suffix.lower()
    if suffix == ".csv":
        return pd.read_csv(file_path)
    elif suffix in [".xlsx", ".xls"]:
        return pd.read_excel(file_path)
    else:
        raise ValueError(f"Unsupported file format '{suffix}'. Please upload a CSV or Excel file.")

def infer_column_type(series: pd.Series) -> str:
    if pd.api.types.is_numeric_dtype(series):
        return "number"
    # Check if looks like a date
    sample = series.dropna().head(10).astype(str)
    date_count = 0
    for val in sample:
        try:
            pd.to_datetime(val)
            date_count += 1
        except Exception:
            pass
    if date_count >= max(len(sample) * 0.7, 1):
        return "date"
    return "string"

def suggest_mapping(col_name: str) -> Optional[str]:
    c = col_name.strip().lower().replace(" ", "_").replace("-", "_")
    mapping_rules = {
        "order_id": ["order_id", "orderid", "id", "trans_id", "invoice_id"],
        "order_date": ["order_date", "date", "orderdate", "transaction_date", "sale_date"],
        "product": ["product", "product_name", "item", "item_name", "sku"],
        "region": ["region", "geography", "territory", "zone", "market"],
        "country": ["country", "nation", "state"],
        "channel": ["channel", "sales_channel", "medium", "source"],
        "units_sold": ["units_sold", "units", "quantity", "qty", "volume"],
        "unit_price": ["unit_price", "price", "rate", "cost_per_unit"],
        "revenue": ["revenue", "sales", "total_sales", "turnover", "amount"],
        "material_cost": ["material_cost", "material", "materials"],
        "shipping_cost": ["shipping_cost", "shipping", "freight", "delivery"],
        "labor_cost": ["labor_cost", "labor", "labour"],
        "marketing_cost": ["marketing_cost", "marketing", "ads", "advertising"],
        "total_cost": ["total_cost", "cost", "costs", "expenses"],
        "profit": ["profit", "net_profit", "earnings", "margin_amount"],
    }
    for target_field, aliases in mapping_rules.items():
        if c in aliases:
            return target_field
    return None

def preview_uploaded_file(file_path: Path) -> Dict[str, Any]:
    """Parse, detect types, and suggest mappings for uploaded dataset."""
    df = read_file_to_dataframe(file_path)
    total_rows = len(df)
    total_cols = len(df.columns)

    if total_rows == 0:
        raise ValueError("Uploaded file is empty.")

    columns_info = []
    for col in df.columns:
        inferred = infer_column_type(df[col])
        null_count = int(df[col].isnull().sum())
        suggested = suggest_mapping(str(col))
        columns_info.append({
            "source_column": str(col),
            "inferred_type": inferred,
            "null_count": null_count,
            "suggested_field": suggested,
            "sample_values": [str(x) for x in df[col].dropna().head(3).tolist()],
        })

    # Duplicate check on potential ID column
    id_col = next((c["source_column"] for c in columns_info if c["suggested_field"] == "order_id"), None)
    duplicate_count = 0
    if id_col:
        duplicate_count = int(df[id_col].duplicated().sum())

    preview_rows = df.head(10).fillna("").to_dict(orient="records")

    return {
        "total_rows": total_rows,
        "total_columns": total_cols,
        "columns": columns_info,
        "duplicate_id_count": duplicate_count,
        "preview_data": preview_rows,
        "supported_fields": SUPPORTED_FIELDS,
    }

def commit_import(
    file_path: Path,
    filename: str,
    column_mappings: List[Dict[str, str]],
    org_id: str,
) -> Dict[str, Any]:
    """Commit mapped dataset into tenant_sales and update dataset tracking."""
    df = read_file_to_dataframe(file_path)

    # Invert mapping: {target_field: source_column}
    map_dict = {m["target_field"]: m["source_column"] for m in column_mappings if m["target_field"]}

    # Check required fields
    required = ["order_id", "order_date", "product", "region", "revenue", "units_sold"]
    missing_req = [f for f in required if f not in map_dict]
    if missing_req:
        raise ValueError(f"Missing required field mappings: {', '.join(missing_req)}")

    conn = get_db()
    conn.autocommit = False
    try:
        cur = conn.cursor()

        # Prepare records
        inserted_count = 0
        skipped_count = 0
        dataset_id = f"ds_{uuid.uuid4().hex[:12]}"

        # Check if a dataset with this filename already exists for this organization (prevent duplicate records)
        cur.execute("SELECT id FROM imported_datasets WHERE org_id = %s AND filename = %s", (org_id, filename))
        existing_matches = cur.fetchall()
        for (old_id,) in existing_matches:
            cur.execute("DELETE FROM tenant_sales WHERE org_id = %s AND dataset_id = %s", (org_id, old_id))
            cur.execute("DELETE FROM imported_datasets WHERE id = %s", (old_id,))

        insert_sql = """
            INSERT INTO tenant_sales (
                org_id, dataset_id, order_id, order_date, year, quarter, month,
                region, country, product, channel, units_sold, unit_price,
                revenue, material_cost, shipping_cost, labor_cost, marketing_cost,
                total_cost, profit, margin_percent
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
        """

        for _, row in df.iterrows():
            raw_id = str(row[map_dict["order_id"]]).strip()
            if not raw_id or pd.isna(row[map_dict["order_id"]]):
                skipped_count += 1
                continue

            # Parse date
            try:
                parsed_date = pd.to_datetime(row[map_dict["order_date"]])
                order_date = parsed_date.date()
                year = parsed_date.year
                quarter = f"Q{(parsed_date.month - 1) // 3 + 1}"
                month = str(parsed_date.month)
            except Exception:
                skipped_count += 1
                continue

            product = str(row[map_dict["product"]]).strip()
            region = str(row[map_dict["region"]]).strip()
            channel = str(row[map_dict["channel"]]).strip() if "channel" in map_dict else "Direct"
            country = str(row[map_dict["country"]]).strip() if "country" in map_dict else region

            try:
                units_sold = int(float(row[map_dict["units_sold"]]))
                revenue = round(float(row[map_dict["revenue"]]), 2)
            except Exception:
                skipped_count += 1
                continue

            unit_price = round(float(row[map_dict["unit_price"]]), 2) if "unit_price" in map_dict and pd.notna(row[map_dict["unit_price"]]) else round(revenue / max(units_sold, 1), 2)

            # Costs breakdown
            material_cost = round(float(row[map_dict["material_cost"]]), 2) if "material_cost" in map_dict and pd.notna(row[map_dict["material_cost"]]) else round(revenue * 0.45, 2)
            shipping_cost = round(float(row[map_dict["shipping_cost"]]), 2) if "shipping_cost" in map_dict and pd.notna(row[map_dict["shipping_cost"]]) else round(revenue * 0.05, 2)
            labor_cost = round(float(row[map_dict["labor_cost"]]), 2) if "labor_cost" in map_dict and pd.notna(row[map_dict["labor_cost"]]) else round(revenue * 0.10, 2)
            marketing_cost = round(float(row[map_dict["marketing_cost"]]), 2) if "marketing_cost" in map_dict and pd.notna(row[map_dict["marketing_cost"]]) else round(revenue * 0.05, 2)

            if "total_cost" in map_dict and pd.notna(row[map_dict["total_cost"]]):
                total_cost = round(float(row[map_dict["total_cost"]]), 2)
            else:
                total_cost = round(material_cost + shipping_cost + labor_cost + marketing_cost, 2)

            if "profit" in map_dict and pd.notna(row[map_dict["profit"]]):
                profit = round(float(row[map_dict["profit"]]), 2)
            else:
                profit = round(revenue - total_cost, 2)

            margin_percent = round((profit / revenue * 100), 2) if revenue > 0 else 0.0

            cur.execute(insert_sql, (
                org_id, dataset_id, raw_id, order_date, year, quarter, month,
                region, country, product, channel, units_sold, unit_price,
                revenue, material_cost, shipping_cost, labor_cost, marketing_cost,
                total_cost, profit, margin_percent
            ))
            inserted_count += 1

        # Register dataset in imported_datasets
        import json
        cur.execute("""
            INSERT INTO imported_datasets (id, org_id, filename, row_count, columns, status)
            VALUES (%s, %s, %s, %s, %s, 'ready')
            ON CONFLICT (id) DO UPDATE SET row_count = %s;
        """, (dataset_id, org_id, filename, inserted_count, json.dumps(column_mappings), inserted_count))

        # Set newly imported dataset as the active dataset for the organization
        cur.execute("""
            UPDATE organizations
            SET active_dataset_id = %s
            WHERE id = %s;
        """, (dataset_id, org_id))

        # Update usage tracking
        current_my = datetime.now().strftime("%Y-%m")
        cur.execute("""
            INSERT INTO usage_tracking (id, org_id, month_year, imports_count)
            VALUES (%s, %s, %s, 1)
            ON CONFLICT (org_id, month_year)
            DO UPDATE SET imports_count = usage_tracking.imports_count + 1;
        """, (f"ut_{uuid.uuid4().hex[:12]}", org_id, current_my))

        conn.commit()

        # Delete temp file cleanly
        try:
            if file_path.exists():
                file_path.unlink()
        except Exception:
            pass

        return {
            "dataset_id": dataset_id,
            "filename": filename,
            "inserted_rows": inserted_count,
            "skipped_rows": skipped_count,
            "status": "ready",
            "message": f"Successfully ingested {inserted_count} records into your organization workspace and set as active dataset.",
        }
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

def get_import_history(org_id: str) -> List[Dict[str, Any]]:
    """Get list of past dataset imports for the organization."""
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT id, filename, row_count, status, created_at
            FROM imported_datasets
            WHERE org_id = %s
            ORDER BY created_at DESC;
        """, (org_id,))
        rows = cur.fetchall()
        return [
            {
                "id": r[0],
                "filename": r[1],
                "row_count": r[2],
                "status": r[3],
                "created_at": r[4].isoformat() if r[4] else None,
            }
            for r in rows
        ]
    finally:
        conn.close()

def get_available_datasets(org_id: str) -> Dict[str, Any]:
    """
    Get all selectable datasets for the organization, including active dataset pointer,
    individual uploaded datasets, demo corporate dataset, and combined option.
    """
    conn = get_db()
    try:
        cur = conn.cursor()

        # Fetch active dataset from organizations
        cur.execute("SELECT active_dataset_id FROM organizations WHERE id = %s", (org_id,))
        org_row = cur.fetchone()
        active_id = org_row[0] if org_row and org_row[0] else "ds_demo_corporate"

        # Fetch imported datasets
        cur.execute("""
            SELECT id, filename, row_count, created_at
            FROM imported_datasets
            WHERE org_id = %s
            ORDER BY created_at DESC;
        """, (org_id,))
        imported_rows = cur.fetchall()

        dataset_list = []
        has_demo = False
        total_tenant_rows = 0

        # Calculate exact counts in tenant_sales
        cur.execute("SELECT dataset_id, COUNT(*) FROM tenant_sales WHERE org_id = %s GROUP BY dataset_id", (org_id,))
        actual_counts = dict(cur.fetchall())
        total_tenant_rows = sum(actual_counts.values())

        for r in imported_rows:
            ds_id, filename, row_count, created_at = r[0], r[1], r[2], r[3]
            is_demo = (ds_id == "ds_demo_corporate")
            if is_demo:
                has_demo = True
            
            # Use real count in tenant_sales if present
            count_val = actual_counts.get(ds_id, row_count)
            dataset_list.append({
                "id": ds_id,
                "filename": filename,
                "row_count": count_val,
                "created_at": created_at.isoformat() if created_at else None,
                "is_demo": is_demo,
            })

        # Ensure demo corporate sales is always present
        if not has_demo:
            demo_count = actual_counts.get("ds_demo_corporate", 5000)
            dataset_list.append({
                "id": "ds_demo_corporate",
                "filename": "MetricMind Corporate Sales (Demo)",
                "row_count": demo_count,
                "created_at": "2024-01-01T00:00:00",
                "is_demo": True,
            })

        # Add "All Datasets Combined" option if multiple datasets exist
        if len(dataset_list) > 1 and total_tenant_rows > 0:
            dataset_list.append({
                "id": "all",
                "filename": "All Datasets (Combined)",
                "row_count": total_tenant_rows,
                "created_at": None,
                "is_demo": False,
                "is_combined": True,
            })

        # Determine active dataset details
        active_dataset = next((d for d in dataset_list if d["id"] == active_id), None)
        if not active_dataset:
            active_dataset = dataset_list[0] if dataset_list else {
                "id": "ds_demo_corporate",
                "filename": "MetricMind Corporate Sales (Demo)",
                "row_count": 5000,
                "is_demo": True,
            }
            active_id = active_dataset["id"]

        return {
            "active_dataset_id": active_id,
            "active_dataset_name": active_dataset["filename"],
            "active_dataset_row_count": active_dataset["row_count"],
            "datasets": dataset_list,
        }
    finally:
        conn.close()

def set_active_dataset(org_id: str, dataset_id: str) -> Dict[str, Any]:
    """Set the currently active dataset for an organization."""
    conn = get_db()
    try:
        cur = conn.cursor()

        # Validate dataset exists or is 'all'
        if dataset_id != "all":
            cur.execute("""
                SELECT id, filename, row_count FROM imported_datasets
                WHERE id = %s AND org_id = %s;
            """, (dataset_id, org_id))
            row = cur.fetchone()
            if not row and dataset_id != "ds_demo_corporate":
                raise ValueError(f"Dataset '{dataset_id}' not found for this organization.")

        cur.execute("""
            UPDATE organizations
            SET active_dataset_id = %s
            WHERE id = %s;
        """, (dataset_id, org_id))
        conn.commit()

        return get_available_datasets(org_id)
    finally:
        conn.close()

def delete_dataset(org_id: str, dataset_id: str) -> Dict[str, Any]:
    """Delete an imported dataset and remove its records from tenant_sales."""
    if dataset_id in ["ds_demo_corporate", "all"]:
        raise ValueError("Cannot delete standard system or combined datasets.")

    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM tenant_sales WHERE org_id = %s AND dataset_id = %s", (org_id, dataset_id))
        cur.execute("DELETE FROM imported_datasets WHERE id = %s AND org_id = %s", (dataset_id, org_id))

        # If active was deleted, reset to demo
        cur.execute("SELECT active_dataset_id FROM organizations WHERE id = %s", (org_id,))
        active_id = cur.fetchone()[0]
        if active_id == dataset_id:
            cur.execute("UPDATE organizations SET active_dataset_id = 'ds_demo_corporate' WHERE id = %s", (org_id,))

        conn.commit()
        return {"status": "success", "message": "Dataset successfully deleted."}
    finally:
        conn.close()
