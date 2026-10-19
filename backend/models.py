"""
Pydantic schemas and contracts for MetricMind AI SaaS backend.
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

# ----------------- Auth Schemas -----------------
class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str
    organization_name: str
    role: Optional[str] = "owner"

class LoginRequest(BaseModel):
    email: str
    password: str

class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]
    organization: Dict[str, Any]

class UserInviteRequest(BaseModel):
    email: str
    full_name: str
    role: str = "viewer"
    password: Optional[str] = "MetricMind2026!"

# ----------------- Analytics & KPI Schemas -----------------
class KPIOverview(BaseModel):
    total_revenue: float
    total_profit: float
    total_costs: float
    profit_margin_percent: float
    total_orders: int
    units_sold: int
    average_order_value: float
    # Period growth comparisons
    revenue_growth_percent: Optional[float] = None
    profit_growth_percent: Optional[float] = None
    orders_growth_percent: Optional[float] = None
    active_dataset: Optional[Dict[str, Any]] = None

class TrendsResponse(BaseModel):
    monthly_trend: List[Dict[str, Any]]
    quarterly_comparison: List[Dict[str, Any]]
    revenue_vs_costs: List[Dict[str, Any]]
    active_dataset: Optional[Dict[str, Any]] = None

class BreakdownResponse(BaseModel):
    top_products: List[Dict[str, Any]]
    underperforming_products: List[Dict[str, Any]]
    regional_performance: List[Dict[str, Any]]
    sales_by_channel: List[Dict[str, Any]]
    active_dataset: Optional[Dict[str, Any]] = None

# ----------------- AI Query Schemas -----------------
class AIChatRequest(BaseModel):
    question: str
    filters: Optional[Dict[str, Any]] = None
    time_range: Optional[str] = None
    dataset_id: Optional[str] = None

class ActiveDatasetRequest(BaseModel):
    dataset_id: str

# ----------------- Data Import Schemas -----------------
class ColumnMapping(BaseModel):
    source_column: str
    target_field: str

class ImportConfirmRequest(BaseModel):
    file_id: str
    filename: str
    column_mappings: List[ColumnMapping]

# ----------------- Forecasting Schemas -----------------
class ForecastResponse(BaseModel):
    metric: str
    horizon_months: int
    historical: List[Dict[str, Any]]
    forecast: List[Dict[str, Any]]
    evaluation: Dict[str, Any]
    disclaimer: str

# ----------------- Alerts Schemas -----------------
class AlertRuleCreate(BaseModel):
    name: str
    metric: str
    condition: str
    threshold: float
