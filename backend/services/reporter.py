from db.mongo import reports_collection, runs_collection
from datetime import datetime


def create_incident_report(pipeline_name: str, run: dict) -> dict:
    report = {
        "pipeline_name": pipeline_name,
        "created_at": datetime.utcnow(),
        "summary": f"Pipeline {pipeline_name} failed at stage: {run.get('stage_failed', 'unknown')}",
        "root_cause": run.get("error_message", "Unknown error"),
        "suggested_fix": "Check logs and verify source connection",
        "severity": "high" if run.get("stage_failed") else "medium",
    }
    reports_collection.insert_one(report)
    return report


def get_reports(pipeline_name: str = None) -> list:
    query = {}
    if pipeline_name:
        query["pipeline_name"] = pipeline_name
    return list(reports_collection.find(query))


def ensure_reports_for_recent_failures() -> list:
    from services.monitor import get_recent_failures
    failures = get_recent_failures()
    new_reports = []
    for run in failures:
        existing = reports_collection.find_one({
            "pipeline_name": run["pipeline_name"],
            "created_at": {"$gte": run["started_at"]}
        })
        if not existing:
            report = create_incident_report(run["pipeline_name"], run)
            new_reports.append(report)
    return new_reports