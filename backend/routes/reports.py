"""
Incident report endpoints and auto-generation from failed runs.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Annotated, Any

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from pymongo.database import Database

from routes.pipelines import COL_PIPELINES, COL_RUNS, RunStatus, get_mongo_db

router = APIRouter()

COL_REPORTS = "incident_reports"


class ReportSeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class IncidentReportBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    summary: str = Field(..., min_length=1, max_length=8000)
    severity: ReportSeverity = ReportSeverity.MEDIUM
    pipeline_id: str
    run_id: str | None = None
    details: dict[str, Any] = Field(default_factory=dict)


class IncidentReportCreate(IncidentReportBase):
    pass


class IncidentReport(IncidentReportBase):
    id: str
    created_at: datetime


MongoDb = Annotated[Database[Any], Depends(get_mongo_db)]


def _oid(s: str) -> ObjectId:
    try:
        return ObjectId(s)
    except (InvalidId, TypeError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid id") from e


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _doc_to_report(doc: dict[str, Any]) -> IncidentReport:
    return IncidentReport(
        id=str(doc["_id"]),
        title=doc["title"],
        summary=doc["summary"],
        severity=ReportSeverity(doc["severity"]),
        pipeline_id=str(doc["pipeline_id"]),
        run_id=str(doc["run_id"]) if doc.get("run_id") else None,
        details=doc.get("details") or {},
        created_at=doc["created_at"],
    )


def _severity_for_run(error_message: str | None) -> ReportSeverity:
    if not error_message:
        return ReportSeverity.MEDIUM
    lowered = error_message.lower()
    if any(k in lowered for k in ("timeout", "connection refused", "503", "unavailable")):
        return ReportSeverity.HIGH
    if any(k in lowered for k in ("permission", "auth", "forbidden", "401", "403")):
        return ReportSeverity.HIGH
    return ReportSeverity.MEDIUM


def _build_summary(pipeline_name: str, error_message: str | None, rows_processed: int | None) -> str:
    parts = [
        f"Pipeline: {pipeline_name}",
        f"Error: {error_message or 'No error message captured.'}",
    ]
    if rows_processed is not None:
        parts.append(f"Rows processed before failure: {rows_processed}")
    parts.append("This report was generated automatically by Datapilot (template).")
    return "\n".join(parts)


def _create_report_for_failed_run(
    db: Database[Any],
    *,
    pipeline_id: str,
    run_id: str,
    pipeline_name: str,
) -> IncidentReport | None:
    try:
        run_oid = ObjectId(run_id)
        pipe_oid = ObjectId(pipeline_id)
    except Exception:
        return None

    run = db[COL_RUNS].find_one({"_id": run_oid, "pipeline_id": pipe_oid})
    if not run or run.get("status") != RunStatus.FAILED.value:
        return None

    existing = db[COL_REPORTS].find_one({"run_id": run_oid})
    if existing:
        return _doc_to_report(existing)

    err = run.get("error_message")
    rows = run.get("rows_processed")
    sev = _severity_for_run(err)
    title = f"[{pipeline_name}] Run failed"
    summary = _build_summary(pipeline_name, err, rows)
    doc = {
        "title": title,
        "summary": summary,
        "severity": sev.value,
        "pipeline_id": pipe_oid,
        "run_id": run_oid,
        "details": {"source": "auto", "run_status": RunStatus.FAILED.value},
        "created_at": _utcnow(),
    }
    res = db[COL_REPORTS].insert_one(doc)
    stored = db[COL_REPORTS].find_one({"_id": res.inserted_id})
    assert stored is not None
    return _doc_to_report(stored)


@router.get("", response_model=list[IncidentReport])
def list_reports(
    db: MongoDb,
    pipeline_id: str | None = None,
    limit: int = 50,
) -> list[IncidentReport]:
    q: dict[str, Any] = {}
    if pipeline_id:
        q["pipeline_id"] = _oid(pipeline_id)
    cur = db[COL_REPORTS].find(q).sort("created_at", -1).limit(min(limit, 200))
    return [_doc_to_report(d) for d in cur]


@router.get("/{report_id}", response_model=IncidentReport)
def get_report(report_id: str, db: MongoDb) -> IncidentReport:
    doc = db[COL_REPORTS].find_one({"_id": _oid(report_id)})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    return _doc_to_report(doc)


@router.post("", response_model=IncidentReport, status_code=status.HTTP_201_CREATED)
def create_report(body: IncidentReportCreate, db: MongoDb) -> IncidentReport:
    _oid(body.pipeline_id)
    run_oid: ObjectId | None = None
    if body.run_id:
        run_oid = _oid(body.run_id)
    doc = {
        "title": body.title,
        "summary": body.summary,
        "severity": body.severity.value,
        "pipeline_id": _oid(body.pipeline_id),
        "run_id": run_oid,
        "details": body.details,
        "created_at": _utcnow(),
    }
    res = db[COL_REPORTS].insert_one(doc)
    stored = db[COL_REPORTS].find_one({"_id": res.inserted_id})
    assert stored is not None
    return _doc_to_report(stored)


@router.post(
    "/generate-from-failures/{pipeline_id}",
    response_model=list[IncidentReport],
    summary="Create incident reports for recent failed runs that do not yet have one",
)
def generate_reports_from_failures(pipeline_id: str, db: MongoDb) -> list[IncidentReport]:
    """Idempotent batch: skips runs that already have a linked report."""
    p_oid = _oid(pipeline_id)
    p = db[COL_PIPELINES].find_one({"_id": p_oid})
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pipeline not found")
    pipeline_name = p.get("name", "(unnamed)")

    created: list[IncidentReport] = []
    cur = (
        db[COL_RUNS]
        .find({"pipeline_id": p_oid, "status": RunStatus.FAILED.value})
        .sort("started_at", -1)
        .limit(25)
    )
    for run in cur:
        run_oid = run["_id"]
        if db[COL_REPORTS].find_one({"run_id": run_oid}):
            continue
        rep = _create_report_for_failed_run(
            db,
            pipeline_id=pipeline_id,
            run_id=str(run_oid),
            pipeline_name=pipeline_name,
        )
        if rep:
            created.append(rep)
    return created
