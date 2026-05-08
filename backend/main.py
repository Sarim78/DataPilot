"""
Datapilot FastAPI entrypoint.

Run from the `backend/` directory:

    uvicorn main:app --reload

Environment variables (see repo `.env.example`):

    MONGODB_URI       — required
    MONGODB_DB_NAME   — optional, default `datapilot`
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic_settings import BaseSettings, SettingsConfigDict
from pymongo import MongoClient
from pymongo.database import Database

from routes import pipelines, reports


class Settings(BaseSettings):
    """Loads from environment and optional `.env` next to this file or repo root."""

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    mongodb_uri: str
    mongodb_db_name: str = "datapilot"


# Collection names (keep in sync with routes + data/seed.py)
COL_PIPELINES = "pipelines"
COL_RUNS = "pipeline_runs"
COL_REPORTS = "incident_reports"


def ensure_indexes(db: Database[Any]) -> None:
    """Idempotent indexes for local dev."""
    db[COL_PIPELINES].create_index("name", unique=True)
    db[COL_RUNS].create_index([("pipeline_id", 1), ("started_at", -1)])
    db[COL_REPORTS].create_index([("pipeline_id", 1), ("created_at", -1)])
    db[COL_REPORTS].create_index("run_id", unique=True, sparse=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = Settings()
    client: MongoClient[Any] = MongoClient(settings.mongodb_uri)
    db = client[settings.mongodb_db_name]
    app.state.mongo_client = client
    app.state.db = db
    ensure_indexes(db)
    yield
    client.close()


app = FastAPI(
    title="Datapilot API",
    description="Pipeline monitoring backend (Week 1).",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pipelines.router, prefix="/api/pipelines", tags=["pipelines"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])


@app.get("/health")
def health_check() -> dict[str, str]:
    """Liveness probe for deploy targets."""
    return {"status": "ok"}
