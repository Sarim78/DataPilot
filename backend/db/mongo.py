"""
MongoDB helpers aligned with `main.py` lifespan: no global client.

The app attaches `pymongo.database.Database` to `request.app.state.db`.
This module only defines collection names and idempotent index creation.
"""

from __future__ import annotations

from typing import Any

from pymongo.database import Database

# Must match `data/seed.py` and any code that reads/writes these collections.
COL_PIPELINES = "pipelines"
COL_RUNS = "pipeline_runs"
COL_REPORTS = "incident_reports"


def ensure_indexes(db: Database[Any]) -> None:
    """Create indexes idempotently (safe on every app startup)."""
    db[COL_PIPELINES].create_index("name", unique=True)
    db[COL_RUNS].create_index([("pipeline_id", 1), ("started_at", -1)])
    db[COL_REPORTS].create_index([("pipeline_id", 1), ("created_at", -1)])
    db[COL_REPORTS].create_index("run_id", unique=True, sparse=True)
