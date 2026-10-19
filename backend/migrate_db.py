"""
Database migration and multi-tenant schema setup for MetricMind AI.
Creates organizations, users, tenant sales records, alerts, and usage tracking tables.
"""

import os
import hashlib
import psycopg2
from dotenv import load_dotenv
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
load_dotenv(PROJECT_ROOT / ".env")

def get_db():
    return psycopg2.connect(
        host=os.getenv("PGHOST", "localhost"),
        port=os.getenv("PGPORT", "5432"),
        dbname=os.getenv("PGDATABASE", "metricmind"),
        user=os.getenv("PGUSER", "metricmind"),
        password=os.getenv("PGPASSWORD", "Password11"),
        connect_timeout=10,
    )

def hash_password(password: str) -> str:
    salt = "metricmind_salt_2026"
    return hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000
    ).hex()

def run_migrations():
    conn = get_db()
    conn.autocommit = True
    cur = conn.cursor()

    print("Running database migrations...")

    # 1. Organizations table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS organizations (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(128) UNIQUE NOT NULL,
        plan VARCHAR(32) NOT NULL DEFAULT 'starter',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 2. Users table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        org_id VARCHAR(64) REFERENCES organizations(id) ON DELETE CASCADE,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        role VARCHAR(32) NOT NULL DEFAULT 'viewer',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 3. Datasets table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS imported_datasets (
        id VARCHAR(64) PRIMARY KEY,
        org_id VARCHAR(64) REFERENCES organizations(id) ON DELETE CASCADE,
        filename VARCHAR(255) NOT NULL,
        row_count INT NOT NULL DEFAULT 0,
        columns JSONB NOT NULL DEFAULT '[]'::jsonb,
        status VARCHAR(32) NOT NULL DEFAULT 'ready',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 4. Multi-tenant sales table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS tenant_sales (
        id BIGSERIAL PRIMARY KEY,
        org_id VARCHAR(64) REFERENCES organizations(id) ON DELETE CASCADE,
        order_id VARCHAR(64) NOT NULL,
        order_date DATE NOT NULL,
        year INT NOT NULL,
        quarter VARCHAR(16) NOT NULL,
        month VARCHAR(16) NOT NULL,
        region VARCHAR(128) NOT NULL,
        country VARCHAR(128) NOT NULL,
        product VARCHAR(128) NOT NULL,
        channel VARCHAR(128) NOT NULL,
        units_sold INT NOT NULL,
        unit_price NUMERIC(12, 2) NOT NULL,
        revenue NUMERIC(14, 2) NOT NULL,
        material_cost NUMERIC(14, 2) NOT NULL,
        shipping_cost NUMERIC(14, 2) NOT NULL,
        labor_cost NUMERIC(14, 2) NOT NULL,
        marketing_cost NUMERIC(14, 2) NOT NULL,
        total_cost NUMERIC(14, 2) NOT NULL,
        profit NUMERIC(14, 2) NOT NULL,
        margin_percent NUMERIC(6, 2) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_tenant_sales_org_date ON tenant_sales(org_id, order_date);
    CREATE INDEX IF NOT EXISTS idx_tenant_sales_org_region ON tenant_sales(org_id, region);
    CREATE INDEX IF NOT EXISTS idx_tenant_sales_org_product ON tenant_sales(org_id, product);
    """)

    # 5. Alerts configuration
    cur.execute("""
    CREATE TABLE IF NOT EXISTS alerts_config (
        id VARCHAR(64) PRIMARY KEY,
        org_id VARCHAR(64) REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        metric VARCHAR(64) NOT NULL,
        condition VARCHAR(64) NOT NULL,
        threshold NUMERIC(14, 2) NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 6. Alerts history
    cur.execute("""
    CREATE TABLE IF NOT EXISTS alerts_history (
        id VARCHAR(64) PRIMARY KEY,
        org_id VARCHAR(64) REFERENCES organizations(id) ON DELETE CASCADE,
        alert_id VARCHAR(64),
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        severity VARCHAR(32) NOT NULL DEFAULT 'info',
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 7. Usage tracking
    cur.execute("""
    CREATE TABLE IF NOT EXISTS usage_tracking (
        id VARCHAR(64) PRIMARY KEY,
        org_id VARCHAR(64) REFERENCES organizations(id) ON DELETE CASCADE,
        month_year VARCHAR(16) NOT NULL,
        ai_queries_count INT NOT NULL DEFAULT 0,
        imports_count INT NOT NULL DEFAULT 0,
        reports_count INT NOT NULL DEFAULT 0,
        UNIQUE (org_id, month_year)
    );
    """)

    # 8. Audit logs
    cur.execute("""
    CREATE TABLE IF NOT EXISTS audit_logs (
        id BIGSERIAL PRIMARY KEY,
        org_id VARCHAR(64),
        user_id VARCHAR(64),
        action VARCHAR(128) NOT NULL,
        details JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 9. Seed default demo organization & demo user
    demo_org_id = "org_metricmind_demo"
    cur.execute("""
    INSERT INTO organizations (id, name, slug, plan)
    VALUES (%s, %s, %s, %s)
    ON CONFLICT (id) DO UPDATE SET plan = 'pro';
    """, (demo_org_id, "MetricMind Demo Corp", "demo-corp", "pro"))

    demo_user_id = "usr_demo_owner"
    demo_email = "demo@metricmind.ai"
    pwd_hash = hash_password("DemoUser123!")

    cur.execute("""
    INSERT INTO users (id, org_id, email, password_hash, full_name, role)
    VALUES (%s, %s, %s, %s, %s, %s)
    ON CONFLICT (email) DO UPDATE SET password_hash = %s, role = 'owner';
    """, (demo_user_id, demo_org_id, demo_email, pwd_hash, "Satyendra Demo Owner", "owner", pwd_hash))

    # Also seed a standard analyst user
    analyst_user_id = "usr_demo_analyst"
    analyst_email = "analyst@metricmind.ai"
    analyst_pwd = hash_password("Analyst123!")
    cur.execute("""
    INSERT INTO users (id, org_id, email, password_hash, full_name, role)
    VALUES (%s, %s, %s, %s, %s, %s)
    ON CONFLICT (email) DO UPDATE SET password_hash = %s, role = 'analyst';
    """, (analyst_user_id, demo_org_id, analyst_email, analyst_pwd, "Priya Analytics Lead", "analyst", analyst_pwd))

    # 10. Populate tenant_sales for demo org if empty
    cur.execute("SELECT COUNT(*) FROM tenant_sales WHERE org_id = %s", (demo_org_id,))
    existing_count = cur.fetchone()[0]

    if existing_count == 0:
        print("Populating initial tenant_sales from raw_sales for demo organization...")
        cur.execute("""
        INSERT INTO tenant_sales (
            org_id, order_id, order_date, year, quarter, month,
            region, country, product, channel, units_sold, unit_price,
            revenue, material_cost, shipping_cost, labor_cost, marketing_cost,
            total_cost, profit, margin_percent
        )
        SELECT
            %s, order_id, order_date, year, quarter, month,
            region, country, product, channel, units_sold, unit_price,
            revenue, material_cost, shipping_cost, labor_cost, marketing_cost,
            total_cost, profit, margin_percent
        FROM raw_sales;
        """, (demo_org_id,))
        print("Inserted demo records into tenant_sales.")

    # 11. Seed default alerts config
    alerts = [
        ("alt_rev_drop", demo_org_id, "Significant Revenue Decline", "revenue_decline", "greater_than", 15.0),
        ("alt_cost_spike", demo_org_id, "Unusual Cost Spike", "cost_increase", "greater_than", 20.0),
        ("alt_margin_floor", demo_org_id, "Profit Margin Below Threshold", "margin_floor", "less_than", 25.0),
    ]
    for alt in alerts:
        cur.execute("""
        INSERT INTO alerts_config (id, org_id, name, metric, condition, threshold, is_active)
        VALUES (%s, %s, %s, %s, %s, %s, TRUE)
        ON CONFLICT (id) DO NOTHING;
        """, alt)

    # 12. Seed sample alert history
    sample_alerts = [
        ("ah_01", demo_org_id, "alt_rev_drop", "Revenue Dip in Latin America", "Q3 sales in Brazil dropped by 16.4% compared to Q2 expectation.", "warning"),
        ("ah_02", demo_org_id, "alt_margin_floor", "Retail Channel Margin Warning", "Margin fell to 22.8% on Monitor sales in Retail channel.", "critical"),
        ("ah_03", demo_org_id, None, "Positive Momentum: Server Growth", "Enterprise Server revenue grew +24.8% quarter-over-quarter.", "info"),
    ]
    for sa in sample_alerts:
        cur.execute("""
        INSERT INTO alerts_history (id, org_id, alert_id, title, message, severity)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (id) DO NOTHING;
        """, sa)

    conn.close()
    print("Migrations completed successfully!")

if __name__ == "__main__":
    run_migrations()
