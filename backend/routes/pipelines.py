"""
REST endpoints for pipelines and their runs.

Uses `request.app.state.db` (set in `main.lifespan`). Collection names come from `db.mongo` (same as `data/seed.py`).
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Annotated, Any

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pymongo.errors import DuplicateKeyError
from pydantic import BaseModel, Field
from pymongo.database import Database

from db.mongo import COL_PIPELINES, COL_REPORTS, COL_RUNS

router = APIRouter()


# --- enums & models (Week 1; keep aligned with agent / future frontend) ---


class RunStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    CANCELLED = "cancelled"


class HealthStatus(str, Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    DOWN = "down"
    UNKNOWN = "unknown"


class PipelineBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    owner: str | None = Field(default=None, max_length=200)
    schedule_cron: str | None = Field(default=None, max_length=120)
    enabled: bool = True


class PipelineCreate(PipelineBase):
    pass


class PipelineUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    owner: str | None = None
    schedule_cron: str | None = None
    enabled: bool | None = None


class Pipeline(PipelineBase):
    id: str
    created_at: datetime
    updated_at: datetime


class PipelineRunBase(BaseModel):
    status: RunStatus = RunStatus.PENDING
    started_at: datetime | None = None
    finished_at: datetime | None = None
    rows_processed: int | None = Field(default=None, ge=0)
    error_message: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class PipelineRunCreate(PipelineRunBase):
    pass


class PipelineRun(PipelineRunBase):
    id: str
    pipeline_id: str


class PipelineHealth(BaseModel):
    pipeline_id: str
    pipeline_name: str
    health: HealthStatus
    last_run: PipelineRun | None = None
    recent_failure_count: int = 0
    notes: str | None = None


# --- DB access ---


def get_mongo_db(request: Request) -> Database[Any]:
    return request.app.state.db


MongoDb = Annotated[Database[Any], Depends(get_mongo_db)]


def _oid(s: str) -> ObjectId:
    try:
        return ObjectId(s)
    except (InvalidId, TypeError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid id") from e


def _pipeline_doc_to_model(doc: dict[str, Any]) -> Pipeline:
    return Pipeline(
        id=str(doc["_id"]),
        name=doc["name"],
        description=doc.get("description"),
        owner=doc.get("owner"),
        schedule_cron=doc.get("schedule_cron"),
        enabled=bool(doc.get("enabled", True)),
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )


def _run_doc_to_model(doc: dict[str, Any]) -> PipelineRun:
    raw_pid = doc.get("pipeline_id")
    return PipelineRun(
        id=str(doc["_id"]),
        pipeline_id=str(raw_pid) if raw_pid is not None else "",
        status=RunStatus(doc["status"]),
        started_at=doc.get("started_at"),
        finished_at=doc.get("finished_at"),
        rows_processed=doc.get("rows_processed"),
        error_message=doc.get("error_message"),
        metadata=doc.get("metadata") or {},
    )


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _to_utc_aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _get_recent_runs(db: Database[Any], pipeline_id: str, limit: int = 20) -> list[PipelineRun]:
    oid = _oid(pipeline_id)
    cur = db[COL_RUNS].find({"pipeline_id": oid}).sort("started_at", -1).limit(limit)
    return [_run_doc_to_model(d) for d in cur]


def _compute_health(
    pipeline_id: str,
    pipeline_name: str,
    runs: list[PipelineRun],
    *,
    window_hours: int = 48,
) -> PipelineHealth:
    now = _utcnow()
    window_start = now - timedelta(hours=window_hours)

    if not runs:
        return PipelineHealth(
            pipeline_id=pipeline_id,
            pipeline_name=pipeline_name,
            health=HealthStatus.UNKNOWN,
            last_run=None,
            recent_failure_count=0,
            notes="No runs recorded yet.",
        )

    last = runs[0]
    in_window: list[PipelineRun] = []
    for r in runs:
        st = _to_utc_aware(r.started_at)
        if st is not None and st >= window_start:
            in_window.append(r)

    failures = [r for r in in_window if r.status == RunStatus.FAILED]
    recent_failure_count = len(failures)

    if last.status == RunStatus.FAILED:
        health = HealthStatus.DOWN
        notes = "Most recent run failed."
    elif last.status == RunStatus.RUNNING:
        health = HealthStatus.DEGRADED
        notes = "A run is currently in progress."
    elif last.status == RunStatus.SUCCESS:
        if recent_failure_count > 0:
            health = HealthStatus.DEGRADED
            notes = "Last run succeeded but failures occurred in the observation window."
        else:
            health = HealthStatus.HEALTHY
            notes = "Recent runs look healthy."
    elif last.status == RunStatus.PENDING:
        health = HealthStatus.UNKNOWN
        notes = "Last recorded run is still pending."
    elif last.status == RunStatus.CANCELLED:
        health = HealthStatus.DEGRADED
        notes = "Most recent run was cancelled."
    else:
        health = HealthStatus.UNKNOWN
        notes = "Not enough signal from last run status."

    return PipelineHealth(
        pipeline_id=pipeline_id,
        pipeline_name=pipeline_name,
        health=health,
        last_run=last,
        recent_failure_count=recent_failure_count,
        notes=notes,
    )


# --- routes ---


@router.post("", response_model=Pipeline, status_code=status.HTTP_201_CREATED)
def create_pipeline(body: PipelineCreate, db: MongoDb) -> Pipeline:
    now = _utcnow()
    doc = {
        "name": body.name,
        "description": body.description,
        "owner": body.owner,
        "schedule_cron": body.schedule_cron,
        "enabled": body.enabled,
        "created_at": now,
        "updated_at": now,
    }
    try:
        res = db[COL_PIPELINES].insert_one(doc)
    except DuplicateKeyError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Pipeline name already exists.",
        ) from e
    stored = db[COL_PIPELINES].find_one({"_id": res.inserted_id})
    assert stored is not None
    return _pipeline_doc_to_model(stored)


@router.get("", response_model=list[Pipeline])
def list_pipelines(db: MongoDb, enabled_only: bool = False) -> list[Pipeline]:
    q: dict[str, Any] = {}
    if enabled_only:
        q["enabled"] = True
    return [_pipeline_doc_to_model(d) for d in db[COL_PIPELINES].find(q).sort("name", 1)]


@router.get("/{pipeline_id}", response_model=Pipeline)
def get_pipeline(pipeline_id: str, db: MongoDb) -> Pipeline:
    doc = db[COL_PIPELINES].find_one({"_id": _oid(pipeline_id)})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pipeline not found")
    return _pipeline_doc_to_model(doc)


@router.patch("/{pipeline_id}", response_model=Pipeline)
def update_pipeline(pipeline_id: str, body: PipelineUpdate, db: MongoDb) -> Pipeline:
    oid = _oid(pipeline_id)
    updates: dict[str, Any] = {k: v for k, v in body.model_dump(exclude_unset=True).items()}
    if not updates:
        doc = db[COL_PIPELINES].find_one({"_id": oid})
        if not doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pipeline not found")
        return _pipeline_doc_to_model(doc)
    updates["updated_at"] = _utcnow()
    res = db[COL_PIPELINES].update_one({"_id": oid}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pipeline not found")
    doc = db[COL_PIPELINES].find_one({"_id": oid})
    assert doc is not None
    return _pipeline_doc_to_model(doc)


@router.delete("/{pipeline_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_pipeline(pipeline_id: str, db: MongoDb) -> Response:
    oid = _oid(pipeline_id)
    db[COL_RUNS].delete_many({"pipeline_id": oid})
    db[COL_REPORTS].delete_many({"pipeline_id": oid})
    res = db[COL_PIPELINES].delete_one({"_id": oid})
    if res.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pipeline not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{pipeline_id}/runs", response_model=PipelineRun, status_code=status.HTTP_201_CREATED)
def create_run(pipeline_id: str, body: PipelineRunCreate, db: MongoDb) -> PipelineRun:
    p_oid = _oid(pipeline_id)
    if not db[COL_PIPELINES].find_one({"_id": p_oid}):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pipeline not found")
    doc = body.model_dump()
    doc["pipeline_id"] = p_oid
    doc["status"] = doc["status"].value if isinstance(doc["status"], RunStatus) else doc["status"]
    res = db[COL_RUNS].insert_one(doc)
    stored = db[COL_RUNS].find_one({"_id": res.inserted_id})
    assert stored is not None
    return _run_doc_to_model(stored)


@router.get("/{pipeline_id}/runs", response_model=list[PipelineRun])
def list_runs(pipeline_id: str, db: MongoDb, limit: int = 50) -> list[PipelineRun]:
    oid = _oid(pipeline_id)
    if not db[COL_PIPELINES].find_one({"_id": oid}):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pipeline not found")
    return _get_recent_runs(db, pipeline_id, limit=min(limit, 200))


@router.get("/{pipeline_id}/health", response_model=PipelineHealth)
def pipeline_health(pipeline_id: str, db: MongoDb) -> PipelineHealth:
    oid = _oid(pipeline_id)
    p = db[COL_PIPELINES].find_one({"_id": oid})
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pipeline not found")
    name = p.get("name", "(unnamed)")
    runs = _get_recent_runs(db, pipeline_id, limit=20)
    return _compute_health(pipeline_id, name, runs)
