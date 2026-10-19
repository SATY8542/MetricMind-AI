# MetricMind AI — Enterprise Semantic Business Intelligence SaaS Platform

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI_0.143-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js_16.3-black?logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/UI-React_19.2-blue?logo=react)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL_16-336791?logo=postgresql)](https://www.postgresql.org)
[![dbt](https://img.shields.io/badge/Data_Marts-dbt_1.10-FF694B?logo=dbt)](https://www.getdbt.com)
[![Cube](https://img.shields.io/badge/Semantic_Layer-Cube.js_1.7-5C5CFF?logo=cube)](https://cube.dev)
[![License](https://img.shields.io/badge/License-Proprietary-red)](#)

MetricMind AI is a production-grade, multi-tier Semantic Business Intelligence (BI) and AI-powered Analytics SaaS platform. It combines governed data transformations (**dbt**), a semantic metrics abstraction layer (**Cube.js**), high-performance **PostgreSQL** relational warehousing, an autonomous natural language query engine (**English & Hindi**), statistical **forecasting**, real-time **anomaly detection**, **CSV/Excel data ingestion**, and automated **PDF & Excel executive report exports**.

---

## 1. System Architecture

```mermaid
graph TD
    Client["Next.js 16 + React 19 Frontend<br/>(Tailwind CSS v4 · Apache ECharts 6.1)"]
    API["FastAPI 0.143 Gateway<br/>(JWT Auth · RBAC · Tenant Scoping)"]
    SemanticAgent["Autonomous AI Assistant<br/>(English & Hindi NLP · Intent Parser · Reasoning Engine)"]
    Cube["Cube.js Semantic Layer<br/>(Port 4000 · Governed Code-First Metrics)"]
    Postgres[("PostgreSQL 16 Warehousing<br/>(Port 5432 · Multi-tenant Schema)")]
    dbt["dbt Transformation Pipeline<br/>(staging views & sales_summary mart)"]

    Client -->|REST & Bearer JWT| API
    API -->|Governed Query Dispatch| SemanticAgent
    SemanticAgent -->|REST /load| Cube
    Cube -->|SQL Execution| Postgres
    SemanticAgent -.->|Direct Governed Fallback| Postgres
    dbt -->|Transformations| Postgres
    API -->|Tenant Ingestion & Analytics| Postgres
```

---

## 2. Key Modules & Implemented Features

### 1. Executive Business Intelligence Dashboard
- **7 Governed KPI Cards**: Total Revenue, Total Net Profit, Total Operational Costs, Profit Margin %, Total Orders, Units Sold, and Average Order Value (AOV).
- **Interactive ECharts 6.1 Visualizations**:
  - Revenue & Profit monthly trends over time.
  - Revenue vs Operational Costs comparison.
  - Top 5 performing products ranked by revenue & margin.
  - Regional geographic sales distribution.
  - Sales by Channel (Enterprise, Online, Retail, Direct).
  - Underperforming margin alert table.
- **Dynamic Filter Controls**: Year, Quarter, and Region selectors with zero business-logic fabrication.

### 2. Multilingual AI Business Assistant (English & Hindi)
- Natural language query parsing supporting:
  - Measures: Revenue, profit, margin, costs, orders, units sold.
  - Dimensions: Products, regions, channels, countries, months, quarters, years.
  - Intent recognition: Rankings (highest, top 5, lowest), comparisons (month-over-month, quarter-over-quarter), and trends.
  - Multilingual support for Hindi/Hinglish inquiries:
    - *"Is mahine sabse zyada profit kis product se hua?"*
    - *"Pichhle mahine ke comparison mein sales kitni badhi?"*
    - *"Kaun se region mein profit margin sabse kam hai?"*
- Generates data-grounded insights, dynamic ECharts specs, and toggleable "View Semantic Query" and "View Governed SQL" audit cards.

### 3. CSV and Excel Data Ingestion Pipeline
- Drag-and-drop file upload (`.csv`, `.xlsx`, `.xls` up to 50MB).
- File structure inspection: detects rows, columns, duplicate Order IDs, and infers column types (`string`, `number`, `date`).
- Interactive column mapping interface matching source columns to standard business fields.
- Recalculates financial formulas: `Revenue = Units Sold * Unit Price`, `Total Cost = Material + Shipping + Labor + Marketing`, `Profit = Revenue - Total Cost`, `Margin % = (Profit / Revenue) * 100`.
- Ingests into isolated tenant storage (`tenant_sales`) and immediately refreshes dashboard analytics.

### 4. Automated Business Reports
- Generates weekly, monthly, quarterly, and annual executive summaries.
- One-click export to styled **Excel (`.xlsx`)** spreadsheets with KPI summaries and product breakdowns.
- One-click export to authoritative printable **PDF (`.pdf`)** reports via ReportLab with generation timestamps.

### 5. Sales Forecasting Engine
- Statistical time-series forecasting using Holt's Linear Exponential Smoothing.
- Configurable forecasting horizons: 1, 3, 6, and 12 months ahead.
- Displays actual historical baseline, projected forecast trajectory, and upper/lower **95% confidence intervals**.
- Provides evaluation accuracy metrics: MAE, RMSE, and MAPE %.
- Includes standard statistical disclaimer.

### 6. Smart Alerts & Anomaly Detection
- Statistical transaction anomaly detection using Z-score 3-sigma variance analysis.
- User-configurable threshold alert rules (e.g., margin floor breach, revenue decline, cost spike).
- Alert notification history with severity badges (`Critical`, `Warning`, `Info`).

### 7. Multi-Tenant SaaS Foundations
- JWT Bearer authentication and cryptographic password hashing (PBKDF2-HMAC-SHA256).
- Role-Based Access Control (RBAC): `Owner`, `Admin`, `Analyst`, `Viewer`.
- Multi-tenant data isolation (`organizations`, `users`, `tenant_sales`, `usage_tracking`).
- Configurable subscription plans: **Free Starter** ($0), **Small Business** ($49), **Business Pro** ($149).
- Monthly usage tracking for AI queries, imports, and reports.

---

## 3. Getting Started & Local Execution

### Prerequisites
- Python 3.10+
- Node.js v20+ & npm
- PostgreSQL 14+ running locally on port 5432

### Step 1: Environment Setup
Ensure root `.env` exists (copied from `.env.example`):
```env
APP_ENV=development
PORT=8000
API_BASE_URL=http://localhost:8000
DATABASE_URL=postgresql://metricmind:Password11@localhost:5432/metricmind
PGHOST=localhost
PGPORT=5432
PGDATABASE=metricmind
PGUSER=metricmind
PGPASSWORD=Password11
SECRET_KEY=metricmind-super-secure-jwt-secret-key-2026
CUBE_API_URL=http://localhost:4000/cubejs-api/v1/load
```

### Step 2: Database Setup & Migrations
Run the multi-tenant migration script to initialize schema and seed demo records:
```bash
python backend/migrate_db.py
```

### Step 3: Run dbt Data Transformation Models
```bash
cd metricmind_dbt
dbt run
dbt test
cd ..
```

### Step 4: Start Backend API (FastAPI)
```bash
cd backend
uvicorn main:app --reload --port 8000
```
Interactive Swagger documentation is available at: [http://localhost:8000/docs](http://localhost:8000/docs)

### Step 5: Start Frontend (Next.js)
```bash
cd frontend
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 4. Automated Testing & Verification

Run the automated test suites:

```bash
# 1. Test AI Assistant NLP, Parser, Reasoning & Semantic layer (17 tests)
python -m unittest discover -s ai_agentllm

# 2. Test Backend APIs, Auth, KPIs, Reports, Forecasting & Alerts (12 tests)
python -m unittest discover -s backend

# 3. Test dbt data mart models and integrity constraints
cd metricmind_dbt && dbt test && cd ..

# 4. Verify Next.js production build and TypeScript compilation
cd frontend && npm run build && cd ..
```

**Verification Results:**
- `ai_agentllm`: 17 passed (0 failures)
- `backend`: 12 passed (0 failures)
- `dbt`: 2 data tests passed (0 failures)
- `frontend`: Compiled successfully with Next.js Turbopack and TypeScript in zero errors.

---

## 5. Pre-Configured Demo Credentials

| Role | Email | Password | Organization |
| :--- | :--- | :--- | :--- |
| **Owner** | `demo@metricmind.ai` | `DemoUser123!` | MetricMind Demo Corp (Pro Plan) |
| **Analyst** | `analyst@metricmind.ai` | `Analyst123!` | MetricMind Demo Corp |
