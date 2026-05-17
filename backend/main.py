"""
Datapilot FastAPI entrypoint.

Run from the `backend/` directory:

    uvicorn main:app --reload

Environment variables (see repo `.env.example`):

    MONGODB_URI       — required
    MONGODB_DB_NAME   — optional, default `datapilot`
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pymongo import MongoClient
from pymongo.errors import PyMongoError, ServerSelectionTimeoutError

from config import Settings
from db.mongo import ensure_indexes
from routes import pipelines, reports

logger = logging.getLogger(__name__)

# Local dev + Vercel preview/production frontends.
_CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
_CORS_ORIGIN_REGEX = r"https://.*\.vercel\.app"

_MONGO_TIMEOUT_MS = 5_000


def _connect_mongodb(settings: Settings) -> tuple[MongoClient[Any] | None, Any | None, bool]:
    """Return (client, database, connected). Does not raise on connection failure."""
    client: MongoClient[Any] | None = None
    try:
        client = MongoClient(
            settings.mongodb_uri,
            serverSelectionTimeoutMS=_MONGO_TIMEOUT_MS,
            connectTimeoutMS=_MONGO_TIMEOUT_MS,
        )
        client.admin.command("ping")
        db = client[settings.mongodb_db_name]
        ensure_indexes(db)
        logger.info("Connected to MongoDB database %r", settings.mongodb_db_name)
        return client, db, True
    except (ServerSelectionTimeoutError, PyMongoError, OSError) as exc:
        logger.warning("MongoDB unavailable at startup: %s", exc)
        if client is not None:
            client.close()
        return None, None, False


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = Settings()
    client, db, mongo_connected = _connect_mongodb(settings)
    app.state.settings = settings
    app.state.mongo_client = client
    app.state.db = db
    app.state.mongo_connected = mongo_connected
    yield
    if client is not None:
        client.close()


app = FastAPI(
    title="Datapilot API",
    description="Pipeline monitoring backend (Week 1).",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_origin_regex=_CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pipelines.router, prefix="/api/pipelines", tags=["pipelines"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])


class AgentMessage(BaseModel):
    message: str = Field(..., min_length=1, max_length=8000)


class AgentReply(BaseModel):
    reply: str


@app.post("/api/agent", response_model=AgentReply, tags=["agent"])
def agent_stub(body: AgentMessage) -> AgentReply:
    """Temporary stub until the ADK agent is wired to HTTP."""
    snippet = body.message.strip()
    if len(snippet) > 280:
        snippet = snippet[:277] + "…"
    return AgentReply(
        reply=(
            "Datapilot agent (stub): received your message. "
            "When the live agent is connected, I will answer about pipelines and incidents. "
            f"You asked: {snippet!r}"
        )
    )


@app.get("/health")
def health_check(request: Request) -> dict[str, str]:
    """Liveness probe for deploy targets."""
    mongo_connected = bool(getattr(request.app.state, "mongo_connected", False))
    return {
        "status": "ok" if mongo_connected else "degraded",
        "mongodb": "connected" if mongo_connected else "unavailable",
    }
