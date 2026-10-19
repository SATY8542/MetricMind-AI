import os
import requests
import psycopg2
from calendar import monthrange
from datetime import date, timedelta
from typing import Any, Optional
from pathlib import Path
from dotenv import load_dotenv

from schemas import SemanticQuery

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
load_dotenv(PROJECT_ROOT / ".env")

CUBE_API_URL = os.getenv("CUBE_API_URL", "http://localhost:4000/cubejs-api/v1/load")

def get_db_connection():
    return psycopg2.connect(
        host=os.getenv("PGHOST", "localhost"),
        port=int(os.getenv("PGPORT", "5432")),
        dbname=os.getenv("PGDATABASE", "metricmind"),
        user=os.getenv("PGUSER", "metricmind"),
        password=os.getenv("PGPASSWORD", "Password11"),
        connect_timeout=4,
    )

def get_date_range(time_range, reference_date: Optional[date] = None):
    if time_range is None:
        return None

    today = reference_date or date.today()
    normalized = str(time_range).strip().lower()

    if normalized == "last month":
        first_this_month = date(today.year, today.month, 1)
        last_day_previous_month = first_this_month - timedelta(days=1)
        first_previous_month = date(
            last_day_previous_month.year,
            last_day_previous_month.month,
            1,
        )

        return [
            first_previous_month.isoformat(),
            last_day_previous_month.isoformat(),
        ]

    if normalized == "this month":
        return [
            date(today.year, today.month, 1).isoformat(),
            today.isoformat(),
        ]

    if normalized == "last year":
        return [
            date(today.year - 1, 1, 1).isoformat(),
            date(today.year - 1, 12, 31).isoformat(),
        ]

    if normalized == "this year":
        return [
            date(today.year, 1, 1).isoformat(),
            today.isoformat(),
        ]

    if normalized == "last quarter":
        current_quarter = (today.month - 1) // 3
        if current_quarter == 0:
            last_quarter_start = date(today.year - 1, 10, 1)
            last_quarter_end_month = 12
        else:
            last_quarter_start = date(today.year, current_quarter * 3 - 2, 1)
            last_quarter_end_month = current_quarter * 3

        last_quarter_end = date(
            last_quarter_start.year,
            last_quarter_end_month,
            monthrange(last_quarter_start.year, last_quarter_end_month)[1],
        )

        return [
            last_quarter_start.isoformat(),
            last_quarter_end.isoformat(),
        ]

    if normalized == "this quarter":
        current_quarter = (today.month - 1) // 3
        start_month = current_quarter * 3 + 1
        return [
            date(today.year, start_month, 1).isoformat(),
            today.isoformat(),
        ]

    return None


def query_semantic_layer(query: SemanticQuery):
    """Query Cube.js semantic layer via REST API."""
    if query is None:
        raise ValueError("Query cannot be None.")

    filters = query.filters or {}
    cube_filters = [
        {
            "member": field,
            "operator": "equals",
            "values": [value],
        }
        for field, value in filters.items()
    ]

    cube_query = {
        "measures": list(query.measures or []),
        "dimensions": list(query.dimensions or []),
        "filters": cube_filters,
    }

    date_range = get_date_range(query.time_range)

    if date_range:
        cube_query["timeDimensions"] = [
            {
                "dimension": "Sales.orderDate",
                "dateRange": date_range,
            }
        ]

    payload = {"query": cube_query}

    response = requests.post(
        CUBE_API_URL,
        json=payload,
        timeout=30,
    )

    response.raise_for_status()

    result = response.json()

    return result.get("data", [])


# Map Cube measures to SQL aggregate expressions
MEASURE_SQL_MAP = {
    "Sales.revenue": "ROUND(SUM(revenue), 2)",
    "Sales.totalRevenue": "ROUND(SUM(revenue), 2)",
    "Sales.totalProfit": "ROUND(SUM(profit), 2)",
    "Sales.totalCost": "ROUND(SUM(total_cost), 2)",
    "Sales.totalUnitsSold": "SUM(units_sold)",
    "Sales.totalOrders": "COUNT(*)",
    "Sales.averageMargin": "ROUND(100.0 * SUM(profit) / NULLIF(SUM(revenue), 0), 2)",
}

# Map Cube dimensions to SQL column names
DIMENSION_SQL_MAP = {
    "Sales.product": "product",
    "Sales.region": "region",
    "Sales.channel": "channel",
    "Sales.country": "country",
    "Sales.year": "year",
    "Sales.quarter": "quarter",
    "Sales.month": "month",
    "Sales.orderDate": "order_date",
}

def query_database_semantic_layer(
    query: SemanticQuery,
    org_id: Optional[str] = None,
    dataset_id: Optional[str] = None
) -> list[dict[str, Any]]:
    """
    Direct governed semantic query execution on PostgreSQL.
    Enforces tenant isolation, active dataset scoping, SQL parameterization, and approved metrics/dimensions only.
    """
    conn = get_db_connection()
    try:
        cur = conn.cursor()

        # Build SELECT clause
        select_parts = []
        group_by_parts = []

        for dim in query.dimensions:
            sql_col = DIMENSION_SQL_MAP.get(dim, "product")
            select_parts.append(f"{sql_col} AS \"{dim}\"")
            group_by_parts.append(sql_col)

        for meas in query.measures:
            sql_expr = MEASURE_SQL_MAP.get(meas, "ROUND(SUM(revenue), 2)")
            select_parts.append(f"{sql_expr} AS \"{meas}\"")

        if not select_parts:
            select_parts = ["ROUND(SUM(revenue), 2) AS \"Sales.revenue\""]

        # Build WHERE clause
        where_clauses = []
        params = []

        table_name = "raw_sales"
        effective_dataset = dataset_id or query.dataset_id

        if org_id:
            # If dataset_id was not explicitly passed, read active_dataset_id from organizations
            if not effective_dataset:
                try:
                    cur.execute("SELECT active_dataset_id FROM organizations WHERE id = %s", (org_id,))
                    org_row = cur.fetchone()
                    if org_row and org_row[0]:
                        effective_dataset = org_row[0]
                except Exception:
                    pass

            if effective_dataset == "all":
                cur.execute("SELECT COUNT(*) FROM tenant_sales WHERE org_id = %s", (org_id,))
                cnt = cur.fetchone()[0]
                if cnt > 0:
                    table_name = "tenant_sales"
                    where_clauses.append("org_id = %s")
                    params.append(org_id)
            elif effective_dataset == "ds_demo_corporate":
                cur.execute("SELECT COUNT(*) FROM tenant_sales WHERE org_id = %s AND dataset_id = 'ds_demo_corporate'", (org_id,))
                cnt = cur.fetchone()[0]
                if cnt > 0:
                    table_name = "tenant_sales"
                    where_clauses.append("org_id = %s AND dataset_id = %s")
                    params.extend([org_id, "ds_demo_corporate"])
                else:
                    table_name = "raw_sales"
            elif effective_dataset:
                table_name = "tenant_sales"
                where_clauses.append("org_id = %s AND dataset_id = %s")
                params.extend([org_id, effective_dataset])
            else:
                cur.execute("SELECT COUNT(*) FROM tenant_sales WHERE org_id = %s", (org_id,))
                cnt = cur.fetchone()[0]
                if cnt > 0:
                    table_name = "tenant_sales"
                    where_clauses.append("org_id = %s")
                    params.append(org_id)

        # Filters
        for field, val in (query.filters or {}).items():
            sql_col = DIMENSION_SQL_MAP.get(field)
            if sql_col:
                where_clauses.append(f"{sql_col} = %s")
                params.append(str(val))

        # Time range filter (anchored to dataset latest date if available)
        ref_date = None
        if query.time_range:
            try:
                base_where = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""
                cur.execute(f"SELECT MAX(order_date) FROM {table_name} {base_where}", tuple(params))
                max_row = cur.fetchone()
                if max_row and max_row[0]:
                    ref_val = max_row[0]
                    if hasattr(ref_val, "date"):
                        ref_date = ref_val.date()
                    elif isinstance(ref_val, str):
                        from datetime import datetime
                        ref_date = datetime.strptime(ref_val[:10], "%Y-%m-%d").date()
                    else:
                        ref_date = ref_val
            except Exception:
                ref_date = None

        dr = get_date_range(query.time_range, reference_date=ref_date)
        if dr and len(dr) == 2:
            where_clauses.append("order_date >= %s AND order_date <= %s")
            params.extend([dr[0], dr[1]])

        where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""
        group_by_sql = ("GROUP BY " + ", ".join(group_by_parts)) if group_by_parts else ""

        # ORDER BY
        order_col = "1"
        if query.measures:
            order_col = f"\"{query.measures[0]}\""
        order_dir = query.order_direction.upper() if query.order_direction in ["asc", "desc"] else "DESC"
        order_sql = f"ORDER BY {order_col} {order_dir}"

        limit_sql = f"LIMIT {int(query.limit)}" if query.limit and query.limit > 0 else "LIMIT 50"

        sql = f"""
            SELECT {', '.join(select_parts)}
            FROM {table_name}
            {where_sql}
            {group_by_sql}
            {order_sql}
            {limit_sql};
        """

        cur.execute(sql, tuple(params))
        cols = [desc[0] for desc in cur.description]
        rows = cur.fetchall()

        results = []
        for r in rows:
            row_dict = {}
            for col, val in zip(cols, r):
                if val is None:
                    row_dict[col] = None
                else:
                    try:
                        row_dict[col] = float(val)
                    except (ValueError, TypeError):
                        row_dict[col] = str(val)
            results.append(row_dict)

        return results

    finally:
        conn.close()


def execute_governed_query(
    query: SemanticQuery,
    org_id: Optional[str] = None,
    dataset_id: Optional[str] = None
) -> list[dict[str, Any]]:
    """
    Execute semantic query with automatic fallback from Cube.js to PostgreSQL semantic layer.
    """
    effective_org = org_id or query.org_id
    effective_dataset = dataset_id or query.dataset_id
    try:
        # If specific dataset or tenant is requested, use direct governed PostgreSQL semantic layer for strict scoping
        if effective_org or effective_dataset:
            return query_database_semantic_layer(query, org_id=effective_org, dataset_id=effective_dataset)
        return query_semantic_layer(query)
    except Exception:
        # Fallback to direct governed PostgreSQL semantic layer
        return query_database_semantic_layer(query, org_id=effective_org, dataset_id=effective_dataset)
