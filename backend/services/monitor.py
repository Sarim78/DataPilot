from db.mongo import runs_collection, pipelines_collection
from datetime import datetime, timedelta


def get_pipeline_health(pipeline_name: str) -> dict:
    last_run = runs_collection.find_one(
        {"pipeline_name": pipeline_name},
        sort=[("started_at", -1)]
    )

    if not last_run:
        return {"pipeline_name": pipeline_name, "status": "no runs found"}

    return {
        "pipeline_name": pipeline_name,
        "status": last_run.get("status"),
        "last_run": last_run.get("started_at"),
        "error_message": last_run.get("error_message"),
        "stage_failed": last_run.get("stage_failed"),
    }


def get_recent_failures(hours: int = 24) -> list:
    since = datetime.utcnow() - timedelta(hours=hours)
    failures = runs_collection.find({
        "status": "failed",
        "started_at": {"$gte": since}
    })
    return list(failures)


def get_all_pipeline_statuses() -> list:
    pipelines = pipelines_collection.find()
    statuses = []
    for p in pipelines:
        health = get_pipeline_health(p["name"])
        statuses.append(health)
    return statuses