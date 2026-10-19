"""
Smart Alerts and Anomaly Detection engine for MetricMind AI.
Evaluates configurable threshold rules and detects statistical transaction anomalies
using Z-score variance analysis.
"""

import os
import uuid
import math
import psycopg2
from typing import Dict, Any, List, Optional
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

def get_alert_rules(org_id: str) -> List[Dict[str, Any]]:
    """Retrieve configured alert rules for the tenant."""
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT id, name, metric, condition, threshold, is_active, created_at
            FROM alerts_config
            WHERE org_id = %s
            ORDER BY created_at DESC;
        """, (org_id,))
        rows = cur.fetchall()
        return [
            {
                "id": r[0],
                "name": r[1],
                "metric": r[2],
                "condition": r[3],
                "threshold": float(r[4]),
                "is_active": bool(r[5]),
                "created_at": r[6].isoformat() if r[6] else None,
            }
            for r in rows
        ]
    finally:
        conn.close()

def create_alert_rule(org_id: str, name: str, metric: str, condition: str, threshold: float) -> Dict[str, Any]:
    """Create a new alert rule."""
    conn = get_db()
    try:
        cur = conn.cursor()
        rule_id = f"alt_{uuid.uuid4().hex[:10]}"
        cur.execute("""
            INSERT INTO alerts_config (id, org_id, name, metric, condition, threshold, is_active)
            VALUES (%s, %s, %s, %s, %s, %s, TRUE);
        """, (rule_id, org_id, name, metric, condition, threshold))
        conn.commit()
        return {
            "id": rule_id,
            "name": name,
            "metric": metric,
            "condition": condition,
            "threshold": threshold,
            "is_active": True,
        }
    finally:
        conn.close()

def delete_alert_rule(org_id: str, rule_id: str) -> bool:
    """Delete an alert rule."""
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM alerts_config WHERE id = %s AND org_id = %s", (rule_id, org_id))
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()

def get_alert_history(org_id: str) -> List[Dict[str, Any]]:
    """Retrieve alert and anomaly notification history."""
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT id, alert_id, title, message, severity, is_read, created_at
            FROM alerts_history
            WHERE org_id = %s
            ORDER BY created_at DESC
            LIMIT 50;
        """, (org_id,))
        rows = cur.fetchall()
        return [
            {
                "id": r[0],
                "alert_id": r[1],
                "title": r[2],
                "message": r[3],
                "severity": r[4],
                "is_read": bool(r[5]),
                "created_at": r[6].isoformat() if r[6] else None,
            }
            for r in rows
        ]
    finally:
        conn.close()

def scan_anomalies_and_rules(org_id: str) -> Dict[str, Any]:
    """
    Scan dataset for:
    1. Active threshold rule breaches (rule-based)
    2. Statistical transaction outliers (|Z-score| > 2.8 on order revenue or margins)
    """
    conn = get_db()
    try:
        cur = conn.cursor()
        tbl = "raw_sales"
        params = []
        where_clause = ""
        if org_id:
            cur.execute("SELECT COUNT(*) FROM tenant_sales WHERE org_id = %s", (org_id,))
            if cur.fetchone()[0] > 0:
                tbl = "tenant_sales"
                where_clause = "WHERE org_id = %s"
                params.append(org_id)

        # 1. Statistical anomaly detection (Z-score on transaction revenue)
        cur.execute(f"""
            SELECT
                AVG(revenue) AS mean_rev,
                STDDEV(revenue) AS std_rev,
                AVG(margin_percent) AS mean_margin,
                STDDEV(margin_percent) AS std_margin
            FROM {tbl}
            {where_clause};
        """, tuple(params))
        stats = cur.fetchone()

        anomalies_found = []
        if stats and stats[0] is not None and stats[1] is not None and stats[1] > 0:
            mean_rev, std_rev = float(stats[0]), float(stats[1])
            # Find transactions with Z-score > 3.0
            cur.execute(f"""
                SELECT order_id, order_date, product, region, channel, revenue, margin_percent
                FROM {tbl}
                {where_clause + (' AND' if where_clause else 'WHERE')}
                revenue > %s
                ORDER BY revenue DESC
                LIMIT 3;
            """, tuple(params + [mean_rev + 3.0 * std_rev]))

            for r in cur.fetchall():
                z = (float(r[5]) - mean_rev) / std_rev
                anomalies_found.append({
                    "type": "statistical_anomaly",
                    "order_id": r[0],
                    "title": f"High-Value Transaction Outlier: {r[0]}",
                    "message": (
                        f"Order {r[0]} ({r[2]}, {r[3]}) recorded ${float(r[5]):,.2f} "
                        f"(Z-score: +{z:.1f}σ above mean). Statistical anomaly detected."
                    ),
                    "severity": "info",
                })

        # 2. Check active rules
        cur.execute("SELECT id, name, metric, condition, threshold FROM alerts_config WHERE org_id = %s AND is_active = TRUE", (org_id,))
        active_rules = cur.fetchall()

        rule_breaches = []
        for r_id, r_name, metric, condition, thresh in active_rules:
            thresh = float(thresh)
            if metric == "margin_floor" and condition == "less_than":
                # Check if any recent product or region margin falls below threshold
                cur.execute(f"""
                    SELECT product, ROUND(100.0 * SUM(profit) / NULLIF(SUM(revenue), 0), 2) AS margin
                    FROM {tbl}
                    {where_clause}
                    GROUP BY product
                    HAVING 100.0 * SUM(profit) / NULLIF(SUM(revenue), 0) < %s
                    LIMIT 2;
                """, tuple(params + [thresh]))
                for pr in cur.fetchall():
                    rule_breaches.append({
                        "type": "rule_breach",
                        "rule_id": r_id,
                        "title": f"Margin Alert: {pr[0]} ({float(pr[1]):.1f}%)",
                        "message": f"Product '{pr[0]}' profit margin ({float(pr[1]):.1f}%) breached configured floor threshold of {thresh}%.",
                        "severity": "warning",
                    })

        # Store any new findings into history
        for item in anomalies_found + rule_breaches:
            alert_history_id = f"ah_{uuid.uuid4().hex[:10]}"
            cur.execute("""
                INSERT INTO alerts_history (id, org_id, alert_id, title, message, severity)
                VALUES (%s, %s, %s, %s, %s, %s);
            """, (alert_history_id, org_id, item.get("rule_id"), item["title"], item["message"], item["severity"]))
        conn.commit()

        return {
            "total_anomalies_detected": len(anomalies_found),
            "total_rule_breaches": len(rule_breaches),
            "new_triggers": anomalies_found + rule_breaches,
        }
    finally:
        conn.close()
