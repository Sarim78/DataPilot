from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


class PipelineRun(BaseModel):
    pipeline_name: str
    status: Literal["success", "failed", "running", "skipped"]
    started_at: datetime
    finished_at: Optional[datetime] = None
    duration_seconds: Optional[float] = None
    records_processed: Optional[int] = None
    error_message: Optional[str] = None
    stage_failed: Optional[str] = None


class Pipeline(BaseModel):
    name: str
    description: str
    source: str
    destination: str
    schedule: str
    last_run: Optional[PipelineRun] = None


class IncidentReport(BaseModel):
    pipeline_name: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    summary: str
    root_cause: Optional[str] = None
    suggested_fix: Optional[str] = None
    severity: Literal["low", "medium", "high", "critical"]