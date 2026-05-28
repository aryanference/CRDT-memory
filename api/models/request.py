"""Pydantic v2 request schemas for the PCCM API."""

from typing import Optional
from pydantic import BaseModel, Field


class IngestEventRequest(BaseModel):
    agent_id: str
    session_id: Optional[str] = None
    event_type: str = "observation"  # "tool_call" | "observation" | "llm_response" | "error"
    content: str
    causal_parent_ids: list[str] = []
    edge_type_to_parents: str = "causes"
    metadata: dict[str, str] = {}


class QueryRequest(BaseModel):
    query_text: str
    agent_id: str
    semantic_threshold: float = Field(default=0.75, ge=0.0, le=1.0)
    max_nodes: int = Field(default=100, ge=1, le=500)
    time_window_days: int = Field(default=7, ge=1, le=365)
    query_time_center_ms: Optional[int] = None  # None = current time
    include_lateral_inhibition: bool = True
