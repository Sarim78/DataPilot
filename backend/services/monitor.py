"""
Pipeline health helpers. Expects a `Database` from `request.app.state.db` (no global client).

Collection layout matches `routes/pipelines.py` and `db/mongo.py`.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from pymongo.database import Database

from db.mongo import COL_PIPELINES, COL_RUNS


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _parse_pipeline_id(pipeline_id: str) -> ObjectId | None:
    try:
        return ObjectId(pipeline_id)
    except (InvalidId, TypeError):
        return None


def get_pipeline_health(db: Database[Any], pipeline_id: str) -> dict[str, Any]:
    """Latest run for a pipeline (by ObjectId), as a simple dict for callers."""
    oid = _parse_pipeline_id(pipeline_id)
    if oid is None:
        return {"pipeline_id": pipeline_id, "status": "invalid id"}

    p = db[COL_PIPELINES].find_one({"_id": oid})
    if not p:
        return {"pipeline_id": pipeline_id, "status": "pipeline not found"}

    last_run = db[COL_RUNS].find_one({"pipeline_id": oid}, sort=[("started_at", -1)])
    if not last_run:
        return {"pipeline_id": pipeline_id, "pipeline_name": p.get("name"), "status": "no runs found"}

    return {
        "pipeline_id": pipeline_id,
        "pipeline_name": p.get("name"),
        "status": last_run.get("status"),
        "last_run_started_at": last_run.get("started_at"),
        "error_message": last_run.get("error_message"),
        "rows_processed": last_run.get("rows_processed"),
    }


def get_recent_failures(db: Database[Any], hours: int = 24) -> list[dict[str, Any]]:
    """Runs with status `failed` since `hours` ago."""
    since = _utcnow() - timedelta(hours=hours)
    return list(
        db[COL_RUNS].find(
            {
                "status": "failed",
                "started_at": {"$gte": since},
            }
        )
    )


def get_all_pipeline_statuses(db: Database[Any]) -> list[dict[str, Any]]:
    """One health summary dict per pipeline document."""
    statuses: list[dict[str, Any]] = []
    for p in db[COL_PIPELINES].find({}):
        pid = str(p["_id"])
        statuses.append(get_pipeline_health(db, pid))
    return statuses
