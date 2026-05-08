"""
Seed MongoDB with sample pipelines and runs for local development.

Run from the repository root (loads `.env` from root):

    python data/seed.py

Requires `MONGODB_URI` and optional `MONGODB_DB_NAME` (default `datapilot`).
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(ROOT / ".env")

from bson import ObjectId  # noqa: E402
from pymongo import MongoClient  # noqa: E402

COL_PIPELINES = "pipelines"
COL_RUNS = "pipeline_runs"
COL_REPORTS = "incident_reports"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def main() -> None:
    uri = os.environ.get("MONGODB_URI")
    if not uri:
        raise SystemExit("MONGODB_URI is not set. Copy .env.example to .env and configure MongoDB.")

    db_name = os.environ.get("MONGODB_DB_NAME", "datapilot")
    client = MongoClient(uri)
    db = client[db_name]

    # Idempotent dev seed: drop previous demo docs tagged by seed tag
    db[COL_PIPELINES].delete_many({"metadata.seed": "datapilot-demo"})
    db[COL_RUNS].delete_many({"metadata.seed": "datapilot-demo"})
    db[COL_REPORTS].delete_many({"details.seed": "datapilot-demo"})

    now = _utcnow()
    pipelines = [
        {
            "name": "Sales Ingest — Daily",
            "description": "Loads CRM export into warehouse staging.",
            "owner": "data-platform",
            "schedule_cron": "0 6 * * *",
            "enabled": True,
            "created_at": now,
            "updated_at": now,
            "metadata": {"seed": "datapilot-demo"},
        },
        {
            "name": "Product Analytics — Hourly",
            "description": "Event stream rollup for product dashboards.",
            "owner": "analytics",
            "schedule_cron": "15 * * * *",
            "enabled": True,
            "created_at": now,
            "updated_at": now,
            "metadata": {"seed": "datapilot-demo"},
        },
    ]
    p_ids: list[ObjectId] = []
    for doc in pipelines:
        p_ids.append(db[COL_PIPELINES].insert_one(doc).inserted_id)

    p0, p1 = p_ids

    runs = [
        {
            "pipeline_id": p0,
            "status": "success",
            "started_at": now - timedelta(days=1),
            "finished_at": now - timedelta(days=1) + timedelta(minutes=12),
            "rows_processed": 125_000,
            "error_message": None,
            "metadata": {"seed": "datapilot-demo"},
        },
        {
            "pipeline_id": p0,
            "status": "failed",
            "started_at": now - timedelta(hours=8),
            "finished_at": now - timedelta(hours=8) + timedelta(minutes=3),
            "rows_processed": 4_200,
            "error_message": "Connection refused to warehouse host db-warehouse:5432",
            "metadata": {"seed": "datapilot-demo"},
        },
        {
            "pipeline_id": p1,
            "status": "running",
            "started_at": now - timedelta(minutes=20),
            "finished_at": None,
            "rows_processed": None,
            "error_message": None,
            "metadata": {"seed": "datapilot-demo"},
        },
    ]
    for r in runs:
        db[COL_RUNS].insert_one(r)

    print(f"Seeded database {db_name!r}: {len(pipelines)} pipelines, {len(runs)} runs.")
    print(f"  pipeline ids: {p0}, {p1}")
    client.close()


if __name__ == "__main__":
    main()
