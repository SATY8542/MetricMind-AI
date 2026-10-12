# MetricMind AI — Semantic BI & Analytics Platform

MetricMind AI is a full-stack, conversational Business Intelligence (BI) engine powered by **Next.js**, **Cube**, **dbt**, **PostgreSQL**, and **FastAPI**.

---

## 1. Architecture Overview

```
                      ┌───────────────────────────────────────┐
                      │    Next.js UI (Port 3000)             │
                      │    - Conversational Analytics Chat    │
                      │    - ECharts Dynamic Visualizations   │
                      │    - API & Genuine SQL Inspector      │
                      └──────────────────┬────────────────────┘
                                         │ POST /api/analytics
                                         ▼
                      ┌───────────────────────────────────────┐
                      │    Next.js Analytics API Proxy        │
                      │    - Validates query shape & limits   │
                      │    - Allow-lists measures/dimensions  │
                      └──────────────────┬────────────────────┘
                                         │ POST /cubejs-api/v1/load & /sql
                                         ▼
                      ┌───────────────────────────────────────┐
                      │    Cube Semantic Layer (Port 4000)    │
                      │    - model/Sales.js Semantic Model    │
                      │    - CubeStore Aggregation Cache      │
                      └──────────────────┬────────────────────┘
                                         │ SQL Queries
                                         ▼
                      ┌───────────────────────────────────────┐
                      │    PostgreSQL Database (Port 5432)    │
                      │    - public.stg_raw_sales             │
                      │    - public.sales_summary             │
                      └──────────────────▲────────────────────┘
                                         │
                                         │ dbt run / dbt test
                      ┌──────────────────┴────────────────────┐
                      │    metricmind_dbt (dbt Core)          │
                      │    - Staging views & Mart aggregations│
                      └───────────────────────────────────────┘

                      ┌───────────────────────────────────────┐
                      │    FastAPI Backend (Port 8000)        │
                      │    - Direct CSV analytics API         │
                      │    - Interactive Swagger docs (/docs) │
                      └───────────────────────────────────────┘
```

---

## 2. Prerequisites & Port Allocation

| Service | Port | Directory | Required Prerequisite |
| :--- | :--- | :--- | :--- |
| **PostgreSQL** | `5432` | System Service / Local | Must be running with database `metricmind` |
| **dbt transformations** | N/A | `metricmind_dbt/` | Runs on-demand to refresh views/models |
| **Cube Server** | `4000` | `cube/` | PostgreSQL on `5432` |
| **FastAPI Backend** | `8000` | `backend/` | Python virtual environment `.venv` |
| **Next.js Frontend** | `3000` | `frontend/` | Node.js, Cube on `4000` |

---

## 3. End-to-End Startup Procedure (Windows PowerShell)

Run each service in a separate Windows PowerShell terminal window in the following order:

### Terminal 1: PostgreSQL
Verify that PostgreSQL is running on port 5432:
```powershell
Get-NetTCPConnection -LocalPort 5432 -State Listen
```
If not running, start the PostgreSQL Windows service:
```powershell
Start-Service postgresql*
```

---

### Terminal 2: dbt Transformations (On-Demand Data Refresh)
When refreshing database views or running constraint tests:
```powershell
cd "C:\Users\HP Victus\Desktop\MetricMind_AI\metricmind_dbt"
& "..\.venv\Scripts\dbt.exe" debug
& "..\.venv\Scripts\dbt.exe" run
& "..\.venv\Scripts\dbt.exe" test
```

---

### Terminal 3: Cube Semantic Layer (Port 4000)
```powershell
cd "C:\Users\HP Victus\Desktop\MetricMind_AI\cube"
npm run dev
```
- **Port:** `http://localhost:4000`
- **Metadata Endpoint:** `http://localhost:4000/cubejs-api/v1/meta`
- **Query Load Endpoint:** `http://localhost:4000/cubejs-api/v1/load`

---

### Terminal 4: FastAPI Backend (Port 8000)
```powershell
cd "C:\Users\HP Victus\Desktop\MetricMind_AI"
& ".\.venv\Scripts\uvicorn.exe" backend.main:app --host 127.0.0.1 --port 8000 --reload
```
- **Port:** `http://127.0.0.1:8000`
- **Interactive Swagger Docs:** `http://127.0.0.1:8000/docs`

---

### Terminal 5: Next.js Frontend (Port 3000)
```powershell
cd "C:\Users\HP Victus\Desktop\MetricMind_AI\frontend"
npm run dev
```
- **Port:** `http://localhost:3000`
- **Analytics Proxy Route:** `http://localhost:3000/api/analytics`

---

## 4. Verification & Testing

### Running Frontend Checks & Build
```powershell
cd "C:\Users\HP Victus\Desktop\MetricMind_AI\frontend"
npm run lint
npx tsc --noEmit
npm run build
```

### Running Backend Unit Tests
```powershell
cd "C:\Users\HP Victus\Desktop\MetricMind_AI"
& ".\.venv\Scripts\python.exe" -m unittest backend/test_main.py
```

### Testing the Analytics API Proxy
```powershell
$body = @{ query = @{ measures = @("Sales.totalRevenue", "Sales.totalProfit") } } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3000/api/analytics" -Method Post -ContentType "application/json" -Body $body
```

---

## 5. Supported Natural-Language Query Types

The chat interface translates natural-language queries into validated Cube queries:

- **Overall Business Summary:** "Show me the overall business summary"
- **Quarterly Performance:** "How did Q3 revenue perform?", "Q1 sales summary"
- **Yearly Performance:** "Show me 2024 performance", "2025 revenue"
- **Combined Period Filters:** "2024 Q3 performance"
- **Regional Comparison:** "Show me regional performance", "Regional comparison"
- **Specific Region Filter:** "Show me European sales", "North America sales"
- **Product Performance:** "Show me product performance", "Server sales"
- **Channel Performance:** "Show me sales channel performance", "Online channel"
- **Country Analysis:** "Top countries by revenue", "USA performance"
- **Cost & Profit Analysis:** "Show me cost and profit summary"
- **Unsupported Dimensions (e.g. Month):** Handled gracefully with explanatory guidance.