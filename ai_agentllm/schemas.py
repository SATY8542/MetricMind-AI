
from typing import Any, Optional

from pydantic import BaseModel, Field


class SemanticQuery(BaseModel):
    """Schema for querying the Cube semantic data layer."""

    measures: list[str] = Field(default_factory=list)
    dimensions: list[str] = Field(default_factory=list)
    filters: dict[str, Any] = Field(default_factory=dict)
    time_range: Optional[str] = None
