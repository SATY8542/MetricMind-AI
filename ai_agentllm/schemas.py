from typing import Any, Optional
from pydantic import BaseModel, Field

class SemanticQuery(BaseModel):
    """Schema for querying the Cube / PostgreSQL semantic data layer."""

    measures: list[str] = Field(default_factory=list)
    dimensions: list[str] = Field(default_factory=list)
    filters: dict[str, Any] = Field(default_factory=dict)
    time_range: Optional[str] = None
    comparison_period: Optional[str] = None
    order_by: Optional[str] = None
    order_direction: str = "desc"
    limit: Optional[int] = None
    language: str = "en"
    question_intent: str = "summary"
    org_id: Optional[str] = None
    dataset_id: Optional[str] = None

class AIQueryResponse(BaseModel):
    """Structured response from the AI Business Assistant."""

    question: str
    language: str = "en"
    semantic_query: SemanticQuery
    data: list[dict[str, Any]] = Field(default_factory=list)
    summary_text: str
    chart_config: Optional[dict[str, Any]] = None
    comparison: Optional[dict[str, Any]] = None
    filters_applied: dict[str, Any] = Field(default_factory=dict)
    time_range_applied: Optional[str] = None
    is_data_sufficient: bool = True
