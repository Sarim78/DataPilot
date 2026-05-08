"""
Incident report helpers using a passed-in `Database` (same as routes / lifespan).

Writes to `COL_REPORTS` with the same shape as `routes/reports.py`.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from pymongo.database import Database

from db.mongo import COL_PIPELINES, COL_REPORTS, COL_RUNS
from services.monitor import get_recent_failures


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def create_incident_report(
    db: Database[Any],
    *,
    pipeline_id: str,
    pipeline_name: str,
    run: dict[str, Any],
) -> dict[str, Any]:
    """Insert one incident report document aligned with the API schema."""
    pipe_oid = ObjectId(pipeline_id)
    run_oid = run["_id"]
    if not isinstance(run_oid, ObjectId):
        run_oid = ObjectId(run_oid)

    doc = {
        "title": f"[{pipeline_name}] Run failed",
        "summary": (
            f"Pipeline: {pipeline_name}\n"
            f"Error: {run.get('error_message') or 'No error message captured.'}"
        ),
        "severity": "high" if run.get("error_message") else "medium",
        "pipeline_id": pipe_oid,
        "run_id": run_oid,
        "details": {"source": "services.reporter"},
        "created_at": _utcnow(),
    }
    res = db[COL_REPORTS].insert_one(doc)
    doc["_id"] = res.inserted_id
    return doc


def get_reports(db: Database[Any], pipeline_id: str | None = None) -> list[dict[str, Any]]:
    query: dict[str, Any] = {}
    if pipeline_id:
        try:
            query["pipeline_id"] = ObjectId(pipeline_id)
        except Exception:
            return []
    return list(db[COL_REPORTS].find(query).sort("created_at", -1))


def ensure_reports_for_recent_failures(db: Database[Any]) -> list[dict[str, Any]]:
    """Create reports for recent failed runs that do not already have a report for that `run_id`."""
    failures = get_recent_failures(db)
    new_reports: list[dict[str, Any]] = []
    for run in failures:
        run_oid = run["_id"]
        if db[COL_REPORTS].find_one({"run_id": run_oid}):
            continue
        pipe_oid = run.get("pipeline_id")
        if not isinstance(pipe_oid, ObjectId):
            continue
        p = db[COL_PIPELINES].find_one({"_id": pipe_oid})
        pipeline_name = p.get("name", "(unnamed)") if p else "(unknown)"
        new_reports.append(
            create_incident_report(
                db,
                pipeline_id=str(pipe_oid),
                pipeline_name=pipeline_name,
                run=run,
            )
        )
    return new_reports
